# Clock Lyrics Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hero aperture with a reference-style animated frosted clock widget that synchronizes user-supplied LRC lyrics to the existing local music player.

**Architecture:** Keep the single-page architecture. `index.html` owns the widget’s DOM, CSS and small browser-side functions; LRC files become static assets under `assets/music/lyrics/`. The widget consumes the existing `TRACKS`, `trackIndex`, and `profileAudio` state instead of adding another player.

**Tech Stack:** Static HTML/CSS/JavaScript, Node built-in test runner, local MP3 and LRC assets.

## Global Constraints

- Preserve the existing left avatar, personal introduction, education card, native audio controls and contact links.
- Use only the nine user-provided LRC files from `/Users/yyy/Learning_material/music/LRC`; do not fetch lyrics at runtime.
- Desktop must reserve a dedicated right column for a 220–250px widget and move/limit the center content accordingly; narrow screens must reflow the widget.
- Use real local time, CSS `prefers-reduced-motion`, and no new third-party dependency.
- Every audio track must expose one stable ASCII `lyrics` asset path.

---

### Task 1: Add lyric assets and track-to-lyric metadata

**Files:**
- Create: `assets/music/lyrics/the-nights-avicii.lrc`
- Create: `assets/music/lyrics/houlai-rene-liu.lrc`
- Create: `assets/music/lyrics/meet-stefanie-sun.lrc`
- Create: `assets/music/lyrics/daoxiang-jay-chou.lrc`
- Create: `assets/music/lyrics/stubborn-mayday.lrc`
- Create: `assets/music/lyrics/viva-la-vida-coldplay.lrc`
- Create: `assets/music/lyrics/counting-stars-onerepublic.lrc`
- Create: `assets/music/lyrics/ordinary-road-pu-shu.lrc`
- Create: `assets/music/lyrics/long-time-no-see-eason-chan.lrc`
- Modify: `index.html` (the `TRACKS` declarations)
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: the existing nine `src` paths in `TRACKS`.
- Produces: a `lyrics: "assets/music/lyrics/<ascii-name>.lrc"` string in every track object.

- [ ] **Step 1: Write the failing test**

```js
test("player maps every local track to a local LRC asset", () => {
  const lyricPaths = page.match(/lyrics: "assets\/music\/lyrics\/[^\"]+\.lrc"/g) ?? [];
  assert.equal(lyricPaths.length, 9);
  assert.match(page, /the-nights-avicii\.lrc/);
  assert.match(page, /long-time-no-see-eason-chan\.lrc/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: FAIL because `TRACKS` has no `lyrics` properties.

- [ ] **Step 3: Copy assets and add the metadata**

```js
{
  title: "The Nights",
  artist: "Avicii",
  mood: "YOUTHFUL",
  accent: "#84d9f4",
  src: "assets/music/the-nights-avicii.mp3",
  lyrics: "assets/music/lyrics/the-nights-avicii.lrc"
}
```

Copy each user-supplied LRC into `assets/music/lyrics/` with the matching stable ASCII name shown above. Add the corresponding `lyrics` property to all nine `TRACKS` objects.

- [ ] **Step 4: Run the test to verify it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: PASS, including the new mapping test.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/music/lyrics tests/homepage-hero.test.mjs
git commit -m "feat: add local lyric assets"
```

### Task 2: Replace the aperture markup with the reference-style clock card

**Files:**
- Modify: `index.html` (hero CSS and the `#memory-aperture` markup)
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `#clock-widget`, `#clock-time`, `#clock-date`, `#lyrics-current`, `#lyrics-previous`, `#lyrics-next` IDs used by Task 3.
- Produces: a keyboard-focusable right-side component with presentational orbit layers and a lyric container.

- [ ] **Step 1: Write the failing test**

```js
test("hero renders a frosted clock lyric widget instead of an aperture", () => {
  assert.match(page, /id="clock-widget"[^>]*type="button"/);
  assert.match(page, /id="clock-time"/);
  assert.match(page, /id="clock-date"/);
  assert.match(page, /class="clock-orbit clock-orbit-outer"/);
  assert.match(page, /id="lyrics-current"/);
  assert.match(page, /\.clock-widget\s*\{[\s\S]*width: clamp\(220px, 17vw, 250px\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: FAIL because `clock-widget` is absent.

- [ ] **Step 3: Implement minimal semantic markup and CSS**

```html
<button class="clock-widget" id="clock-widget" type="button" aria-label="查看当前播放歌词">
  <span class="clock-time" id="clock-time">00:00:00</span>
  <span class="clock-date" id="clock-date">加载日期…</span>
  <span class="clock-orbits" aria-hidden="true">
    <span class="clock-orbit clock-orbit-outer"></span>
    <span class="clock-orbit clock-orbit-middle"></span>
    <span class="clock-orbit clock-orbit-inner"></span>
  </span>
  <span class="clock-lyrics" aria-live="polite">
    <span id="lyrics-previous"></span><strong id="lyrics-current">选择一首歌</strong><span id="lyrics-next"></span>
  </span>
