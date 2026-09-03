# Atlas Order Contract Fix Report

Date: 2026-09-03
Base HEAD: `479aaeb`

## Scope

- Updated `assets/archive-atlas.js`
- Updated `tests/archive-atlas.test.mjs`
- Left existing `.superpowers/sdd/task-4-report.md` untouched

## RED

Command:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs
```

Observed failure:

- `reordered note arrays that violate manifest order contract fall back to static atlas controls`
- Actual `root.dataset.atlasRelations`: `ready`
- Expected: `fallback`

This reproduced the review finding that `validateRelations()` accepted a reordered `data.notes` input because it only validated a sorted copy, while `mountRelations()` still rendered from the original array.

## Fix

- Added a validator check that each original `data.notes[index]` must satisfy `note.order === index`
- Kept mount behavior unchanged
- Did not introduce sorting, API changes, or fallback variants beyond the existing static fallback

## GREEN

Commands:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js
git diff --check
```

Results:

- `70` tests passed, `0` failed
- JavaScript syntax check passed
- Diff whitespace check passed

## Self Review

- Fix is minimal and localized to the validator contract
- New test exercises the exact bad input shape from the review
- Invalid reordered JSON now falls back to the static eight-stage navigation instead of rendering misordered dynamic notes
