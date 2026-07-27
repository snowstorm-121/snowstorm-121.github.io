# Task 4: Living Journal directory

## Files changed

- `living/index.html`
- `assets/library.css`
- `tests/homepage-hero.test.mjs`

## TDD evidence

### RED

Command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="living journal presents" tests/homepage-hero.test.mjs
```

Result: `pass 0`, `fail 1`. The new assertion failed because `living/index.html` had `<main class="library-shell">`, rather than the required Living Journal directory container.

### GREEN

Focused command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="living journal presents" tests/homepage-hero.test.mjs
```

Result: `pass 1`, `fail 0`.

Full command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Result: `pass 35`, `fail 0`.

`git diff --check` completed with no output.

## Self-review

- The former empty-state block is replaced by one semantic `ul.living-directory` with exactly four `li` entries.
- Each entry has the required title and description, and the directory has no anchors, child pages, or dead links.
- The existing `SNOWSTORM / ARCHIVE` return link remains unchanged.
- Glass panel, list rows, and pseudo-element trunk/branch connectors are all scoped through `.living-journal`; other library archive pages retain their existing selectors and behavior.

## Concerns

None identified after the focused suite, full suite, and diff check.
