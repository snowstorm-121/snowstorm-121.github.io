# 海岸书页全站阅读主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用已批准的海岸书页目录替代三个档案入口的轨道图，为所有子页面提供日夜阅读主题，保留主页样式与 PyTorch 内容/URL，并删除四个指定旧博客页面。

**Architecture:** 主页只接入共享阅读主题开关并停止加载自定义光标。学习入口用现有已校验的 `atlas-relations.json` 渐进增强静态阶段链接；生活/研究入口是静态空目录；PyTorch 总览、阶段、正文由现有同步器模板统一更新外壳。共享主题脚本在 head 早期确定主题，CSS 变量驱动子页面，主页始终使用自身夜海配色。

**Tech Stack:** 静态 HTML/CSS、原生浏览器 JavaScript、Node.js 内置测试运行器、现有 `scripts/sync-pytorch.mjs`。

## Global Constraints

- 唯一允许修改的隔离工作区：`/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget`；分支 `feature/midnight-archive-atlas`。保留既有未提交 `.superpowers/sdd/task-4-report.md`。
- 正式规格：`docs/superpowers/specs/2026-10-01-coastal-editorial-reading-theme-design.md`；它取代旧轨道/准星视觉决策。
- 主页现有布局、照片、文字、搜索、短句、身份、档案入口、联系方式、访客统计和音乐交互保持不变；只增「阅读模式」潮线刻度并停止自定义光标。主页无论选择昼/夜，始终维持现有夜海配色。
- 子页面日间纸色 `#f4f0e9`、正文 `#26333d`、强调 `#9a7047`；夜间底色 `#0a1623`、正文 `#eef2f4`、强调 `#d4b789`。页眉与正文同底色、细线分隔。
- 首次无保存选择时跟随 `prefers-color-scheme`；手动选择只持久化 `light` 或 `dark`。设置跨页面/刷新/标签页同步；存储失败不妨碍当次切换。主页开关标「阅读模式」，但主页视觉不随主题改变。
- `/learning/` 的文章链接与顺序只来自通过校验的 `/learning/pytorch/atlas-relations.json`，关系仍只由 manifest 顺序及真实已发布内链生成；不猜测文件依赖，不绘制任何关系线。数据/脚本失败时仍有总览和七阶段原生链接。
- 不修改 PyTorch Markdown 正文、笔记正文内容、图片字节及其公开 URL。已发布笔记 HTML 只可因同步器模板改变外壳；`.note-content` 生成内容必须不变。保留 `atlas-relations.json` 公开产物与同步校验。
- 仅删除 `archives/index.html`、`archives/2023/index.html`、`archives/2023/12/index.html`、`2023/12/22/hello-world/index.html`；它们的旧 URL 失效是唯一例外。不要删除旧资源或其他文件。
- 系统光标用于全站；不用跟随层、余迹、吸附或点击动画。普通文字至少 WCAG AA 4.5:1；键盘、触摸、文本选择、reduced-motion 与背景失败回退均须可用。
- 当前基线为 248/248；不得删测试降低覆盖，最终全量测试数 `>=248` 且 0 失败。每任务 RED→GREEN→提交→独立 reviewer；修复后复审，最终独立全分支 reviewer 批准后才合并/推送。
- 运行同步检查的真实只读源目录是 `/Users/yyy/Documents/知识库/Notes/Pytorch学习`；正常基线为 32 notes、7 stages、29 remote images、0 warnings。

---

### Task 1: 共享阅读主题、主页开关与系统光标

**Files:**
- Create: `assets/reading-theme.css`, `assets/reading-theme.js`, `tests/reading-theme.test.mjs`
- Modify: `index.html`, `tests/homepage-hero.test.mjs`
- Preserve: `assets/homepage/homepage.css`, `assets/homepage/homepage.js` 的既有版式/功能；只在共享主题 CSS 中样式化开关。
- Do not yet remove archive-page cursor references; Task 3 migrates them together.

**Interfaces:**
- HTML: one `button[data-reading-theme-toggle]` with visible `阅读模式`/`昼`/`夜`; homepage `<html data-reading-home>`。
- JS: `document.documentElement.dataset.readingTheme` is `light|dark`; persistence key is `snowstorm-reading-theme`。No public `window` API.
- CSS: `--reading-surface`, `--reading-ink`, `--reading-accent`, `--reading-muted`, `--reading-line` consumed by later tasks. Homepage's existing `--ink` etc. are untouched.

