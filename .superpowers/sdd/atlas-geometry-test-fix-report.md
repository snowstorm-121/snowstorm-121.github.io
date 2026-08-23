# Atlas geometry-test fix report

## Scope

Changed only `tests/archive-atlas.test.mjs`. Production CSS remains unchanged.

## Root cause

- The chart model derived a responsive width but treated desktop chart height as only the larger of chart and layout minimum heights. It omitted the automatic grid-row expansion caused by each page's index content. At 1024x768 the learning page has eight directory rows, so its index's CSS minimum content height exceeds the `578px` layout minimum.
- The motion guard collected only `from` and `to` blocks and handled only a narrow translation syntax. A percentage keyframe using `translateY()` could therefore move a marker off its route endpoint without being evaluated.

## RED

Before changing the helpers, I added two regressions and ran:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs
```

Result: 8 passed, 2 failed.

- `atlas geometry checks every named and percentage keyframe state for translate motion` failed because the old scan returned only `from` and `to`, omitting `50%` and `75%` `translateY(4px)` states.
- `atlas geometry accounts for page-specific index rows when sizing a desktop chart` failed because the prior height calculation returned `578px` instead of including the eight-row learning index.

## GREEN

- Added a keyframe-state parser that expands every comma-separated `from`, `to`, and percentage selector and evaluates individual `translate` plus `translate`, `translate3d`, `translateX`, and `translateY` transform functions.
- Derived shell width, grid gap/sidebar width, viewport layout minimum, and each page's chart height from the current CSS. Desktop chart height now includes a conservative minimum index-content height calculated from the page's actual directory row count and the index's CSS dimensions.

Fresh verification:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs
# 10 passed, 0 failed

/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
# 168 passed, 0 failed

/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check tests/archive-atlas.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/archive-atlas.js
git diff --check
# all succeeded
```
