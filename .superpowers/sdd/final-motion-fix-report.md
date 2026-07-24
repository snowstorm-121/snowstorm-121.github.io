# Final motion fix report

## Scope

This follow-up fixes the three Important whole-branch review findings without changing the homepage content model, audio inventory, archive behavior, or contact behavior.

1. `data-active-section` now drives section reveal, background wash, backdrop brightness, and main-light position. Archive receives the brighter silver-blue environment, Origin again exposes an in-viewport link to Identity, and the unenhanced base rule keeps every section visible with no transform.
2. `track.accent`, native playback state, Dock progress, and lyric index now reach real CSS consumers. Playing enables low-strength Dock and nearby spectrum breathing; pause stops both continuous animations while preserving progress; track and lyric colors transition through the existing local state.
3. Ordinary mode owns the low-strength `ambient-breathe` animation. The 20-second idle state only changes its duration and strength variables from `10s / .34` to `18s / .2` and similarly weakens any already-playing music glow. Reduced motion disables animations and transitions and clears section reveal transforms.

The localhost review also exposed that the author `display: flex` rule overrode `#music-panel[hidden]`. A focused regression and `#music-panel[hidden] { display: none; }` restore the intended initially closed panel.

## TDD evidence

### RED

The first focused run failed all three state-consumption tests:

```text
node --test --test-name-pattern='active section state|track, playback|idle only' tests/homepage-hero.test.mjs
tests 3, pass 0, fail 3
```

After the browser exposed the hidden-panel and scroll-cue issues, the second focused RED run failed both additions:

```text
node --test --test-name-pattern='active section state|closed music panel' tests/homepage-hero.test.mjs
tests 2, pass 0, fail 2
```

### GREEN

Both focused groups passed after their minimal implementations. The complete suite then passed 29 tests with no failures. JavaScript syntax and whitespace checks also exited successfully.

## Desktop localhost review

Checked `http://127.0.0.1:4177/` at `1440 × 900`:

- Initial state: `activeSection=origin`, the music panel computed to `display:none`, the scroll cue occupied `y=842–886`, and horizontal overflow was `0`.
- Archive: keyboard navigation set `activeSection=archive`; content reached `opacity:1` and neutral transform; the backdrop transitioned toward `rgba(116, 159, 191, .26)` with `brightness(1.18)` and a shifted main light.
- Playback: native audio advanced, Dock progress moved from zero, and computed animations were `dock-breathe` plus `spectrum-breathe`.
- Track change: selecting `稻香` changed `--track-accent` to `#e4bb83`; the computed spectrum color showed an intermediate value during the declared `background-color` transition and a distinct settled value.
- Pause: both continuous animation names returned to `none`; the nonzero Dock progress remained visible.
- Idle: before 20 seconds, the existing ambient animation was `ambient-breathe` at `10s / .34`; after 20 seconds, the same animation remained active at `18s / .2`. The next click immediately restored `10s / .34`.
- Browser console: no page errors or warnings.

The browser control surface did not expose a reduced-motion media emulation control. Reduced-motion behavior is covered by the Node CSS contracts and the stylesheet’s `prefers-reduced-motion` block.

## Verification commands

```text
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js
git diff --check
```
