(() => {
  const root = document.querySelector("[data-atlas-root]");
  if (!root) return;

  const controls = [...document.querySelectorAll("[data-atlas-control]")];
  const map = document.querySelector("[data-atlas-map]");
  const title = document.querySelector("[data-atlas-title]:not([data-atlas-control])");
  const count = document.querySelector("[data-atlas-count]:not([data-atlas-control])");
  const meta = document.querySelector("[data-atlas-meta]:not([data-atlas-control])");
  const description = document.querySelector("[data-atlas-description]:not([data-atlas-control])");
  const destination = document.querySelector("[data-atlas-destination]");
  const empty = document.querySelector("[data-atlas-empty]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scheduleDiffusion = typeof setTimeout === "function" ? setTimeout : null;
  const cancelDiffusion = typeof clearTimeout === "function" ? clearTimeout : null;
  let diffusionTimer = null;

  function stopDiffusion() {
    if (diffusionTimer !== null) {
      cancelDiffusion?.(diffusionTimer);
      diffusionTimer = null;
    }
    controls.forEach((control) => control.classList.remove("is-selecting"));
  }

  function diffuseMoonlight(control) {
    if (reduceMotionQuery.matches || !scheduleDiffusion) return;
    stopDiffusion();
    control.classList.add("is-selecting");
    diffusionTimer = scheduleDiffusion(() => {
      control.classList.remove("is-selecting");
      diffusionTimer = null;
    }, 240);
  }

  function selectNode(control, animate = true) {
    const key = control?.dataset.atlasKey;
    if (!key) return "";

    const source = controls.find((candidate) => candidate.dataset.atlasKey === key) ?? control;
    const changed = root.dataset.atlasSelected !== key;
    root.dataset.atlasSelected = key;
    controls.forEach((candidate) => {
      const selected = candidate.dataset.atlasKey === key;
      candidate.classList.toggle("is-active", selected);
      candidate.classList.toggle("is-dimmed", !selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });

    if (title) title.textContent = source.dataset.atlasTitle ?? source.textContent.trim();
    if (count) count.textContent = source.dataset.atlasCount ?? "0 篇";
    if (meta) meta.textContent = source.dataset.atlasMeta ?? "";
    if (description) description.textContent = source.dataset.atlasDescription ?? "";

    const href = source.dataset.atlasHref;
    if (destination) {
      destination.hidden = !href;
      if (href) destination.setAttribute("href", href);
      else destination.removeAttribute("href");
    }
    if (empty) {
      empty.hidden = Boolean(href);
      empty.textContent = "尚待启航";
    }
    if (changed && animate) diffuseMoonlight(source);
    return href ?? "";
  }

  controls.forEach((control) => {
    control.addEventListener("click", () => selectNode(control));
    control.addEventListener("focus", () => selectNode(control));
    control.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") selectNode(control);
    });
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const href = selectNode(control);
      if (href) window.location.assign(href);
    });
  });

  function syncMotion() {
    document.documentElement.dataset.atlasReducedMotion = String(reduceMotionQuery.matches);
    if (reduceMotionQuery.matches) stopDiffusion();
  }

  reduceMotionQuery.addEventListener?.("change", syncMotion);
  syncMotion();
  selectNode(
    controls.find((control) => control.getAttribute("aria-pressed") === "true") ?? controls[0],
    false,
  );

  window.ArchiveAtlas = { selectNode };
})();
