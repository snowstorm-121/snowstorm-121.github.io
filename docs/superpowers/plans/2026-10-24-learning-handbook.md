# Coastal Learning Handbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Independent implementation, review and final branch review.

**Goal:** Make /learning/ a refined, efficient coastal study directory without changing its data or behavior.

**Architecture:** Scoped HTML presentation and a final-loaded stylesheet over existing controller hooks. Retain original JS and fallback anchors unchanged.

**Tech Stack:** HTML/CSS and Node built-in tests; existing learning-directory.js and reading-theme.js.

## Global Constraints

- Work only in /Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget; preserve dirty .superpowers/sdd/task-4-report.md.
- Follow docs/superpowers/specs/2026-10-24-learning-handbook-design.md. User delegates choices and reviewed publication.
- No changes to assets/learning-directory.js, shared CSS/JS, learning/pytorch/**, research/**, homepage or living. All original URLs and controller hooks remain.
- New body class learning-handbook; all new CSS scoped to it. No new JS/dependencies/fonts/animations, fabricated progress/counts/relations.
- Keep original h1, intro, stage names and order, fallback links, role=status and aria-live. Tests >=354.

### Task 1: Learning overview, stage index and article presentation

**Files:** Modify learning/index.html; create assets/learning-handbook.css and tests/learning-handbook.test.mjs. Existing tests only if an exact layout assertion conflicts with authorized markup; preserve coverage.

**Interfaces:** Original data-learning-directory/data-relations-url and all data-directory-* unchanged. Add learning-handbook body class; learning-hero-copy, learning-hero-image, learning-directory-heading as needed. Add id=learning-directory to existing directory section.

- [ ] Read full spec, learning/index.html, assets/learning-directory.js, assets/archive-directory.css and relevant tests/learning-directory.test.mjs, archive-atlas.test.mjs, legacy-routes.test.mjs.
- [ ] Write failing tests for last CSS link/new class, preserved exact h1/intro/eight keys+hrefs, native #learning-directory anchor, actual image path, stylesheet scoping, active button/noncolor marker, focus44px and <=900 layout. Capture original controller and protected paths hashes from baseline via git show for checks where useful. Example assertions:

```js
assert.match(html, /class="archive-page archive-learning learning-handbook"/);
assert.match(html, /href="#learning-directory"/);
assert.match(html, /id="learning-directory"/);
assert.equal((html.match(/data-directory-stage data-stage-key=/g)||[]).length, 8);
assert.match(css, /\.learning-handbook[^{]*\[aria-pressed="true"\]/);
```

- [ ] RED run `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/learning-handbook.test.mjs tests/learning-directory.test.mjs tests/archive-atlas.test.mjs tests/legacy-routes.test.mjs`; new presentation assertions must fail before implementation.
- [ ] Add final stylesheet link and body class. Wrap original hero label/h1/intro in learning-hero-copy, append `<a class="learning-browse" href="#learning-directory">浏览学习目录 ↓</a>`, sibling `<div class="learning-hero-image" aria-hidden="true"></div>`. Preserve section.archive-photo hook and label. Add id to directory without breaking data attributes. Wrap existing count/title/description/destination in learning-directory-heading only if useful; dynamic querySelector stays valid.
- [ ] Implement scoped paper/deep-sea palette, max1200px shell, light hero two columns (~60/40), title fluid42–64px, pure decorative coastal background, intro balanced without splitting words into lone characters. Desktop directory grid minmax(0,280px) minmax(0,1fr), gap48px. Side rows use CSS counter, 44px button and anchor targets, current active background/left rule and bold. Article ordered list gets decimal-leading-zero markers and block links >=44px; use logical padding and min-width:0, overflow-wrap:anywhere for long titles. Avoid extra components or stale count duplication.
- [ ] <=900px stack hero and directory, stage grid two columns minmax(0,1fr); at320 retain readable naturally wrapping labels, visible links, no page overflow. Wide sticky index max-height:calc(100dvh - 32px); scroll internally, <=900static. New CSS no motion, focus ring visible both themes, fallback backgrounds not dependent on image.
- [ ] GREEN focused suite, full>=354, syntax changed tests, diff check. Self-review style cascade, no-script anchors, current state (button inserted before anchor), word wrapping, color contrast. Commit only scoped task files. Detailed report .superpowers/sdd/learning-handbook-task-report.md records RED/GREEN commands/output and concerns.
- [ ] Independent task reviewer gate; fix and re-review if needed.

## Controller acceptance

- [ ] Browser8viewport/theme states, all8stages against JSON counts/URLs, keyboard/theme, fallback images/JSON and short-height nav. Capture actual screenshots; correct visual defects with separate fix agent and re-review.
- [ ] Fresh full tests>=354, JSsyntax, real notesync --check, working/cumulative diffchecks, protected paths identity and original dirty file hash.
- [ ] Final independent whole-branch review, then authorized merge/push, Pages success, public HTML/CSS/assets verification and SHA equality. Preserve branch/worktree.
