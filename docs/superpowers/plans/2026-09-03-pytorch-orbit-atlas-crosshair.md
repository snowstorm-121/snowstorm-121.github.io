# PyTorch 轨道档案与轨道准星 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以主页冷夜海景为背景，把学习入口重建为真实数据驱动的 PyTorch 中心轨道档案，并以无跟随层的轨道准星替换月鳞光标。

**Architecture:** `learning/pytorch/atlas-relations.json` 仍是文章、阶段顺序与引用的唯一数据源。`learning/index.html` 提供八个静态原生阶段控制；`archive-atlas.js` 在 JSON 通过既有验证后把它们定位成“中心总览＋七阶段”，并挂载 32 个原生文章链接、七条目录射线和七条阶段顺序支线。自定义光标只依赖原生 CSS cursor；`cursor-shoal.js` 只保留文本选择状态同步，绝不创建 DOM 层、跟随指针或启动 RAF。

**Tech Stack:** 静态 HTML、CSS、浏览器原生 JavaScript、内联 SVG、Node.js built-in test runner。

## Global Constraints

- 仅在 `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget` 和 `feature/midnight-archive-atlas` 修改；不得在主 checkout 编辑生产文件。
- 保留未暂存 `.superpowers/sdd/task-4-report.md`，不得 reset、checkout 覆盖、删除或改写该文件。
- 不修改 `learning/pytorch/markdown/**`、`learning/pytorch/notes/**`、`learning/pytorch/atlas-relations.json`、图片内容、旧公开 URL、同步器数据来源或 PyTorch 阅读页系统光标策略。
- 轨道图中心是 `PyTorch 总览`；七条暖色目录射线只表示总览到七阶段的实际层级；七条雾白支线只表示同阶段 manifest 阅读顺序；`references: []` 时不得画任何跨文金线。
- 学习页背景使用现有 `assets/homepage/coast-background.png` 的深海、山影和冷蓝语言；香槟金仅用于中心、阶段准星与当前焦点。
- 准星光标为两个同几何 28×28 SVG，CSS 热点 `(14,14)`；无自定义 DOM 光标、无余迹、无点击水波、无 RAF、无 pointermove 布局读取。
- 1024px 及以上为完整星盘；720px 以下隐藏桌面 SVG，依 manifest 顺序纵向显示总览、七阶段与文章原生链接。
- 所有任务执行 RED → GREEN → commit → 独立 reviewer；最终独立全分支 review 后才能合并或推送。全量测试不得低于 238 项。

---

### Task 1: 用轨道准星替换月鳞光标

