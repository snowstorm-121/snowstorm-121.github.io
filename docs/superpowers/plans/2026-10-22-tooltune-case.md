# ToolTune Case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish a detailed, evidence-backed ToolTune case using the existing paper dossier presentation and add it to the research index.

**Architecture:** Static HTML with shared theme and native disclosure. Only case-scoped CSS additions; no backend, dependency, generated screenshot, or runtime data fetching.

**Tech Stack:** HTML, CSS, existing reading-theme.js, Node built-in test runner.

## Global Constraints

- Edit only /Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget.
- ToolTune is a read-only source at /Users/yyy/code/ToolTune, publicly verified commit 82c53f9eb15e37e01f8f16e7ece33198e11ba1f4.
- Preserve homepage, existing two cases, note bodies, URLs, existing tests and dirty .superpowers/sdd/task-4-report.md.
- Follow docs/superpowers/specs/2026-10-22-tooltune-case-design.md; retain all denominators, negative results and scope limitations.
- All new CSS selectors are scoped to .research-case--tooltune. Reuse existing day/night theme and native controls.
- Baseline 334 tests; no test deletion. Independent task review and final branch review before publishing.

---

### Task 1: ToolTune case, index integration and regression coverage

**Files:**
- Create: research/tooltune/index.html
- Modify: research/index.html, assets/research-cases.css, tests/research-cases.test.mjs
- Create if useful: tests/tooltune-case.test.mjs

**Interfaces:** Existing .research-case shell and shared theme assets; four section IDs problem, engineering, experiments, conclusion; public route /research/tooltune/.

- [ ] Read the design above and its public source files, plus research/scholarlens/index.html, assets/research-cases.css and existing research tests.
- [ ] Add route/semantic regression tests before implementation. Extend existing overview destination test to require exactly three case links and project count 3. Replace whole-overview hash assertion with protection of the unchanged existing two project blocks (capture their current hashes before editing), preserving the other assertions in that test.

```js
const page = new URL("../research/tooltune/index.html", import.meta.url);
const text = await readFile(page, "utf8");
assert.deepEqual([...text.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]),
  ["problem", "engineering", "experiments", "conclusion"]);
for (const [, href] of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (href.startsWith("https:") || href.startsWith("#")) continue;
  await access(new URL(href.endsWith("/") ? href + "index.html" : href, page));
}
```

- [ ] Add tests validating Test table rows/denominators, paired counts and truthful adjacent interpretation, fixed source links, native theme/disclosure and scoped layout. Extend generic research accessibility test to the new page. Keep tests focused on observable content/navigation contracts, not all prose wording.
- [ ] Run RED with the existing Node binary: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-cases.test.mjs tests/tooltune-case.test.mjs (omit the second path if tests are kept in the existing file). Expected missing new route/index failures.
- [ ] Implement the page using the existing shell. Copy shared header and resource ordering, change the case body class to research-case--tooltune and cover number to 03. Use the complete content decisions and exact numbers in the design; write connected Chinese explanatory prose of comparable depth to existing cases. Provide a training ledger, labeled process list, Test table, four-category paired record, three real failure/success examples and a detailed native disclosure. Include the 50% constant-no-call reference and clearly label its limited meaning.
- [ ] Append the third project using this overview markup and change count to 3:

```html
<li class="archive-project" id="tooltune">
  <p class="archive-label">微调 · 工具调用</p>
  <h2>ToolTune</h2>
  <p class="archive-status">实验原型</p>
  <p>在 Apple Silicon 上进行本地量化 LoRA 微调，记录工具调用决策、参数输出与冻结 Test 的逐题变化。</p>
  <p>主要工作：严格数据处理、分组抽样、训练目标校验与冻结对照；均衡诊断集结果不代表真实 API 执行成功率。</p>
  <div class="research-links">
    <a href="./tooltune/">阅读 ToolTune 案例</a>
    <a href="https://github.com/snowstorm-121/ToolTune">GitHub · ToolTune</a>
  </div>
</li>
```

- [ ] Add restrained CSS for new records, using existing variables. A responsive grid can use grid-template-columns: repeat(auto-fit,minmax(min(100%,150px),1fr)); numeric values use tabular-nums; labels and explanations remain readable with no color dependency. Do not change previous case selectors or append a max-width:720px block that accidentally invalidates existing source-order checks; scope any media additions to the new case.
- [ ] Run focused GREEN then full /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs; git diff --check. Commit only task files, write report with RED/GREEN evidence to .superpowers/sdd/tooltune-task-1-report.md.
- [ ] Independent reviewer checks spec + quality via review package; a fresh fix agent resolves findings, then re-review.

## Browser and release gate (controller)

- [ ] Serve the isolated checkout locally. Inspect overview and new page at 1440×900, 1024×768, 720×900, 320×568 in both themes. Check overflow, title and IDs, table and native disclosure, keyboard focus and Enter/Space, theme persistence, link destinations. Confirm system cursor, no new animation/image dependence; document tool limitations honestly.
- [ ] Check JS syntax for theme script and changed tests; run real-source note synchronization --check using repository-documented source path; git diff 1b04d715bcc11f2dc4a3d65b15a4f3271a502781..HEAD --check.
- [ ] Independent full-branch reviewer checks complete diff, evidence attribution, original page preservation and acceptance report; resolve all blocking findings and re-review.
- [ ] Fast-forward master in main checkout, push GitHub, verify feature/master/origin/master and live remote SHA agree. Verify research overview, ToolTune page and shared resources publicly accessible. Preserve dirty files and worktree.