- [ ] **Step 1: Write RED tests.** In `tests/reading-theme.test.mjs`, use Node `test` + `vm.runInNewContext` with fake `document`, `localStorage`, `matchMedia` and button to assert: no override follows OS; saved `light` overrides dark OS before DOM ready; native click stores new mode and updates `aria-pressed`/`aria-label`; storage denial still changes current mode; `storage` event updates another tab; system changes update only when no override; home meta color stays `#07101c`. Replace each obsolete crosshair assertion in `tests/homepage-hero.test.mjs` with system-cursor/homepage-preservation assertions rather than deleting test cases. Representative assertion:
  ```js
  assert.match(homeHtml, /data-reading-home/);
  assert.match(homeHtml, /data-reading-theme-toggle/);
  assert.doesNotMatch(homeHtml, /cursor-shoal\.(?:css|js)/);
  assert.match(homeHtml, /id="origin-title"[\s\S]*?STILL,/);
  ```
- [ ] **Step 2: Verify RED.** Run `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/reading-theme.test.mjs tests/homepage-hero.test.mjs`; expect named new theme assertions to fail because resources/control do not exist.
- [ ] **Step 3: Minimal implementation.** Load `reading-theme.js` synchronously before styles to set the dataset before first paint, and `reading-theme.css` after existing homepage CSS. Put the button in the existing `.site-header`, not a new bar. Script behavior:
  ```js
  (() => {
    const KEY = "snowstorm-reading-theme";
    const media = matchMedia("(prefers-color-scheme: dark)");
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    let choice = saved === "light" || saved === "dark" ? saved : null;
    const current = () => choice ?? (media.matches ? "dark" : "light");
    const apply = () => {
      const mode = current();
      document.documentElement.dataset.readingTheme = mode;
      if (!document.documentElement.hasAttribute("data-reading-home")) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = mode === "light" ? "#f4f0e9" : "#0a1623";
      }
      document.querySelectorAll("[data-reading-theme-toggle]").forEach((button) => {
        button.dataset.mode = mode;
        button.setAttribute("aria-pressed", String(mode === "dark"));
        button.setAttribute("aria-label", mode === "dark"
          ? "阅读模式：夜间，切换为日间"
          : "阅读模式：日间，切换为夜间");
      });
    };
    apply();
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll("[data-reading-theme-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
          choice = current() === "dark" ? "light" : "dark";
          try { localStorage.setItem(KEY, choice); } catch {}
          apply();
        });
      });
      apply();
    });
    media.addEventListener?.("change", () => { if (choice === null) apply(); });
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY) return;
      choice = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
      apply();
    });
  })();
  ```
  Implement the comments as concrete code, using one native button per page; suppress only the pin transition under `prefers-reduced-motion`. CSS draws the chosen thin tide line and pin, not a custom cursor.
- [ ] **Step 4: Verify GREEN and commit.** Run the focused command from Step 2, then full `node --test tests/*.test.mjs` using the bundled Node executable; expect at least 248 passing, 0 failing. Run `node --check assets/reading-theme.js` and `git diff --check`. Stage only Task 1 files and commit `feat: add persistent reading theme control`.

### Task 2: 安全的学习目录数据增强器

**Files:**
- Create: `assets/learning-directory.js`, `tests/learning-directory.test.mjs`
- No production HTML/CSS changes in this task; Task 3 integrates the controller.

**Interfaces:**
- Root: `[data-learning-directory][data-relations-url]`。
- Static stage anchors: `a[data-directory-stage][data-stage-key]` with real hrefs, manifest order overview/foundation/stage-1…stage-6。
- Output: `[data-directory-articles]`, `[data-directory-title]`, `[data-directory-count]`, `[data-directory-destination]`, `[data-directory-status]`。
- On verified data, insert native selection buttons beside all eight original native stage anchors; keep every direct link visible with distinct accessible labels and retain the selected panel destination. On failure, preserve all original anchors. No relationship visualization/public JS API.

- [ ] **Step 1: Write RED tests.** Use a minimal fake DOM/fetch harness in `tests/learning-directory.test.mjs` and the published `atlas-relations.json` fixture. Assert the default foundation panel renders its exact 10 native article links, and the union of all eight stage selections covers the 32 published notes with exact `href`/title/order; overview selects its one note; click/Enter/Space select stages; unavailable/invalid/reordered data leave all eight original anchors and display `文章列表暂不可用`; note href outside `/learning/pytorch/notes/` is rejected; no SVG or pointermove/geometry code is created. Representative assertion:
  ```js
  assert.deepEqual(renderedHrefs, published.notes
    .filter((note) => note.stageKey === "foundation")
    .map((note) => note.href));
  ```