**Files:**
- Modify: `assets/cursors/moon-scale-cold-silver.svg`
- Modify: `assets/cursors/moon-scale-warm-gold.svg`
- Modify: `assets/cursor-shoal.css`
- Modify: `assets/cursor-shoal.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: 页面根元素的 `data-moon-scale-shoal="true"` opt-in。
- Produces: CSS cursor 的雾白／香槟金准星 SVG（`viewBox="0 0 28 28"`、`data-hotspot="14 14"`）；仅在选中文字时由脚本设置 `data-orbit-selecting="true"`。

- [ ] **Step 1: 写入失败测试**

  在 `tests/homepage-hero.test.mjs` 中替换月鳞、trail、ripple、controller 生命周期断言为：

  ```js
  test("orbit cursor is a centered 28px native crosshair with no follower layer", async () => {
    const [cold, warm] = await Promise.all([
      readFile(new URL("../assets/cursors/moon-scale-cold-silver.svg", import.meta.url), "utf8"),
      readFile(new URL("../assets/cursors/moon-scale-warm-gold.svg", import.meta.url), "utf8"),
    ]);
    for (const svg of [cold, warm]) {
      assert.match(svg, /viewBox="0 0 28 28"/);
      assert.match(svg, /width="28"/);
      assert.match(svg, /height="28"/);
      assert.match(svg, /data-hotspot="14 14"/);
      assert.match(svg, /data-part="ring"/);
      assert.match(svg, /data-part="tick"/);
      assert.match(svg, /data-part="core"/);
      assert.doesNotMatch(svg, /<polygon|data-part="tail"|data-part="spine"/);
    }
    assert.equal(stripPaint(cold), stripPaint(warm));
    assert.match(shoalStyles, /moon-scale-cold-silver\.svg"\) 14 14, auto/);
    assert.match(shoalStyles, /moon-scale-warm-gold\.svg"\) 14 14, pointer/);
    assert.doesNotMatch(sharedScript, /requestAnimationFrame|pointermove|pointerdown|moon-scale-cursor|moon-scale-trail|moon-scale-ripple/);
  });
  ```

  追加 selection runtime 测试：选中字符串时根元素的 `data-orbit-selecting` 为 `"true"`，清空后移除该属性；脚本从不 append child。

- [ ] **Step 2: 运行 RED**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern "orbit cursor|selection" tests/homepage-hero.test.mjs`

  Expected: FAIL，旧 32px 羽鳞、热点 `(5,5)` 和 trail/ripple 实现不符合新断言。

- [ ] **Step 3: 实现最小准星与系统回退**

  用相同 path 几何重画两个 SVG。每个 SVG 仅包含一个雾白 `ring`、四条 `tick` 和一个 `core`；warm 文件只改变 `stroke`/`fill` 颜色。CSS 使用：

  ```css
  @media (hover: hover) and (pointer: fine) {
    html[data-moon-scale-shoal="true"]:not([data-orbit-selecting="true"]) :where(body, body *) {
      cursor: url("./cursors/moon-scale-cold-silver.svg") 14 14, auto;
    }
    html[data-moon-scale-shoal="true"]:not([data-orbit-selecting="true"]) :is(a, button, summary, select, [role="button"]):not([disabled]) {
      cursor: url("./cursors/moon-scale-warm-gold.svg") 14 14, pointer;
    }
  }
  ```

  保留 input、textarea、contenteditable 的 `cursor: text` 和 reduced-motion 的 `cursor: auto`。将 `cursor-shoal.js` 缩减为只监听 `selectionchange` 并以 `document.getSelection()?.toString()` 切换 `data-orbit-selecting`；页面隐藏时移除该属性。不得创建元素、监听 pointer 事件、读取控件几何或保留 `window.MoonScaleShoal`。

- [ ] **Step 4: 运行 GREEN**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

  Expected: PASS，准星、选择回退、输入/触摸/reduced-motion 回退与主页既有行为均通过。

- [ ] **Step 5: 提交**

  ```bash
  git add assets/cursors/moon-scale-cold-silver.svg assets/cursors/moon-scale-warm-gold.svg assets/cursor-shoal.css assets/cursor-shoal.js tests/homepage-hero.test.mjs
  git commit -m "feat: replace moon cursor with orbit crosshair"
  ```

---

### Task 2: 用真实目录层级重建 PyTorch 轨道星盘

**Files:**
- Modify: `learning/index.html`
- Modify: `assets/archive-atlas.css`
- Modify: `assets/archive-atlas.js`
- Test: `tests/archive-atlas.test.mjs`

**Interfaces:**
- Consumes: 已验证的 `{ stages, notes, sequence, references }`；既有 `window.ArchiveAtlas.selectNode(key)`。
- Produces: 总览中心 control、七个定位阶段 control、7 个 `line[data-kind="hierarchy"]`、7 个 `path[data-kind="sequence"]`、最多 `references.length` 个 `path[data-kind="reference"]`、32 个原生 `.atlas-note-scale` links。

- [ ] **Step 1: 写入失败测试**

  在 `tests/archive-atlas.test.mjs` 把月湾／潮丝断言替换为：

  ```js
  test("validated relations mount one center, seven hierarchy rays, seven stage routes, and 32 native note links", async () => {
    const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
    vm.runInNewContext(script, runtime);
    await runtime.flushRelations(validRelations);
    assert.equal(runtime.root.dataset.atlasRelations, "ready");
    assert.equal(runtime.controlByKey("pytorch").dataset.orbitRole, "center");
    assert.equal(runtime.threads.children.filter((node) => node.dataset.kind === "hierarchy").length, 7);
    assert.equal(runtime.threads.children.filter((node) => node.dataset.kind === "sequence").length, 7);
    assert.equal(runtime.noteLinks.length, 32);
    assert.equal(runtime.threads.children.filter((node) => node.dataset.kind === "reference").length, validRelations.references.length);
  });
  ```

  追加几何测试：七条 hierarchy 线必须从 `pytorch` control 中心向七个 stage control 中心辐射；每条 stage route 的节点 ID 顺序严格等于该 `stage.noteIds`；当 `references` 为空时没有金色 reference path。静态测试必须拒绝 `.atlas-moon-bay`、`cubicTide`、`data-kind="sequence"` 为 31 条文章边和 `archive-moon-sea.webp` 作为 learning 背景。

- [ ] **Step 2: 运行 RED**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern "center|hierarchy|stage routes|moon-bay" tests/archive-atlas.test.mjs`

  Expected: FAIL，旧线性八湾只生成 7 条相邻潮线，未生成中心层级射线或阶段分支。

- [ ] **Step 3: 定义固定视觉方位与静态中心控制**

  在 `learning/index.html` 给总览 button 添加 `data-orbit-role="center"`，给七阶段 button 添加 `data-orbit-role="stage"`；不改其 `data-atlas-*` 键、文字、href、DOM 顺序或可访问名称。

  在 `archive-atlas.js` 声明并只对 canonical stage key 使用下列布局常量：

  ```js
  const ORBIT_SLOTS = {
    foundation: { x: .50, y: .16, vx: -1, vy: 0 },
    "stage-1": { x: .72, y: .26, vx:  .78, vy: -.62 },
    "stage-2": { x: .80, y: .53, vx:  1, vy:  .12 },
    "stage-3": { x: .64, y: .79, vx:  .58, vy:  .82 },
    "stage-4": { x: .37, y: .79, vx: -.58, vy:  .82 },
    "stage-5": { x: .20, y: .53, vx: -1, vy:  .12 },
    "stage-6": { x: .29, y: .24, vx: -.78, vy: -.62 },
  };
  ```

  CSS 用 `data-orbit-role` 将总览置于 map 中心、阶段以 `--orbit-x` / `--orbit-y` 绝对定位，并只在 `@media (min-width: 721px)` 启用。学习页背景规则改为 `url("./homepage/coast-background.png")` 加深海蓝局部渐变和下缘山影遮罩；生活/研究背景规则不变。

- [ ] **Step 4: 重建关系挂载与几何**

  用 `makeLine("hierarchy")` 创建 7 条中心到阶段 SVG `<line>`。`mountRelations()` 为每一个非 overview stage 创建 1 条 stage route，而不是为 31 条 sequence 创建路径：

  ```js
  hierarchyPaths = relationData.stages.slice(1).map(() => makeLine("hierarchy"));
  sequencePaths = relationData.stages.slice(1).map(() => makePath("sequence"));
  threads.replaceChildren(...hierarchyPaths, ...sequencePaths, ...referencePaths);
  ```

  `drawGeometry()` 从中心与阶段 control 的实际 `getBoundingClientRect()` 获得端点。每阶段按 `stage.noteIds` 在 `ORBIT_SLOTS[stage.key].vx/vy` 的外向支线上放置文章原生链接；在 route 上依序连结 `stage` 与所有文章点。overview 的唯一文章点放在中心下方 28px。reference path 仅在 `references` 非空时创建，并只在相关文章 focus/hover/click 时显示。保留验证失败时 `fallback`、0 dynamic links、0 SVG paths 和静态 controls 的既有安全行为。

- [ ] **Step 5: 运行 GREEN**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js`

  Expected: PASS，32 个文章链接、7 条 hierarchy、7 条 stage route、真实 reference 限制、乱序/无效 JSON fallback 与原生导航均通过。

- [ ] **Step 6: 提交**

  ```bash
  git add learning/index.html assets/archive-atlas.css assets/archive-atlas.js tests/archive-atlas.test.mjs
  git commit -m "feat: render PyTorch orbit archive"
  ```

---

### Task 3: 响应式、无障碍和背景失败验收

**Files:**
- Modify: `assets/archive-atlas.css`
- Modify: `assets/archive-atlas.js`
- Test: `tests/archive-atlas.test.mjs`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `data-orbit-selecting` CSS fallback，以及 Task 2 的 `data-orbit-role`、hierarchy/stage route paths 和原生 article links。
- Produces: 1024px 完整星盘、720px 以下纵向总览/阶段/文章入口、可见焦点环、背景和关系失败安全回退。

- [ ] **Step 1: 写入失败测试**

  加入静态/运行时断言：

  ```js
  test("orbit atlas has a readable mobile fallback instead of a miniature SVG map", async () => {
    const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 320 });
    vm.runInNewContext(script, runtime);
    await runtime.flushRelations(validRelations);
    assert.equal(runtime.threads.hidden, true);
    assert.deepEqual(runtime.mobileStageKeys(), ["pytorch", "foundation", "stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6"]);
    assert.equal(runtime.noteLinks.every((link) => link.tagName === "a"), true);
  });
  ```

  断言 CSS 有 `@media (max-width: 720px)` 隐藏 `.atlas-threads`、不让 `.atlas-map` 横向滚动、保留 `.atlas-note-scale:focus-visible` 外部 outline；learning background 有纯色 `#07101c` fallback 与 `coast-background.png`，且 `prefers-reduced-motion` 不含 animation/transition。背景资源和 JSON 失败 runtime 均必须保持静态 controls 可用。

- [ ] **Step 2: 运行 RED**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern "mobile fallback|background|reduced motion|focus" tests/archive-atlas.test.mjs`

  Expected: FAIL，旧移动端月湾布局与旧背景契约不满足轨道档案回退断言。

- [ ] **Step 3: 实现响应式与失败回退**

  在 721px 以下把 map 改为单列：静态总览/阶段 button 按 DOM 顺序显示，动态 article links 作为各阶段下的纵向原生链接；设置 `threads.hidden = true` 并不计算任何 SVG 几何。桌面 `ResizeObserver` 只在 map 尺寸变化时调度一次几何更新，不监听 pointermove。为 `.archive-atlas-learning` 声明先行的 `background-color: #07101c`，再叠入主页海岸图；用局部渐变保护文字而不压黑整幅背景。

  reduced-motion 下移除选择过渡与所有 SVG path transition；键盘 focus 使用不裁切的 outline；touch 的 pointerenter 不改变选择，click 仍由原生链接导航。背景或 JSON 失败不写入空的动态容器。

- [ ] **Step 4: 运行 GREEN**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs tests/homepage-hero.test.mjs`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/cursor-shoal.js`

  Run: `git diff --check`

  Expected: PASS；移动、焦点、触摸、文本选择、系统光标、背景/JSON 失败和 reduced-motion 新旧回归全部通过。

- [ ] **Step 5: 提交**

  ```bash
  git add assets/archive-atlas.css assets/archive-atlas.js tests/archive-atlas.test.mjs tests/homepage-hero.test.mjs
  git commit -m "fix: harden orbit atlas fallbacks"
  ```

---

### Task 4: 独立全分支验收

**Files:**
- Modify only if a failing acceptance check proves a scoped Task 1–3 regression.
- Test: `tests/*.test.mjs`

**Interfaces:**
- Consumes: Task 1–3 committed code and test suites.
- Produces: 238+ passing tests, visual evidence at four viewports, independent reviewer approval.

- [ ] **Step 1: 自动验证**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/cursor-shoal.js`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --check --source /Users/yyy/code/pytorch_study`

  Run: `git diff --check`

  Expected: 全量测试不少于 238 且通过；两项 JS syntax 与 diff 通过。若同步检查被源树既有 Hugging Face cache symlink 安全拒绝，记录精确路径并确认本分支未改同步器或源树，不通过删除缓存来伪造成功。

- [ ] **Step 2: 浏览器验收**

  在 `1440×900`、`1024×768`、`720×900`、`320×568` 打开首页和 `/learning/`。桌面验证中心总览、七条阶段射线、七条真实阶段支线、32 点、无跨文伪线、主页海岸背景与无重叠；移动验证无星盘 SVG、总览/阶段/文章顺序和无横向溢出。逐项验证键盘焦点、touch、文本选择系统光标、输入系统光标、reduced-motion、背景 404 CSS fallback、JSON fallback。

- [ ] **Step 3: 独立审阅与收尾**

  让独立 reviewer 审查自本计划开始的所有提交、正式规格、真实 JSON 与浏览器证据。任何 Critical/Important 问题由新 fix agent RED→GREEN 修复并再审。批准后才在主 checkout 快进合并 `master`、推送 `origin/master`，并核对功能分支、本地 `master`、`origin/master` 三方 SHA 完全一致。
