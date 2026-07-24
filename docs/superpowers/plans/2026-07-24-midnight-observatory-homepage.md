# Midnight Observatory Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage into a four-act Apple-like liquid-glass experience with fixed search/typewriter geometry, globally integrated local music, and restrained interactive motion.

**Architecture:** Replace the current monolithic inline homepage with semantic HTML in `index.html`, one local stylesheet, and one local interaction module. `homepage.js` owns a single state source for quote, section, contact, archive, and music state; the sole `<audio id="profileAudio">` remains the only media player and drives Dock, lyrics, and environmental accent state. `homepage.css` owns all layout, material, responsive, and reduced-motion rules.

**Tech Stack:** Static HTML, CSS custom properties and media queries, browser-native JavaScript, local MP3/LRC/PNG assets, Node built-in test runner.

## File Structure

- `index.html` — semantic four-section document, local stylesheet/script references, accessible controls, sole audio element, and existing local content/link data.
- `assets/homepage/homepage.css` — visual tokens, liquid-glass layers, desktop/mobile layout, responsive breakpoints, focus styles, and reduced-motion overrides.
- `assets/homepage/homepage.js` — quote typewriter, section state, contact/archive interactions, local track data, playback/lyrics/Dock state, and motion listeners.
- `tests/homepage-hero.test.mjs` — static contracts for HTML, CSS, JS, local assets, and accessibility invariants.

## Global Constraints

- Modify only `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget` on `feature/vinyl-player-card`; never reset, delete, or modify the main checkout.
- Preserve the existing personal content, education information, archive links, social destinations, nine local MP3/LRC/cover assets, and the existing ten dynamic-text phrases in their current order.
- The homepage must contain exactly one `<audio id="profileAudio">`; do not call `new Audio()` and do not add any other audio element.
- Add no package, framework, CDN, remote image, remote font, or remote stylesheet. The only remote navigation remains the existing Google search form and existing user-provided external social/archive destinations.
- Search and dynamic text use different fixed grid rows. The search rectangle must stay within 1px throughout one full delete/type cycle at wide desktop, 1024px, and 320px.
- Dynamic text is exactly two lines high. Normal motion deletes from the last visible character before typing the next phrase; reduced motion renders complete phrases without a caret while keeping identical geometry.
- In `prefers-reduced-motion: reduce`, disable smooth scrolling, typewriter animation, pointer parallax, tilt, magnetic movement, light-wave animation, lyric spectrum transition, and continuous breathing. Preserve content updates, playback, lyrics, panel state, and keyboard operation.
- Use `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs` after every implementation task.

---

### Task 1: Establish the semantic homepage shell and local file boundaries

**Files:**
- Modify: `index.html:1-2206`
- Create: `assets/homepage/homepage.css`
- Create: `assets/homepage/homepage.js`
- Modify: `tests/homepage-hero.test.mjs:1-95`

**Interfaces:**
- Consumes: existing local assets, supplied personal text, existing archive/social URLs, and the test command.
- Produces: `#origin`, `#identity`, `#archive`, `#connection`, `#music-dock`, `#music-panel`, `#wechat-popover`, and `<audio id="profileAudio">`; local references to `./assets/homepage/homepage.css` and `./assets/homepage/homepage.js`.

- [ ] **Step 1: Write the failing shell tests**

Replace the file preamble with a three-file harness while keeping `page` for compatibility with selector helpers:

```js
const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [html, styles, script] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readOptional("../assets/homepage/homepage.css"),
  readOptional("../assets/homepage/homepage.js"),
]);
const page = `${html}\n${styles}\n${script}`;
```

Add this test and remove tests that require the retired `.vinyl-player`, `.hero-top`, or inline-only style/script layout:

```js
test("homepage uses a semantic four-act shell and one local runtime", () => {
  for (const id of ["origin", "identity", "archive", "connection"]) {
    assert.match(html, new RegExp(`<section[^>]+id="${id}"`));
  }
  assert.match(html, /href="\.\/assets\/homepage\/homepage\.css"/);
  assert.match(html, /src="\.\/assets\/homepage\/homepage\.js" defer/);
  assert.equal((html.match(/<audio\s+id="profileAudio"/g) ?? []).length, 1);
  assert.doesNotMatch(script, /new Audio\s*\(/);
  assert.doesNotMatch(html, /<style[\s>]/);
  assert.doesNotMatch(html, /<script>(?:.|\n)*?<\/script>/);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="semantic four-act shell" tests/homepage-hero.test.mjs
```

