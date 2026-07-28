# Homepage Tidal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Midnight Observatory homepage with fixed title composition, a compact tidal-island player, non-overlapping archive previews, and richer premium motion.

**Architecture:** Keep the existing static HTML/CSS/JS architecture. Retain every existing player ID and data flow, adding small semantic containers and controls only where required. Use CSS for appearance and motion, with small JavaScript state helpers only for queue, timing, accessibility, and motion preference behavior.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node built-in test runner.

## Global Constraints

- Work only in this linked worktree and branch; do not modify, reset, or clean the main checkout.
- Preserve one `#profileAudio`, the `TRACKS` structure, all nine local MP3/LRC/cover resources, current lyric live region, existing player IDs, and current play/pause/next/previous/LRC failure/focus behavior.
- Add no dependencies, remote images, remote fonts, icon libraries, or second audio element.
- Use inline SVG with `aria-hidden="true"` for player glyphs; do not use textual CSS pseudo-element glyphs for controls.
- The player remains a 240–296px by approximately 56px desktop Dock, and its mobile sheet may not exceed 72dvh.
- Preserve search and quote independent fixed slots and all existing social, WeChat, QQ, avatar, education, archive, and accessibility behavior.
- In reduced motion, disable continuous animation, parallax, rotation, blur/elastic transitions, but continue song, quote, lyric, section, and content updates.
- Each task must add a failing behavior test, confirm RED, implement minimally, run GREEN and the full suite, commit narrowly, and receive an independent reviewer approval.

---

### Task 1: Fix semantic heading composition

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Adds `.origin-title-line` around the two required title lines.
- Keeps `#origin-title` and `#identity-title` unchanged for navigation and accessibility.

- [ ] **Step 1: Write failing tests**
  - Assert that `#origin-title` contains two ordered `.origin-title-line` elements whose text is exactly `STILL,` and `I GO ON`.
  - Assert that desktop/tablet rules keep `#identity-title` on one line and the `max-width: 720px` rules restore wrapping.

- [ ] **Step 2: Run RED**
  - Run `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`.
  - Confirm the new assertions fail because the title is still a single text node and no responsive identity-title rule exists.

- [ ] **Step 3: Implement minimally**
  - Replace the hero title text with two spans, preserving its accessible combined name.
  - Make each hero title span block-level and retain existing type scale.
  - For widths of 721px and above, set `#identity-title` to a one-line responsive font size that fits the identity copy panel; at 720px and below restore normal wrapping.

- [ ] **Step 4: Run GREEN and full tests**
  - Re-run the test command and require every test to pass.

- [ ] **Step 5: Commit**
  - Commit only Task 1 files with `fix: refine homepage title composition`.

### Task 2: Build the tidal-island music player

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Preserve all existing player IDs and introduce only `#music-queue-toggle`, `#music-elapsed`, `#music-duration`, and the player queue state class/attribute.
- `#music-queue-toggle` controls `#music-track-list` with `aria-expanded` and `aria-controls`.

- [ ] **Step 1: Write failing tests**
  - Assert all Dock and panel control buttons contain inline `svg[aria-hidden="true"]`; assert their CSS has fixed icon boxes and no textual `content:` glyph rules.
  - Assert the elapsed/duration outputs and collapsed queue toggle exist, the queue has the required control relationship, and the mobile panel has a 72dvh cap.
  - Assert the script has a queue state helper, updates elapsed/duration from audio time, and closes an open queue before closing the panel on Escape.

- [ ] **Step 2: Run RED**
  - Run the test command and confirm the new player assertions fail before modifying production code.

- [ ] **Step 3: Implement minimally**
  - Replace CSS-drawn player glyphs with semantic button text plus inline SVG; use true grid centering, `display: block` SVGs, and only a 1px optical right shift for the play triangle.
  - Restructure the panel as the compact tidal-island composition: circular cover, mood, title/artist, three-line lyric stage, timing row, fine progress, and a collapsed queue trigger.
  - Keep the queue inside the panel as a bounded drawer showing roughly three tracks before internal scrolling; do not make the player full-screen on mobile.
  - Add queue toggling, accurate elapsed/duration rendering, Escape priority, and focus restoration without changing playback or lyric interfaces.
  - Add motion for open, cover rotation while playing, accent transitions, lyrics, and queue opening; ensure reduced motion performs immediate state changes.

