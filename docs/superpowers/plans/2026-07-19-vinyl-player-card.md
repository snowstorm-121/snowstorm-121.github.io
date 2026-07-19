# Vinyl Player Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right film/clock card with a responsive, interactive night-sea vinyl player and keep the search bar fixed immediately above a smooth two-line dynamic-text area.

**Architecture:** Keep the single-file static-page architecture. `TRACKS` gains one local `cover` path per track; the current native `profileAudio` and LRC pipeline remain the only media state. The former `clock-*` / `film-*` markup, CSS and runtime bindings are replaced together by `vinyl-*` equivalents, while the hero quote animator uses its existing two span nodes without allowing its content to alter layout.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Node built-in test runner, local PNG assets, browser verification.

## Global Constraints

- Work only in `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget` on `feature/vinyl-player-card`.
- Preserve the left profile, education, one native `profileAudio`, local MP3 files, local LRC files, social links, transport controls and live lyric disclosure.
- Create nine local square, original night-sea label images: no text, no people, no logos, no watermark, no artist likeness and no copied album art.
- On wide screens the search and quote are a fixed-width, left-shifted vertical group; the search is immediately above the quote and neither changes position because the quote text changes.
- Quote text always occupies exactly two fixed-height lines. On normal motion, delete the prior phrase one character at a time from its end, then type the next phrase one character at a time; on reduced motion, directly render full text without animated deleting/typing.
- The vinyl card shows a black grooved record, silver rim, original current-track label, tonearm, title, artist and current LRC. On wide screens metadata is right of the record; where insufficient, it is below the record.
- Pointer parallax, reflection, record spin, tonearm movement, label transition and state glow must be disabled under `prefers-reduced-motion`, while song and LRC text continue updating.
- No external runtime request except existing local LRC `fetch`; do not add packages, another audio instance, or remote image URLs.

---

## File structure

- `assets/music/covers/*.png` — nine original generated night-sea label assets with stable ASCII filenames.
- `index.html` — responsive hero layout, player markup/CSS, `TRACKS` cover metadata, player synchronisation and quote transition control.
- `tests/homepage-hero.test.mjs` — static regression tests for local cover mapping, fixed middle stack, vinyl semantics, media synchronisation and reduced motion.

### Task 1: Create and map original night-sea vinyl labels

**Files:**
- Create: `assets/music/covers/the-nights.png`
- Create: `assets/music/covers/daoxiang.png`
- Create: `assets/music/covers/houlai.png`
- Create: `assets/music/covers/meet.png`
- Create: `assets/music/covers/viva-la-vida.png`
- Create: `assets/music/covers/ordinary-road.png`
- Create: `assets/music/covers/stubborn.png`
- Create: `assets/music/covers/counting-stars.png`
- Create: `assets/music/covers/long-time-no-see.png`
- Modify: `index.html:1575-1585`
- Modify: `tests/homepage-hero.test.mjs:113-125`

**Interfaces:**
- Produces: every `TRACKS` object has `cover: "assets/music/covers/<ascii>.png"`; later tasks use `track.cover` as the `#vinyl-cover` source.

- [ ] **Step 1: Write the failing cover mapping test**

```js
test("player maps every local track to a distinct local vinyl label", async () => {
  const covers = page.match(/cover: "assets\/music\/covers\/[^\"]+\.png"/g) ?? [];
  assert.equal(covers.length, 9);
  assert.equal(new Set(covers).size, 9);
  for (const cover of covers) {
    const file = cover.match(/assets\/music\/covers\/([^\"]+)/)[1];
    await readFile(new URL(`../assets/music/covers/${file}`, import.meta.url));
  }
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="vinyl label" tests/homepage-hero.test.mjs`

Expected: FAIL because `cover` mappings and assets do not yet exist.

- [ ] **Step 3: Generate and place the nine images**

