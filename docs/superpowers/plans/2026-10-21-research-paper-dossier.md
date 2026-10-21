# Research Paper Dossier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the ScholarLens and RetailFlow case pages as two refined, accessible paper dossiers without changing their factual claims or any other public page.

**Architecture:** Preserve the static HTML, existing anchor IDs, theme script, evidence content, tables and native disclosures. Add a small case-only visual layer to `assets/research-cases.css`; distinguish the two dossiers with body modifiers. No runtime data or new dependencies.

**Tech Stack:** Static HTML/CSS, existing `reading-theme.js`, Node built-in test runner.

## Global Constraints

- Only `/research/scholarlens/` and `/research/retailflow/` change visually; `/research/`, homepage, notes, assets and all old URLs remain unchanged.
- Retain exact experimental denominators, failures, dates, qualifications, project sources and upstream attribution. Do not invent visual evidence.
- Keep existing native theme switch, links, table semantics, screenshot bytes, `<details>` and keyboard/touch access.
- Preserve the unrelated modified `.superpowers/sdd/task-4-report.md`.
- Full test count must not fall below 328; run syntax, note-sync, `git diff --check` and browser QA at 1440×900, 1024×768, 720×900, 320×568 in both modes.

## File map

- `research/scholarlens/index.html`: case identifier, semantic cover and authentic evidence presentation; preserve all content.
- `research/retailflow/index.html`: case identifier, semantic cover and phase-separated ledger; preserve all content.
- `assets/research-cases.css`: case-scoped cover, navigation, document typography, evidence treatments, responsive and dark variables; existing overview selectors remain intact.
- `tests/research-cases.test.mjs`: structural and integrity checks for both dossiers.

---

### Task 1: Shared dossier cover and reading geometry

**Files:** Modify `research/scholarlens/index.html`, `research/retailflow/index.html`, `assets/research-cases.css`, `tests/research-cases.test.mjs`.

**Interfaces:** Consumes existing `.research-case`, `.archive-photo`, `.archive-layout`, `.archive-index`, `.archive-content`, theme variables. Produces `.research-case--scholarlens`, `.research-case--retailflow`, `.research-cover`, and case-only CSS custom properties for later tasks.

- [ ] **Step 1: RED.** Add a Node test that reads both case HTML files and CSS, asserts case body modifier and cover class, requires `research-case .archive-layout` single-column override, and confirms research overview HTML hash before/after task. Use `assert.match(html, /class="archive-page archive-research research-case research-case--(?:scholarlens|retailflow)"/)`, `assert.match(html, /class="archive-photo research-cover"/)`, and `assert.match(css, /\.research-case \.archive-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)`.
- [ ] **Step 2: Run** `node --test tests/research-cases.test.mjs`; expect new test FAIL on missing modifiers.
- [ ] **Step 3: GREEN.** Add corresponding body modifier to each HTML file. Add `research-cover` to the existing cover section. Keep heading, intro and chapter links. Add these case-only declarations (extend them only where necessary for the approved mockup):

```css
.research-case { --case-paper:#f3f1ea; --case-ink:#242621; --case-copper:#9a5e43; --case-rule:#b9b5aa; background:var(--case-paper); color:var(--case-ink); }
[data-reading-theme="dark"] .research-case { --case-paper:#171a19; --case-ink:#eee9de; --case-copper:#d5a487; --case-rule:#595b53; }
.research-case .archive-header { background:var(--case-paper); border-color:var(--case-rule); }
.research-case .archive-photo { min-height:0; background:var(--case-paper); color:var(--case-ink); border-bottom:1px solid var(--case-rule); padding:clamp(30px,6vw,76px) clamp(22px,5vw,60px) 35px; }
.research-case .research-cover::after { display:block; height:6px; margin-top:36px; background:repeating-linear-gradient(90deg,var(--case-copper) 0 30px,var(--case-paper) 30px 38px,var(--case-ink) 38px 72px,var(--case-paper) 72px 80px); content:""; }
.research-case .archive-layout { grid-template-columns:minmax(0,1fr); gap:0; margin-top:0; }
.research-case .archive-index { border-right:0; border-bottom:1px solid var(--case-rule); padding:12px 0; }
.research-case .archive-content { width:min(100%,820px); margin:0 auto; }
```
- [ ] **Step 4: Run** `node --test tests/research-cases.test.mjs`; expect PASS. Verify `/research/` source unchanged with `git diff -- research/index.html` (empty).
- [ ] **Step 5: Commit** only task files, message `style: establish paper dossier case layout`.

### Task 2: ScholarLens evidence plate and metric hierarchy

**Files:** Modify `research/scholarlens/index.html`, `assets/research-cases.css`, `tests/research-cases.test.mjs`.

**Interfaces:** Consumes Task 1's `.research-case--scholarlens` and scoped paper variables. Produces `.research-source-plate` around the existing tracked screenshot, and isolated visual treatment for `.research-evidence-ruler`.

- [ ] **Step 1: RED.** Add a test asserting `class="research-source-plate"`, screenshot `src="../assets/scholarlens-demo.png"`, the original caption's “演示题不计入正式评测”, and CSS `.research-case--scholarlens .research-evidence-ruler`. Also assert the screenshot's SHA-256 remains the existing `35ed26e1bce896f10a91d9a1d22c6b24af8c5dc6ecac229d875c2716e6e065be`.
- [ ] **Step 2: Run** `node --test tests/research-cases.test.mjs`; expect FAIL on absent source-plate class.
- [ ] **Step 3: GREEN.** Change only the screenshot figure to `<figure class="research-source-plate">` while retaining image and caption. Add this CSS and refine spacing against the screenshot; do not alter metric strings or their table:

