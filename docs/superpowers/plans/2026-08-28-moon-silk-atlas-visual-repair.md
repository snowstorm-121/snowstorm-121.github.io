# 月白绢潮视觉返工 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除首页误留的夜航白球并修复失控的光标余迹，以真正的八处月湾、疏朗主潮和更清晰的背景替换当前拥挤回钩的学习谱面。

**Architecture:** 关系 JSON 与同步安全实现保持不变；返工只修正消费端结构和视觉。光标继续使用原生 32×32 SVG cursor，DOM 层只负责两段有明确 SVG class/尺寸的短余迹与真实坐标点击弧；学习页把阶段月湾和文章鳞点置于同一八列布局，每个相邻文章边独立生成三次贝塞尔 path，避免把不连续边强行拼成一条路径。

**Tech Stack:** 静态 HTML、CSS、浏览器原生 JavaScript、SVG、Node.js built-in test runner。

## Global Constraints

- 只在 `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget` 和 `feature/midnight-archive-atlas` 修改；不得在主 checkout 编辑生产文件。
- 保留未暂存的 `.superpowers/sdd/task-4-report.md`，不得 reset、checkout 覆盖、删除或改写该文件。
- 不修改 `learning/pytorch/markdown/**`、`learning/pytorch/notes/**`、背景图片、旧公开 URL 或 PyTorch 阅读页的系统光标策略。
- `learning/pytorch/atlas-relations.json` 仍是唯一文章关系来源；不新增或猜测引用。当前真实数据是 32 篇、31 条相邻阅读顺序、0 条可验证跨文引用。
- 连接线只允许无箭头、无折线、无直角、无虚线的三次贝塞尔潮丝；默认不显示金色引用线，无引用时不得造线。
- 最终测试数不得低于 234；每个任务必须 RED → GREEN → commit → 独立 review，最终再做全分支 review。

---

### Task 1: 删除多余夜航白球并修复鎏金羽鳞光标

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Modify: `assets/cursors/moon-scale-cold-silver.svg`
- Modify: `assets/cursors/moon-scale-warm-gold.svg`
- Modify: `assets/cursor-shoal.css`
- Modify: `assets/cursor-shoal.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `<html data-moon-scale-shoal="true">` 与 `window.MoonScaleShoal = { sync, destroy, get controller() }`。
- Produces: 32×32、热点 `(5,5)` 的非箭头弯月羽鳞；`controller.trails.length === 2`；首页不再存在 `#moon-ripple` 和夜航 session 状态。

- [ ] **Step 1: 写入失败测试**

  在 `tests/homepage-hero.test.mjs` 中删除要求 `#moon-ripple`/夜航持久化的旧断言，改为明确的删除契约：

  ```js
  test("homepage removes the obsolete night-navigation moon control", () => {
    assert.doesNotMatch(html, /id="moon-ripple"|data-night-navigation/);
    assert.doesNotMatch(script, /moonRipple|NIGHT_NAVIGATION|nightNavigation|is-night-navigating|is-moonlit/);
    assert.doesNotMatch(styles, /#moon-ripple|night-navigation|night-navigating|is-moonlit/);
  });
  ```

  为真实浏览器暴露的 SVG 类名和尺寸写契约；类必须使用 `setAttribute("class", ...)`，不能给 `SVGElement.className` 直接赋字符串：

  ```js
  assert.match(sharedScript, /trail\.setAttribute\("class", `moon-scale-trail/);
  assert.doesNotMatch(sharedScript, /trail\.className\s*=/);
  assert.match(shoalStyles, /\.moon-scale-trail\s*\{[^}]*width:\s*22px[^}]*height:\s*10px/);
  ```

  SVG 光标测试额外要求主体使用 `fill-rule="evenodd"` 的弯月负形、金色脊线和两条独立羽尾，且两个状态的所有 `d` 完全一致，只允许颜色变化。

- [ ] **Step 2: 运行 RED**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

  Expected: FAIL；至少捕获首页仍有 `#moon-ripple`，以及真实 SVG trail 没有 class attribute 的回归。

- [ ] **Step 3: 最小修复首页与装饰层**

  从 `index.html` 删除 `#moon-ripple` button；从 `homepage.css` 删除仅服务于它与夜航仪式的选择器、变量覆盖和 keyframes；从 `homepage.js` 删除对应 DOM 查询、sessionStorage 状态、计时器、初始化和 click listener。不得影响搜索、语句、音乐、访客计数或 section navigation。

  在 `cursor-shoal.js` 中创建 trail 时使用：

  ```js
  trail.setAttribute("class", `moon-scale-trail${index ? " moon-scale-trail-gold" : ""}`);
  trail.setAttribute("width", index ? "14" : "22");
  trail.setAttribute("height", index ? "8" : "10");
  ```

  保留 CSS 的显式 `width`/`height`，并给 `#moon-scale-cursor > svg` 增加 `display: block; overflow: visible;`，使类失效时也不能占据整页普通流。

  重画两个 cursor SVG：可见尖端仍精确位于 `(5,5)`；主体是带内凹负形的斜向弯月羽鳞，不是闭合三角叶片；香槟金 S 脊线沿弯月弧度走向，两条短羽尾从尾端分叉。冷热状态路径几何相同，仅提高可点击状态的金色亮度。

