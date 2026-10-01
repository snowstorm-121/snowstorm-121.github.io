# Coastal Task 3 — editorial archive entry pages

## Scope and implementation
- Replaced `learning/index.html`, `living/index.html`, and `research/index.html` with semantic coastal photo strips and an index/content directory.
- All pages load the theme script synchronously before styles, the shared theme tokens, and `archive-directory.css`. Their native tide-pin toggle sits in a header whose surface is the same `--reading-surface` as the page.
- Learning keeps eight canonical static stage anchors in published order, defaults visibly to foundation with a native stage destination, and includes all five Task 2 output hooks. Article output is an ordered list. Only learning loads `learning-directory.js`; its published JSON source stays unchanged.
- Living/research preserve each of their four category names, descriptions and order. Every category is a noninteractive semantic list item with an explicit “尚未发布” span. Index labels are plain text.
- Existing coast/living/research image files are referenced in CSS; image bytes were not changed. Photos have solid deep-coast and gradient fallback layers. Content and directory are on opaque theme paper.
- At 720 px the grid becomes one fluid column; layout children have min-width 0 and anywhere wrapping, readable 16 px body text and native focus outlines. No pointer runtime, geometry, parallax or animation is introduced.
- Removed obsolete atlas CSS/JS after checking that three page references were gone. Did not remove the separate cursor resources or any unrelated assets.
- Preserved the dirty `.superpowers/sdd/task-4-report.md`; it is excluded from staging.

## Tests and RED → GREEN evidence
All commands use bundled Node:
`/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

1. Migrated all 78 cases in `tests/archive-atlas.test.mjs`, without reducing the number. Contracts now cover every page shell, theme loading and native switch, all eight real static stage labels/order/destinations, each unpublished category, actual runtime rendering through HTML anchors of all 32 published titles/URLs in order, foundation default, keyboard/hover boundaries, malformed/unavailable JSON, unsafe URLs and stage order, photo fallbacks, opaque surfaces, native focus, responsive flow and resource removal.
2. RED: `node --test tests/archive-atlas.test.mjs` against original atlas pages → **78 tests; 8 pass; 70 fail**. Missing editorial shell/anchors/styles and still-present old resources caused expected contract failures. Evidence: `/tmp/coastal-task-3-red.log`.
3. Initial GREEN: same command after implementing pages/CSS/removal → **78 pass; 0 fail**. Evidence: `/tmp/coastal-task-3-green.log`.
4. First full suite → **272 tests; 271 pass; 1 fail**. Sole failure was an obsolete living atlas contract in `tests/homepage-hero.test.mjs` (expected old class/title spans). Parent explicitly authorized surgical migration of this test. Its meaning and count are preserved: exactly four semantic non-navigable living entries with original names/metadata; it additionally verifies four unpublished labels.
5. Self-review found that a 36% photo veil could fail contrast over a bright pixel at a narrow width. Added a >=76% veil requirement to the existing photo test first: **78 tests; 77 pass; 1 fail**. Evidence: `/tmp/coastal-task-3-contrast-red.log`. Changed only the three gradient ends from .36 to .76.
6. Initial focused `node --test tests/archive-atlas.test.mjs tests/homepage-hero.test.mjs` → **142 pass; 0 fail**.
7. Initial full `node --test tests/*.test.mjs` → **272 pass; 0 fail**. Parent requested checking why Task 2 had 284. Inspection found the old file contained 78 literal test declarations plus 12 additional parameterized cases (four contracts repeated for each of the three pages at old lines 327–365), for an actual 90 cases. The new initial suite had 78 runtime cases. Restored the total to 90 by adding twelve meaningful page-integrated schema fallback cases: missing reference array/stage/label/member, duplicate stage member, wrong ownership, duplicate ID, noncontiguous order, wrong sequence endpoint, unknown/self/duplicate references. Each verifies all eight original anchors and canonical destinations remain intact with no rendered article links and visible unavailable status. Also retained old external/relative/non-note URL and untrusted-stage schema cases in the existing unsafe-data test.
8. Final focused → **154 pass; 0 fail**; final full → **284 pass; 0 fail**, restoring the Task 2 count exactly. Evidence: `/tmp/coastal-task-3-focused.log`, `/tmp/coastal-task-3-full.log`.
9. `node --check assets/learning-directory.js` passed.
10. `git diff --check` passed.
11. `rg -n 'archive-atlas\\.(css|js)|cursor-shoal\\.(css|js)' learning/index.html living/index.html research/index.html` returned no matches.

## Self-review and boundaries
- Public URLs, 32-note data/order/title mapping and old destinations remain valid. The tests access each static destination and execute the real Task 2 controller against the actual page anchor contract.
- Theme surface overrides follow library.css in cascade. Directory/page styles use shared theme variables; photo copy stays light on a strong dark veil in both modes.
- All eight empty categories have no links or buttons; normal archive navigation and theme toggle remain available.
- No Markdown/note body/manifest/relations/images were edited.
- No direct browser visual QA was claimed in this task. Parent-level multi-viewport visual and interaction verification remains required by the overall approved spec.
- Test migration of the one homepage living assertion is the sole scope addition, explicitly authorized by the parent because the test directly covered these changed entry pages.