Expected: FAIL because the current page has inline `<style>`/`<script>`, no four-act sections, no local homepage CSS/JS files, and creates its audio with `new Audio()`.

- [ ] **Step 3: Implement the minimum shell**

Move all homepage CSS into `assets/homepage/homepage.css` and all runtime JavaScript into `assets/homepage/homepage.js`; link both from `index.html` with:

```html
<link rel="stylesheet" href="./assets/homepage/homepage.css">
<script src="./assets/homepage/homepage.js" defer></script>
```

Replace the body with the semantic hierarchy below while preserving real profile, education, archive, search, and social values. Put no inline style or script in the new document.

```html
<main>
  <section class="story-section origin" id="origin"></section>
  <section class="story-section identity" id="identity"></section>
  <section class="story-section archive" id="archive"></section>
  <section class="story-section connection" id="connection"></section>
</main>
<audio id="profileAudio" preload="metadata"></audio>
<aside id="music-dock"></aside>
<section id="music-panel" hidden></section>
<section id="wechat-popover" hidden></section>
```

Keep all authored values in HTML, not generated from remote requests. Declare `const profileAudio = document.querySelector("#profileAudio");` at the top of `homepage.js`; do not retain the retired Web Audio ambient-player code.

- [ ] **Step 4: Run the full static suite to verify GREEN**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Expected: PASS. The suite no longer contains assertions for the retired vinyl card and validates the external local-file boundary.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/homepage/homepage.css assets/homepage/homepage.js tests/homepage-hero.test.mjs
git commit -m "refactor: establish midnight observatory homepage shell"
```

### Task 2: Build the fixed Origin and Identity narrative

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: semantic `#origin` and `#identity`, local profile image, ten existing phrase objects, and `profileAudio` from Task 1.
- Produces: `#origin-search-slot`, `#origin-quote-slot`, `.sentence-line`, `#moon-ripple`, `renderStaticPhrase()`, `deleteVisibleLines(run)`, and `syncQuoteMotion()`.

- [ ] **Step 1: Write failing origin/identity tests**

Add these tests:

```js
test("origin fixes search and quote into separate geometry slots", () => {
  assert.match(html, /id="origin-search-slot"[\s\S]*id="hero-search-form"/);
  assert.match(html, /id="origin-quote-slot"[\s\S]*class="sentence-line"[\s\S]*class="sentence-line"/);
  assert.match(styles, /\.origin-story\s*\{[\s\S]*grid-template-rows:\s*var\(--search-slot-height\) var\(--origin-stack-gap\) var\(--quote-slot-height\)/);
  assert.match(styles, /#origin-search-slot\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(styles, /#origin-quote-slot\s*\{[\s\S]*grid-row:\s*3[\s\S]*height:\s*var\(--quote-slot-height\)/);
  assert.match(styles, /--quote-slot-height:\s*calc\(2 \* var\(--quote-line-height\)\)/);
});

test("quote preserves delete-before-type and reduced-motion static rendering", () => {
  assert.match(script, /async function deleteVisibleLines\(run\)/);
  assert.match(script, /await deleteLine\(lineNodes\[lineIndex\], run\)/);
  assert.match(script, /async function play\(run\)[\s\S]*deleteVisibleLines\(run\)[\s\S]*phraseIndex = \(phraseIndex \+ 1\)/);
  assert.match(script, /function renderStaticPhrase\(\)/);
  assert.match(script, /if \(reduceMotionQuery\.matches\)[\s\S]*scheduleStaticPhrase\(quoteRun\)/);
});

test("origin keeps the existing Google form and reports an empty submit accessibly", () => {
  assert.match(html, /id="hero-search-form"[^>]*action="https:\/\/www\.google\.com\/search"/);
  assert.match(html, /id="hero-search-input"[^>]*name="q"/);
  assert.match(html, /id="search-status"[^>]*aria-live="polite"/);
  assert.match(script, /heroSearchForm\.addEventListener\("submit"/);
  assert.match(script, /heroSearchInput\.setAttribute\("aria-invalid", "true"\)/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="origin fixes|quote preserves|origin keeps" tests/homepage-hero.test.mjs
```

