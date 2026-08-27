(() => {
  const TRAIL_COUNT = 2;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  let controller;
  let destroyed = false;

  const now = () => globalThis.performance?.now?.() ?? Date.now();
  const canRun = () => !reduceMotionQuery.matches && pointerQuery.matches;
  const isMouse = (event) => !event.pointerType || event.pointerType === "mouse";
  const sourceFrom = (event) => event.composedPath?.()[0] ?? event.srcElement;
  const isTextSource = (source) => Boolean(source?.closest?.("input, textarea, [contenteditable]") ?? source?.matches?.("input, textarea, [contenteditable]"));

  function createLayer() {
    const layer = document.createElement("div");
    layer.id = "moon-scale-cursor";
    layer.setAttribute("aria-hidden", "true");
    const ripple = document.createElement("span");
    ripple.className = "moon-scale-ripple";
    layer.append(ripple);
    const trails = Array.from({ length: TRAIL_COUNT }, () => {
      const trail = document.createElement("span");
      trail.className = "moon-scale-trail";
      layer.append(trail);
      return trail;
    });
    document.body.append(layer);
    return {
      layer,
      ripple,
      trails,
      frame: 0,
      pageActive: true,
      pageVisible: document.visibilityState !== "hidden",
      selecting: false,
      textInput: false,
      pointer: { x: 0, y: 0, known: false },
      positions: Array.from({ length: TRAIL_COUNT }, () => ({ x: 0, y: 0 })),
      rippleUntil: 0,
      listeners: [],
    };
  }

  function shouldDecorate(state) {
    return state.pageActive && state.pageVisible && state.pointer.known && !state.selecting && !state.textInput;
  }

  function stopFrame(state) {
    if (!state.frame) return;
    window.cancelAnimationFrame(state.frame);
    state.frame = 0;
  }

  function ensureFrame(state) {
    if (state.frame || !shouldDecorate(state)) return;
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

  function render(timestamp) {
    if (!controller) return;
    const state = controller;
    state.frame = 0;
    if (!shouldDecorate(state)) return;
    state.ripple.classList.toggle("is-rippling", state.rippleUntil > timestamp);
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
      if (isTextSource(sourceFrom(event))) return;
      state.ripple.classList.remove("is-rippling");
      void state.ripple.offsetWidth;
      state.ripple.style.setProperty("--moon-ripple-x", `${event.clientX}px`);
      state.ripple.style.setProperty("--moon-ripple-y", `${event.clientY}px`);
      state.rippleUntil = now() + 420;
      state.ripple.classList.add("is-rippling");
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
