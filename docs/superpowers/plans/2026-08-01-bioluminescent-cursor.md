# 荧光浮游群鼠标交互 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在精细指针桌面端提供“月白核心 + 六个青蓝浮游体”的创意鼠标交互，同时完整保留主页的可读性、原生输入体验和减少动态回退。

**Architecture:** 浮游群不写入静态 HTML；JavaScript 仅在精细指针且未减少动态时创建一个不可交互的固定覆盖层，并以一个 `requestAnimationFrame` 循环更新七个既有节点的位置。CSS 负责色彩、拖尾、目标收束、点击避散和原生光标回退；现有 `syncMotionPreferences()` 负责生命周期开关，避免与玻璃视差、夜航或播放器状态建立新的耦合。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Node.js 内置 `node:test`、现有主页静态资源。

## Global Constraints

- 只能在 `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/bioluminescent-cursor` 的 `feature/bioluminescent-cursor` 分支实施；不得修改主 checkout、重置或删除既有改动。
- 不增加依赖、远程资源、网络字体、第三方脚本、第二个 `<audio>` 或新的持久化存储。
- 保留唯一 `#profileAudio`、九首本地 MP3/LRC/封面、夜航、搜索、微信、QQ、访客统计、档案预览、页面视差与现有玻璃卡片行为。
- 浮游群只在 `(hover: hover) and (pointer: fine)` 且 `prefers-reduced-motion: no-preference` 时存在；触屏、粗指针、减少动态、脚本不可用时保持现有页面。
- 覆盖层必须为 `aria-hidden="true"`、`pointer-events: none`、固定复用 1 个核心与恰好 6 个粒子；不得在每次移动或点击时创建节点。
- 只允许月白、月光青、低透明深海蓝；禁止彩虹色、emoji、文字标签与持续闪烁。
- 每个 Task 必须遵循：失败测试 → 确认失败 → 最小实现 → 测试通过 → 单独提交 → 独立 reviewer；最终还需全分支审查与浏览器回归。

---

## File Structure

- `index.html`：保持不变。覆盖层由 JavaScript 动态创建，因此无脚本时不会留下自定义光标节点。
- `assets/homepage/homepage.css`：定义浮游群图层、核心、六个粒子的视觉状态、系统光标回退、减少动态隐藏规则；不重写现有 `.pointer-glass` 或播放器样式。
- `assets/homepage/homepage.js`：定义启用边界、图层生命周期、单一动画循环、目标收束、点击避散和文字选择/输入回退；在现有 `syncMotionPreferences()` 中同步启停。
- `tests/homepage-hero.test.mjs`：针对动态节点、固定数量、能力门控、RAF 生命周期、目标/点击状态和减少动态回退添加静态契约测试。

## Task 1: 浮游群图层、能力门控与原生光标回退

**Files:**
- Modify: `assets/homepage/homepage.js:42-210`
- Modify: `assets/homepage/homepage.css:305-361, 520-534`
- Modify: `tests/homepage-hero.test.mjs:890-927`

**Interfaces:**
- Consumes: 现有 `reduceMotionQuery`、`pointerQuery`、`syncMotionPreferences()` 与根元素 `document.documentElement`。
- Produces: `setupBioluminescentShoal()`, `syncBioluminescentShoal()`, `destroyBioluminescentShoal()`, `SHOAL_PARTICLE_COUNT`, 以及根状态 `data-bioluminescent-shoal="true|false"`；Task 2 只通过这些接口和 `shoalController` 添加运动状态。

