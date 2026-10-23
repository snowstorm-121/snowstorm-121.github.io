# Coastal Research Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute sequential tasks with independent review gates.

**Goal:** Give the research overview and three case studies a polished visual presentation with distinct evidence-led graphics while preserving their research depth.

**Architecture:** A scoped presentation stylesheet and semantic HTML exhibit/hero components, using existing theme and assets. Existing case article HTML is kept byte-identical; no new JS.

**Tech Stack:** HTML/CSS, existing reading-theme.js, Node built-in tests.

## Global Constraints

- Work only in /Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget; preserve dirty .superpowers/sdd/task-4-report.md.
- Follow docs/superpowers/specs/2026-10-23-research-portfolio-design.md. User delegates all design decisions and authorizes reviewed publication.
- Homepage, learning/living pages, PyTorch bodies, existing public URLs and source project repositories unchanged.
- Preserve existing article.archive-content HTML byte-for-byte in all three cases. Preserve facts, sources, negative results, native details and shared theme.
- Scope new CSS under .research-portfolio or .research-editorial. Shared component names start portfolio-. No new JS/dependencies, external fonts, fake screenshots or metrics.
- ScholarLens: real screenshot, explicitly demo not evaluated; 0.6290 Dense EvidenceRecall@5 on 240 answerable Test questions, not answer accuracy.
- RetailFlow: schematic four stages, not successful execution evidence; historical 2026-10-20 B0/B1/B2 each 0/4. Current seen-Dev kept distinct.
- ToolTune: strict decision match B0 89/190 (46.84%), U200 100/190 (52.63%), same 0–100% scale; paired 17 improve/6 regress; balanced 95+95, not API success.
- Full test floor 342; migrate outdated layout assertions without removing coverage. Review before release.

---

### Task 1: Overview and shared visual exhibit components

**Files:** research/index.html; create assets/research-portfolio.css; tests/research-cases.test.mjs, tests/archive-atlas.test.mjs as required; create tests/research-portfolio.test.mjs.

**Interfaces:** new body class research-portfolio, portfolio-intro, portfolio-exhibit, portfolio-visual, portfolio-copy, portfolio-tags, portfolio-cta. Visual modifiers portfolio-visual--scholarlens/--retailflow/--tooltune, reusable by Task 2. New stylesheet last in head after research-cases.css.

- [ ] Read complete spec, current overview, shared CSS and relevant tests.
- [ ] Add meaningful RED checks for semantic exhibit count/IDs, original descriptions and routes, actual screenshot bytes/source, schematic label, ToolTune numeric values/width percentages and balanced denominator, scoped stylesheet reference. Migrate old overview project-block hashes to explicit retained text/links (new markup is authorized). Keep all existing test cases; rename only when their purpose changes.
- [ ] Run focused node tests/research-portfolio.test.mjs tests/research-cases.test.mjs tests/archive-atlas.test.mjs with /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node; record expected missing-exhibit failures.
- [ ] Implement intro and three wide alternating exhibits. Preserve original project descriptions and hrefs exactly. Main h1 remains 烛微观澜. Original overview category index becomes compact horizontal strip; no 260px sidebar. Retain .archive-photo/.archive-layout hooks if generic tests depend on them, override only within new body class.

```html
<li class="archive-project portfolio-exhibit" id="scholarlens">
  <figure class="portfolio-visual portfolio-visual--scholarlens">
    <img src="./assets/scholarlens-demo.png" width="1440" height="900" alt="ScholarLens 单篇论文问答与原文证据的真实演示界面">
    <figcaption>真实演示界面 · 不计入正式评测</figcaption>
  </figure>
  <div class="portfolio-copy"><!-- retain original status, description and links, add chapter number and qualified finding --></div>
</li>
```

The comment above denotes the existing project prose to retain, not a production placeholder. Use the complete original prose. Retail graphic is an ol of four roles with visible 流程示意; ToolTune graphic is two dl rows with actual percentages and aria-hidden bars.

```html
<div class="portfolio-bar" aria-hidden="true"><span style="width:46.84%"></span></div>
<div class="portfolio-bar" aria-hidden="true"><span style="width:52.63%"></span></div>
```

