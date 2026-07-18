# Homepage Player and Glass Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the nine supplied MP3 files as a real homepage playlist and refine the contact, Google search, lens, and player controls.

**Architecture:** Keep the single-file homepage. Native `HTMLAudioElement` replaces generated Web Audio; the existing buttons control the selected local track. CSS and minimal JavaScript preserve the current profile and hero structure while adding polished interactions.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node `node:test`, native HTML audio.

## Global Constraints

- Preserve profile, education, archives, and hero copy.
- Add no framework or dependency.
- Copy only the nine files from `/Users/yyy/Learning_material/music`.
- Submit raw keywords to `https://www.google.com/search`.
- Set audio volume to `1` and respect reduced-motion preferences.

---

### Task 1: Add playlist assets and metadata

**Files:**
- Create: `assets/music/*.mp3` (the nine explicitly supplied songs)
- Modify: `index.html:1040-1055`, `index.html:1175-1370`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:** Produces `TRACKS` records `{ title, artist, mood, accent, src }` and one `profileAudio` element.

- [ ] **Step 1: Write the failing test**

```js
test("player declares local audio tracks", () => {
  assert.match(page, /the-nights-avicii\.mp3/);
  assert.match(page, /artist: "Avicii"/);
  assert.match(page, /new Audio\(\)/);
  assert.match(page, /profileAudio\.volume = 1/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: FAIL because no local audio playlist exists.

- [ ] **Step 3: Copy assets and implement metadata**

Copy each supplied file to `assets/music/` using stable ASCII filenames. Replace generated-sound records with records such as:

```js
{ title: "The Nights", artist: "Avicii", mood: "OPEN ROAD", accent: "#8fc5d6", src: "./assets/music/the-nights-avicii.mp3" }
```

Create `const profileAudio = new Audio();`, set `profileAudio.volume = 1`, and render the selected `title` and `artist`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

- [ ] **Step 5: Commit**

Run: `git add index.html assets/music tests/homepage-hero.test.mjs && git commit -m "feat: add homepage music playlist"`

### Task 2: Use native playback and symmetric controls

**Files:**
- Modify: `index.html:276-345`, `index.html:1040-1055`, `index.html:1175-1370`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:** Consumes `TRACKS` and `profileAudio`; produces `loadTrack(index)`, `togglePlayback()`, and `switchTrack(direction)`.

- [ ] **Step 1: Write the failing test**

```js
test("player uses native audio and symmetric transport", () => {
  assert.match(page, /profileAudio\.src = track\.src/);
  assert.match(page, /await profileAudio\.play\(\)/);
  assert.match(page, /profileAudio\.addEventListener\("ended"/);
  assert.match(page, /#track-previous,\s*#track-next/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

- [ ] **Step 3: Implement native control flow**

```js
function loadTrack(index) {
  trackIndex = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIndex];
  profileAudio.src = track.src;
  profileAudio.load();
  renderTrack(true);
}
async function togglePlayback() {
  if (profileAudio.paused) await profileAudio.play();
  else profileAudio.pause();
}
profileAudio.addEventListener("ended", () => loadTrack(trackIndex + 1));
```

Use single opposing chevrons, identical previous/next button dimensions, and a larger central play/pause button.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

- [ ] **Step 5: Commit**

Run: `git add index.html tests/homepage-hero.test.mjs && git commit -m "feat: use native audio controls"`

### Task 3: Refine Google search, contact toggle, and frosted lens

**Files:**
- Modify: `index.html:430-660`, `index.html:1070-1120`, `index.html:1370-1435`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:** Produces `toggleContact(value)`, raw-keyword Google submission, a 760px desktop glass search surface, and a frosted lens.

- [ ] **Step 1: Write the failing test**

```js
test("homepage toggles contacts and submits Google keywords", () => {
  assert.match(page, /action="https:\/\/www\.google\.com\/search"/);
  assert.match(page, /contactPopover\.hidden = !contactPopover\.hidden/);
  assert.match(page, /width: min\(760px,/);
  assert.match(page, /\.memory-aperture::before/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

- [ ] **Step 3: Implement minimal behavior and surfaces**

```js
heroSearchForm.addEventListener("submit", (event) => {
  if (heroSearchInput.value.trim()) return;
  event.preventDefault();
  heroSearchInput.focus();
  heroSearchInput.setAttribute("aria-invalid", "true");
});
function toggleContact(value) {
  const alreadyOpen = !contactPopover.hidden && copyContact.dataset.value === value;
  contactPopover.hidden = alreadyOpen;
  if (alreadyOpen) return;
  copyContact.dataset.value = value;
  contactPopover.hidden = false;
}
```

Change the form action to Google, remove the old site-prefix rewrite, apply a translucent 760px glass search surface, and use muted blue-grey glass pseudo-elements for the lens. Preserve normal-flow tablet/mobile lens rules and reduced motion.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

- [ ] **Step 5: Commit**

Run: `git add index.html tests/homepage-hero.test.mjs && git commit -m "feat: refine hero glass interactions"`

### Task 4: Verify rendered behavior

**Files:** Verify `index.html`, `assets/music/`, and `tests/homepage-hero.test.mjs`.

- [ ] **Step 1: Run static checks**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs && git diff --check`

Expected: all tests pass and no whitespace errors.

- [ ] **Step 2: Run browser checks**

Check 1440px, 1024px, and 390px widths. Verify second WeChat click closes the card, Google search retains raw keywords, no lens/search overlap, and next-track updates the displayed title and artist.