Use the image generation tool once per image, each as a square original record-label artwork. Use these distinct visual directions, all with deep-ocean navy, moonlit cyan and restrained gold reflection: open moonlit coastal road (`The Nights`); rice field and distant water (`稻香`); fading pier afterglow (`后来`); drifting city lights across water (`遇见`); abstract ascending crown-like light without logos (`Viva La Vida`); empty horizon road (`平凡之路`); storm-lit lighthouse (`倔强`); constellation navigation over waves (`Counting Stars`); misty empty harbour (`好久不见`). Save the final project assets under the paths above. Every prompt must include `no words, no typography, no people, no logo, no watermark, no existing album art`.

- [ ] **Step 4: Add the exact stable mappings**

```js
{ title: "The Nights", artist: "Avicii", mood: "OPEN ROAD", accent: "#8fc5d6", src: "./assets/music/the-nights-avicii.mp3", lyrics: "assets/music/lyrics/the-nights-avicii.lrc", cover: "assets/music/covers/the-nights.png" },
{ title: "稻香", artist: "周杰伦", mood: "SUNLIT", accent: "#e4bb83", src: "./assets/music/daoxiang-jay-chou.mp3", lyrics: "assets/music/lyrics/daoxiang-jay-chou.lrc", cover: "assets/music/covers/daoxiang.png" },
{ title: "后来", artist: "刘若英", mood: "AFTERGLOW", accent: "#b38b9f", src: "./assets/music/houlai-rene-liu.mp3", lyrics: "assets/music/lyrics/houlai-rene-liu.lrc", cover: "assets/music/covers/houlai.png" },
{ title: "遇见", artist: "孙燕姿", mood: "WANDER", accent: "#9db5d4", src: "./assets/music/meet-stefanie-sun.mp3", lyrics: "assets/music/lyrics/meet-stefanie-sun.lrc", cover: "assets/music/covers/meet.png" },
{ title: "Viva La Vida", artist: "Coldplay", mood: "ASCENT", accent: "#d8d3a5", src: "./assets/music/viva-la-vida-coldplay.mp3", lyrics: "assets/music/lyrics/viva-la-vida-coldplay.lrc", cover: "assets/music/covers/viva-la-vida.png" },
{ title: "平凡之路", artist: "朴树", mood: "HORIZON", accent: "#8cae9e", src: "./assets/music/ordinary-road-pu-shu.mp3", lyrics: "assets/music/lyrics/ordinary-road-pu-shu.lrc", cover: "assets/music/covers/ordinary-road.png" },
{ title: "倔强", artist: "五月天", mood: "YOUTH", accent: "#d49a82", src: "./assets/music/stubborn-mayday.mp3", lyrics: "assets/music/lyrics/stubborn-mayday.lrc", cover: "assets/music/covers/stubborn.png" },
{ title: "Counting Stars", artist: "OneRepublic", mood: "MOTION", accent: "#a7b9e7", src: "./assets/music/counting-stars-onerepublic.mp3", lyrics: "assets/music/lyrics/counting-stars-onerepublic.lrc", cover: "assets/music/covers/counting-stars.png" },
{ title: "好久不见", artist: "陈奕迅", mood: "MELANCHOLY", accent: "#8d89b8", src: "./assets/music/long-time-no-see-eason-chan.mp3", lyrics: "assets/music/lyrics/long-time-no-see-eason-chan.lrc", cover: "assets/music/covers/long-time-no-see.png" },
```

- [ ] **Step 5: Run the focused test and commit**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="vinyl label" tests/homepage-hero.test.mjs`

Expected: PASS.

```bash
git add assets/music/covers index.html tests/homepage-hero.test.mjs
git commit -m "feat: add original vinyl label assets"
```

### Task 2: Build the fixed hero stack and responsive vinyl structure

**Files:**
- Modify: `index.html:147-151, 418-944, 1290-1383, 1440-1494`
- Modify: `tests/homepage-hero.test.mjs:7-110`

**Interfaces:**
- Consumes: `#hero-search-form`, `#sentence`, and every `TRACKS[].cover` path.
- Produces: `#vinyl-player`, `#vinyl-record`, `#vinyl-cover`, `#vinyl-tonearm`, `#vinyl-track-title`, `#vinyl-track-artist`, `#vinyl-lyrics-current`, plus `.hero-middle-stack` used by Task 3.