- [ ] **Step 1: 写出失败的结构与门控测试**

  在 `tests/homepage-hero.test.mjs` 新增以下测试；先不修改生产代码：

  ```js
  test("bioluminescent shoal is dynamically mounted, capability-gated, and keeps native text cursors", () => {
    assert.doesNotMatch(html, /id="bioluminescent-shoal"/);
    assert.match(script, /const SHOAL_PARTICLE_COUNT = 6;/);
    assert.match(script, /function setupBioluminescentShoal\(\)/);
    assert.match(script, /function syncBioluminescentShoal\(\)/);
    assert.match(script, /function destroyBioluminescentShoal\(\)/);
    assert.match(script, /if \(reduceMotionQuery\.matches \|\| !pointerQuery\.matches\) return;/);
    assert.match(script, /document\.createElement\("div"\)/);
    assert.match(script, /layer\.id = "bioluminescent-shoal";/);
    assert.match(script, /layer\.setAttribute\("aria-hidden", "true"\)/);
    assert.match(script, /for \(let index = 0; index < SHOAL_PARTICLE_COUNT; index \+= 1\)/);
    assert.match(script, /root\.dataset\.bioluminescentShoal = String\(Boolean\(shoalController\)\)/);
    assert.match(styles, /#bioluminescent-shoal\s*\{[^}]*pointer-events:\s*none/);
    assert.match(styles, /#bioluminescent-shoal\s*\{[^}]*position:\s*fixed/);
    assert.match(styles, /html\[data-bioluminescent-shoal="true"\][\s\S]*?cursor:\s*none/);
    assert.match(styles, /:is\(input, textarea, \[contenteditable\]\)[\s\S]*?cursor:\s*text/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#bioluminescent-shoal\s*\{[^}]*display:\s*none/);
  });
  ```

- [ ] **Step 2: 运行测试并确认它失败**

  Run:

  ```bash
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
  ```

  Expected: 新增 `bioluminescent shoal is dynamically mounted...` 测试失败，首个缺失断言是 `SHOAL_PARTICLE_COUNT` 或 `setupBioluminescentShoal`。

- [ ] **Step 3: 以固定节点和可销毁控制器实现最小图层**

  在现有状态变量附近定义常量和控制器。控制器只在启用时存在，并保存一次注册的事件处理器、7 个节点与 RAF id：

  ```js
  const SHOAL_PARTICLE_COUNT = 6;
  const SHOAL_SETTLE_DURATION = 700;
  let shoalController;

  function canRunBioluminescentShoal() {
    return !reduceMotionQuery.matches && pointerQuery.matches;
  }

  function createShoalLayer() {
    const layer = document.createElement("div");
    layer.id = "bioluminescent-shoal";
    layer.setAttribute("aria-hidden", "true");
    const core = document.createElement("span");
    core.className = "shoal-core";
    layer.append(core);
    const particles = [];
    for (let index = 0; index < SHOAL_PARTICLE_COUNT; index += 1) {
      const particle = document.createElement("span");
      particle.className = "shoal-particle";
      particle.style.setProperty("--shoal-index", String(index));
      layer.append(particle);
      particles.push(particle);
    }
    document.body.append(layer);
    return { layer, core, particles, frame: 0, visible: false, target: null, selecting: false };
  }
  ```

  添加 `setupBioluminescentShoal()`，只在 `canRunBioluminescentShoal()` 时调用 `createShoalLayer()`；`destroyBioluminescentShoal()` 必须 `cancelAnimationFrame`、移除该控制器安装的事件监听器、移除 `layer`，并清除 `data-bioluminescent-shoal` 与 `data-shoal-selecting`。`syncBioluminescentShoal()` 必须先销毁旧控制器，再按能力创建或保持空状态；在 `syncMotionPreferences()` 末尾调用它，使媒体偏好变化即时生效：

  ```js
  function syncBioluminescentShoal() {
    destroyBioluminescentShoal();
    const root = document.documentElement;
    if (reduceMotionQuery.matches || !pointerQuery.matches) {
      root.dataset.bioluminescentShoal = "false";
      return;
    }
    shoalController = setupBioluminescentShoal();
    root.dataset.bioluminescentShoal = String(Boolean(shoalController));
  }
  ```

  添加 CSS，确保覆盖层永远不命中指针，且不影响现有玻璃变换：

  ```css
  #bioluminescent-shoal { position: fixed; z-index: 20; inset: 0; pointer-events: none; opacity: 0; transition: opacity .16s ease; }
  #bioluminescent-shoal.is-visible { opacity: 1; }
  #bioluminescent-shoal :is(.shoal-core, .shoal-particle) { position: fixed; left: 0; top: 0; pointer-events: none; will-change: transform, opacity; }
  #bioluminescent-shoal .shoal-core { width: 9px; height: 9px; border-radius: 50%; background: #edf7ff; box-shadow: 0 0 10px rgba(213, 246, 255, .92), 0 0 24px rgba(112, 220, 237, .38); }
  #bioluminescent-shoal .shoal-particle { width: 5px; height: 5px; border-radius: 50%; background: #8fe2ef; box-shadow: 0 0 9px rgba(116, 222, 239, .78); }
  html[data-bioluminescent-shoal="true"] :where(body, body *) { cursor: none; }
  html[data-bioluminescent-shoal="true"] :is(input, textarea, [contenteditable]), html[data-shoal-selecting="true"] :where(body, body *) { cursor: text; }
  @media (prefers-reduced-motion: reduce) { #bioluminescent-shoal { display: none; } }
  ```

  `selectionchange` 监听器必须在文本实际被选中时设置 `data-shoal-selecting="true"` 并隐藏图层；清空选区时恢复它。指针进入 `input`、`textarea` 或 `[contenteditable]` 时同样暂时隐藏图层，离开后恢复。

