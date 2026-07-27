# Browser Validation Fix Report

## Status

Implemented the four browser-validation fixes on `feature/homepage-visual-refinement` from starting head `8a486b2fadefb7e2a2d63e4a8c0879b274c8d920`.

Changed only:

- `assets/homepage/homepage.css`
- `tests/homepage-hero.test.mjs`
- `.superpowers/sdd/browser-validation-fix-report.md`

No homepage markup, runtime IDs, JavaScript data flow, audio elements, local media declarations, archive destinations, social behavior, or reduced-motion updates were changed.

## TDD evidence

Baseline command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Baseline result: `37` tests, `37` passed, `0` failed.

Initial focused RED command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='browser validation' tests/homepage-hero.test.mjs
```

Initial RED result: `3` tests, `0` passed, `3` failed.

The expected failures were:

- `body` still contained `min-width: 320px`;
- archive preview bottom clearance was below the asserted safe control reserve;
- expanded transport/close controls had no circular icon-control rule.

Initial focused GREEN command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='browser validation' tests/homepage-hero.test.mjs
```

Initial GREEN result: `3` tests, `3` passed, `0` failed.

Live browser validation then found the first `112px` archive preview clearance still overlapped the toggle by about `0.8px` after the card transform. The structural assertion was tightened before the CSS was changed.

Second focused RED command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='fixed archive previews' tests/homepage-hero.test.mjs
```

Second RED result: `1` test, `0` passed, `1` failed.

Second focused GREEN command:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='fixed archive previews' tests/homepage-hero.test.mjs
```

Second GREEN result: `1` test, `1` passed, `0` failed.

## Implementation reasoning

### Responsive origin

- Removed the homepage `body` minimum-width floor so a nominal `320px` viewport no longer creates a `320px` layout inside the narrower scrollbar-adjusted client area.
- Added a height-gated medium rule for `721px–1100px` wide viewports at `800px` height or shorter. This covers the reported `1024×768` failure while leaving the accepted `1440×900` composition and `720×900` layout unchanged. It reduces only the origin story gap, row gap, and decorative cue stem.
- Added a height-gated mobile rule for viewports up to `720px` wide and `700px` high. This covers the reported `320×568` short screen, compacts the same normal-flow origin rows, and reserves Dock/safe-area space in the origin bottom padding. The ordinary `720×900` mobile layout does not enter this short-height rule.
- Search and quote remain separate fixed grid rows; their geometry cannot change during the quote typing/deletion transition.

### Archive preview

- Kept the preview absolutely positioned and fixed at `104px` high.
- Increased its bottom reserve to `120px`.
- Pinned the preview toggle with `margin-top: auto` and placed the direct destination `12px` below it, creating a deterministic bottom control zone.

### Expanded player

- Kept the visible-control text nodes (`上一首`, `播放`, `下一首`, `关闭`) in the DOM as the accessible names.
- Rendered their visual treatment as centered `38px` circular controls with CSS pseudo-element icons.
- Removed hard track-row borders, added a quiet translucent glass fill and rounded corners, and used an inset accent for the active track.

## Browser verification

Rendered from a localhost static server after the final CSS change:

- `1024×768`: quote bottom `665.83`, cue bottom `704.33`, Dock top `698`; both quote/Dock and cue/Dock intersection checks were false because the cue is horizontally separate from the right-side desktop Dock. `scrollWidth === clientWidth === 1009`.
- `720×900`: quote/Dock, cue/Dock, and quote/cue intersection checks were all false. `scrollWidth === clientWidth === 705`.
- `320×568`: quote bottom `474.42`, cue bottom `508.92`, Dock top `512`; all intersection checks were false. `scrollWidth === clientWidth === 305`.
- `1440×900`: supporting copy measured exactly one line; the search slot remained `620×82`.
- Expanded learning preview at `320×568`: `7.10px` gap to the toggle and `62.19px` gap to the direct destination; neither intersection check was true.
- Expanded player at `1024×768`: panel rect remained within the viewport; transport and close controls computed to `38×38`, `border-radius: 50%`, and retained text content for accessible names; track rows computed with no border and a `12px` radius.
- Closing the expanded player returned focus to `#music-dock-expand`, set `aria-expanded="false"`, and hid the panel.

## Final verification

Final commands:

```sh
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='browser validation' tests/homepage-hero.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
git diff --check
```

Final result: focused `3/3` passed, full suite `40/40` passed, and `git diff --check` exited `0` with no output.

## Concerns

None known. The new responsive rules are deliberately height-gated; unusually short viewports outside the tested width ranges may still require separate product decisions, but the reported acceptance sizes and preserved `1440×900` / `720×900` layouts are covered.