- [ ] **Step 2: Verify RED.** Run bundled `node --test tests/learning-directory.test.mjs`; expect failure because controller is absent.
- [ ] **Step 3: Minimal implementation.** Reuse the existing `atlas-relations.json` schema and its manifest-order/URL validation contract from `archive-atlas.js`: exactly eight canonical stages, unique ordered note IDs, contiguous note `order`, safe published note hrefs, valid references. Use `textContent` and `createElement` for article list links, never interpolated HTML. Fetch only the URL from `data-relations-url`; default to foundation, ignore hover, keep all eight native stage links visible beside distinctly labelled selection buttons and keep the selected destination in the panel.
- [ ] **Step 4: Verify GREEN and commit.** Run focused tests, full 248+ suite, `node --check assets/learning-directory.js`, and `git diff --check`. Stage only Task 2 files and commit `feat: build safe learning directory controller`.

### Task 3: A 版学习入口与生活/研究档案

**Files:**
- Create: `assets/archive-directory.css`
- Modify: `learning/index.html`, `living/index.html`, `research/index.html`, `tests/archive-atlas.test.mjs`
- Preserve byte-identically: `assets/archive-atlas.css`, `assets/archive-atlas.js`; all live pages stop referencing them.
- Preserve: all old page URLs, archive image bytes, `learning/pytorch/atlas-relations.json`。

**Interfaces:**
- Learning root and selectors exactly as Task 2; load `learning-directory.js` only on `/learning/`。
- Three pages load `reading-theme.js` early, `reading-theme.css`, `archive-directory.css`, and share a same-surface header with the `data-reading-theme-toggle` button.
- Living headings/order: 长夜微澜、纸上星河、山河来信、岁序留痕。Research headings/order: 问题航标、实验潮汐、工程舱图、结论星屿。All eight are explicitly unpublished, not links.

- [ ] **Step 1: Write RED tests.** Migrate the 78 atlas test cases in `tests/archive-atlas.test.mjs`: retain applicable data-validation/fallback assertions and replace obsolete orbit-specific assertions with meaningful editorial-directory contracts; do not delete test coverage or pad with empty assertions. Cover 8 static stage hrefs in correct order, true 32-note runtime mapping, no fake relations/lines, living/research exact four empty categories, same-surface day/night header, coast/living/research image sources, 320/720 CSS flow, native focus and fallback backgrounds. Example:
  ```js
  assert.deepEqual([...learning.matchAll(/data-stage-key="([^"]+)"/g)]
    .map((match) => match[1]),
    ["overview","foundation","stage-1","stage-2","stage-3","stage-4","stage-5","stage-6"]);
  assert.doesNotMatch(learning, /<svg\b|atlas-threads|data-orbit-role/);
  ```
- [ ] **Step 2: Verify RED.** Run bundled `node --test tests/archive-atlas.test.mjs`; expect new directory assertions to fail against orbit pages.
- [ ] **Step 3: Minimal implementation.** Replace the shared atlas shell with a photo strip and `grid-template-columns` directory/content body. The learning HTML contains eight real stage anchors and a visible stage destination. The controller enhances it only after validating JSON. Living/research use semantic ordered/unordered lists, each item with an explicit non-link `尚未发布` status. CSS consumes Task 1 theme variables; set the header background to `var(--reading-surface)`, never a separate colored block. At 720px stack the columns; at 320px use one readable column. Stop loading old atlas/cursor resources; preserve their files byte-identically. Only the four specified legacy HTML pages may be deleted.
- [ ] **Step 4: Verify GREEN and commit.** Run focused tests and full suite (at least 248/248), `node --check assets/learning-directory.js`, `git diff --check`, and confirm `rg -n 'archive-atlas\.(css|js)|cursor-shoal\.(css|js)' learning/index.html living/index.html research/index.html` has no matches. Stage only Task 3 files and commit `feat: replace atlas maps with coastal directories`.

### Task 4: PyTorch 总览、阶段与笔记的日夜书页

**Files:**
- Modify: `scripts/sync-pytorch.mjs`, `assets/library.css`, `assets/pytorch-reading.css`, `tests/pytorch-reading.test.mjs`, `tests/pytorch-sync.test.mjs`
- Regenerate only manifest-owned HTML under `learning/pytorch/` with existing sync command; do not modify generated Markdown, images or other bytes.