Expected: FAIL because the new slots, CSS variables, and migrated quote runtime do not exist yet.

- [ ] **Step 3: Implement the fixed narrative**

Build `#origin` from three visual regions: a readable declaration, `.origin-story` containing the two explicit slots, and a `<button id="moon-ripple" type="button" aria-label="触发月光涟漪">` for the right-side optical object. Preserve the existing Google `q` form action. On a whitespace-only submit, call `preventDefault()`, set `aria-invalid="true"` on `#hero-search-input`, write a concise Chinese prompt to `#search-status[aria-live="polite"]`, and focus the input; a nonempty query retains the normal Google submission. Implement the fixed stack exactly with:

```css
.origin-story {
  display: grid;
  grid-template-rows: var(--search-slot-height) var(--origin-stack-gap) var(--quote-slot-height);
}
#origin-search-slot { grid-row: 1; height: var(--search-slot-height); }
#origin-quote-slot { grid-row: 3; height: var(--quote-slot-height); overflow: hidden; }
```

Move the existing ten `phrases`, `TIMING`, `typeLine`, `deleteLine`, `deleteVisibleLines`, `play`, `renderStaticPhrase`, and `syncQuoteMotion` logic into `homepage.js`. Preserve the exact delete-from-end behavior and invalidate old runs before any reduced-motion render. Put avatar, profile copy, and both education entries into `#identity` as readable glass panels. The moon button adds an `.is-rippling` class once per activation and removes it on `animationend`.

- [ ] **Step 4: Run GREEN and browser geometry check**

Run the full Node suite. Then serve the worktree with a local static server and, in a desktop browser console, sample this rectangle during the current short phrase, long phrase, deletion-to-empty, and retyping states at wide desktop, 1024px, and 320px:

```js
const r = document.querySelector("#origin-search-slot").getBoundingClientRect();
console.log([r.top, r.left, r.width, r.height]);
```

Expected: every sample differs from the first sample by no more than 1 CSS pixel per coordinate at its viewport width; the quote remains two lines and neither control overlaps the moon object.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/homepage/homepage.css assets/homepage/homepage.js tests/homepage-hero.test.mjs
git commit -m "feat: build fixed origin and identity narrative"
```

### Task 3: Add the Archive and Connection interactions

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `#archive`, `#connection`, existing archive URLs, existing six inline SVG social icons, and the `reduceMotionQuery` created in Task 2.
- Produces: `.archive-card[data-preview]`, `setArchivePreview(card, expanded)`, `#wechat-trigger`, `#wechat-popover`, and `closeWeChatPopover({ returnFocus })`.

- [ ] **Step 1: Write failing archive/contact tests**

Add:

```js
test("archive has one expandable preview at a time and keeps direct destinations", () => {
  assert.equal((html.match(/class="archive-card"/g) ?? []).length, 3);
  assert.equal((html.match(/data-preview/g) ?? []).length, 3);
  assert.match(script, /function setArchivePreview\(card, expanded\)/);
  assert.match(script, /document\.querySelectorAll\("\.archive-card\[data-preview\]"\)/);
  assert.match(styles, /\.archive-card\.is-expanded\s*\{/);
});

test("QQ remains a direct link while WeChat is a copyable dialog", () => {
  assert.match(html, /id="wechat-trigger"[^>]*aria-controls="wechat-popover"/);
  assert.match(html, /id="wechat-popover"[^>]*role="dialog"/);
  assert.match(html, /https:\/\/wpa\.qq\.com\/msgrd[^\"]+/);
  assert.doesNotMatch(html, /data-contact="qq"/);
  assert.match(script, /function closeWeChatPopover\(\{ returnFocus \}\)/);
  assert.match(script, /navigator\.clipboard\?\.writeText/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="archive has|QQ remains" tests/homepage-hero.test.mjs
```

Expected: FAIL because the bento previews and explicit WeChat dialog contract do not exist.

- [ ] **Step 3: Implement archive and connection**

Render `./learning/`, `./living/`, and `./research/` as asymmetric `article.archive-card` elements with a preview button and a separate direct `<a>` destination. `setArchivePreview` must close every other card before expanding the selected one and update its `aria-expanded` value. In CSS, use one large card and two secondary cards at wide widths, two columns near 1024px, and one column at 720px or below.

