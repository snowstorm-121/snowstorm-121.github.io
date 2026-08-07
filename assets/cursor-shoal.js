(() => {
  const PARTICLE_COUNT = 6;
  const TRAIL_DURATION = 180;
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

  const now = () => globalThis.performance?.now?.() ?? Date.now();
  const canRun = () => !reduceMotionQuery.matches && pointerQuery.matches;
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
      target: null,
      selecting: false,
      nativeTextTarget: false,
      pointer: { x: 0, y: 0, previousX: 0, previousY: 0, updatedAt: null },
      heading: 0,
      trailStrength: 0,
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

  function syncVisibility(state) {
    state.layer.classList.toggle("is-visible", state.visible && !state.selecting && !state.nativeTextTarget);
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
    const { pointer } = state;
    const deltaX = pointer.x - pointer.previousX;
    const deltaY = pointer.y - pointer.previousY;
    const speed = Math.hypot(deltaX, deltaY);
    if (speed > .01 && pointer.updatedAt !== state.lastPointerAt) {
      const wanted = Math.atan2(deltaY, deltaX);
      const difference = Math.atan2(Math.sin(wanted - state.heading), Math.cos(wanted - state.heading));
      state.heading += difference * (speed > 12 ? .38 : .1);
      state.lastMotionAt = timestamp;
      state.lastPointerAt = pointer.updatedAt;
    }
    state.trailStrength = Math.max(0, 1 - ((timestamp - state.lastMotionAt) / TRAIL_DURATION));
    state.core.style.setProperty("--shoal-trail", String(state.trailStrength));
    state.layer.classList.toggle("is-clicking", state.goldUntil > timestamp);
    const scattering = state.scatterUntil > timestamp;
    if (!scattering && state.scatterUntil) {
      state.scatterUntil = 0;
      state.layer.classList.remove("is-scattering");
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
    state.frame = window.requestAnimationFrame(render);
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
      updatePointer(state, event);
      state.visible = true;
      syncVisibility(state);
    });
    listen(document, "pointerover", (event) => {
      if (event.relatedTarget === null) updatePointer(state, event);
      state.visible = true;
      state.nativeTextTarget = textTarget(event.target);
      setTarget(state.nativeTextTarget ? null : event.target.closest?.(INTERACTIVE_SELECTOR) ?? null);
      syncVisibility(state);
    });
    listen(document, "pointerout", (event) => {
      if (event.relatedTarget === null) {
        state.visible = false;
        state.nativeTextTarget = false;
        setTarget(null);
      } else {
        state.nativeTextTarget = textTarget(event.relatedTarget);
        if (event.relatedTarget?.closest?.(INTERACTIVE_SELECTOR) !== state.target) setTarget(null);
      }
      syncVisibility(state);
    });
    listen(document, "pointerdown", (event) => {
      if (!textTarget(event.target)) scatterAt(event.clientX, event.clientY);
    });
    return state;
  }

  function destroy() {
    if (!controller) return;
    window.cancelAnimationFrame(controller.frame);
    controller.listeners.forEach(({ target, type, handler }) => target.removeEventListener(type, handler));
    controller.layer.remove();
    controller = undefined;
    delete document.documentElement.dataset.shoalSelecting;
  }

  function sync() {
    destroy();
    if (!canRun()) {
      document.documentElement.dataset.bioluminescentShoal = "false";
      return undefined;
    }
    controller = setup();
    if (controller) render(now());
    document.documentElement.dataset.bioluminescentShoal = String(Boolean(controller));
    return controller;
  }

  window.MoonScaleShoal = { sync, destroy, render, setTarget, scatterAt, get controller() { return controller; } };
  reduceMotionQuery.addEventListener("change", sync);
  pointerQuery.addEventListener("change", sync);
  if (document.documentElement.dataset.moonScaleShoal === "true") sync();
})();
