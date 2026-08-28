# 月白绢潮档案与鎏金羽鳞光标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将三个档案入口升级为可回退、可访问的“月白绢潮”谱系，并以仅由 manifest 和已解析内部链接生成的关系数据驱动学习页文章鳞点与贝塞尔潮丝，同时将入口范围内光标替换为不吸附的鎏金羽鳞。

**Architecture:** `sync-pytorch.mjs` 在既有安全发布事务内，从既有的解析器和 note index 生成受 manifest 管理的 `atlas-relations.json`；它是学习页唯一的文章关系来源。学习入口保留八处静态阶段月湾作为 JSON 失败时的可用回退，`archive-atlas.js` 成功校验 JSON 后只在该页增补原生文章链接、inline 移动端关系文字和 SVG 曲线；生活与研究仍使用静态四湾／四灯。共享 `cursor-shoal` 仍以浏览器原生 SVG CSS cursor 决定热点，装饰层只用真实 pointer 坐标与单一 RAF。

**Tech Stack:** 静态 HTML、CSS、浏览器原生 JavaScript、SVG、Node.js built-in test runner、`markdown-it`。

## Global Constraints

- 只在 `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget` 和分支 `feature/midnight-archive-atlas` 工作；不得在主 checkout 编辑生产文件。
- 不 reset、checkout 覆盖、删除或覆盖既有改动；每次提交前以 `git status --short` 和 `git diff --check` 保护边界。
- 当前已知全量基线为 220 项；不得删测试或降低覆盖，最终 `node --test tests/*.test.mjs` 必须不少于 220 项且全绿。当前 shell 没有可执行 `node`，执行 Task 1 前须通过用户已安装的 Node runtime 恢复该命令，不能以跳过测试代替。
- 不改写 `learning/pytorch/markdown/**`、`learning/pytorch/notes/**`、图片内容或任何既有公开 URL；PyTorch 时间线、阶段页、正文阅读页不得 opt-in 自定义光标。
- 文件关系只能来自 manifest 的阶段／文章顺序，以及 Markdown 解析器确认解析到发布 note 的内部链接；不得从标题、正文或模型推断关系。
- `atlas-relations.json` 必须进入 `generatedFiles`，并经过现有 `safeManagedPath`、ownership、digest、journal、恢复、检查和旧生成文件清理流程。
- 连接线仅为平滑 SVG 三次贝塞尔潮丝：无箭头、折线、直角、虚线、中心枢纽、科技蛛网、循环路径动画、指针跟随重算或视差。
- 月海背景资源不更换；整体遮罩固定调整至 .42–.48，局部墨色渐隐／文字阴影负责 WCAG AA（普通 4.5:1，大字 3:1）对比。
- reduced-motion、输入与文本选择、触摸／粗指针、页面隐藏与背景资源失败必须保持系统光标或静态、可用页面；所有文章和阶段入口必须是原生 link/button 且焦点环不裁切。

## File Structure and Interfaces

- Modify: `assets/cursors/moon-scale-cold-silver.svg`, `assets/cursors/moon-scale-warm-gold.svg` — 32×32 弯月羽鳞的可见尖端在 `(5, 5)`，CSS 热点与之相同。
- Modify: `assets/cursor-shoal.css`, `assets/cursor-shoal.js` — 入口页的原生 cursor、两段水光、以真实 `clientX/clientY` 为中心的双月弧点击反馈，以及单层／单 RAF 生命周期。
- Modify: `scripts/sync-pytorch.mjs` — 导出 `buildAtlasRelations(notes, stages, noteIndex)`；返回版本化、确定性、可 JSON 序列化的关系数据。
- Create (generated): `learning/pytorch/atlas-relations.json` — 仅由同步器写入的公开关系数据，schema 为 `{ version: 1, stages, notes, sequence, references }`。
- Modify: `tests/pytorch-sync.test.mjs` — 对关系构建、链接排除、确定性、manifest ownership、check 和事务恢复的 Node 测试。
- Modify: `learning/index.html` — 保留八处阶段回退月湾，加入 `data-atlas-relations-url="./pytorch/atlas-relations.json"` 和供脚本安全挂载的容器；不把 32 篇文章静态复制进页面。
- Modify: `assets/archive-atlas.js`, `assets/archive-atlas.css` — JSON 校验／回退、文章交互、响应式 SVG 图层、潮丝几何、双层月海谱和局部可读性。
- Modify: `living/index.html`, `research/index.html` — 仅为新的通用无障碍／背景回退结构作必要标注；不添加虚构文章或关系。
- Modify: `tests/archive-atlas.test.mjs` — 静态约束与 `FakeElement`／fetch／ResizeObserver runtime 测试。
- Modify: `tests/homepage-hero.test.mjs` — 更新共享光标 SVG、热点、真实坐标、系统回退和生命周期契约测试。