Use the current correct inline SVG icons. Make `#wechat-trigger` a button that opens `#wechat-popover`, which contains the actual WeChat ID, a copy button, and close button. Close it on outside click, `Escape`, or close button; return focus to `#wechat-trigger`. Keep QQ as the existing `wpa.qq.com` anchor without a popover. Add `:focus-visible` and press states for every control.

- [ ] **Step 4: Run GREEN**

Run the full Node suite.

Expected: PASS; archive links remain direct, only one preview can expand, QQ has no number popover, and WeChat has a keyboard-closable copy panel.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/homepage/homepage.css assets/homepage/homepage.js tests/homepage-hero.test.mjs
git commit -m "feat: add archive and contact glass interactions"
```

### Task 4: Integrate the local music Dock and lyrics panel

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `<audio id="profileAudio">`, the nine existing local assets, `reduceMotionQuery`, and a trigger element in `#music-dock`.
- Produces: immutable `TRACKS`, `loadTrack(index, { autoplay })`, `openMusicPanel()`, `closeMusicPanel({ returnFocus })`, `syncLyrics()`, `renderLyricLines(index)`, and an `aria-live="polite"` current lyric node.

- [ ] **Step 1: Write failing music tests**

Add:

```js
test("music Dock uses the sole native audio and all local track resources", async () => {
  assert.equal((html.match(/<audio\s+id="profileAudio"/g) ?? []).length, 1);
  assert.doesNotMatch(script, /new Audio\s*\(/);
  assert.equal((script.match(/lyrics:\s*"assets\/music\/lyrics\/[^\"]+\.lrc"/g) ?? []).length, 9);
  const covers = script.match(/cover:\s*"assets\/music\/covers\/[^\"]+\.png"/g) ?? [];
  assert.equal(covers.length, 9);
  assert.equal(new Set(covers).size, 9);
  assert.match(html, /id="music-dock"[\s\S]*aria-controls="music-panel"/);
  assert.match(html, /id="current-lyric"[^>]*aria-live="polite"/);
});

test("music panel has deterministic close and lyric interfaces", () => {
  assert.match(script, /function openMusicPanel\(\)/);
  assert.match(script, /function closeMusicPanel\(\{ returnFocus \}\)/);
  assert.match(script, /function parseLrc\(source\)/);
  assert.match(script, /function syncLyrics\(\)/);
  assert.match(script, /profileAudio\.addEventListener\("timeupdate", syncLyrics\)/);
  assert.match(script, /profileAudio\.addEventListener\("ended"/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="music Dock uses|music panel has" tests/homepage-hero.test.mjs
```

Expected: FAIL until Dock markup, native audio binding, migrated local track table, and lyrics interfaces exist.

- [ ] **Step 3: Implement the unified music state**

Declare the existing nine local tracks once in `TRACKS`; preserve title, artist, mood, accent, MP3, LRC, and PNG paths. Bind `profileAudio` to the audio element. `loadTrack(index, { autoplay })` sets `src`, resets lyric render cache, loads local LRC, updates compact Dock and panel metadata, and only calls `play()` when `autoplay` is true. Handle rejected playback by retaining pause state and writing a concise status message; do not show an alert.

Build a compact fixed Dock with cover, title, play/pause, and one expand button. The panel contains previous/play-next, progress, all nine track buttons, previous/current/next lyric lines, and close button. Keep the current line in `#current-lyric` with `aria-live="polite"`; suppress writes when track and lyric index did not change. The desktop panel opens above the Dock; mobile opens as a bottom sheet with `max-height: calc(100dvh - env(safe-area-inset-top))`, internal list/lyric scrolling, visible close/control row, and body bottom padding based on `--dock-height` plus `env(safe-area-inset-bottom)`.

- [ ] **Step 4: Run GREEN and exercise playback manually**

Run the full Node suite. In the browser, choose each song from the panel, then verify play/pause, previous/next wrap, LRC loading, lyric progression, `Escape`, outside-close, and focus return. Temporarily block one LRC URL in DevTools to verify the concise unavailable-lyrics state while audio still plays.

