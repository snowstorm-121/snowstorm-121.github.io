# Task 4 report — global Music Dock and lyrics panel

## RED → GREEN

- RED: added the two Task 4 music-interface tests, then ran the required name-pattern command. Both failed as expected: the page lacked `#current-lyric` and the script lacked `openMusicPanel()`.
- GREEN: implemented the Dock/panel shared controls, immutable track data, native audio loading, LRC rendering, and deterministic close behavior. The same focused command passed 2/2.

## Changed files

- `index.html`: one `#profileAudio`, fixed Dock controls, expandable dialog panel, progress indicator, and previous/current/next lyric nodes. `#current-lyric` is the sole polite live region.
- `assets/homepage/homepage.js`: one frozen `TRACKS` table; `loadTrack(index, { autoplay })`; Dock/panel rendering over the same audio; LRC cache and three-line rendering; guarded live-region writes; Escape/outside close plus focus return.
- `assets/homepage/homepage.css`: responsive fixed Dock; desktop panel positioned above it; mobile bottom sheet with safe-area height, scrolling track/lyric content, and persistent close/control row.
- `tests/homepage-hero.test.mjs`: the two required static interface/resource tests.

## Verification

- `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='music Dock uses|music panel has' tests/homepage-hero.test.mjs` — 2 passed, 0 failed.
- `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs` — 16 passed, 0 failed.
- Browser check over a local-only HTTP server: every one of the nine track buttons selected its matching title and reported the shared native audio as unpaused; the `稻香` check advanced to `currentTime` 0.859s and rendered LRC. Escape closed the panel and returned focus to `#music-dock-expand`; clicking outside closed it. At 320×700, the panel was a bottom sheet from y=87.5 to y=700, with the close row visible at y=104.5–146.5.
- `git diff --check` completed with no whitespace errors.

## Self-check / concern

- Origin, Identity, Archive, Connection, QQ, and WeChat code paths were not changed.
- The browser automation surface did not expose request interception, so I could not force one LRC fetch failure through DevTools. The implemented fetch `catch` preserves native playback and renders `歌词暂不可用`; this error path is code-reviewed but not browser-forced in this run.

## Reviewer follow-up — persistent lyric status, outside focus, and Dock clearance

- RED: added three focused static regressions. On the reviewed implementation, they failed because LRC failure state was only rendered to the DOM, outside-close passed `returnFocus: false`, and the body padding omitted the desktop 14px Dock gap.
- GREEN: `lyricStatus` now persists loading/unavailable states across `timeupdate` while progress continues to update; successful nonempty LRC data clears that state. Neither empty nor failed LRC loading pauses the native audio. Outside-click now closes with focus returning to `#music-dock-expand`.
- Layout: `--dock-offset` centralizes the desktop 14px spacing in both Dock placement and `body` block-end padding, then resets to `0px` on mobile while preserving the safe-area inset.
- Verification: focused regression suite 3 passed; full Node suite 19 passed; `node --check assets/homepage/homepage.js` and `git diff --check` both exited 0.

## Reviewer P2 follow-up — mobile panel controls and behavioral coverage

- RED: the new mobile layout contract failed because the panel lacked a dedicated `.music-panel-scroll`; after a 320×480 browser check also exposed the sticky site header covering the close row, the contract failed again until the mobile panel was raised above that header.
- GREEN: `music-panel-header` and the now-playing/transport/progress controls stay outside `.music-panel-scroll`. The mobile panel remains bounded by `max-height: calc(100dvh - env(safe-area-inset-top))`, hides outer overflow, and gives the inner content/list its own vertical scroll. Its mobile `z-index: 11` keeps close and transport above the site header (`z-index: 10`).
- Behavioral regression: a `node:test` FakeDocument/FakeAudio runtime executes the real `homepage.js`, rejects LRC fetch, dispatches `timeupdate`, then opens the panel and dispatches a document outside click. It asserts the unavailable lyric text persists, audio remains unpaused, the panel closes, and focus returns to the Dock expand button.
- Browser result / screenshot captured: at 320×480, header spans y=17–59 and fixed controls y=59–228.5 while the internal scroll region spans y=228.5–464 (`overflow-y:auto`, 236px client height, 322px scroll height). Scrolling that region to its bottom (`scrollTop: 87`) left header and controls at those same coordinates; panel z-index was 11 against the site header's 10.
