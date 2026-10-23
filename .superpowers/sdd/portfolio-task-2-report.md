# Task 2 implementation report

## Implemented

- Added evidence-led covers to ScholarLens, RetailFlow, and ToolTune using the shared `portfolio-visual`, tags, and palette. Each cover retains its original h1, intro, case label, URL, and native chapter links.
- Added a three-part semantic `dl` for research scope, method, and evidence boundary. ScholarLens separates 240 retrieval questions from 100 generation questions; RetailFlow separates historical frozen Test from seen Dev; ToolTune separates Validation model selection from the 190-question Test.
- Added scoped editorial styles for two-column desktop covers, stacked narrow covers, an 820px reading column, a 150px index with constrained sticky scrolling, responsive facts, and intact numeric table cells in the existing focusable overflow regions. The legacy cover stripe is removed only on these three pages. Light and dark reading/case tokens map to the shared portfolio palette within `research-editorial`.

## TDD evidence

Before any HTML/CSS change, article `archive-content` outerHTML SHA-256 values were captured and fixed in `tests/research-portfolio.test.mjs`:

| Case | SHA-256 |
| --- | --- |
| ScholarLens | `2bfdef34dd4fb228d0df56c52a8e1980cd3643271f103f15de06c7f97ae32d83` |
| RetailFlow | `0f3c2e0ec797633892e6090116a005eff2ad2595c44e7a27ee855e6bdadd9cc2` |
| ToolTune | `15764e8270f3d7e07104ab1c1340777de0d08714d00979ae2709723366a8aacd` |

RED: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-portfolio.test.mjs tests/research-cases.test.mjs` exited 1: 44 tests, 38 passed, 6 failed. Failures required the new body class, case covers, graphics, and editorial CSS, which were absent as expected. The old exact body-class assertion was updated to require the appended class while preserving the specific case name.

GREEN: the same focused suite with `--test-reporter=dot` exited 0 with 44 passing tests. An intermediate run had one expected copy mismatch (`100 道生成题`), which was corrected in the facts strip without changing article content.

## Verification

- Full suite: `node --test --test-reporter=spec tests/*.test.mjs` (using the absolute bundled Node path) exited 0: **353 tests, 353 passed, 0 failed**.
- `node --check` passed for both changed test files.
- `git diff --check` exited 0.
- Article hash assertions passed for all three originals. Existing real screenshot hash checks also passed.
- Visual browser review is assigned to the controller; no browser was used here.

## Files and self-review

Changed only `research/{scholarlens,retailflow,tooltune}/index.html`, `assets/research-portfolio.css`, `tests/research-cases.test.mjs`, `tests/research-portfolio.test.mjs`, and this report. The pre-existing dirty `.superpowers/sdd/task-4-report.md` was not edited or staged. The overview page was not edited.

Self-review found no article text changes or new dependencies. The first CSS review caught the dark theme's higher-specificity legacy case tokens; a scoped dark override now keeps them on the portfolio palette. Browser visual and interaction checks remain for the controller's acceptance pass.