- [ ] **Step 4: GREEN 与提交**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/cursor-shoal.js`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js`

  Run: `git diff --check`

  Expected: 测试全绿，JS 语法与 diff 检查通过；提交信息 `fix: repair gilded scale cursor presentation`。

---

### Task 2: 重建八处月湾、文章鳞点和疏朗贝塞尔主潮

**Files:**
- Modify: `learning/index.html`
- Modify: `assets/archive-atlas.css`
- Modify: `assets/archive-atlas.js`
- Test: `tests/archive-atlas.test.mjs`

**Interfaces:**
- Consumes: 已校验的 `{ stages, notes, sequence, references }`；保留 `window.ArchiveAtlas.selectNode`。
- Produces: 八个 `.atlas-moon-bay` 阶段湾；32 个原生 `.atlas-note-scale` link；31 个独立 `path[data-kind="sequence"]`；仅由 `references` 生成的独立金色 path。

- [ ] **Step 1: 写入失败测试**

  静态与 runtime 测试必须断言：

  ```js
  assert.match(learning, /class="atlas-map-node atlas-moon-bay/);
  assert.match(styles, /\.archive-atlas-learning \.atlas-moon-bay::before\s*\{[^}]*width:\s*clamp\(/);
  assert.doesNotMatch(script, /sequenceSegments\.map\([^)]*replace\(\/\^M/);
  assert.match(script, /sequencePaths\s*=\s*data\.sequence\.map/);
  assert.equal(runtime.threads.children.filter((node) => node.dataset.kind === "sequence").length, validRelations.sequence.length);
  ```

  几何测试对同阶段相邻文章断言每条 path 都以自己的 `M` 开始且只含一个 `C`；不得把一个节点的入边终点直接当成出边起点。背景测试把全局均匀遮罩限制在 `.28`–`.34`，`body::before` 底部遮罩不得超过 `.40`，并继续用局部 `.atlas-node-copy::before` 维持普通文字 4.5:1。

- [ ] **Step 2: 运行 RED**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs`

  Expected: FAIL；捕获没有真实月湾、31 条边被拼成一个回钩路径、全局叠色过深。

- [ ] **Step 3: 最小重构八湾与文章布局**

  在 `learning/index.html` 的八个阶段 button 上增加 `atlas-moon-bay`，不改变键、链接、文字或顺序。桌面端每湾使用宽而低的月白椭圆/新月水纹（宽度 `clamp(72px, 8vw, 116px)`），阶段文字落在湾外上下交替；文章鳞点在该湾内部沿一条短弧均匀展开，不再把同阶段文章堆成竖直串。

  `mountRelations()` 将 sequence 改成每条 edge 一个 path：

  ```js
  sequencePaths = data.sequence.map(() => makePath("sequence"));
  threads.replaceChildren(...sequencePaths, ...referencePaths);
  ```

  `drawGeometry()` 为每条边分别计算起终点和一个疏朗三次贝塞尔。湾内相邻点使用小弧高，跨湾相邻点沿共同主潮切线平滑连接；每条 path 始终保持自己的 `M ... C ...`。不得拼接 path、不得画箭头或在 pointermove 重算。

  将 `body.archive-atlas-page` 的均匀遮罩降到 `.30`，横向辅助渐变只在文字一侧保留；`body::before` 改为顶部透明、底部不高于 `.38`。标题、阶段 copy、题跋各自保留局部墨色渐隐和文字阴影。背景资源失败时仍有 `#030713` 底色和可读前景。

  720px 以下保持纵向潮卷，不显示 SVG threads；文章关系用已有 inline 链接，焦点、触摸、reduced-motion 契约不变。

- [ ] **Step 4: GREEN 与提交**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js`

  Run: `git diff --check`

  Expected: 测试全绿；提交信息 `fix: rebuild moon silk atlas geometry`。

---

### Task 3: 全分支视觉与回退验收

**Files:**
- Modify only if a failing acceptance check requires a scoped fix to Task 1 or Task 2 files.
- Test: `tests/homepage-hero.test.mjs`
- Test: `tests/archive-atlas.test.mjs`
- Test: `tests/pytorch-sync.test.mjs`

- [ ] **Step 1: 自动验证**

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/cursor-shoal.js && /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js && /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js`

  Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --check --source-root /Users/yyy/code/pytorch_study --output-root learning/pytorch`

  Run: `git diff --check`

  Expected: 不少于 234 项且全绿；语法、真实源同步和 diff 检查通过。

- [ ] **Step 2: 浏览器验收**

  在 1440×900、1024×768、720×900、320×568 逐一检查首页和 `/learning/`：无巨弧、无白球、无横向溢出；背景月面/潮光/山影清晰；桌面为八湾和疏朗独立贝塞尔，移动端不画跨栏网；键盘、触摸、文本选择、系统光标、reduced-motion、背景失败回退均可用。

- [ ] **Step 3: 独立全分支审阅**

  Reviewer 必须对照正式规格、用户截图和本计划检查差异；Critical/Important 问题由单独 fix agent 以 RED→GREEN 修复并重新复审。批准后才允许合并 master、推送并核对功能分支 HEAD、本地 master、`origin/master` 三方 SHA 完全一致。
