(() => {
  const TRAIL_COUNT = 2;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  let controller;
  let destroyed = false;

  const canRun = () => !reduceMotionQuery.matches && pointerQuery.matches;
  const isMouse = (event) => !event.pointerType || event.pointerType === "mouse";
  const sourceFrom = (event) => event.composedPath?.()[0] ?? event.srcElement;
  const isTextSource = (source) => Boolean(source?.closest?.("input, textarea, [contenteditable]") ?? source?.matches?.("input, textarea, [contenteditable]"));

  function createLayer() {
    const layer = document.createElement("div");
    layer.id = "moon-scale-cursor";
    layer.setAttribute("aria-hidden", "true");
    const ripples = Array.from({ length: 2 }, (_, index) => {
      const ripple = document.createElement("span");
      ripple.className = `moon-scale-ripple-arc${index ? " moon-scale-ripple-arc-secondary" : ""}`;
      layer.append(ripple);
      return ripple;
    });
    const trails = Array.from({ length: TRAIL_COUNT }, (_, index) => {
      const trail = document.createElementNS(SVG_NAMESPACE, "svg");
      trail.setAttribute("class", `moon-scale-trail${index ? " moon-scale-trail-gold" : ""}`);
      trail.setAttribute("width", index ? "14" : "22");
      trail.setAttribute("height", index ? "8" : "10");
      trail.setAttribute("viewBox", "0 0 28 12");
      trail.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(SVG_NAMESPACE, "path");
      path.setAttribute("d", index ? "M 3 8 C 9 2 17 3 24 6" : "M 2 7 C 8 1 18 2 26 5");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", index ? "rgba(225, 194, 139, .46)" : "rgba(185, 225, 244, .52)");
      path.setAttribute("stroke-width", "1");
      path.setAttribute("stroke-linecap", "round");
      trail.append(path);
      layer.append(trail);
      return trail;
    });
    document.body.append(layer);
    return {
      layer,
      ripple: ripples[0],
      ripples,
      trails,
      frame: null,
      pageActive: true,
      pageVisible: document.visibilityState !== "hidden",
      selecting: false,
      textInput: false,
      pointer: { x: 0, y: 0, known: false },
      positions: Array.from({ length: TRAIL_COUNT }, () => ({ x: 0, y: 0 })),
      listeners: [],
    };
  }

  function shouldDecorate(state) {
    return state.pageActive && state.pageVisible && state.pointer.known && !state.selecting && !state.textInput;
  }

  function stopFrame(state) {
    if (state.frame === null) return;
    window.cancelAnimationFrame(state.frame);
    state.frame = null;
  }

  function ensureFrame(state) {
    if (state.frame !== null || !shouldDecorate(state)) return;
    state.frame = window.requestAnimationFrame(render);
  }

  function syncVisibility(state) {
    const visible = shouldDecorate(state);
    state.layer.classList.toggle("is-visible", visible);
    document.documentElement.dataset.moonScaleCursor = String(visible);
    if (visible) ensureFrame(state);
    else stopFrame(state);
  }

  function updatePointer(state, event) {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    if (!state.pointer.known) {
      state.positions.forEach((position) => Object.assign(position, { x: event.clientX, y: event.clientY }));
    }
    state.pointer.known = true;
  }

  function hideForNativeInput(state) {
    state.pointer.known = false;
    state.textInput = false;
    syncVisibility(state);
  }

  function render() {
    if (!controller) return;
    const state = controller;
    state.frame = null;
    if (!shouldDecorate(state)) return;
    state.trails.forEach((trail, index) => {
      const position = state.positions[index];
      const easing = index === 0 ? .44 : .3;
      position.x += (state.pointer.x - position.x) * easing;
      position.y += (state.pointer.y - position.y) * easing;
      if (Math.abs(state.pointer.x - position.x) < .5) position.x = state.pointer.x;
      if (Math.abs(state.pointer.y - position.y) < .5) position.y = state.pointer.y;
      trail.style.setProperty("--moon-trail-x", `${position.x}px`);
      trail.style.setProperty("--moon-trail-y", `${position.y}px`);
    });
    ensureFrame(state);
  }

  function setup() {
    if (!canRun()) return undefined;
    const state = createLayer();
    const listen = (owner, type, handler) => {
      owner.addEventListener(type, handler, { passive: true });
      state.listeners.push({ owner, type, handler });
    };
    listen(document, "selectionchange", () => {
      state.selecting = Boolean(document.getSelection?.()?.toString());
      document.documentElement.dataset.moonScaleSelecting = String(state.selecting);
      syncVisibility(state);
    });
    listen(document, "pointermove", (event) => {
      if (!isMouse(event)) return hideForNativeInput(state);
      state.textInput = isTextSource(sourceFrom(event));
      updatePointer(state, event);
      syncVisibility(state);
    });
    listen(document, "pointerover", (event) => {
      if (!isMouse(event)) return hideForNativeInput(state);
      state.textInput = isTextSource(sourceFrom(event));
      if (event.relatedTarget === null) updatePointer(state, event);
      syncVisibility(state);
    });
    listen(document, "pointerout", (event) => {
      if (!isMouse(event)) return hideForNativeInput(state);
      if (event.relatedTarget === null) state.pointer.known = false;
      else state.textInput = isTextSource(event.relatedTarget);
      syncVisibility(state);
    });
    listen(document, "pointerdown", (event) => {
      if (!isMouse(event)) return hideForNativeInput(state);
      updatePointer(state, event);
      state.textInput = isTextSource(sourceFrom(event));
      syncVisibility(state);
      if (state.textInput) return;
      state.ripples.forEach((ripple) => ripple.classList.remove("is-rippling"));
      void state.ripple.offsetWidth;
      state.ripples.forEach((ripple) => {
        ripple.style.setProperty("--moon-ripple-x", `${event.clientX}px`);
        ripple.style.setProperty("--moon-ripple-y", `${event.clientY}px`);
        ripple.classList.add("is-rippling");
      });
      ensureFrame(state);
    });
    listen(document, "visibilitychange", () => {
      state.pageVisible = document.visibilityState !== "hidden";
      syncVisibility(state);
    });
    listen(window, "pagehide", () => {
      state.pageActive = false;
      syncVisibility(state);
    });
    listen(window, "pageshow", () => {
      state.pageActive = true;
      syncVisibility(state);
    });
    return state;
  }

  function teardownController() {
    if (controller) {
      stopFrame(controller);
      controller.listeners.forEach(({ owner, type, handler }) => owner.removeEventListener(type, handler));
      controller.layer.remove();
      controller = undefined;
    }
    delete document.documentElement.dataset.moonScaleSelecting;
    document.documentElement.dataset.moonScaleCursor = "false";
  }

  function sync() {
    if (destroyed || !canRun()) {
      teardownController();
      return undefined;
    }
    if (!controller) controller = setup();
    document.documentElement.dataset.moonScaleCursor = String(Boolean(controller && shouldDecorate(controller)));
    return controller;
  }

  function destroy() {
    destroyed = true;
    reduceMotionQuery.removeEventListener("change", sync);
    pointerQuery.removeEventListener("change", sync);
    teardownController();
  }

  window.MoonScaleShoal = { sync, destroy, get controller() { return controller; } };
  reduceMotionQuery.addEventListener("change", sync);
  pointerQuery.addEventListener("change", sync);
  if (document.documentElement.dataset.moonScaleShoal === "true") sync();
})();
