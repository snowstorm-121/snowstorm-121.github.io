# Task 2 Contract Fix Report

## Scope

This follow-up resolves only the three Task 2 plan-contract gaps reported by the final whole-branch review:

1. The collapsed queue now visibly reads `QUEUE · 9 TRACKS` while its accessible name changes between expand and collapse states.
2. All seven player control SVGs use `viewBox="0 0 24 24"` and the shared icon box is exactly `24px × 24px`; controls remain grid-centered and only the play triangle receives a `1px` optical shift.
3. Track changes and lyric changes now set short-lived runtime motion classes. Track cover, title, artist, mood, and accent animate from real player state; lyric lines use a small vertical crossfade. Reduced motion skips these classes while content continues updating.

No player ID, track record, local asset, audio/LRC flow, queue/Escape behavior, live region, dependency, or panel height was changed.

## TDD Evidence

### RED 1: visible queue count

Command:

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='tidal-island collapsed queue' tests/homepage-hero.test.mjs
```

Result: `tests 1`, `pass 0`, `fail 1`.

Expected failure: `#music-queue-toggle` had neither the initial accessible label nor a visible `QUEUE · 9 TRACKS` label, and remained a round icon-only control.

### RED 2: 24-pixel SVG contract

Command:

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='every tidal player SVG' tests/homepage-hero.test.mjs
```

Result: `tests 1`, `pass 0`, `fail 1`.

Expected failure: the first player SVG still exposed `viewBox="0 0 18 18"` and the shared icon box was `18px × 18px`.

### RED 3: runtime-driven transitions

Command:

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='track and lyric changes drive' tests/homepage-hero.test.mjs
```

Result: `tests 1`, `pass 0`, `fail 1`.

Expected failure: production JavaScript had no motion-state helper and track/lyric changes only relied on static CSS transition declarations.

### Focused GREEN

Command:

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='tidal-island collapsed queue|every tidal player SVG|track and lyric changes drive' tests/homepage-hero.test.mjs
```

Result: `tests 3`, `pass 3`, `fail 0`.

The runtime test also proves the transition classes are removed after their bounded timers and are never added in reduced-motion mode.

## Implementation

- `index.html`: converts the seven player SVG coordinate systems and paths to 24px, and adds the visible queue count without changing the queue relationship.
- `assets/homepage/homepage.css`: establishes the 24px icon box, compact queue pill, state-driven track/accent and lyric keyframes, and explicit reduced-motion overrides.
- `assets/homepage/homepage.js`: adds one reusable bounded motion-state helper, carries the previous track accent into the next render, triggers track/lyric state changes, and clears motion classes when reduced motion is selected.
- `tests/homepage-hero.test.mjs`: adds the three contract regressions and a deterministic timer harness for proving short-lived state cleanup.

## Verification

Fresh verification immediately before the commit:

```text
$ /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
tests 54, pass 54, fail 0

$ /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js
exit 0

$ git diff --check
exit 0, no output
```

Static inventory: one `#profileAudio`, nine local MP3 records, nine local LRC records, and one polite `#current-lyric` live region.
