# Task 1 implementation report — research overview and shared portfolio exhibits

## Implemented

- Rebuilt `research/index.html` as a 1200px coastal research portfolio overview with a split introduction, compact horizontal project index, and three wide exhibits. ScholarLens shows the tracked real screenshot; RetailFlow shows a labeled four-role HTML schematic; ToolTune shows two exact values against a shared visible 0–100% scale. The second visual alternates on wide screens via CSS while the DOM remains visual-first for every exhibit.
- Preserved all three original project descriptions, work summaries, statuses, case routes and GitHub links. New results include their denominators and explicit limitations. The original `archive-photo` and `archive-layout` hooks remain.
- Added scoped `assets/research-portfolio.css` after `research-cases.css`. Both light and dark palettes are defined under `research-portfolio` / `research-editorial`, with reusable `portfolio-*` visual components, a <=900px single-column layout, uncropped screenshot sizing, fluid columns, minimum widths of zero, wrapping prose, and noncolor numeric labels. The introduction uses a 16em measure and balanced wrapping after controller screenshot feedback about an orphan character.
- Migrated layout-sensitive overview assertions in `tests/research-cases.test.mjs` and `tests/archive-atlas.test.mjs` to the authorized markup while retaining factual and link coverage. Added six meaningful `tests/research-portfolio.test.mjs` cases.

## TDD evidence

- Initial RED command: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-portfolio.test.mjs tests/research-cases.test.mjs tests/archive-atlas.test.mjs`. The five new tests failed as expected: absent `research-portfolio` body/style, absent ScholarLens/RetailFlow/ToolTune exhibits, and `ENOENT` for `assets/research-portfolio.css`. Existing unrelated checks passed.
- During layout polish, RED command: `.../node --test tests/research-portfolio.test.mjs`. Output: `tests 6`, `pass 5`, `fail 1`; the new balanced-wrapping CSS check failed before the CSS edit.
- Final focused GREEN command: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-portfolio.test.mjs tests/research-cases.test.mjs tests/archive-atlas.test.mjs`. Output: `tests 135`, `pass 135`, `fail 0`.
- Final full suite: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`. Output: `tests 348`, `pass 348`, `fail 0` (baseline floor 342).
- `git diff --check`: passed with no output.
- Verified screenshot SHA-256 remains `35ed26e1bce896f10a91d9a1d22c6b24af8c5dc6ecac229d875c2716e6e065be`.
- Measured text contrast ratios: light muted 6.50:1, accent 6.97:1, copper 6.19:1, blue on plate 5.62:1; dark muted 10.44:1, accent 11.08:1, copper 10.49:1, blue on plate 8.55:1. All exceed 4.5:1.

## Files changed

- `research/index.html`
- `assets/research-portfolio.css` (new)
- `tests/research-portfolio.test.mjs` (new)
- `tests/research-cases.test.mjs`
- `tests/archive-atlas.test.mjs`
- `.superpowers/sdd/portfolio-task-1-report.md` (this report)

## Self-review and concerns

- Confirmed all new CSS selectors are rooted in `research-portfolio` or `research-editorial`, including dark and responsive rules. Confirmed the ToolTune bars are literal 46.84% / 52.63% widths inside equal 100% tracks; both ratios and 0–100% endpoints remain visible as text.
- Confirmed the screenshot uses its actual local PNG, intrinsic 1440×900 dimensions, `width:100%`, `height:auto`, and `object-fit:contain` so no evidence content is cropped.
- Browser screenshot acceptance across breakpoints and themes is assigned to the controller; it remains the only unverified visual gate for this task. In particular, the revised subtitle wrapping needs screenshot confirmation.
- Existing modified `.superpowers/sdd/task-4-report.md` was preserved and excluded from this task commit.
