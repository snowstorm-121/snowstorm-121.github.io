# WeChat SVG trigger fix

## Scope

- Replaced the WeChat document-click outside check with `!wechatTrigger.contains(event.target)`.
- Added a runtime regression test that opens the popover through a nested SVG-path click sequence and confirms it remains open.
- Added a runtime interaction test confirming a click on an unrelated target still closes the popover.

## Verification

- `git diff --check`: passed.
- `node --test tests/homepage-hero.test.mjs`: blocked because this environment has no `node` executable (`zsh: command not found: node`).
- `node --check assets/homepage/homepage.js`: blocked for the same missing executable.

## Boundaries

No music, layout, dependency, or audio files were changed.