- [ ] **Step 4: 运行完整主页测试并确认通过**

  Run:

  ```bash
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
  ```

  Expected: 所有测试通过，新增浮游群结构测试通过，原有唯一音频、音乐、夜航、访客计数与减少动态测试仍通过。

- [ ] **Step 5: 提交 Task 1**

  ```bash
  git add assets/homepage/homepage.js assets/homepage/homepage.css tests/homepage-hero.test.mjs
  git commit -m "feat: add capability-gated shoal cursor layer"
  ```

- [ ] **Step 6: 独立 reviewer 验收 Task 1**

  Reviewer 必须检查：静态 HTML 中没有浮游群节点；控制器仅在精细指针且非减少动态时创建；销毁路径取消 RAF 和删除节点；所有七个节点 `aria-hidden` 覆盖层内且 `pointer-events: none`；输入、可编辑内容和选中文字恢复原生文本光标；没有触碰音乐、夜航、统计业务逻辑。

## Task 2: 单 RAF 拖尾、目标收束与点击避散

**Files:**
- Modify: `assets/homepage/homepage.js:42-233`
- Modify: `assets/homepage/homepage.css:305-361, 520-534`
- Modify: `tests/homepage-hero.test.mjs:890-927`

**Interfaces:**
- Consumes: Task 1 的 `shoalController`（`layer`, `core`, `particles`, `frame`, `visible`, `target`, `selecting`）、`canRunBioluminescentShoal()` 和 `destroyBioluminescentShoal()`。
- Produces: `renderShoalFrame(timestamp)`, `setShoalTarget(element)`, `scatterShoalAt(x, y)`；所有状态由单一控制器维护，Task 3 可据此做视觉验收。

- [ ] **Step 1: 写出失败的运动、互动与性能测试**

  在 `tests/homepage-hero.test.mjs` 新增：

  ```js
  test("bioluminescent shoal reuses one RAF loop for six-particle trails, targets, and one-shot scatter", () => {
    assert.match(script, /const SHOAL_INTERACTIVE_SELECTOR = "a, button, \[data-preview\], #music-dock, #music-panel";/);
    assert.match(script, /function renderShoalFrame\(timestamp\)/);
    assert.match(script, /shoalController\.frame = window\.requestAnimationFrame\(renderShoalFrame\);/);
    assert.match(script, /window\.cancelAnimationFrame\(shoalController\.frame\);/);
    assert.match(script, /const speed = Math\.hypot\(pointer\.x - pointer\.previousX, pointer\.y - pointer\.previousY\);/);
    assert.match(script, /const stretch = Math\.min\(18, speed \* \.18\);/);
    assert.match(script, /particle\.style\.transform = `translate3d\(\$\{x\}px, \$\{y\}px, 0\) scale\(\$\{scale\}\)`;/);
    assert.match(script, /function setShoalTarget\(element\)/);
    assert.match(script, /shoalController\.layer\.classList\.toggle\("is-clustered", Boolean\(element\)\);/);
    assert.match(script, /function scatterShoalAt\(x, y\)/);
    assert.match(script, /SHOAL_SETTLE_DURATION/);
    assert.match(script, /event\.target\.closest\(SHOAL_INTERACTIVE_SELECTOR\)/);
    assert.match(script, /if \(event\.target\.closest\("input, textarea, \[contenteditable\]"\)\) return;/);
    assert.match(styles, /#bioluminescent-shoal\.is-clustered \.shoal-particle\s*\{[^}]*opacity:/);
    assert.match(styles, /#bioluminescent-shoal\.is-scattering \.shoal-particle\s*\{[^}]*transition:/);
    assert.doesNotMatch(script, /document\.createElement\([^)]*\)[\s\S]{0,300}pointermove/);
  });
  ```

