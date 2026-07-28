# Task 4 report — richer premium page interaction

## Scope

- `assets/homepage/homepage.css`: layered section reveals, bounded pointer glass lift/tilt/highlight, scene-light offsets, shared press feedback, dual moon ripples, temporary moonlit background, and reduced-motion overrides.
- `assets/homepage/homepage.js`: fine-pointer-only scene-light updates capped at 12px, scene reset on capability changes, and moonlit state lifecycle through the existing moon interaction.
- `tests/homepage-hero.test.mjs`: static motion contracts plus runtime checks for the full-motion and reduced-motion scene-light paths.

No HTML, player data, audio/LRC resources, dependencies, remote assets, or unrelated interfaces changed.

## RED

Command:

`/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='premium motion|scene-light pointer' tests/homepage-hero.test.mjs`

Result: 0 passed, 2 failed as expected.

- The premium-motion test failed because no staged reveal rule existed.
- The scene-light runtime test failed because the fine-pointer move left `--scene-light-offset-x` empty instead of the required capped `12px`.

A follow-up TDD cycle added explicit press-state precedence assertions. The focused premium-motion test failed against the initial selectors because hover specificity could mask press feedback.

## GREEN

- Active sections reveal eyebrow/title/copy/cards/contacts with 80ms short stagger steps, 20px vertical recovery, and 5px blur recovery.
- Existing section state continues to drive background wash/direction; one passive pointer listener writes only `--scene-light-offset-x/y`, each clamped to `[-12px, 12px]`.
- Existing pointer-glass surfaces retain their pointer highlight and use at most 2deg tilt, a 5px hover lift, edge glow, and a 1px press depth.
- Education entries and social controls share the same 5px hover lift and compressed press response.
- The existing moon button now drives two staggered ripples and one 1.35s background-brightening cycle; no timer was added.
- Reduced motion does not enable pointer glass, removes scene offsets, suppresses moon/player/background animation through the existing media query, removes reveal blur/transform, and keeps all state/content logic active.

## Verification

- Focused motion tests: 2 passed, 0 failed.
- Full `tests/homepage-hero.test.mjs`: 49 passed, 0 failed.
- `node --check assets/homepage/homepage.js`: exit 0.
- `git diff --check`: exit 0.

## Self-check

- Lift is exactly 5px, computed card tilt is bounded to +/-2deg, and scene-light parallax is hard-clamped to +/-12px.
- Reveal translation uses a shared custom property so pointer tilt/lift and section entry motion compose instead of overriding each other.
- Playback accent linkage (`data-playing`, track accent, lyric accent) remains unchanged and lower in visual intensity than content.