- [ ] **Step 1: Write failing structure/layout tests**

```js
test("hero locks search directly above a two-line quote stack", () => {
  assert.match(page, /class="hero-middle-stack"[\s\S]*id="hero-search-form"[\s\S]*class="hero-quote-area"/);
  assert.match(page, /\.hero-middle-stack\s*\{[\s\S]*width: min\(520px, calc\(100vw - 860px\)\)/);
  assert.match(page, /\.sentence-wrap\s*\{[\s\S]*height: calc\(2 \* var\(--sentence-line-height\)\)/);
});

test("hero renders a responsive vinyl turntable instead of the film clock", () => {
  assert.match(page, /id="vinyl-player"[^>]*type="button"/);
  assert.match(page, /id="vinyl-record"[^>]*aria-hidden="true"/);
  assert.match(page, /id="vinyl-cover"[^>]*alt=""/);
  assert.match(page, /id="vinyl-tonearm"[^>]*aria-hidden="true"/);
  assert.match(page, /id="vinyl-lyrics-current"/);
  assert.doesNotMatch(page, /film-perforations|film-equalizer|clock-orbit/);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="hero locks|vinyl turntable" tests/homepage-hero.test.mjs`

Expected: FAIL because the current markup is still the film/clock card and the search is a grid sibling of the quote.

- [ ] **Step 3: Restructure only the hero middle stack**

Wrap the existing search form and quote area in `<div class="hero-middle-stack">`; leave heading as a separate sibling. Set desktop width to `min(520px, calc(100vw - 860px))`, `margin-left: clamp(320px, 20vw, 430px)`, and `margin-right: auto`. Make the quote width `100%`, set `--sentence-line-height` once, and use `height: calc(2 * var(--sentence-line-height))` on `.sentence-wrap`; do not change the two `.sentence-line` elements.

- [ ] **Step 4: Replace only the right-card markup and styles**

Replace `#clock-widget` and its film/clock children with the declared vinyl IDs. CSS must create a frosted deep-blue base, a left record with black concentric grooves and silver rim, a circular `#vinyl-cover` inside it, a tonearm above it, and metadata/LRC to the right. At `max-width: 1320px`, retain ordinary flow and use a layout that puts metadata beneath the record when the card cannot maintain two columns. Keep card decoration `aria-hidden`; retain a native button and `aria-expanded` for lyric disclosure.

- [ ] **Step 5: Run focused tests and commit**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="hero locks|vinyl turntable" tests/homepage-hero.test.mjs`

Expected: PASS.

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: build responsive vinyl player layout"
```

### Task 3: Synchronize vinyl state, interactions, and smooth quote transitions

**Files:**
- Modify: `index.html:1587-2190`
- Modify: `tests/homepage-hero.test.mjs:39-153`

**Interfaces:**
- Consumes: `TRACKS[].cover`, `profileAudio`, `#vinyl-player`, `#vinyl-cover`, `#vinyl-tonearm`, `#vinyl-track-title`, `#vinyl-track-artist`, `#vinyl-lyrics-current`, `#lyrics-previous`, `#lyrics-next`, `reduceMotionQuery`, and existing phrase/line nodes.
- Produces: `syncVinylPlayback()`, `updateVinylParallax(event)`, `syncVinylParallaxListeners()`, and a normal-motion quote cycle that deletes then types without clearing nodes before deletion.

- [ ] **Step 1: Write failing synchronisation and motion tests**

```js
test("vinyl player follows the sole native audio and local LRC state", () => {
  assert.match(page, /function syncVinylPlayback\(\)/);
  assert.match(page, /vinylCover\.src = track\.cover/);
  assert.match(page, /vinylTrackTitle\.textContent = track\.title/);
  assert.match(page, /vinylTrackArtist\.textContent = track\.artist/);
  assert.match(page, /vinylPlayer\.classList\.toggle\("is-playing", !profileAudio\.paused\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncVinylPlayback\)/);
});

test("vinyl motion and the quote animator respect reduced motion", () => {
  assert.match(page, /function syncVinylParallaxListeners\(\)/);
  assert.match(page, /if \(reduceMotionQuery\.matches\) return;/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vinyl-record[\s\S]*animation: none;/);
  assert.match(page, /if \(reduceMotionQuery\.matches\)[\s\S]*lineNodes\.forEach/);
  assert.match(page, /await deleteLine\(lineNodes\[lineIndex\]\);[\s\S]*phraseIndex =/);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="vinyl player follows|vinyl motion" tests/homepage-hero.test.mjs`

