(() => {
  const root = document.querySelector("[data-learning-directory][data-relations-url]");
  if (!root) return;
  const anchors = [...root.querySelectorAll("a[data-directory-stage][data-stage-key]")];
  const articles = root.querySelector("[data-directory-articles]");
  const title = root.querySelector("[data-directory-title]");
  const count = root.querySelector("[data-directory-count]");
  const destination = root.querySelector("[data-directory-destination]");
  const status = root.querySelector("[data-directory-status]");
  const stageKeys = ["overview", "foundation", "stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6"];
  const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const isText = value => typeof value === "string" && value.trim().length > 0;
  const noteHrefPattern = /^\/learning\/pytorch\/notes\/(?:[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%-]*\/)*[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%-]*\.html$/;

  function safeNoteHref(href) {
    if (!isText(href) || !noteHrefPattern.test(href)) return false;
    try {
      const decoded = decodeURIComponent(href);
      return !decoded.includes("\\") && !decoded.split("/").some(part => part === "." || part === "..");
    } catch {
      return false;
    }
  }

  function validateRelations(data) {
    if (!isRecord(data) || data.version !== 1) return false;
    if (![data.stages, data.notes, data.sequence, data.references].every(Array.isArray)) return false;
    if (data.stages.length !== 8 || data.notes.length < 2) return false;
    for (const [index, stage] of data.stages.entries()) {
      const key = stageKeys[index];
      if (!isRecord(stage) || stage.key !== key || !isText(stage.label)) return false;
      if (stage.href !== (key === "overview" ? "./" : `./${key}/`)) return false;
      if (!Array.isArray(stage.noteIds) || stage.noteIds.some(id => !isText(id))) return false;
      if (new Set(stage.noteIds).size !== stage.noteIds.length) return false;
    }
    const noteById = new Map();
    for (const [index, note] of data.notes.entries()) {
      if (!isRecord(note) || !isText(note.id) || !isText(note.title) || !safeNoteHref(note.href)) return false;
      if (!stageKeys.includes(note.stageKey) || note.order !== index || noteById.has(note.id)) return false;
      noteById.set(note.id, note);
    }
    const listedIds = data.stages.flatMap(stage => stage.noteIds);
    if (listedIds.length !== data.notes.length || new Set(listedIds).size !== data.notes.length) return false;
    for (const stage of data.stages) {
      let previousOrder = -1;
      for (const id of stage.noteIds) {
        const note = noteById.get(id);
        if (!note || note.stageKey !== stage.key || note.order <= previousOrder) return false;
        previousOrder = note.order;
      }
    }
    if (data.sequence.length !== data.notes.length - 1) return false;
    for (const [index, edge] of data.sequence.entries()) {
      if (!isRecord(edge) || edge.from !== data.notes[index].id || edge.to !== data.notes[index + 1].id) return false;
    }
    const references = new Set();
    for (const edge of data.references) {
      if (!isRecord(edge) || !noteById.has(edge.from) || !noteById.has(edge.to) || edge.from === edge.to) return false;
      const key = `${edge.from}\u0000${edge.to}`;
      if (references.has(key)) return false;
      references.add(key);
    }
    return true;
  }

  function unavailable() {
    if (status) status.textContent = "文章列表暂不可用";
  }

  async function enhance() {
    try {
      if (!articles || !title || !count || !destination || anchors.length !== 8 || anchors.some((anchor, index) => anchor.dataset.stageKey !== stageKeys[index] || !anchor.getAttribute("href"))) {
        unavailable();
        return;
      }
      const response = await fetch(root.dataset.relationsUrl);
      if (!response.ok) throw new Error("Unavailable directory");
      const data = await response.json();
      if (!validateRelations(data)) throw new Error("Invalid directory");
      const buttons = data.stages.map(stage => {
        const button = document.createElement("button");
        button.setAttribute("type", "button");
        button.dataset.directoryStage = "";
        button.dataset.stageKey = stage.key;
        button.textContent = stage.label;
        button.setAttribute("aria-label", `查看${stage.label}文章`);
        return button;
      });
      function select(key) {
        const index = stageKeys.indexOf(key);
        const stage = data.stages[index];
        const notes = data.notes.filter(note => note.stageKey === key);
        const items = notes.map(note => {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.setAttribute("href", note.href);
          link.textContent = note.title;
          item.append(link);
          return item;
        });
        articles.replaceChildren(...items);
        title.textContent = stage.label;
        count.textContent = `${notes.length} 篇`;
        destination.setAttribute("href", anchors[index].getAttribute("href"));
        destination.textContent = "进入此阶段 →";
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.stageKey === key)));
      }
      buttons.forEach((button, index) => {
        button.addEventListener("click", () => select(stageKeys[index]));
        button.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select(stageKeys[index]);
        });
      });
      select("foundation");
      anchors.forEach((anchor, index) => {
        anchor.parentNode.insertBefore(buttons[index], anchor);
        anchor.setAttribute("aria-label", `进入${data.stages[index].label}`);
        anchor.textContent = "进入阶段 →";
      });
      if (status) status.textContent = "";
    } catch {
      unavailable();
    }
  }
  enhance();
})();