`buildAtlasRelations(notes, stages, noteIndex)` 的严格数据契约：

```js
{
  version: 1,
  stages: [{ key, label, href: `./${key}/`, noteIds }],
  notes: [{ id: `${stageKey}/${slug}`, stageKey, title, href, order }],
  sequence: [{ from, to }],
  references: [{ from, to }]
}
```

- `notes` 顺序固定为总览在前、其后 `collectSourceNotes()` 已确立的阶段与文章顺序；`order` 为此数组零基索引。
- `sequence` 只连接相邻 `notes`；这是唯一的银白主潮数据。
- `references` 使用 `createMarkdownParser()` 的 inline `link_open` token，跳过 image token、外链、片段链接和无法由 `resolveNoteTarget()` 找到的 target；每一对 `{from,to}` 去重后按 `from`、`to` 的 `order` 排序。
- `stage.noteIds` 只含该阶段（总览为 `overview`）的已发布 note ID；`stage.href` 与既有 stage index 相对地址一致。
- `archive-atlas.js` 只接受 schema version 1、唯一 ID、现有 stageKey、已排序 `order`、合法相对 `/learning/pytorch/notes/...html` href 和端点都存在的边；任一失败即删除动态层、保留八湾静态导航、不会令入口空白。

---

### Task 1: 鎏金羽鳞光标