- [ ] **Step 4: Run GREEN and full tests**
  - Run focused new player tests, then the complete Node test file. Require clean output and all tests passing.

- [ ] **Step 5: Commit**
  - Commit only Task 2 files with `feat: refine tidal island music player`.

### Task 3: Replace archive preview overlap with a fixed copy stage

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Adds `.archive-copy-stage` within every `.archive-card`.
- Keeps existing preview IDs, `.archive-preview-toggle`, direct archive links, one-open-card behavior, and Escape focus return.

- [ ] **Step 1: Write failing tests**
  - Assert every archive card has one `.archive-copy-stage` containing both the standard description and its preview.
  - Assert the preview no longer uses its previous card-relative absolute `bottom: 120px` layout and that visible content uses mutually exclusive stage states.
  - Assert the script updates toggle labels between `展开预览` and `收起预览` while preserving a single expanded card.

- [ ] **Step 2: Run RED**
  - Run the test command and confirm the new assertions fail against the old overlay implementation.

- [ ] **Step 3: Implement minimally**
  - Move each normal description and preview into the fixed copy stage.
  - Use one CSS grid area for the two content states; only the active state receives opacity, visibility, and pointer events.
  - Keep card media, toggle, and direct link positions unchanged. Update the existing preview state helper to set the visible label and preserve Escape focus handling.
  - Disable the crossfade in reduced motion while retaining state switching.

- [ ] **Step 4: Run GREEN and full tests**
  - Run focused archive assertions and the complete Node test file.

- [ ] **Step 5: Commit**
  - Commit only Task 3 files with `fix: stabilize archive preview stage`.

### Task 4: Add richer premium page interaction

**Files:**
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Reuse `data-motion`, `data-active-section`, `data-pointer-glass`, `data-playing`, and current section observer rather than adding a second motion system.
- Add only CSS custom properties needed for bounded scene-light pointer position.

- [ ] **Step 1: Write failing tests**
  - Assert full-motion styles add staggered section reveal behavior, bounded hover lift/tilt/highlight behavior, and two-stage moon ripple behavior.
  - Assert the script updates scene-light pointer variables only when fine pointer motion is enabled and reduced motion disables the new effects.

- [ ] **Step 2: Run RED**
  - Run the test command and confirm the new motion assertions fail before implementation.

- [ ] **Step 3: Implement minimally**
  - Extend current active-section CSS with short staggered reveal of headings, copy, cards, and contacts using opacity, 16–24px translation, and modest blur restoration.
  - Add bounded scene-light pointer offsets of no more than 12px, shared card hover lift of 4–6px, and at most 2deg tilt with existing pointer-glass state.
  - Add a second moon ripple and a brief background brightening driven by the existing moon interaction; do not create unrelated timers or listeners.
  - Retain existing player accent/background linkage and ensure every new effect has a reduced-motion override.

- [ ] **Step 4: Run GREEN and full tests**
  - Run focused motion assertions and the complete Node test file.

- [ ] **Step 5: Commit**
  - Commit only Task 4 files with `feat: enrich homepage glass interactions`.

## Final verification

- [ ] Run `git diff --check` and the full Node suite.
- [ ] Browser-test 1440×900, 1024×768, 720×900, and 320×568: heading line count, no horizontal overflow, fixed search geometry during quote cycles, SVG centering, Dock/panel bounds, mobile 72dvh cap, queue behavior, archive stage exclusivity, playback/LRC/focus behavior, and no intersections with fixed UI.
- [ ] Verify reduced-motion source contract and live functional behavior.
- [ ] Dispatch a whole-branch reviewer over the merge-base-to-HEAD review package.
- [ ] After review approval, merge to `master`, run tests again, push GitHub, and verify local/master/origin/master/remote SHA equality.