```css
.research-case--scholarlens .research-source-plate { margin:42px 0; padding-top:14px; border-top:2px solid var(--case-ink); }
.research-case--scholarlens .research-source-plate::before { display:block; margin-bottom:14px; color:var(--case-copper); font:12px/1.5 ui-monospace,monospace; letter-spacing:.12em; content:"01 / 原始证据 · 本地界面"; }
.research-case--scholarlens .research-source-plate img { border:1px solid var(--case-rule); }
.research-case--scholarlens .research-marginalia { padding:18px 0; background:transparent; border:0; border-top:2px solid var(--case-ink); border-bottom:1px solid var(--case-rule); }
.research-case--scholarlens .research-evidence-ruler { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }
.research-case--scholarlens .research-evidence-ruler strong { display:block; margin:8px 0; color:var(--case-copper); font:clamp(34px,5vw,52px)/1 Georgia,serif; font-variant-numeric:tabular-nums; }
```
- [ ] **Step 4: Run** `node --test tests/research-cases.test.mjs`; expect PASS. Inspect that a label never claims the screenshot is a Test result.
- [ ] **Step 5: Commit** only task files, message `style: frame ScholarLens evidence as a source plate`.

### Task 3: RetailFlow phase ledger and process dossier

**Files:** Modify `research/retailflow/index.html`, `assets/research-cases.css`, `tests/research-cases.test.mjs`.

**Interfaces:** Consumes Task 1's `.research-case--retailflow` and scoped paper variables. Produces `.research-process-plate` for the existing factual ordered flow; retains `.research-version-ledger` and `.research-proof-slip` data.

- [ ] **Step 1: RED.** Add a test requiring `<figure class="research-process-plate">`, visible “流程示意”, `B0 / B1 / B2 各 0/4`, `V5 1/9 · V4 2/9`, “不直接比较”, and CSS rule `.research-case--retailflow .research-version-ledger`. Assert no `<svg>`/`<canvas>`/new `<img>` was added to RetailFlow.
- [ ] **Step 2: Run** `node --test tests/research-cases.test.mjs`; expect FAIL on absent process-plate class.
- [ ] **Step 3: GREEN.** Add the figure class without changing ordered flow contents. Preserve historical Test and current Dev statements verbatim. Add these rules and refine spacing against the screenshot; no arrow or fabricated system state:

```css
.research-case--retailflow .research-process-plate { margin:42px 0; padding-top:14px; border-top:2px solid var(--case-ink); }
.research-case--retailflow .research-flow { list-style:decimal-leading-zero; padding-left:42px; }
.research-case--retailflow .research-flow li { padding:14px 0 16px 8px; margin:0; border:0; border-bottom:1px solid var(--case-rule); }
.research-case--retailflow .research-flow li::marker { color:var(--case-copper); font-family:Georgia,serif; }
.research-case--retailflow .research-version-ledger { background:transparent; border:0; border-top:2px solid var(--case-ink); border-bottom:1px solid var(--case-rule); padding:18px 0; font-variant-numeric:tabular-nums; }
.research-case--retailflow .research-proof-slip { border-top:2px solid var(--case-ink); }
```
- [ ] **Step 4: Run** `node --test tests/research-cases.test.mjs`; expect PASS. Confirm text search still finds all four Test failures and the limitation statements.
- [ ] **Step 5: Commit** only task files, message `style: distinguish RetailFlow process and evidence phases`.

### Task 4: Responsive, accessibility and visual acceptance

**Files:** Modify `assets/research-cases.css`, `tests/research-cases.test.mjs` only if checks expose a real gap.

**Interfaces:** Consumes both complete dossiers; produces final responsive/dark behavior with no HTML API change.

- [ ] **Step 1: RED.** Add tests asserting case-scoped dark variables, wrap-enabled chapter navigation, `44px` anchor targets, constrained screenshots and horizontally scrollable tables. Require `@media (max-width:720px)` to set `.research-evidence-ruler` and `.research-version-ledger` to one column. Run `node --test tests/research-cases.test.mjs`; expect FAIL for any missing rule.
- [ ] **Step 2: GREEN.** Add only missing responsive rules: chapter index `display:flex; flex-wrap:wrap; gap:0 18px`, list items with no column-breaking border, anchors `min-height:44px`; at 720px and below set the evidence/ledger grids to `minmax(0,1fr)` and reduce cover padding; at 360px and below prevent overflow of titles and long identifiers with `overflow-wrap:anywhere`. Preserve focus styling and native `<details>`; no animation or custom cursor.
- [ ] **Step 3: Run** `npm test` (>=328 PASS), `node --check assets/reading-theme.js`, `node scripts/sync-pytorch.mjs --check`, `git diff --check`; record exact counts and exits. If sync CLI uses a different check flag, inspect `node scripts/sync-pytorch.mjs --help` or source before running the correct read-only check.
- [ ] **Step 4: Browser QA.** Serve the isolated worktree, inspect both routes at 1440×900, 1024×768, 720×900 and 320×568 in day/night. Check hero, evidence, long content, no horizontal page overflow, chapter anchors, theme switch, keyboard Tab/Enter, touch targets, screenshot fallback and reduced-motion. Fix only observed failures, rerun relevant tests.
- [ ] **Step 5: Commit** only actual Task 4 changes, message `test: validate paper dossier responsive behavior`. If no changes are required, record QA in the task report and do not create an empty commit.

## Review and integration

Each task follows fresh implementer → RED → GREEN → commit → independent reviewer, then fix/re-review if needed. After Task 4, dispatch a different whole-branch reviewer against this specification, verify tests again, and only then consider integration. Do not merge/push without explicit authorization for this iteration. Do not stage the unrelated `.superpowers/sdd/task-4-report.md` or preview files.
