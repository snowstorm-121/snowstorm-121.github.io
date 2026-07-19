# Film Clock Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage center column collision-proof and turn the clock/lyrics widget into an interactive night-glass film player using the existing native audio state.

**Architecture:** Keep the single-page HTML/CSS/JavaScript structure. CSS owns the stable desktop safe column, film-glass presentation, and motion states; `index.html` markup provides decorative film layers plus semantic playback metadata. Existing `profileAudio`, `TRACKS`, LRC state, and reduced-motion query supply current track, progress, playback visual state, and accessibility-safe disclosure without any new network source or audio instance.

**Tech Stack:** Static HTML/CSS/JavaScript, Node built-in test runner, native `Audio` events, local LRC assets.

## Global Constraints

- Preserve the left avatar, personal introduction, education card, native audio controls, social links, local LRC mapping, and existing accessible lyric disclosure.
- Desktop title/search must occupy a stable safe column between the profile and the 220–250px right card; `STILL, I GO ON` stays on one line and dynamic text cannot move or widen the search field.
- The card uses a deep blue-gray translucent night-glass/film-player style, not a brown retro treatment.
- Reuse the existing single `profileAudio`, `TRACKS`, `trackIndex`, LRC cache, `aria-live` lyric deduplication, and local `fetch(track.lyrics)` only.
- Continuous film/reel/equalizer/pointer motion must be disabled under `prefers-reduced-motion`, while time, lyrics, progress, and click disclosure continue working.
- Add no third-party dependency, external lyric service, or additional `Audio` instance.

---

### Task 1: Stabilize the desktop safe column and title/search geometry

**Files:**
- Modify: `index.html` (`.hero-main`, `#hero-title`, `.hero-search` desktop CSS)
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: existing `.hero-main`, `#hero-title`, `.hero-search`, `@media (max-width: 1320px)` reflow.
- Produces: a stable desktop main column with fixed width/edge constraints independent of dynamic quote length.

- [ ] **Step 1: Write the failing test**

```js
test("desktop hero keeps a compact fixed safe column for title and search", () => {
  assert.match(page, /\.hero-main\s*\{[\s\S]*width: min\(540px, calc\(100vw - 820px\)\)[\s\S]*margin:\s*0 clamp\(360px, 24vw, 430px\) 0 clamp\(360px, 20vw, 460px\)/);
  assert.match(page, /#hero-title\s*\{[\s\S]*font: italic 700 clamp\(34px, 4\.2vw, 58px\)\/\.9 Georgia, serif;[\s\S]*white-space: nowrap;/);
  assert.match(page, /\.hero-search\s*\{[\s\S]*width: 100%;[\s\S]*max-width: 540px;/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: FAIL because the current column uses the 600px/720px geometry and the title can exceed its safe area.

- [ ] **Step 3: Implement the scoped desktop geometry**

```css
.hero-main {
  width: min(540px, calc(100vw - 820px));
  margin: 0 clamp(360px, 24vw, 430px) 0 clamp(360px, 20vw, 460px);
  text-align: center;
}

#hero-title {
  font: italic 700 clamp(34px, 4.2vw, 58px)/.9 Georgia, serif;
  white-space: nowrap;
}

.hero-search { width: 100%; max-width: 540px; }
```

Keep the existing 1320px reflow override unchanged so narrow layouts still use `width: 100%` and `margin: 0`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: PASS, including all existing hero/player tests.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "fix: stabilize hero safe column"
```

### Task 2: Add film-player semantic layers and night-glass styling

**Files:**
- Modify: `index.html` (clock widget markup and widget CSS)
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `#clock-widget`, `#clock-time`, `#clock-date`, `#lyrics-previous`, `#lyrics-current`, `#lyrics-next`.
- Produces: `#film-now-playing`, `#film-track-title`, `#film-track-artist`, `#film-progress`, `#film-elapsed`, `#film-duration`, and decorative film/reel/equalizer layers for Task 3.

- [ ] **Step 1: Write the failing test**

```js
test("clock widget exposes film-player metadata and decorative layers", () => {
  assert.match(page, /id="film-now-playing"/);
  assert.match(page, /id="film-track-title"/);
  assert.match(page, /id="film-track-artist"/);
  assert.match(page, /id="film-progress"/);
  assert.match(page, /id="film-elapsed"/);
  assert.match(page, /id="film-duration"/);
  assert.match(page, /class="film-perforations" aria-hidden="true"/);
  assert.match(page, /class="film-equalizer" aria-hidden="true"/);
  assert.match(page, /\.clock-widget\s*\{[\s\S]*backdrop-filter: blur\(28px\) saturate\(150%\)/);
  assert.match(page, /\.film-perforations\s*\{[\s\S]*repeating-linear-gradient/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: FAIL because no film metadata or decorative layers exist.

- [ ] **Step 3: Add semantic metadata and presentational film layers**

Add this inside `#clock-widget`, before `.clock-time`:

```html
<span class="film-perforations" aria-hidden="true"></span>
<span class="film-grain" aria-hidden="true"></span>
<span class="film-now-playing" id="film-now-playing">NOW PLAYING</span>
<span class="film-track" aria-live="off">
  <strong id="film-track-title">选择一首歌</strong>
  <span id="film-track-artist">LOCAL ARCHIVE</span>
</span>
```