- [ ] **Step 2: 运行测试并确认它失败**

  Run:

  ```bash
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
  ```

  Expected: 新增运动测试失败，首个缺失断言是 `SHOAL_INTERACTIVE_SELECTOR` 或 `renderShoalFrame`。

- [ ] **Step 3: 用一个动画循环实现自由追随与速度拖尾**

  将下面的确定性状态加入 Task 1 控制器，避免每次指针事件写节点样式：

  ```js
  const SHOAL_INTERACTIVE_SELECTOR = "a, button, [data-preview], #music-dock, #music-panel";
  const SHOAL_SCATTER_DURATION = 700;
  const SHOAL_PHASES = Object.freeze([0, 1.1, 2.2, 3.3, 4.4, 5.5]);
  const SHOAL_DAMPING = Object.freeze([.16, .13, .11, .09, .075, .06]);
  ```

  `pointermove` 只更新 `shoalController.pointer = { x, y, previousX, previousY, updatedAt }` 与交互目标；不得直接调用 `style.setProperty()` 或 `style.transform`。`renderShoalFrame(timestamp)` 中：

  ```js
  const speed = Math.hypot(pointer.x - pointer.previousX, pointer.y - pointer.previousY);
  const stretch = Math.min(18, speed * .18);
  const resting = Math.min(1, (timestamp - pointer.updatedAt) / SHOAL_SETTLE_DURATION);
  ```

  核心使用当前指针位置。每粒子从自己的上帧坐标向核心按 `SHOAL_DAMPING[index]` 靠近，并叠加 `Math.sin(timestamp / 180 + SHOAL_PHASES[index])` 的低幅偏移；速度越高，将各粒子沿移动反方向扩展 `stretch`，`resting` 趋近 1 时扩展量归零。每帧只对现有核心和 6 个粒子写一次 `transform`/`opacity`，随后仅安排下一帧：

  ```js
  shoalController.frame = window.requestAnimationFrame(renderShoalFrame);
  ```

  可见状态由 `pointerenter`/`pointerleave` 控制：离开窗口移除 `.is-visible`，进入时重新显示；覆盖层仍不截获事件。

- [ ] **Step 4: 增加目标环形收束与一次性避散**

  `pointerover` 用 `event.target.closest(SHOAL_INTERACTIVE_SELECTOR)` 设置目标，`pointerout` 在相关目标真正离开时清空目标。目标存在时，`renderShoalFrame()` 将核心放在目标边界中心，6 个粒子按 `SHOAL_PHASES[index]` 排成半径 14px 的亮环，给 layer 添加 `.is-clustered`；离开后回到自由追随。

  `pointerdown` 仅处理普通页面区域：

  ```js
  if (event.target.closest("input, textarea, [contenteditable]")) return;
  if (event.target.closest(SHOAL_INTERACTIVE_SELECTOR)) return;
  scatterShoalAt(event.clientX, event.clientY);
  ```

  `scatterShoalAt(x, y)` 复用已有六个粒子，设置各自固定角度和 `scatterUntil = performance.now() + SHOAL_SCATTER_DURATION`，并添加 `.is-scattering`。在 `renderShoalFrame()` 里，避散期间核心停在点击处，粒子向固定角度扩散后按进度降低 opacity；到期时移除 `.is-scattering`，将粒子位置重置到核心，并恢复自由追随。不得创建临时 DOM、计时器阵列或无限动画。

  添加最小 CSS 区分状态，保持克制的海蓝光：

  ```css
  #bioluminescent-shoal.is-clustered .shoal-core { box-shadow: 0 0 13px rgba(227, 250, 255, .95), 0 0 30px rgba(120, 225, 239, .55); }
  #bioluminescent-shoal.is-clustered .shoal-particle { opacity: 1; }
  #bioluminescent-shoal.is-scattering .shoal-particle { transition: opacity .7s ease; }
  ```

