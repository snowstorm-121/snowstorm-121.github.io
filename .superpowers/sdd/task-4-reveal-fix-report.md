# Task 4 Reveal Cascade Fix Report

## Scope

- Fixed the active-section reveal cascade regression found during final browser validation.
- Changed only the shared reveal selectors, their regression tests, and this report.
- Preserved the existing reveal timing, active-section declarations, pointer effects, and reduced-motion rules.

## Root cause

The shared inactive reveal rule used `:is(...)` around selectors with unequal specificity:

- `#origin .origin-declaration` contributes one ID and one class.
- `#archive > .section-inner > .eyebrow` contributes one ID and two classes.

CSS gives `:is(...)` the specificity of its most specific argument, even when another argument is the one matching the current element. Including the outer `html` and two data attributes, the shared rule therefore had specificity `(1,4,1)`.

The later active Origin rule had specificity `(1,3,1)`. It matched the DOM, but its later source order could not overcome the more-specific shared rule, so Origin copy retained `opacity: .18` and `filter: blur(5px)`. The companion shared translation selector had the same specificity hazard.

The minimal fix changes only the two shared inactive baseline selector lists from `:is(...)` to `:where(...)`. `:where(...)` contributes zero specificity, so the active section rules reliably override the inactive baseline while keeping the same matched elements and reveal semantics.

## TDD evidence

### RED

Command:

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='premium motion|active section reveal rules outrank' tests/homepage-hero.test.mjs
```

Result before production changes:

```text
tests 2
pass 0
fail 2
```

Both tests failed because the shared reveal selector was not the required low-specificity `:where(...)` baseline.

### GREEN

The same focused command passed after the two-selector CSS change:

```text
tests 2
pass 2
fail 0
```

Full regression command:

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Full result:

```text
tests 50
pass 50
fail 0
```

`git diff --check` also passed.

## Files changed

- `assets/homepage/homepage.css`
- `tests/homepage-hero.test.mjs`
- `.superpowers/sdd/task-4-reveal-fix-report.md`
