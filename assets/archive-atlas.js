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
  const notesLayer = document.querySelector("[data-atlas-notes]");
  const threads = document.querySelector(".atlas-threads");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scheduleDiffusion = typeof setTimeout === "function" ? setTimeout : null;
  const cancelDiffusion = typeof clearTimeout === "function" ? clearTimeout : null;
  const MOBILE_BREAKPOINT = 720;
  const ORBIT_SLOTS = {
    foundation: { x: .50, y: .16, vx: -1, vy: 0 },
    "stage-1": { x: .72, y: .26, vx: .78, vy: -.62 },
    "stage-2": { x: .80, y: .53, vx: 1, vy: .12 },
    "stage-3": { x: .64, y: .79, vx: .58, vy: .82 },
    "stage-4": { x: .37, y: .79, vx: -.58, vy: .82 },
    "stage-5": { x: .20, y: .53, vx: -1, vy: .12 },
    "stage-6": { x: .29, y: .24, vx: -.78, vy: -.62 },
  };
  let diffusionTimer = null;
  let geometryFrame = null;
  let relationData = null;
  let relationObserver = null;
  let noteLinks = [];
  let hierarchyPaths = [];
  let sequencePaths = [];
  let referencePaths = [];
  let noteItems = [];
  let notePoints = new Map();

  function stageControlKey(stageKey) {
    return stageKey === "overview" ? "pytorch" : stageKey;
  }

  function controlForKey(key) {
    return controls.find((control) => control.dataset.atlasKey === key) ?? null;
  }

  function isMobileLayout() {
    return typeof window.innerWidth === "number" && window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function orbitPercent(value) {
    return `${Number((value * 100).toFixed(2))}%`;
  }

  function applyOrbitSlots() {
    const center = controlForKey("pytorch");
    if (center) {
      center.style.setProperty("--orbit-x", orbitPercent(.5));
      center.style.setProperty("--orbit-y", orbitPercent(.5));
    }
    Object.entries(ORBIT_SLOTS).forEach(([key, slot]) => {
      const control = controlForKey(key);
      if (!control) return;
      control.style.setProperty("--orbit-x", orbitPercent(slot.x));
      control.style.setProperty("--orbit-y", orbitPercent(slot.y));
    });
  }

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

  function clearNoteSelection() {
    noteLinks.forEach((link) => link.classList.remove("is-active"));
    referencePaths.forEach((path) => path.classList.remove("is-revealed"));
  }

  function resolveControl(target) {
    if (typeof target === "string") return controlForKey(target);
    if (!target?.dataset?.atlasKey) return null;
    return controlForKey(target.dataset.atlasKey) ?? target;
  }

  function selectNode(target, animate = true) {
    const source = resolveControl(target);
    const key = source?.dataset.atlasKey;
    if (!key) return "";

    const changed = root.dataset.atlasSelected !== key;
    root.dataset.atlasSelected = key;
    clearNoteSelection();
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
      destination.textContent = "进入此卷 →";
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

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  const canonicalStages = [
    ["overview", "./"],
    ["foundation", "./foundation/"],
    ["stage-1", "./stage-1/"],
    ["stage-2", "./stage-2/"],
    ["stage-3", "./stage-3/"],
    ["stage-4", "./stage-4/"],
    ["stage-5", "./stage-5/"],
    ["stage-6", "./stage-6/"],
  ];
  const noteHrefPattern = /^\/learning\/pytorch\/notes\/(?:[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%-]*\/)*[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%-]*\.html$/;

  function validateRelations(data) {
    if (!isRecord(data) || data.version !== 1) return false;
    if (!Array.isArray(data.stages) || !Array.isArray(data.notes)) return false;
    if (!Array.isArray(data.sequence) || !Array.isArray(data.references)) return false;
    if (data.stages.length !== 8 || data.notes.length < 2) return false;

    const stageKeys = new Set();
    for (const [index, stage] of data.stages.entries()) {
      if (!isRecord(stage) || !isText(stage.key) || !isText(stage.label) || !isText(stage.href)) return false;
      const [expectedKey, expectedHref] = canonicalStages[index];
      if (stage.key !== expectedKey || stage.href !== expectedHref) return false;
      if (!Array.isArray(stage.noteIds) || stage.noteIds.some((id) => !isText(id))) return false;
      if (stageKeys.has(stage.key) || new Set(stage.noteIds).size !== stage.noteIds.length) return false;
      stageKeys.add(stage.key);
    }

    const noteIds = new Set();
    const orders = new Set();
    const noteById = new Map();
    for (const [index, note] of data.notes.entries()) {
      if (!isRecord(note) || !isText(note.id) || !isText(note.stageKey)) return false;
      if (!isText(note.title) || !isText(note.href) || !noteHrefPattern.test(note.href) || !Number.isInteger(note.order)) return false;
      if (note.order !== index) return false;
      if (!stageKeys.has(note.stageKey) || noteIds.has(note.id) || orders.has(note.order)) return false;
      noteIds.add(note.id);
      orders.add(note.order);
      noteById.set(note.id, note);
    }

    const listedIds = data.stages.flatMap((stage) => stage.noteIds);
    if (listedIds.length !== data.notes.length || new Set(listedIds).size !== data.notes.length) return false;
    for (const stage of data.stages) {
      if (stage.noteIds.some((id) => !noteById.has(id) || noteById.get(id).stageKey !== stage.key)) return false;
      for (let index = 1; index < stage.noteIds.length; index += 1) {
        const previous = noteById.get(stage.noteIds[index - 1]).order;
        const current = noteById.get(stage.noteIds[index]).order;
        if (previous >= current) return false;
      }
    }

    const orderedNotes = [...data.notes].sort((left, right) => left.order - right.order);
    if (orderedNotes.some((note, index) => note.order !== index)) return false;
    if (data.sequence.length !== orderedNotes.length - 1) return false;
    for (let index = 0; index < data.sequence.length; index += 1) {
      const edge = data.sequence[index];
      if (!isRecord(edge) || edge.from !== orderedNotes[index].id || edge.to !== orderedNotes[index + 1].id) return false;
    }

    const referenceKeys = new Set();
    for (const edge of data.references) {
      if (!isRecord(edge) || !isText(edge.from) || !isText(edge.to)) return false;
      if (!noteIds.has(edge.from) || !noteIds.has(edge.to) || edge.from === edge.to) return false;
      const key = `${edge.from}\u0000${edge.to}`;
      if (referenceKeys.has(key)) return false;
      referenceKeys.add(key);
    }
    return true;
  }

  function createMobileRelations(note, noteById) {
    const group = document.createElement("span");
    group.className = "atlas-note-relations";
    const incoming = relationData.references.filter((edge) => edge.to === note.id);
    const outgoing = relationData.references.filter((edge) => edge.from === note.id);
    for (const edge of incoming) {
      const source = noteById.get(edge.from);
      const link = document.createElement("a");
      link.href = source.href;
      link.textContent = `引用自：${source.title}`;
      group.appendChild(link);
    }
    for (const edge of outgoing) {
      const target = noteById.get(edge.to);
      const link = document.createElement("a");
      link.href = target.href;
      link.textContent = `延伸至：${target.title}`;
      group.appendChild(link);
    }
    group.hidden = group.children.length === 0;
    return group;
  }

  function makeLine(kind) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "atlas-thread");
    line.dataset.kind = kind;
    return line;
  }

  function makePath(kind) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "atlas-thread");
    path.dataset.kind = kind;
    return path;
  }

  function selectNote(noteId, animate = true) {
    if (!relationData) return;
    const note = relationData.notes.find((candidate) => candidate.id === noteId);
    if (!note) return;
    const stage = relationData.stages.find((candidate) => candidate.key === note.stageKey);
    const direct = relationData.references.filter((edge) => edge.from === noteId || edge.to === noteId);
    const noteById = new Map(relationData.notes.map((candidate) => [candidate.id, candidate]));
    const incoming = relationData.references
      .filter((edge) => edge.to === noteId)
      .map((edge) => noteById.get(edge.from))
      .filter(Boolean);
    const outgoing = relationData.references
      .filter((edge) => edge.from === noteId)
      .map((edge) => noteById.get(edge.to))
      .filter(Boolean);

    root.dataset.atlasSelected = noteId;
    controls.forEach((control) => {
      const stageSelected = control.dataset.atlasKey === note.stageKey
        || (note.stageKey === "overview" && control.dataset.atlasKey === "pytorch");
      control.classList.toggle("is-active", stageSelected);
      control.classList.toggle("is-dimmed", !stageSelected);
      control.setAttribute("aria-pressed", String(stageSelected));
    });
    noteLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.atlasNoteId === noteId));
    referencePaths.forEach((path) => {
      const revealed = path.dataset.from === noteId || path.dataset.to === noteId;
      path.classList.toggle("is-revealed", revealed);
      if (!animate && revealed) path.classList.remove("is-revealing");
    });

    if (title) title.textContent = note.title;
    if (count) count.textContent = `${direct.length} 条直连`;
    if (meta) meta.textContent = stage.label;
    if (description) {
      description.textContent = direct.length
        ? [
          ...incoming.map((source) => `引用自：${source.title}`),
          ...outgoing.map((target) => `延伸至：${target.title}`),
        ].join("；")
        : "此篇暂无直接引文潮丝。";
    }
    if (destination) {
      destination.hidden = false;
      destination.textContent = "阅读此篇 →";
      destination.setAttribute("href", note.href);
    }
    if (empty) empty.hidden = true;
  }

  function roundPoint(point) {
    return {
      x: Number(point.x.toFixed(2)),
      y: Number(point.y.toFixed(2)),
    };
  }

  function pointFromRect(rect, mapRect) {
    return roundPoint({
      x: rect.left + rect.width / 2 - mapRect.left,
      y: rect.top + rect.height / 2 - mapRect.top,
    });
  }

  function normalizeVector(vx, vy) {
    const length = Math.hypot(vx, vy) || 1;
    return { x: vx / length, y: vy / length };
  }

  function offsetPoint(point, dx, dy) {
    return roundPoint({ x: point.x + dx, y: point.y + dy });
  }

  function setNotePosition(item, point) {
    item.style.setProperty("--atlas-note-x", `${point.x}px`);
    item.style.setProperty("--atlas-note-y", `${point.y}px`);
  }

  function branchPath(points, vector) {
    if (points.length < 2) return "";
    const unit = normalizeVector(vector.x, vector.y);
    const normal = { x: -unit.y, y: unit.x };
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      const handle = Math.max(14, Math.min(32, distance * .42));
      const bend = (index % 2 === 0 ? 1 : -1) * Math.min(10, 3 + distance * .08);
      const c1 = offsetPoint(start, unit.x * handle + normal.x * bend, unit.y * handle + normal.y * bend);
      const c2 = offsetPoint(end, -unit.x * handle + normal.x * bend, -unit.y * handle + normal.y * bend);
      d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
    }
    return d;
  }

  function referencePath(start, end, index, total) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / distance, y: dx / distance };
    const bend = Math.min(44, 16 + distance * .14) * ((index + total) % 2 ? 1 : -1);
    const c1 = roundPoint({ x: start.x + dx * .28 + normal.x * bend, y: start.y + dy * .28 + normal.y * bend });
    const c2 = roundPoint({ x: start.x + dx * .72 + normal.x * bend, y: start.y + dy * .72 + normal.y * bend });
    return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  }

  function stageNotePoint(stage, stagePoint, controlRect, index, total) {
    const slot = ORBIT_SLOTS[stage.key];
    const unit = normalizeVector(slot.vx, slot.vy);
    const normal = { x: -unit.y, y: unit.x };
    const distanceStart = Math.max(controlRect.width, controlRect.height) * .5 + (stage.key === "foundation" ? 34 : 30);
    const step = total <= 1 ? 0 : Math.min(32, (stage.key === "foundation" ? 248 : 172) / Math.max(1, total - 1));
    const drift = total <= 2 ? 0 : (((index % 2) * 2) - 1) * Math.min(10, 3 + Math.floor(index / 2) * 2);
    return roundPoint({
      x: stagePoint.x + unit.x * (distanceStart + step * index) + normal.x * drift,
      y: stagePoint.y + unit.y * (distanceStart + step * index) + normal.y * drift,
    });
  }

  function drawGeometry() {
    geometryFrame = null;
    if (!relationData || !map || !threads) return;
    if (isMobileLayout()) {
      threads.hidden = true;
      threads.removeAttribute("viewBox");
      return;
    }
    const mapRect = map.getBoundingClientRect();
    const centerControl = controlForKey("pytorch");
    if (!centerControl) return;
    const centerPoint = pointFromRect(centerControl.getBoundingClientRect(), mapRect);
    threads.setAttribute("viewBox", `0 0 ${mapRect.width} ${mapRect.height}`);
    notePoints = new Map();

    const overviewId = relationData.stages[0]?.noteIds[0];
    if (overviewId) {
      const overviewItem = noteItems.find((item) => item.dataset.atlasNoteId === overviewId);
      if (overviewItem) {
        const point = roundPoint({ x: centerPoint.x, y: centerPoint.y + 28 });
        notePoints.set(overviewId, point);
        setNotePosition(overviewItem, point);
      }
    }

    relationData.stages.slice(1).forEach((stage, index) => {
      const control = controlForKey(stage.key);
      if (!control) return;
      const rect = control.getBoundingClientRect();
      const stagePoint = pointFromRect(rect, mapRect);
      const hierarchy = hierarchyPaths[index];
      hierarchy?.setAttribute("x1", String(centerPoint.x));
      hierarchy?.setAttribute("y1", String(centerPoint.y));
      hierarchy?.setAttribute("x2", String(stagePoint.x));
      hierarchy?.setAttribute("y2", String(stagePoint.y));

      const points = stage.noteIds.map((noteId, noteIndex) => {
        const point = stageNotePoint(stage, stagePoint, rect, noteIndex, stage.noteIds.length);
        const item = noteItems.find((candidate) => candidate.dataset.atlasNoteId === noteId);
        if (item) setNotePosition(item, point);
        notePoints.set(noteId, point);
        return point;
      });
      const path = sequencePaths[index];
      if (path) {
        path.dataset.nodeIds = stage.noteIds.join(",");
        path.dataset.stageKey = stage.key;
        path.setAttribute("d", branchPath([stagePoint, ...points], { x: ORBIT_SLOTS[stage.key].vx, y: ORBIT_SLOTS[stage.key].vy }));
      }
    });

    referencePaths.forEach((path, index) => {
      const start = notePoints.get(path.dataset.from);
      const end = notePoints.get(path.dataset.to);
      if (!start || !end) return;
      path.setAttribute("d", referencePath(start, end, index, referencePaths.length));
    });
  }

  function scheduleGeometry() {
    if (isMobileLayout()) return;
    if (geometryFrame !== null) return;
    if (typeof requestAnimationFrame === "function") {
      geometryFrame = requestAnimationFrame(drawGeometry);
      return;
    }
    drawGeometry();
  }

  function mountRelations(data) {
    relationData = data;
    const noteById = new Map(data.notes.map((note) => [note.id, note]));
    const items = data.notes.map((note) => {
      const item = document.createElement("span");
      item.className = "atlas-note-item";
      item.dataset.atlasNoteId = note.id;

      const link = document.createElement("a");
      link.className = "atlas-note-scale";
      link.dataset.atlasNoteId = note.id;
      link.dataset.atlasStageKey = note.stageKey;
      link.href = note.href;
      link.setAttribute("aria-label", note.title);
      link.textContent = note.title;
      link.addEventListener("focus", () => selectNote(note.id, !reduceMotionQuery.matches));
      link.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") selectNote(note.id, !reduceMotionQuery.matches);
      });
      link.addEventListener("click", (event) => {
        if (event.pointerType === "touch") selectNote(note.id, !reduceMotionQuery.matches);
      });
      item.append(link, createMobileRelations(note, noteById));
      return item;
    });

    noteLinks = items.map((item) => item.children[0]);
    noteItems = items;
    hierarchyPaths = relationData.stages.slice(1).map(() => makeLine("hierarchy"));
    sequencePaths = relationData.stages.slice(1).map(() => makePath("sequence"));
    referencePaths = data.references.length ? data.references.map((edge, index) => {
      const path = makePath("reference");
      path.dataset.referenceId = String(index);
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      return path;
    }) : [];
    notesLayer.replaceChildren(...items);
    threads.replaceChildren(...hierarchyPaths, ...sequencePaths, ...referencePaths);
    threads.hidden = isMobileLayout();
    root.dataset.atlasRelations = "ready";
    if (threads.hidden) {
      threads.removeAttribute("viewBox");
      return;
    }
    scheduleGeometry();
    if (typeof ResizeObserver === "function") {
      relationObserver?.disconnect?.();
      relationObserver = new ResizeObserver(scheduleGeometry);
      relationObserver.observe(map);
    }
  }

  function fallbackRelations() {
    relationData = null;
    noteLinks = [];
    hierarchyPaths = [];
    sequencePaths = [];
    referencePaths = [];
    noteItems = [];
    notePoints = new Map();
    notesLayer?.replaceChildren();
    threads?.replaceChildren();
    if (threads) threads.hidden = isMobileLayout();
    root.dataset.atlasRelations = "fallback";
  }

  async function loadRelations() {
    const url = map?.dataset.atlasRelationsUrl;
    if (!url || !notesLayer || !threads) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("atlas relations unavailable");
      const data = await response.json();
      if (!validateRelations(data)) throw new Error("invalid atlas relations");
      mountRelations(data);
    } catch {
      fallbackRelations();
    }
  }

  function syncMotion() {
    document.documentElement.dataset.atlasReducedMotion = String(reduceMotionQuery.matches);
    if (reduceMotionQuery.matches) stopDiffusion();
  }

  reduceMotionQuery.addEventListener?.("change", syncMotion);
  syncMotion();
  applyOrbitSlots();
  if (threads) threads.hidden = isMobileLayout();
  selectNode(
    controls.find((control) => control.getAttribute("aria-pressed") === "true") ?? controls[0],
    false,
  );
  loadRelations();

  window.ArchiveAtlas = { selectNode };
})();