**Interfaces:**
- `pageTemplate` emits same-surface header, `data-reading-theme-toggle`, early shared theme script/style, existing reading-progress and reading script.
- `renderArchiveIndex` keeps overview + seven stage destinations; `renderStageIndex` keeps manifest counts/order/neighbors; `renderArticle` keeps `.note-content`, TOC and neighbor links, but labels return link `返回学习档案`。
- `library.css` and `pytorch-reading.css` consume Task 1 theme variables; no photo behind article text.

- [ ] **Step 1: Write RED tests.** Extend the existing reading/sync tests to assert every generated page includes the theme control and same-surface header, stage/overview hrefs remain canonical, note reading content is not replaced with layout copy, both mode CSS tokens style body/TOC/code, return label no longer says 星图, and day mode is not overlaid by a dark top bar. Representative test:
  ```js
  for (const note of manifest.notes) {
    const page = await readArchive(`notes/${note.stageKey}/${note.slug}.html`);
    assert.match(page, /data-reading-theme-toggle/);
    assert.match(page, /<div class="note-content">[\s\S]*?<\/div><\/article>/);
    assert.doesNotMatch(page, /返回星图/);
  }
  ```
- [ ] **Step 2: Verify RED.** Run bundled `node --test tests/pytorch-reading.test.mjs tests/pytorch-sync.test.mjs`; expect missing theme/label assertions to fail.
- [ ] **Step 3: Minimal implementation.** Change only generator wrapper functions and page CSS. Use existing photo as narrow banner with a local overlay; keep the article body on solid `--reading-surface`, TOC/links/code readable in both themes. Add theme resources in `pageTemplate` before page CSS to prevent saved-theme flash. Regenerate with:
  ```sh
  /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习'
  ```
  Before committing, compare old and new `.note-content` for all 32 notes from the pre-task commit (not just rendered appearance); report exact count of identical bodies.
- [ ] **Step 4: Verify GREEN and commit.** Run focused/full tests (at least 248/248), `node --check scripts/sync-pytorch.mjs`, `node --check assets/reading-theme.js`, sync `--check --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习'` expecting `32 notes, 7 stages, 29 remote images, 0 warnings`, and `git diff --check`. Stage only Task 4 files/generated HTML and commit `feat: unify pytorch pages with reading themes`.

### Task 5: 旧博客页删除与跨页面验收

**Files:**
- Delete exactly four paths named in Global Constraints.
- Create: `tests/legacy-routes.test.mjs`
- Modify only relevant CSS/JS/tests if browser QA reveals a defect; do not broaden the deletion target.

**Interfaces:** All remaining URLs are preserved; no homepage or archive link may point at the four removed paths.

- [ ] **Step 1: Write RED tests.** Assert all four legacy HTML paths are absent and search the current live-page HTML for `/archives(?:/|")` and `/2023/12/22/hello-world/`. Assert all 32 manifest note files and seven stage indexes still exist. Example:
  ```js
  for (const path of legacyPages) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)));
  }
  ```
- [ ] **Step 2: Verify RED.** Run bundled `node --test tests/legacy-routes.test.mjs`; expect failure because old pages still exist.
- [ ] **Step 3: Delete only the four verified tracked HTML files via `apply_patch`.** Do not remove `css/`, `js/` or `css/images/` legacy assets. Fix any exact in-scope live links if found.
- [ ] **Step 4: Verify GREEN, browser acceptance, and commit.** Run focused/full tests (`>=248`, 0 failures), sync `--check`, relevant JS `node --check`, `git diff --check`, and `git status --short`. Use a local static server and Chrome/CUA to inspect 1440×900, 1024×768, 720×900, 320×568 in both modes for home, learning, living, research, PyTorch overview, one stage, one note; record screenshots/evidence under ignored `.superpowers/sdd/`. Test keyboard Tab/Enter/Space, touch selection, text selection, system cursor, reduced motion, no-script/invalid-JSON fallback and missing-background fallback. Stage only Task 5 changes and commit `chore: remove legacy blog pages`.

## Final Gate

- Independent reviewer reads the whole branch diff from `git merge-base master HEAD` through current HEAD and gives spec-compliance plus code-quality verdict. Fix all Critical/Important findings through a separate agent, re-run covering tests, and re-review.
- Controller independently runs the full suite, sync check, syntax checks, `git diff --check`, browser size/mode checks, and verifies note content/URL invariants. Preserve the user-owned ignored report.
- Only after reviewer approval: inspect main checkout for unrelated changes, merge the feature branch into `master`, push GitHub, and verify `git rev-parse feature/midnight-archive-atlas`, `git rev-parse master`, `git rev-parse origin/master` print the same SHA. No reset, checkout-overwrite, or direct production edits in main checkout.