</button>
```

Replace only the old aperture CSS and its focus/reduced-motion selectors. Use the exact `clock-widget` class; desktop CSS must position this card at the right, alter `.hero-main` width/margins to reserve the card column, and keep the existing `@media (max-width: 1320px)` reflow behavior. CSS must provide frosted background, segmented cyan/yellow rings, hover lift/shine/outer glow, two counter-rotating orbit animations, and three-line lyric expansion.

- [ ] **Step 4: Run the test to verify it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: PASS, including old tests updated to name the clock widget rather than the removed aperture.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: add reference-style clock lyric widget"
```

### Task 3: Implement local time, LRC parsing, lyric synchronization, and pointer interaction

**Files:**
- Modify: `index.html` (browser-side widget functions and audio event listeners)
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `TRACKS[trackIndex].lyrics`, `profileAudio.currentTime`, and the DOM IDs from Task 2.
- Produces: `parseLrc(source)`, `loadLyrics(track)`, `syncClock()`, `syncLyrics()` and `updateClockWidget()` functions.

- [ ] **Step 1: Write the failing test**

```js
test("clock widget syncs local time and LRC lyrics with the native player", () => {
  assert.match(page, /function parseLrc\(source\)/);
  assert.match(page, /fetch\(track\.lyrics\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncLyrics\)/);
  assert.match(page, /window\.setInterval\(syncClock, 1000\)/);
  assert.match(page, /clockWidget\.addEventListener\("pointermove"/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.clock-orbit/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: FAIL because no lyric parser or clock synchronization exists.

- [ ] **Step 3: Implement the minimal state flow**

```js
function parseLrc(source) {
  return source.split(/\r?\n/).flatMap((line) => {
    const text = line.replace(/^(\[\d{2}:\d{2}(?:\.\d{1,3})?\])+/, "").trim();
    return [...line.matchAll(/\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g)]
      .map((match) => ({ time: Number(match[1]) * 60 + Number(match[2]), text }))
      .filter((entry) => entry.text);
  }).sort((a, b) => a.time - b.time);
}

function syncLyrics() {
  const current = lyricLines.findLastIndex((line) => line.time <= profileAudio.currentTime);
  renderLyricLines(current);
}
```

Cache parsed lyrics by path. `loadTrack` must call `loadLyrics(track)` after setting the audio source. `syncClock` must format local time as two-digit `HH:MM:SS` and Chinese year/month/day/weekday. On pointer movement, set CSS custom properties for bounded X/Y/rotation depth; clear them on leave. On reduced motion, do not register pointer movement and disable orbit/shine animations in CSS. Use existing `profileAudio` `play`, `pause`, `ended`, and add `timeupdate` listeners; never create a second `Audio` instance.

- [ ] **Step 4: Run the test to verify it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: PASS with all clock/lyrics tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: synchronize clock widget lyrics"
```

### Task 4: Verify layout, assets, and interaction in a browser

**Files:**
- Modify: `index.html` only if verification discovers a task-scope regression.

**Interfaces:**
- Consumes: the completed static page and local assets.
- Produces: verified desktop and narrow-screen behavior.

- [ ] **Step 1: Run the complete test suite**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 2: Serve the page and inspect desktop behavior**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4174`  
Expected: local server responds with `index.html` and all `assets/music/lyrics/*.lrc` files return HTTP 200.

Open the page at 1440px-wide viewport. Verify the center heading/search is visibly left of the enlarged clock card, neither overlaps, social glyphs fill their circles more fully, the clock changes each second, and hover activates lift, depth, expanded lyrics, orbit speed, shine and glow.

- [ ] **Step 3: Inspect narrow-screen and reduced-motion behavior**

Set a 768px viewport and confirm the clock reflows without covering the profile/player. Enable reduced motion and confirm the time/lyrics still update while continuous CSS motion and pointer depth are disabled.

- [ ] **Step 4: Commit any scoped verification correction**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "fix: refine clock widget responsive layout"
```
