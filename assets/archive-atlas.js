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
  let diffusionTimer = null;
  let geometryFrame = null;
  let relationData = null;
  let relationObserver = null;
  let noteLinks = [];
  let sequencePath = null;
  let referencePaths = [];

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

  function selectNode(control, animate = true) {
    const key = control?.dataset.atlasKey;
    if (!key) return "";

    const source = controls.find((candidate) => candidate.dataset.atlasKey === key) ?? control;
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

  function validateRelations(data) {
    if (!isRecord(data) || data.version !== 1) return false;
    if (!Array.isArray(data.stages) || !Array.isArray(data.notes)) return false;
    if (!Array.isArray(data.sequence) || !Array.isArray(data.references)) return false;
    if (data.stages.length !== 8 || data.notes.length < 2) return false;

    const stageKeys = new Set();
    for (const stage of data.stages) {
      if (!isRecord(stage) || !isText(stage.key) || !isText(stage.label) || !isText(stage.href)) return false;
      if (!Array.isArray(stage.noteIds) || stage.noteIds.some((id) => !isText(id))) return false;
      if (stageKeys.has(stage.key) || new Set(stage.noteIds).size !== stage.noteIds.length) return false;
      stageKeys.add(stage.key);
    }

    const noteIds = new Set();
    const orders = new Set();
    const noteById = new Map();
    for (const note of data.notes) {
      if (!isRecord(note) || !isText(note.id) || !isText(note.stageKey)) return false;
      if (!isText(note.title) || !isText(note.href) || !Number.isInteger(note.order)) return false;
      if (!stageKeys.has(note.stageKey) || noteIds.has(note.id) || orders.has(note.order)) return false;
      noteIds.add(note.id);
      orders.add(note.order);
      noteById.set(note.id, note);
    }

    const listedIds = data.stages.flatMap((stage) => stage.noteIds);
    if (listedIds.length !== data.notes.length || new Set(listedIds).size !== data.notes.length) return false;
    for (const stage of data.stages) {
      if (stage.noteIds.some((id) => !noteById.has(id) || noteById.get(id).stageKey !== stage.key)) return false;
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
    if (description) description.textContent = direct.length ? "仅显影与此篇直接相连的引文潮丝。" : "此篇暂无直接引文潮丝。";
    if (destination) {
      destination.hidden = false;
      destination.textContent = "阅读此篇 →";
      destination.setAttribute("href", note.href);
    }
    if (empty) empty.hidden = true;
  }

  function cubicTide({ start, end, index, total }) {
    const dx = end.x - start.x;
    const span = Math.max(28, Math.abs(dx) * .28);
    const side = ((index + total) % 2 ? 1 : -1);
    const lift = side * Math.min(132, 22 + Math.abs(dx) * .18);
    return `M ${start.x} ${start.y} C ${start.x + span} ${start.y + lift}, ${end.x - span} ${end.y + lift}, ${end.x} ${end.y}`;
  }

  function edgePoint(fromRect, toRect, mapRect) {
    const from = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
    const to = { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const radiusX = Math.max(1, fromRect.width / 2);
    const radiusY = Math.max(1, fromRect.height / 2);
    const projection = 1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY));
    return {
      x: Number((from.x - mapRect.left + dx * projection).toFixed(2)),
      y: Number((from.y - mapRect.top + dy * projection).toFixed(2)),
    };
  }

  function drawGeometry() {
    geometryFrame = null;
    if (!relationData || !map || !sequencePath) return;
    const mapRect = map.getBoundingClientRect();
    const linksById = new Map(noteLinks.map((link) => [link.dataset.atlasNoteId, link]));
    threads.setAttribute("viewBox", `0 0 ${mapRect.width} ${mapRect.height}`);

    const sequenceSegments = relationData.sequence.map((edge, index) => {
      const fromRect = linksById.get(edge.from).getBoundingClientRect();
      const toRect = linksById.get(edge.to).getBoundingClientRect();
      const start = edgePoint(fromRect, toRect, mapRect);
      const end = edgePoint(toRect, fromRect, mapRect);
      return cubicTide({ start, end, index, total: relationData.sequence.length });
    });
    sequencePath.setAttribute(
      "d",
      sequenceSegments.map((segment, index) => index === 0 ? segment : segment.replace(/^M [^C]+/, "")).join(" "),
    );

    relationData.references.forEach((edge, index) => {
      const fromRect = linksById.get(edge.from).getBoundingClientRect();
      const toRect = linksById.get(edge.to).getBoundingClientRect();
      const start = edgePoint(fromRect, toRect, mapRect);
      const end = edgePoint(toRect, fromRect, mapRect);
      const fromOrder = relationData.notes.find((note) => note.id === edge.from).order;
      const toOrder = relationData.notes.find((note) => note.id === edge.to).order;
      referencePaths[index].setAttribute("d", cubicTide({
        start,
        end,
        index: fromOrder > toOrder ? index + 1 : index,
        total: relationData.references.length,
      }));
    });
  }

  function scheduleGeometry() {
    if (geometryFrame !== null) return;
    geometryFrame = requestAnimationFrame(drawGeometry);
  }

  function mountRelations(data) {
    relationData = data;
    const noteById = new Map(data.notes.map((note) => [note.id, note]));
    const stageIndex = new Map(data.stages.map((stage, index) => [stage.key, index]));
    const items = data.notes.map((note) => {
      const currentStageIndex = stageIndex.get(note.stageKey);
      const stage = data.stages[currentStageIndex];
      const indexWithinStage = stage.noteIds.indexOf(note.id);
      const baseY = currentStageIndex % 2 === 0 ? 43 : 57;
      const spread = stage.noteIds.length === 1 ? 0 : (indexWithinStage / (stage.noteIds.length - 1) - .5) * 30;
      const item = document.createElement("span");
      item.className = "atlas-note-item";
      item.dataset.atlasStageEdge = currentStageIndex === 0 ? "start" : currentStageIndex === data.stages.length - 1 ? "end" : "middle";
      item.style.setProperty("--atlas-note-x", `${((currentStageIndex + .5) / data.stages.length) * 100}%`);
      item.style.setProperty("--atlas-note-y", `${baseY + spread}%`);

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
    sequencePath = makePath("sequence");
    referencePaths = data.references.map((edge, index) => {
      const path = makePath("reference");
      path.dataset.referenceId = String(index);
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      return path;
    });
    notesLayer.replaceChildren(...items);
    threads.replaceChildren(sequencePath, ...referencePaths);
    root.dataset.atlasRelations = "ready";
    scheduleGeometry();
    relationObserver = new ResizeObserver(scheduleGeometry);
    relationObserver.observe(map);
  }

  function fallbackRelations() {
    relationData = null;
    noteLinks = [];
    sequencePath = null;
    referencePaths = [];
    notesLayer?.replaceChildren();
    threads?.replaceChildren();
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
  selectNode(
    controls.find((control) => control.getAttribute("aria-pressed") === "true") ?? controls[0],
    false,
  );
  loadRelations();

  window.ArchiveAtlas = { selectNode };
})();
