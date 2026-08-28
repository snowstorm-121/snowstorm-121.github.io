# Cursor selection fallback fix

## Scope

- Changed `assets/cursor-shoal.css` and `tests/homepage-hero.test.mjs` only.
- Added this required report.
- Left the pre-existing `.superpowers/sdd/task-4-report.md` modification untouched and unstaged.

## Root cause

The broad selection fallback used `html[data-moon-scale-selecting="true"] :where(body, body *)`, whose specificity did not exceed the warm-gold clickable-control cursor rule. A selected link or button could therefore retain the custom cursor.

## RED

Added an assertion requiring a selection override for the same clickable controls with the normal shoal/cursor opt-in attributes plus `data-moon-scale-selecting="true"`.

```text
node --test tests/homepage-hero.test.mjs
73 tests: 72 pass, 1 fail
AssertionError: required clickable-control selection override was absent
```

## GREEN

Added one narrow `cursor: auto` rule for enabled links, buttons, summaries, selects, and role-buttons only while all three opt-in/selection data attributes are true. The ordinary warm-gold cursor rule is unchanged outside text selection.

## Verification

```text
node --test tests/homepage-hero.test.mjs  73 pass, 0 fail
node --test tests/*.test.mjs              234 pass, 0 fail
git diff --check                          exit 0
```