Expected: PASS; exactly one audio element remains, no second sound source is created, and the Dock never covers the panel controls at 320px.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/homepage/homepage.css assets/homepage/homepage.js tests/homepage-hero.test.mjs
git commit -m "feat: integrate global music dock and lyrics panel"
```

### Task 5: Add restrained motion, navigation state, and final accessibility safeguards

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: all section IDs, glass surfaces, `#moon-ripple`, archive previews, music Dock state, and `reduceMotionQuery`.
- Produces: `syncMotionPreferences()`, `setupSectionObserver()`, `setupPointerGlass()`, `setIdleState(idle)`, `data-active-section`, and `data-motion="reduced"` on `<html>` when appropriate.

- [ ] **Step 1: Write failing motion/accessibility tests**

Add:

```js
test("motion is capability-gated and has a complete reduced-motion fallback", () => {
  assert.match(script, /const reduceMotionQuery = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(script, /function syncMotionPreferences\(\)/);
  assert.match(script, /if \(reduceMotionQuery\.matches\) return;/);
  assert.match(script, /window\.matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*scroll-behavior:\s*auto/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
});

test("navigation, idle state, and close controls remain keyboard reachable", () => {
  assert.match(script, /function setupSectionObserver\(\)/);
  assert.match(script, /document\.documentElement\.dataset\.activeSection/);
  assert.match(script, /window\.setTimeout\([\s\S]*20000/);
  assert.match(script, /event\.key === "Escape"/);
  assert.match(styles, /:focus-visible\s*\{/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.section-rail\s*\{[\s\S]*display:\s*none/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="motion is|navigation, idle" tests/homepage-hero.test.mjs
```

Expected: FAIL because the new motion coordinator, section rail, idle clock, and reduced-motion contracts do not yet exist.

- [ ] **Step 3: Implement the progressive enhancement layer**

Use `IntersectionObserver` to set `document.documentElement.dataset.activeSection` and update each navigation/rail link with `aria-current="page"`. If the observer is unavailable, leave all sections visible and links usable. Enable pointer-following highlights and bounded tilt only when both reduced motion is false and `(hover: hover) and (pointer: fine)` matches. Reset CSS custom properties on pointer leave and whenever preferences change.

Implement a 20-second inactivity timer that adds `data-idle="true"` and only slows existing ambient light; it must never change content, section, audio, or visibility. Reset on pointer, scroll, touch, keydown, and focusin. Apply lyric-accent updates only when a lyric index changes, keep them within existing navy/cyan/gold tokens, and bypass them in reduced motion.

Use a single reduced-motion CSS block to disable smooth scrolling, typewriter caret, ripples, spectrum transitions, idle breathing, pointer transforms, and section reveal transforms. Keep static focus, expanded, active, and paused/playing visual states distinct. Ensure `Escape` closes archive preview, WeChat popover, and music panel in that order, returning focus to their triggers.

- [ ] **Step 4: Run GREEN and perform final viewport review**

Run the full Node suite. Inspect all of the following in a browser:

1. Desktop wide: sections transition without central text or Dock collisions; pointer effects are subtle and reset.
2. 1024px: Origin reflows without the moon object covering search/quote; archive bento is readable.
3. 320px: no horizontal scrolling; Dock, bottom sheet, controls, and two-line quote remain usable.
4. Reduced motion: typewriter becomes complete phrases; no smooth scroll, parallax, ripple, magnetic movement, breathing, or spectrum tween remains; songs and lyrics still update.
5. Keyboard: Tab order, visible focus, Enter/Space on all buttons, and `Escape` focus return work for moon, previews, WeChat, and music.

Expected: full static suite passes and every listed viewport/input-mode check succeeds.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/homepage/homepage.css assets/homepage/homepage.js tests/homepage-hero.test.mjs
git commit -m "feat: add observatory motion and accessibility states"
```

## Final Verification and Integration

- [ ] For each task, dispatch a fresh implementation agent, then an independent reviewer before beginning the next task. Record task commits and review outcome in `.superpowers/sdd/progress.md` under a new “Midnight Observatory Homepage” heading.
- [ ] After Task 5, dispatch a whole-branch reviewer to compare the branch with `docs/superpowers/specs/2026-07-24-midnight-observatory-homepage-design.md`; fix every blocking finding and repeat the full Node suite.
- [ ] Check the isolated worktree is clean with `git status --short --branch` and retain all existing user changes.
- [ ] Merge only from the main checkout after whole-branch review succeeds, rerun the full Node suite on `master`, then push the requested branch/`master` to GitHub and verify its remote tracking reference.