- [ ] CSS establish shared light/dark palette, ~1200px shell, intro split, 55/45 exhibits, alternate second exhibit only on wide screens. Each figure uses meaningful role/number/metric typography; no generic icon tiles. Use fluid minmax(0,1fr), min-width:0, overflow-wrap for prose; collapse <=900px to image-first single column. Avoid cropped evidence screenshots. Numeric values nowrap inside otherwise responsive labels. Reusable components also scoped to future research-editorial body.
- [ ] GREEN focused tests then full suite >=342; git diff --check. Commit only task files. Report to .superpowers/sdd/portfolio-task-1-report.md with RED/GREEN commands/results.
- [ ] Independent reviewer inspects task package; fresh fix agent resolves findings and reviewer rechecks.

### Task 2: Three case heroes and editorial reading layouts

**Files:** research/scholarlens/index.html, research/retailflow/index.html, research/tooltune/index.html; assets/research-portfolio.css; tests/research-portfolio.test.mjs and relevant existing research tests.

**Interfaces:** consume Task 1 .portfolio-visual, tags, CTA and palette; append research-editorial body class. Use .portfolio-cover-copy and .portfolio-facts around existing cover content; four original chapter IDs remain.

- [ ] Read spec and Task 1 stylesheet/components. Before editing, capture SHA256 of each existing article.archive-content outerHTML, place stable expected hashes in the regression test.
- [ ] Write RED checks requiring stylesheet last, new body class/hero figures, original article hashes, section links, semantic facts dl and accurate graphic caveats. Update exact body-class regex to accept added class, not weaken to mere name presence. Preserve existing h1 markup, historical facts and screenshot hashes.

```js
const article = text.match(/<article class="archive-content">[\s\S]*?<\/article>/)?.[0];
assert.ok(article);
assert.equal(createHash("sha256").update(article).digest("hex"), expectedHash);
```

- [ ] Run focused tests and record RED. Add shared stylesheet last and research-editorial body class. Inside original section.archive-photo.research-cover, put original label/h1/intro in portfolio-cover-copy, add tags and 查看实验结果 link, then corresponding truthful visual from Task 1. Preserve research-cover-name span. Place three-cell portfolio-facts dl after cover before archive-layout.
- [ ] Facts strip must communicate scope/method/evidence boundary using existing facts. ScholarLens distinguishes 240-answerable retrieval vs 100 generation; RetailFlow distinguishes historical Test vs seen Dev and simulated operations; ToolTune distinguishes Validation selection vs Test 190 and single-tool scope.
- [ ] In scoped CSS remove cover stripe, make cover two columns with constrained title sizing, evidence plate right; stack <=900px. Reading layout minmax(0,150px) minmax(0,820px), gap responsive; vertical sticky index only >1024px, static horizontal <=1024px. Three facts columns collapse gracefully. Existing article remains byte-identical; style headings, paragraphs, evidence records, tables and details through scoped rules. Keep numeric table cells unbroken inside focusable overflow regions; do not flatten distinct evaluation phases into one statistic.
- [ ] Run focused GREEN then full suite, syntax checks for changed tests, git diff --check. Commit. Report .superpowers/sdd/portfolio-task-2-report.md.
- [ ] Independent task reviewer gate and fix/re-review loop.

## Controller visual acceptance and publication

- [ ] Review spec/plan independently before task dispatch. Resolve design questions autonomously per user delegation.
- [ ] Browser inspect four research routes at 1440×900, 1024×768, 720×900, 320×568 and light/dark. Actual screenshots must show clear first-screen hierarchy, three distinct visuals, legible metadata, complete numeric values and no whole-page overflow. Check focus/navigation, Enter/Space details, table scrolling, theme persistence; inspect real screenshot/image fallback and reduced-motion contract.
- [ ] If visual defect, dispatch fresh fix agent, focused verification, re-review and browser recheck. Record tool limits honestly.
- [ ] Full suite >=342; JS syntax, real note sync --check, git diff --check; verify unchanged out-of-scope paths and dirty report hash. Final independent whole-branch review.
- [ ] After approval, fast-forward main checkout master, push, compare feature/master/origin/master/live SHA, wait Pages success and verify four pages + new CSS. Preserve worktree and original uncommitted files.
