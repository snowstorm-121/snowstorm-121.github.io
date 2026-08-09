(() => {
  const PARTICLE_COUNT = 6;
  const TRAIL_DURATION = 180;
  const TRAIL_MIN_SPEED = 4;
  const TRAIL_MAX_SPEED = 40;
  const SCATTER_DURATION = 520;
  const INTERACTIVE_SELECTOR = 'a, button, [role="button"], summary, select';
  const FORMATION = Object.freeze([
    { distance: 12, lateral: -4, damping: .22 },
    { distance: 16, lateral: 4, damping: .19 },
    { distance: 23, lateral: -8, damping: .16 },
    { distance: 28, lateral: 8, damping: .13 },
    { distance: 35, lateral: -12, damping: .11 },
    { distance: 41, lateral: 12, damping: .09 },
  ]);
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  let controller;
  let destroyed = false;

  const now = () => globalThis.performance?.now?.() ?? Date.now();
  const canRun = () => !reduceMotionQuery.matches && pointerQuery.matches;
  const isMousePointer = (event) => !event.pointerType || event.pointerType === "mouse";
  const textTarget = (target) => Boolean(target?.closest?.("input, textarea, [contenteditable]") ?? target?.matches?.("input, textarea, [contenteditable]"));

  function createLayer() {
    const layer = document.createElement("div");
    layer.id = "bioluminescent-shoal";
    layer.setAttribute("aria-hidden", "true");
    const core = document.createElement("span");
    core.className = "shoal-core";
    layer.append(core);
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
      const particle = document.createElement("span");
      particle.className = "shoal-particle";
      particle.style.setProperty("--shoal-index", String(index));
      layer.append(particle);
      return particle;
    });
    document.body.append(layer);
    return {
      layer,
      core,
      particles,
      frame: 0,
      visible: false,
      pageActive: true,
      pageVisible: document.visibilityState !== "hidden",
      target: null,
      hoveredTarget: null,
      selecting: false,
      nativeTextTarget: false,
      pointer: { x: 0, y: 0, previousX: 0, previousY: 0, updatedAt: null },
      heading: 0,
      trailStrength: 0,
      trailPeak: 0,
      lastMotionAt: 0,
      lastPointerAt: null,
      particlePositions: Array.from({ length: PARTICLE_COUNT }, () => ({ x: 0, y: 0 })),
      scatterUntil: 0,
      scatterX: 0,
      scatterY: 0,
      goldUntil: 0,
      listeners: [],
    };
  }

  function isVisible(state) {
    return state.visible && state.pageActive && state.pageVisible && !state.selecting && !state.nativeTextTarget;
  }

  function stopFrame(state) {
    if (!state.frame) return;
    window.cancelAnimationFrame(state.frame);
    state.frame = 0;
  }

  function ensureFrame(state) {
    if (state.frame || !isVisible(state)) return;
    state.frame = window.requestAnimationFrame(render);
  }

  function syncVisibility(state) {
    const visible = isVisible(state);
    state.layer.classList.toggle("is-visible", visible);
    if (visible) ensureFrame(state);
    else stopFrame(state);
  }

  function setTarget(element) {
    if (!controller) return;
    controller.target = element;
    controller.layer.classList.toggle("is-clustered", Boolean(element));
  }

  function updatePointer(state, event) {
    const reset = state.pointer.updatedAt === null || !state.visible;
    const previousX = reset ? event.clientX : state.pointer.x;
    const previousY = reset ? event.clientY : state.pointer.y;
    state.pointer = { x: event.clientX, y: event.clientY, previousX, previousY, updatedAt: now() };
    if (reset) state.particlePositions.forEach((position) => Object.assign(position, { x: event.clientX, y: event.clientY }));
  }

  function hideForNonMouse(state) {
    state.visible = false;
    state.nativeTextTarget = false;
    state.hoveredTarget = null;
    setTarget(null);
    syncVisibility(state);
  }

  function scatterAt(x, y) {
    if (!controller) return;
    setTarget(null);
    controller.scatterX = x;
    controller.scatterY = y;
    controller.scatterUntil = now() + SCATTER_DURATION;
    controller.goldUntil = now() + 140;
    controller.layer.classList.add("is-scattering", "is-clicking");
  }

  function render(timestamp) {
    if (!controller) return;
    const state = controller;
    state.frame = 0;
    if (!isVisible(state)) return;
    const { pointer } = state;
    const deltaX = pointer.x - pointer.previousX;
    const deltaY = pointer.y - pointer.previousY;
    const speed = Math.hypot(deltaX, deltaY);
    const currentTrail = state.trailPeak * Math.max(0, 1 - ((timestamp - state.lastMotionAt) / TRAIL_DURATION));
    if (speed > .01 && pointer.updatedAt !== state.lastPointerAt) {
      const wanted = Math.atan2(deltaY, deltaX);
      const difference = Math.atan2(Math.sin(wanted - state.heading), Math.cos(wanted - state.heading));
      state.heading += difference * (speed > 12 ? .38 : .1);
      const nextPeak = Math.max(0, Math.min(1, (speed - TRAIL_MIN_SPEED) / (TRAIL_MAX_SPEED - TRAIL_MIN_SPEED)));
      if (nextPeak > currentTrail) {
        state.trailPeak = nextPeak;
        state.lastMotionAt = timestamp;
      }
      state.lastPointerAt = pointer.updatedAt;
    }
    state.trailStrength = state.trailPeak * Math.max(0, 1 - ((timestamp - state.lastMotionAt) / TRAIL_DURATION));
    state.core.style.setProperty("--shoal-trail", String(state.trailStrength));
    state.layer.classList.toggle("is-clicking", state.goldUntil > timestamp);
    const scattering = state.scatterUntil > timestamp;
    if (!scattering && state.scatterUntil) {
      state.scatterUntil = 0;
      state.layer.classList.remove("is-scattering");
      setTarget(state.hoveredTarget);
    }

    let coreX = pointer.x;
    let coreY = pointer.y;
    if (state.target) {
      const bounds = state.target.getBoundingClientRect();
      const centerX = bounds.left + (bounds.width / 2);
      const centerY = bounds.top + (bounds.height / 2);
      const orbit = timestamp / 260;
      coreX = centerX + (Math.cos(orbit) * 12);
      coreY = centerY + (Math.sin(orbit) * 8);
      const orbitHeading = Math.atan2(Math.cos(orbit) * 8, -Math.sin(orbit) * 12);
      const difference = Math.atan2(Math.sin(orbitHeading - state.heading), Math.cos(orbitHeading - state.heading));
      state.heading += difference * .16;
    } else if (scattering) {
      coreX = state.scatterX;
      coreY = state.scatterY;
    }
    const degrees = state.heading * (180 / Math.PI);
    state.core.style.transform = `translate3d(${coreX}px, ${coreY}px, 0) rotate(${degrees}deg)`;
    state.core.style.opacity = "1";

    const forwardX = Math.cos(state.heading);
    const forwardY = Math.sin(state.heading);
    const sideX = -forwardY;
    const sideY = forwardX;
    const scatterProgress = scattering ? 1 - ((state.scatterUntil - timestamp) / SCATTER_DURATION) : 0;
    state.particles.forEach((particle, index) => {
      const formation = FORMATION[index];
      const position = state.particlePositions[index];
      let targetX;
      let targetY;
      if (state.target) {
        const angle = (timestamp / 220) + (index * (Math.PI * 2 / PARTICLE_COUNT));
        targetX = coreX + (Math.cos(angle) * 18);
        targetY = coreY + (Math.sin(angle) * 12);
      } else if (scattering) {
        const arc = (index - 2.5) * .31 + state.heading;
        const distance = (32 + (index * 2.8)) * Math.sin(Math.PI * scatterProgress);
        targetX = coreX + (Math.cos(arc) * distance);
        targetY = coreY + (Math.sin(arc) * distance);
      } else {
        const breath = Math.sin((timestamp / 240) + index) * 1.4;
        targetX = coreX - (forwardX * formation.distance) + (sideX * formation.lateral) + (sideX * breath);
        targetY = coreY - (forwardY * formation.distance) + (sideY * formation.lateral) + (sideY * breath);
      }
      position.x += (targetX - position.x) * formation.damping;
      position.y += (targetY - position.y) * formation.damping;
      particle.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) rotate(${degrees}deg) scale(${1 - index * .055})`;
      particle.style.opacity = "1";
    });
    ensureFrame(state);
  }

  function setup() {
    if (!canRun()) return undefined;
    const state = createLayer();
    const listen = (target, type, handler) => {
      target.addEventListener(type, handler, { passive: true });
      state.listeners.push({ target, type, handler });
    };
    listen(document, "selectionchange", () => {
      state.selecting = Boolean(document.getSelection?.()?.toString());
      document.documentElement.dataset.shoalSelecting = state.selecting ? "true" : "";
      syncVisibility(state);
    });
    listen(document, "pointermove", (event) => {
      if (!isMousePointer(event)) return hideForNonMouse(state);
      updatePointer(state, event);
      state.visible = true;
      syncVisibility(state);
    });
    listen(document, "pointerover", (event) => {
      if (!isMousePointer(event)) return hideForNonMouse(state);
      if (event.relatedTarget === null) updatePointer(state, event);
      state.visible = true;
      state.nativeTextTarget = textTarget(event.target);
      state.hoveredTarget = state.nativeTextTarget ? null : event.target.closest?.(INTERACTIVE_SELECTOR) ?? null;
      if (!state.scatterUntil) setTarget(state.hoveredTarget);
      syncVisibility(state);
    });
    listen(document, "pointerout", (event) => {
      if (!isMousePointer(event)) return hideForNonMouse(state);
      if (event.relatedTarget === null) {
        state.visible = false;
        state.nativeTextTarget = false;
        state.hoveredTarget = null;
        setTarget(null);
      } else {
        state.nativeTextTarget = textTarget(event.relatedTarget);
        state.hoveredTarget = state.nativeTextTarget ? null : event.relatedTarget?.closest?.(INTERACTIVE_SELECTOR) ?? null;
        if (state.hoveredTarget !== state.target) setTarget(null);
      }
      syncVisibility(state);
    });
    listen(document, "pointerdown", (event) => {
      if (!isMousePointer(event)) return hideForNonMouse(state);
      if (!textTarget(event.target)) scatterAt(event.clientX, event.clientY);
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
      if (controller.frame) window.cancelAnimationFrame(controller.frame);
      controller.listeners.forEach(({ target, type, handler }) => target.removeEventListener(type, handler));
      controller.layer.remove();
      controller = undefined;
    }
    delete document.documentElement.dataset.shoalSelecting;
    document.documentElement.dataset.bioluminescentShoal = "false";
  }

  function sync() {
    if (destroyed) return undefined;
    if (!canRun()) {
      teardownController();
      return undefined;
    }
    if (!controller) controller = setup();
    document.documentElement.dataset.bioluminescentShoal = String(Boolean(controller));
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
