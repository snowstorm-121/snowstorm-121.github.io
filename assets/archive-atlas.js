(() => {
  const root = document.querySelector("[data-atlas-root]");
  if (!root) return;

  const controls = [...document.querySelectorAll("[data-atlas-control]")];
  const routes = [...document.querySelectorAll("[data-atlas-route]")];
  const map = document.querySelector("[data-atlas-map]");
  const title = document.querySelector("[data-atlas-title]:not([data-atlas-control])");
  const count = document.querySelector("[data-atlas-count]:not([data-atlas-control])");
  const meta = document.querySelector("[data-atlas-meta]:not([data-atlas-control])");
  const description = document.querySelector("[data-atlas-description]:not([data-atlas-control])");
  const destination = document.querySelector("[data-atlas-destination]");
  const empty = document.querySelector("[data-atlas-empty]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function selectNode(control) {
    const key = control?.dataset.atlasKey;
    if (!key) return;

    const source = controls.find((candidate) => candidate.dataset.atlasKey === key) ?? control;
    root.dataset.atlasSelected = key;
    controls.forEach((candidate) => {
      const selected = candidate.dataset.atlasKey === key;
      candidate.classList.toggle("is-active", selected);
      candidate.classList.toggle("is-dimmed", !selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    routes.forEach((route) => route.classList.toggle("is-active", route.dataset.atlasRoute === key));

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
      selectNode(control);
    });
  });

  let parallaxEnabled = false;
  function resetParallax() {
    map?.style.setProperty("--atlas-parallax-x", "0px");
    map?.style.setProperty("--atlas-parallax-y", "0px");
  }
  function moveParallax(event) {
    const rect = map?.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 100, height: 100 };
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 10;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 8;
    map.style.setProperty("--atlas-parallax-x", `${x.toFixed(2)}px`);
    map.style.setProperty("--atlas-parallax-y", `${y.toFixed(2)}px`);
  }
  function syncMotion() {
    document.documentElement.dataset.atlasReducedMotion = String(reduceMotionQuery.matches);
    if (!map) return;
    if (reduceMotionQuery.matches) {
      if (parallaxEnabled) {
        map.removeEventListener?.("pointermove", moveParallax);
        map.removeEventListener?.("pointerleave", resetParallax);
        parallaxEnabled = false;
      }
      resetParallax();
      return;
    }
    if (!parallaxEnabled) {
      map.addEventListener("pointermove", moveParallax);
      map.addEventListener("pointerleave", resetParallax);
      parallaxEnabled = true;
    }
  }

  reduceMotionQuery.addEventListener?.("change", syncMotion);
  syncMotion();
  selectNode(controls.find((control) => control.getAttribute("aria-pressed") === "true") ?? controls[0]);

  window.ArchiveAtlas = { selectNode };
})();