- [ ] **Step 5: 运行完整主页测试和语法检查并确认通过**

  Run:

  ```bash
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js
  git diff --check
  ```

  Expected: 三个命令均成功；主页测试全绿、脚本语法正确、无空白错误。

- [ ] **Step 6: 提交 Task 2**

  ```bash
  git add assets/homepage/homepage.js assets/homepage/homepage.css tests/homepage-hero.test.mjs
  git commit -m "feat: animate interactive bioluminescent cursor shoal"
  ```

- [ ] **Step 7: 独立 reviewer 验收 Task 2**

  Reviewer 必须检查：仅有一个 RAF 调度点；移动处理器不批量写样式；粒子数量固定为 6；速度拉伸会在约 700ms 内归拢；目标收束覆盖链接、按钮、`data-preview` 档案卡、音乐 Dock 和面板控件；普通点击只有一次避散，交互控件与输入控件不会误触发；减少动态或媒体能力变化会销毁节点和停止循环。

## Task 3: 浏览器回归、减少动态与分支验收

**Files:**
- Modify only if a verified defect requires it: `assets/homepage/homepage.css`, `assets/homepage/homepage.js`, `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: Task 1 与 Task 2 已提交的浮游群生命周期和动画接口。
- Produces: 浏览器验收记录、任何最小回归修复及独立最终审查结论。

- [ ] **Step 1: 运行自动化回归基线**

  Run:

  ```bash
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js
  git diff --check
  ```

  Expected: 全部成功，且工作树仅包含本功能的预期变更。

- [ ] **Step 2: 在浏览器完成精细指针验收**

  使用本地静态服务器打开主页，在 `1440×900`、`1024×768` 与 `320×568` 逐项确认：

  - 精细指针桌面存在 1 个月白核心和恰好 6 个青蓝粒子；快速移动有明显但不刺眼的拖尾，停止后约 700ms 归拢。
  - 链接、按钮、任意档案卡、音乐 Dock、展开的音乐面板控制区悬停时形成明亮环形群落；离开后恢复自由追随。
  - 点击普通空白正文时只有一次避散；搜索输入框、音乐控制、社交链接、微信和档案预览按钮仍可正常点击，不出现额外避散。
  - 输入框、可编辑内容与已选择的正文使用原生文本光标；浮游层不遮挡文字选择、滚动、键盘 Tab、焦点环或点击目标。
  - `320×568` 没有横向溢出、固定覆盖层遮挡、页面内容移动或音乐 Dock/访客条退化。

- [ ] **Step 3: 验收减少动态与粗指针回退**

  用浏览器模拟 `prefers-reduced-motion: reduce`，再分别模拟触控/粗指针：

  - 根元素 `data-bioluminescent-shoal` 为 `false`，页面没有 `#bioluminescent-shoal` 节点，且没有运行中的自定义光标动画。
  - 动态文字仍按现有静态切换方式更新；音乐、歌词、队列、夜航、档案预览、QQ/微信和访客统计均保持功能可用。
  - 切回精细指针、非减少动态后只产生一个图层和一个 RAF 循环，不重复创建浮游体。

- [ ] **Step 4: 处理发现的缺陷并为每个缺陷补回归测试**

  若浏览器验收发现问题，只做与问题直接对应的最小修复；先在 `tests/homepage-hero.test.mjs` 写能失败的断言，再修复，重跑 Step 1 三个命令。无缺陷时不改动文件、不产生空提交。

- [ ] **Step 5: 独立全分支审查与交付决策**

  指派不参与 Task 1/2 的 reviewer 审查从分支基线到 HEAD 的完整 diff，重点检查能力门控、DOM/RAF 清理、无障碍、输入体验、性能与既有主页功能。审查无阻塞问题后，按用户授权执行合并到 `master`、推送 GitHub，并核对 `HEAD`、`master`、`origin/master` 指向同一 SHA；不得删除任何预存工作树。