Expected: FAIL because the runtime names and state are still clock/film based.

- [ ] **Step 3: Implement the minimal player synchronisation**

Replace `syncFilmPlayback` references with `syncVinylPlayback`. In it set `vinylCover.src = track.cover`, update title/artist/current lyric references, set a CSS progress custom property if retained, and toggle `is-playing` solely from `!profileAudio.paused`. Update `renderLyricStatus` and `renderLyricLines` to write the same current LRC to the vinyl element while retaining the existing polite live-region behavior and duplicate-write guard. Keep the exact existing `profileAudio` event sources and do not instantiate Audio again.

- [ ] **Step 4: Implement obvious but bounded interactions**

Rename the clock parallax helpers to the declared vinyl helpers. On pointer movement, update only `--vinyl-x`, `--vinyl-y`, `--vinyl-rotate-x`, `--vinyl-rotate-y` and `--vinyl-glow-x`; on leave remove them. CSS: hover/focus lifts and tilts the card, moves a pseudo-element reflection, and brightens edge glow; `is-playing` rotates the record and moves the tonearm to its playing angle; a track change briefly applies/removes `is-switching` for the label/metadata transition. Bind listeners only when reduced motion is not active, including live `matchMedia` changes.

- [ ] **Step 5: Make the quote cycle continuous in its fixed two-line box**

Do not run `lineNodes.forEach(...textContent = "")` at the start of each normal-motion loop. The first phrase may begin empty; after the hold, call `deleteLine` for populated lines in reverse order, then move to the next phrase and type into those already-empty nodes. Add a `renderStaticPhrase()` helper for reduced motion that fills both nodes, updates the eyebrow/progress and never starts `play()`. The caret is not animated under reduced motion.

- [ ] **Step 6: Run all static tests and commit**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: PASS with all updated tests.

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: synchronize interactive vinyl playback"
```

### Task 4: Validate visual layouts and motion behavior in a browser

**Files:**
- Modify: `tests/homepage-hero.test.mjs` only if browser validation exposes a deterministic static regression that the current suite can assert.

**Interfaces:**
- Consumes: completed Tasks 1–3 and local server at repository root.
- Produces: documented validation evidence; no product-code change unless a visual defect requires a small, tested correction.

- [ ] **Step 1: Start the local server**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4174`

Expected: local site serves from `http://127.0.0.1:4174`.

- [ ] **Step 2: Verify desktop state at 1440px**

Use browser automation to load the page at `1440x900`. Record that the search width/left edge stays unchanged while the two-line quote cycles, the search is directly above it, and neither overlaps the profile nor vinyl card. Click the existing play control and verify the record spins, tonearm state changes, title/artist/cover update, and current LRC is visible.

- [ ] **Step 3: Verify card interaction and responsive flow**

At `1440x900`, move the pointer across the vinyl card and verify visible bounded tilt/reflection/state glow; pointer leave returns it smoothly. At `1024x900` and `320x900`, verify no overlap and metadata has flowed below the record where two columns cannot fit. Confirm native button activation still reveals prior/current/next lyric lines.

- [ ] **Step 4: Verify reduced motion and regression tests**

Emulate `prefers-reduced-motion: reduce`, reload, and verify current song/LRC/time content changes while record rotation, tonearm motion, reflection, parallax, type/delete and caret blinking are off. Then run:

`/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit any focused validation regression and record evidence**

If a deterministic test was added for a browser-found defect, commit it with the minimal product fix:

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "fix: validate vinyl player responsive behavior"
```