**Files:**
- Modify: `assets/cursors/moon-scale-cold-silver.svg`
- Modify: `assets/cursors/moon-scale-warm-gold.svg`
- Modify: `assets/cursor-shoal.css`
- Modify: `assets/cursor-shoal.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `<html data-moon-scale-shoal="true">`，以及现有 `MoonScaleShoal.sync()`／`destroy()`。
- Produces: 不变的 `window.MoonScaleShoal = { sync, destroy, get controller() }`；controller 的 `pointer` 始终保存最后一个真实 `clientX/clientY`，`trails.length === 2`。

- [ ] **Step 1: 写入会失败的光标精确性与回退测试**

  在 `tests/homepage-hero.test.mjs` 的共享光标段落中，将原先 24px／`4 4` 断言替换为如下可观察契约，并新增 latest-click 断言：

  ```js
  for (const cursor of [coldSilver, warmGold]) {
    assert.match(cursor, /viewBox="0 0 32 32"/);
    assert.match(cursor, /width="32"/);
    assert.match(cursor, /height="32"/);
    assert.match(cursor, /data-hotspot="5 5"/);
    assert.doesNotMatch(cursor, /<polygon\b/);
  }
  assert.match(styles, /moon-scale-cold-silver\.svg"\) 5 5, auto/);
  assert.match(styles, /moon-scale-warm-gold\.svg"\) 5 5, pointer/);

  runtime.document.dispatch("pointerdown", { pointerType: "mouse", clientX: 70, clientY: 50 });
  runtime.document.dispatch("pointerdown", { pointerType: "mouse", clientX: 90, clientY: 60 });
  assert.equal(controller.ripple.style.getPropertyValue("--moon-ripple-x"), "90px");
  assert.equal(controller.ripple.style.getPropertyValue("--moon-ripple-y"), "60px");
  assert.doesNotMatch(sharedScript, /getBoundingClientRect\(|closest\([^)]*button/);
  ```

- [ ] **Step 2: 运行 RED 并记录失败原因**

  Run: `node --test tests/homepage-hero.test.mjs`

  Expected: FAIL，因为现有 SVG 是 24×24 且 CSS 热点为 `4 4`；不得修改产品代码或弱化断言后再宣称 RED。

- [ ] **Step 3: 最小实现月白／鎏金非箭头弯月羽鳞**

  将两个 SVG 改成 `viewBox="0 0 32 32" width="32" height="32" data-hotspot="5 5"`。共同形体仅可使用 `path`：以 `(5,5)` 开始的短弯月尖端、月白半透明鳞面、香槟金 S 形脊线和两条短羽尾；热态只提升金色 stroke／fill，不移动路径或改变 `viewBox`。在 CSS 中精确改为：

  ```css
  html[data-moon-scale-shoal="true"][data-moon-scale-cursor="true"] :where(body, body *) {
    cursor: url("./cursors/moon-scale-cold-silver.svg") 5 5, auto;
  }
  html[data-moon-scale-shoal="true"][data-moon-scale-cursor="true"] :is(a, button, summary, select, [role="button"]):not([disabled]) {
    cursor: url("./cursors/moon-scale-warm-gold.svg") 5 5, pointer;
  }
  ```

  保持 `pointer-events: none`，不写 `cursor: none`；把两条现有椭圆 trail 改为不闭合的短水光弧（伪元素／渐变均可，但不出现鱼群或椭圆轮廓）。把 `.moon-scale-ripple` 改为两个 `span.moon-scale-ripple-arc`，二者读取相同真实 CSS 坐标，以不同短弧半径向外消散。`pointerdown` 每次先移除两个 arc 的类、强制一次 reflow、写入事件坐标、再加类；不得从 target 读取中心或布局。

- [ ] **Step 4: 运行 GREEN 与全生命周期测试**

  Run: `node --test tests/homepage-hero.test.mjs`

  Expected: PASS；现有单层、单 RAF、页面隐藏、页面返回、text selection、touch、pen、coarse pointer、reduced-motion 和 destroy 测试仍通过。

- [ ] **Step 5: 做任务内静态检查并提交**

  Run: `node --check assets/cursor-shoal.js && git diff --check && git status --short`

  Expected: JS 语法通过，diff 无空白错误，仅 Task 1 文件改变。

  ```bash
  git add assets/cursors/moon-scale-cold-silver.svg assets/cursors/moon-scale-warm-gold.svg assets/cursor-shoal.css assets/cursor-shoal.js tests/homepage-hero.test.mjs
  git commit -m "feat: refine gilded feather-scale cursor"
  ```

- [ ] **Step 6: 派独立 reviewer 并在批准前不启动 Task 2**

  Reviewer 必须检查 SVG 可见尖端与 CSS `(5,5)` 完全一致，代码没有 geometry read／吸附／坐标偏移，且原生回退、一个 layer、一个 RAF 和页面范围未回归。若有问题，派新的修复 agent，RED→GREEN→新提交后由另一 reviewer 重新审阅。

### Task 2: 关系数据生成与同步安全

**Files:**
- Modify: `scripts/sync-pytorch.mjs`
- Create (generated): `learning/pytorch/atlas-relations.json`
- Modify: `learning/pytorch/manifest.json`
- Test: `tests/pytorch-sync.test.mjs`

**Interfaces:**
- Consumes: `notes`、`STAGES`、`buildNoteIndex(notes)`、`createMarkdownParser()` 和 `resolveNoteTarget()`。
- Produces: `buildAtlasRelations(notes, stages, noteIndex)`、`outputs.get('atlas-relations.json')` 和 manifest 的 `generatedFiles` 归属记录。

- [ ] **Step 1: 在临时 fixture 写关系 JSON 的失败测试**

  在 `makeFixture()` 的 `Main.md` 后添加一个明确内部链接、一个外链和一个 image；新增测试直接调用导出的构建函数并通过 `synchronize()` 验证落盘：

  ```js
  const relations = buildAtlasRelations(notes, stages, buildNoteIndex(notes));
  assert.deepEqual(relations.sequence, [
    { from: "stage-1/main", to: "stage-1/other-note" },
  ]);
  assert.deepEqual(relations.references, [
    { from: "stage-1/main", to: "stage-1/other-note" },
  ]);
  assert.ok(relations.notes.every(({ id, href }) => id.includes("/") && href.startsWith("/learning/pytorch/notes/")));
  assert.doesNotMatch(JSON.stringify(relations), /example\.com|plot\.png/);

  await synchronize({ sourceRoot: source, outputRoot: output });
  const manifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
  assert.ok(manifest.generatedFiles.includes("atlas-relations.json"));
  assert.deepEqual(
    await readFile(path.join(output, "atlas-relations.json"), "utf8"),
    `${JSON.stringify(relations, null, 2)}\n`,
  );
  ```

  再加入四个独立测试：相同输入两次字节完全一致；unresolved／跨文件外链／图片／code fence 中的 markdown-like 文本不产生 reference；`--check` 检出该 JSON 被篡改；在已有的 interrupted publish 测试矩阵中确认 atlas JSON 与 manifest 要么同时是上一版、要么同时是下一版，恢复后无 transaction owner 遗留。

- [ ] **Step 2: 运行 RED**

  Run: `node --test tests/pytorch-sync.test.mjs`

  Expected: FAIL，因为 `buildAtlasRelations` 与 `atlas-relations.json` 尚不存在；现有 sync 安全测试必须仍被执行。

- [ ] **Step 3: 以现有 Markdown token 解析器实现确定性关系构建**

  在 `buildNoteIndex()` 后添加并导出下列函数，复用现有解析规则而不是正则猜标题：

  ```js
  export function buildAtlasRelations(notes, stages, noteIndex) {
    const publicNotes = notes.map((note, order) => ({
      id: `${note.stageKey}/${note.slug}`,
      stageKey: note.stageKey,
      title: note.title,
      href: noteUrl(note),
      order,
    }));
    const idByNote = new Map(notes.map((note) => [note, `${note.stageKey}/${note.slug}`]));
    const references = new Map();
    for (const note of notes) {
      for (const token of createMarkdownParser().parse(note.content, {})) {
        const children = token.children || [];
        for (const child of children) {
          if (child.type !== "link_open") continue;
          const href = child.attrGet("href") || "";
          if (!isLocalNoteReference(href) || href.startsWith("#")) continue;
          const resolved = resolveNoteTarget(href, note, noteIndex);
          if (resolved?.note && resolved.note !== note) references.set(`${idByNote.get(note)}\0${idByNote.get(resolved.note)}`, {
            from: idByNote.get(note), to: idByNote.get(resolved.note),
          });
        }
      }
    }
    const noteOrder = new Map(publicNotes.map(({ id, order }) => [id, order]));
    return {
      version: 1,
      stages: [{ key: "overview", label: "学习路线", href: "./", noteIds: publicNotes.filter((note) => note.stageKey === "overview").map(({ id }) => id) },
        ...stages.map((stage) => ({ ...stage, href: `./${stage.key}/`, noteIds: publicNotes.filter((note) => note.stageKey === stage.key).map(({ id }) => id) }))],
      notes: publicNotes,
      sequence: publicNotes.slice(1).map((note, index) => ({ from: publicNotes[index].id, to: note.id })),
      references: [...references.values()].sort((left, right) => noteOrder.get(left.from) - noteOrder.get(right.from) || noteOrder.get(left.to) - noteOrder.get(right.to)),
    };
  }
  ```

  同时在 `synchronize()` 的 `outputs` 建立完成、manifest 组装之前加入：

  ```js
  const atlasRelations = buildAtlasRelations(notes, stages, noteIndex);
  outputs.set("atlas-relations.json", `${JSON.stringify(atlasRelations, null, 2)}\n`);
  ```

  通过既有 `outputs`、`checkOutputs()`、`writeOutputs()` 和 `generatedFiles` 原样发布，绝不写单独 I/O 分支。根据真实源目录安全运行一次同步，加入生成 JSON；随后以 `--check` 验证无漂移。

- [ ] **Step 4: 运行 GREEN、同步检查与发布恢复矩阵**

  Run: `node --test tests/pytorch-sync.test.mjs && node scripts/sync-pytorch.mjs --source "/Users/yyy/Documents/知识库/Notes/Pytorch学习" && node scripts/sync-pytorch.mjs --source "/Users/yyy/Documents/知识库/Notes/Pytorch学习" --check`

  Expected: 所有 sync 测试 PASS；`atlas-relations.json` 存在、可被 manifest 管理、第二命令输出 checked；任何 fixture crash/recovery 仍返回一致发布树。

- [ ] **Step 5: 语法／文件边界检查并提交**

  Run: `node --check scripts/sync-pytorch.mjs && git diff --check && git status --short`

  ```bash
  git add scripts/sync-pytorch.mjs tests/pytorch-sync.test.mjs learning/pytorch/manifest.json learning/pytorch/atlas-relations.json
  git commit -m "feat: publish verified PyTorch atlas relations"
  ```

- [ ] **Step 6: 独立同步安全审阅**

  Reviewer 必须以实际 fixture 证明 relation 仅来自解析到的内部 link，验证 `generatedFiles`、symlink/ownership/digest/journal/recovery/check 都覆盖新文件，并确认没有 markdown 原文、图片或旧 URL 变化。发现任何问题都须新修复 agent 和重新审阅。

### Task 3: 月白绢潮入口构图、文章鳞点和贝塞尔关联线

**Files:**
- Modify: `learning/index.html`
- Modify: `living/index.html`
- Modify: `research/index.html`
- Modify: `assets/archive-atlas.js`
- Modify: `assets/archive-atlas.css`
- Test: `tests/archive-atlas.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `./pytorch/atlas-relations.json`，既有八个 `data-atlas-control` 及 `window.ArchiveAtlas.selectNode(control, animate)`。
- Produces: 原生 `.atlas-note-scale[data-atlas-note-id]` article links；`.atlas-threads` SVG；`selectNode` 继续接受现有 stage button，新增内部 `selectNote(noteId, animate)` 但不公开新的 window API。

- [ ] **Step 1: 写档案 DOM、JSON 回退和几何失败测试**

  扩展 `tests/archive-atlas.test.mjs` 的 fake runtime，使其提供 `fetch`、`ResizeObserver` 和带 `{ left, top, width, height }` 的 `getBoundingClientRect()`。新增覆盖：

  ```js
  assert.equal(learning.match(/class="atlas-tide-stop"/g).length, 8);
  assert.match(learning, /data-atlas-relations-url="\.\/pytorch\/atlas-relations\.json"/);
  assert.match(script, /new ResizeObserver\(scheduleGeometry\)/);
  assert.match(script, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "path"\)/);
  assert.doesNotMatch(script, /pointermove[\s\S]*getBoundingClientRect/);

  await runtime.flushRelations(validRelations);
  assert.equal(runtime.noteLinks.length, 32);
  assert.equal(runtime.svgPaths.filter((path) => path.dataset.kind === "reference").length, validRelations.references.length);
  runtime.noteLinks[4].dispatch("focus");
  assert.equal(runtime.visibleReferenceIds(), directReferences(validRelations, runtime.noteLinks[4].dataset.atlasNoteId));

  await runtime.flushRelations({ version: 2 });
  assert.equal(runtime.noteLinks.length, 0);
  assert.equal(runtime.root.dataset.atlasRelations, "fallback");
  ```

  同时写静态约束：背景第一层 dark gradient alpha 介于 `.42` 和 `.48`；使用局部 `text-shadow`／`linear-gradient`；学习页包含八个回退阶段入口但不硬编码 32 note href；SVG path 不含 `marker-end`、`stroke-dasharray`、`L`／`H`／`V`；生活、研究无 `data-atlas-relations-url` 和文章关系。

- [ ] **Step 2: 运行 RED**

  Run: `node --test tests/archive-atlas.test.mjs`

  Expected: FAIL，因为现有学习页没有 JSON hook、文章鳞点、SVG 图层或 ResizeObserver；生活／研究既有可选结构测试不应删除。

- [ ] **Step 3: 保留八湾静态回退并安全增补动态文章层**

  在 `learning/index.html` 的 `data-atlas-map` 加 `data-atlas-relations-url="./pytorch/atlas-relations.json"`，保留当前八个 `<button>` 与 href；在 `.atlas-tide` 内给出空的 `data-atlas-notes` 和 `<svg class="atlas-threads" aria-hidden="true"></svg>`。仅脚本在 JSON 完整校验后以如下真实 link 生成文章鳞点：

  ```js
  const link = document.createElement("a");
  link.className = "atlas-note-scale";
  link.dataset.atlasNoteId = note.id;
  link.dataset.atlasStageKey = note.stageKey;
  link.href = note.href;
  link.setAttribute("aria-label", note.title);
  link.textContent = note.title;
  ```

  阶段选择更新题跋为 label／篇数／说明／stage href；文章 focus、hover、click（点击自然导航）更新题跋为 title、stage label、直连数及“阅读此篇”。不得将原生链接改成按钮或阻断它的浏览器导航。仅触摸 click 选择状态，`pointerenter` 需排除 touch。

- [ ] **Step 4: 实现只由数据端点决定的贝塞尔潮丝**

  `scheduleGeometry` 只能由首次 JSON 挂载和 `ResizeObserver` 触发，使用 RAF 合并 resize；普通 `pointermove` 不得注册。每次重算先取 map rect，再取每个 note scale rect，并以其边缘作为端点。主 sequence 绘制一个连续 silver `<path>`；reference 为一个对应数据关系的 gold `<path>`，且默认 `opacity: 0`。路径构造只返回三次贝塞尔：

  ```js
  function cubicTide({ start, end, index, total }) {
    const dx = end.x - start.x;
    const span = Math.max(28, Math.abs(dx) * .28);
    const side = ((index + total) % 2 ? 1 : -1);
    const lift = side * Math.min(132, 22 + Math.abs(dx) * .18);
    return `M ${start.x} ${start.y} C ${start.x + span} ${start.y + lift}, ${end.x - span} ${end.y + lift}, ${end.x} ${end.y}`;
  }
  ```

  对逆向 reference 交换 `side` 到独立弧道；曲线端点以 node center 到另一端方向的半径投影落于鳞点边缘。聚焦文章只给直接 `from`／`to` edge 加 `.is-revealed`，且仅该局部运行一次 `atlas-thread-reveal 240ms ease-out`；不对 path 画循环流光。

- [ ] **Step 5: 完成 C1 视觉语言与响应式降级**

  将整体遮罩降为 `.46`，保持 `background-color` 作为图片加载失败回退。标题、header、题跋和 node copy 各自用有限墨色渐隐或 `text-shadow`，不添加玻璃卡。桌面 `>=1025px` 八湾横向、`1024px` 题跋下移但八湾仍横向且无横向 overflow；`<=720px` 改纵向潮卷，隐藏 `.atlas-threads`，并在每个 `.atlas-note-scale` 下渲染原生 inline `引用自 / 延伸至` links。CSS 确保完整文字名称不截断，focus outline 保持在 `overflow: visible` 层；reduced motion 直接切换 classes、禁用 transition／animation。

- [ ] **Step 6: 运行 GREEN 与兼容契约检查**

  Run: `node --test tests/archive-atlas.test.mjs && node --check assets/archive-atlas.js`

  Expected: PASS；32 note／八 stage 对应、数据失败回退、真实直接引用显影、无虚构关系、移动端关系文字、可访问焦点和 `ArchiveAtlas.selectNode` 全部通过。

- [ ] **Step 7: 静态检查并提交**

  Run: `git diff --check && git status --short`

  ```bash
  git add learning/index.html living/index.html research/index.html assets/archive-atlas.js assets/archive-atlas.css tests/archive-atlas.test.mjs
  git commit -m "feat: render moon-silk learning atlas"
  ```

- [ ] **Step 8: 独立图谱 reviewer 审阅**

  Reviewer 要以 JSON fixture 和已发布文件校验数据来源、端点、SVG 命令、无箭头／无网状显影、fallback 与静态页面仍可导航；确认只动本任务文件。问题由新修复 agent 做 RED→GREEN→commit，随后另派 reviewer 复审。

### Task 4: 响应式、无障碍与视觉验收

**Files:**
- Modify only if a failing acceptance test proves necessary: `assets/archive-atlas.css`, `assets/archive-atlas.js`, `assets/cursor-shoal.css`, `assets/cursor-shoal.js`, `tests/archive-atlas.test.mjs`, `tests/homepage-hero.test.mjs`
- Test: `tests/archive-atlas.test.mjs`, `tests/homepage-hero.test.mjs`, full suite

**Interfaces:**
- Consumes: Tasks 1–3 已审阅的 runtime 与 CSS。
- Produces: 不扩展公开 API；只留下已验证的响应式／无障碍修复。

- [ ] **Step 1: 为验收矩阵先补失败自动化测试**

  在 archive runtime 中增加 `prefers-reduced-motion`、keyboard focus、touch pointer、fetch rejection 和 image error state；在 cursor runtime 中增加 input、selection、page visibility 和 coarse pointer。断言：

  ```js
  assert.equal(runtime.document.documentElement.dataset.atlasReducedMotion, "true");
  assert.equal(runtime.svgPaths.some((path) => path.classList.contains("is-animating")), false);
  assert.equal(runtime.document.documentElement.dataset.moonScaleCursor, "false");
  assert.equal(runtime.noteLinks.every((link) => link.tagName === "A" && link.getAttribute("aria-label")), true);
  assert.doesNotMatch(mobileCss, /overflow-x:\s*(?:auto|scroll)/);
  ```

  加 CSS source tests，锁定 desktop 1440/1024 的横向八湾、720/320 的纵向潮卷、图片背景失败的 `background-color`、focus outline、最小 11px 辅助文字和 Task 1 之外页面没有 cursor opt-in。

- [ ] **Step 2: 运行 RED**

  Run: `node --test tests/archive-atlas.test.mjs tests/homepage-hero.test.mjs`

  Expected: 任何尚未明确保证的 reduced-motion、resource fallback 或尺寸约束先失败；不可把浏览器人工验收替代单元回归。

- [ ] **Step 3: 仅实现被 RED 证明的最小修复**

  修复必须限于宣告失败的 selector／handler。可接受的修复包括 `@media (max-width: 720px)` 内隐藏 SVG、inline reference list 的可读间距、`prefers-reduced-motion` 下清除 reveal class、以及因 `.atlas-scroll`／`.atlas-tide` overflow 导致 focus outline 被裁切的边界修正。不得重写笔记、引入运行时依赖、改 PyTorch 阅读页 cursor opt-in，或为视觉偏好增加新功能。

- [ ] **Step 4: 运行 GREEN、语法和全量回归**

  Run: `node --check assets/archive-atlas.js && node --check assets/cursor-shoal.js && node --test tests/*.test.mjs && git diff --check`

  Expected: 两个 JS 检查通过，`tests 220+`、`pass == tests`、`fail == 0`，diff 无空白错误。

- [ ] **Step 5: 逐尺寸浏览器验收并保存证据**

  使用浏览器在 `/learning/`、`/living/`、`/research/` 分别检查 1440×900、1024×768、720×900、320×568：

  ```text
  1440×900: 八湾横向；月面／潮光／山影清晰；无文字低对比或潮丝交叉成网。
  1024×768: 八湾仍横向；题跋可下移；没有横向滚动或截断 stage 名。
  720×900: 纵向潮卷；无 SVG 跨栏线；每篇有 inline 引用文字。
  320×568: header、原生 links、focus ring、正文和选择文字均不溢出／不遮挡。
  全尺寸: 键盘 Tab/Enter/Space、mouse hover、touch click、reduced-motion、文本选择、input、coarse pointer、page hide/show、背景图片请求失败都保持可用并按规定回退系统 cursor／静态页面。
  ```

  对学习页分别聚焦一篇有进入和出去引用的文章，确认只显影它的 direct gold curves；确认任意 cursor click 的月弧圆心就是 pointerdown 坐标，没有吸附。

- [ ] **Step 6: 提交仅包含验收修复的改动**

  ```bash
  git add assets/archive-atlas.css assets/archive-atlas.js assets/cursor-shoal.css assets/cursor-shoal.js tests/archive-atlas.test.mjs tests/homepage-hero.test.mjs
  git commit -m "fix: harden moon atlas accessibility"
  ```

  若 Task 4 只验证、没有产品改动，则不创建空提交，并将全量测试输出和浏览器矩阵记录在最终交付。

- [ ] **Step 7: 独立 Task 4 reviewer**

  Reviewer 独立重跑全量测试并复查四个 viewport、motion、keyboard、touch、文本选择、系统 cursor fallback 和背景失败 fallback。发现问题必须由新的修复 agent 修复并由新 reviewer 重审。

## Integration Gate After All Task Reviewers Approve

- [ ] **Step 1: 派独立全分支 reviewer**

  全分支 reviewer 不得是任一任务 implementer 或该任务 reviewer。它必须检查 `git log master..HEAD`、每个提交 diff、`git diff master...HEAD --check`、所有同步安全／关系来源／光标范围约束，以及 `node --test tests/*.test.mjs` 的 220+ PASS 输出。未批准前禁止合并。

- [ ] **Step 2: 在功能 worktree 作最终只读核对**

  Run: `git status --short && git diff --check && git rev-parse HEAD && git rev-parse master && git rev-parse origin/master`

  Expected: worktree clean；feature HEAD 含本规格 `c461028` 与四项批准改动；master 和 origin/master 仍指向待合并的同一旧 SHA。

- [ ] **Step 3: 获得全分支 reviewer 批准后才在主 checkout 合并并推送**

  在主 checkout 执行非破坏性 fast-forward-only 合并，拒绝任何需要重写历史的情形：

  ```bash
  git switch master
  git merge --ff-only feature/midnight-archive-atlas
  git push origin master
  ```

  合并或推送出现非 fast-forward、远端变化、未清洁状态或 reviewer 未批准时立即停止，不使用 reset／force push／checkout 覆盖。

- [ ] **Step 4: 最终 SHA 一致性核对**

  Run: `git -C "/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget" rev-parse HEAD && git -C "<主 checkout>" rev-parse master && git -C "<主 checkout>" rev-parse origin/master`

  Expected: 三个 SHA 完全相同；报告 SHA、全量测试数、reviewer 批准结果和浏览器验收矩阵，不修改任何笔记正文或旧公开 URL。

## Plan Self-Review

- **Spec coverage:** Task 1 覆盖 32px 非箭头光标、精确热点、真实 pointer 坐标、两段水光和系统回退；Task 2 覆盖唯一可验证关系来源和全部同步事务边界；Task 3 覆盖 C1 背景、八湾／32 鳞点、贝塞尔 sequence/reference、静态回退；Task 4 覆盖四个视口、无障碍和浏览器验收；Integration Gate 覆盖独立审阅、合并、推送及 SHA 一致性。
- **No placeholders:** 所有任务都有明确文件、接口、RED、GREEN、测试命令、提交与 reviewer gate；`<主 checkout>` 只在用户已指定主 checkout 时执行，因该路径未在当前交接中授权／提供，不能自行猜测。
- **Type consistency:** Task 2 产出 `version/stages/notes/sequence/references`；Task 3 只消费这些字段，文章 ID 始终为 `stageKey/slug`，且公开兼容入口始终是 `ArchiveAtlas.selectNode`。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-28-moon-silk-atlas-gilded-scale.md`. The approved execution path is **Subagent-Driven**: fresh implementer per task, RED → GREEN → commit, independent reviewer, repair-and-rereview on findings, then an independent whole-branch review before merge and push.