Add this after `.clock-orbits`:

```html
<span class="film-progress-row" aria-label="播放进度">
  <span id="film-elapsed">00:00</span>
  <span class="film-progress-track" aria-hidden="true"><span id="film-progress"></span></span>
  <span id="film-duration">00:00</span>
</span>
<span class="film-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
```

Replace the card background/border treatment with deep translucent blue-gray glass, 28px blur and saturated cyan/warm-gold reflection. Use pseudo-elements and `repeating-linear-gradient` for subtle side perforations, and CSS-only grain/scratch layers. Keep all decorative layers behind readable content.

- [ ] **Step 4: Run the test to verify it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: PASS with new film-card contract test green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: style clock as glass film player"
```

### Task 3: Synchronize film metadata, progress, playback state, and pronounced interaction

**Files:**
- Modify: `index.html` (widget runtime functions, audio listeners, interaction/reduced-motion CSS)
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `TRACKS[trackIndex]`, `profileAudio.currentTime`, `profileAudio.duration`, `profileAudio.paused`, `#film-*` IDs, and existing `reduceMotionQuery`.
- Produces: `formatPlaybackTime(seconds)`, `syncFilmPlayback()`, and `.is-playing` widget state.

- [ ] **Step 1: Write the failing test**

```js
test("film clock mirrors existing player metadata progress and motion-safe playback state", () => {
  assert.match(page, /function formatPlaybackTime\(seconds\)/);
  assert.match(page, /function syncFilmPlayback\(\)/);
  assert.match(page, /filmTrackTitle\.textContent = track\.title/);
  assert.match(page, /filmTrackArtist\.textContent = track\.artist/);
  assert.match(page, /filmProgress\.style\.width = `\$\{progress\}%`/);
  assert.match(page, /clockWidget\.classList\.toggle\("is-playing", !profileAudio\.paused\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncFilmPlayback\)/);
  assert.match(page, /profileAudio\.addEventListener\("loadedmetadata", syncFilmPlayback\)/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.film-equalizer i\s*\{\s*animation: none;/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: FAIL because film state has no runtime synchronization.

- [ ] **Step 3: Implement the existing-player synchronization and visible state changes**

```js
function formatPlaybackTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes.toString().padStart(2, "0")}:${remainder}`;
}

function syncFilmPlayback() {
  const track = TRACKS[trackIndex];
  const duration = Number.isFinite(profileAudio.duration) ? profileAudio.duration : 0;
  const progress = duration > 0 ? Math.min(100, profileAudio.currentTime / duration * 100) : 0;
  filmTrackTitle.textContent = track.title;
  filmTrackArtist.textContent = track.artist;
  filmElapsed.textContent = formatPlaybackTime(profileAudio.currentTime);
  filmDuration.textContent = formatPlaybackTime(duration);
  filmProgress.style.width = `${progress}%`;
  clockWidget.classList.toggle("is-playing", !profileAudio.paused);
}
```

Call `syncFilmPlayback()` from `loadTrack`, existing `play`, `pause`, `ended`, `timeupdate`, and `loadedmetadata` listeners. Keep the existing bounded pointer handler but amplify its layer differences through CSS variables: the card uses its current transform, reels use a larger inverse translate, and the metadata strip uses a smaller translate. Add `.clock-widget.is-playing .film-equalizer i` keyframe animation and play-state ring/progress highlights. Under reduced motion disable equalizer/grain/film/reel animation and preserve static values, time, lyrics, progress, and disclosure.

- [ ] **Step 4: Run the test to verify it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: PASS, including existing LRC, disclosure, and live-region deduplication tests.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: synchronize film clock playback state"
```

### Task 4: Validate desktop clearance, film interactions, and responsive motion behavior

**Files:**
- Modify: `index.html` and `tests/homepage-hero.test.mjs` only if a scoped regression is found.

**Interfaces:**
- Consumes: completed static page, local lyrics and native player.
- Produces: verified desktop, narrow-screen, normal-motion and reduced-motion behavior.

- [ ] **Step 1: Run the complete automated suite**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: all tests PASS.

- [ ] **Step 2: Serve and inspect the desktop page**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4174`

Expected: `index.html` and every `assets/music/lyrics/*.lrc` endpoint return HTTP 200.

At 1440px, verify title remains one line, search/title right edge leaves a visible gap before the card, and profile region remains clear. Verify card glass/film layers are visible but text is readable. Hover and move pointer across the card: card lift, layer-depth offsets, sweep, reel speed, glow, lyrics, and film detail must visibly differ from rest state. Start/pause existing audio and verify metadata, progress, timecode, equalizer, and active ring respond.

- [ ] **Step 3: Inspect 768px and reduced-motion behavior**

At 768px confirm card reflows after profile/player without overlap. In reduced motion confirm time, lyrics, progress, and click disclosure work while continuous reel, equalizer, grain/scratch and pointer depth motion are disabled.

- [ ] **Step 4: Commit a scoped correction only when needed**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "fix: refine film clock responsive behavior"
```
