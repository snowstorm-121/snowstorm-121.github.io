# Compact Vinyl Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vinyl player compact, correctly position the tonearm, stabilize the middle stack, restore graphical social icons, and prevent layout overlap.

**Architecture:** Keep the single-file static page. CSS owns the compact three-region desktop geometry and responsive flow; existing native audio state continues to own playing state. Inline SVG restores icon visuals without an external asset request.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Node built-in test runner, inline SVG.

## Global Constraints

- Work only in the existing `clock-lyrics-widget` linked worktree on `feature/vinyl-player-card`.
- Keep the sole `profileAudio`, local music/LRC/covers, current lyric disclosure, and no external runtime requests.
- Use `clamp(304px, 25vw, 348px)` for desktop player width, `clamp(148px, 12vw, 164px)` for record size, and a 70% cover-to-record ratio.
- In normal motion the playing tonearm is over the record; paused tonearm is outside it. Reduced motion remains static.
- Search plus quote are a fixed middle stack; desktop and 1024px/320px layouts must not overlap.
- Social controls use inline SVG, not letter placeholders or CDN icon fonts.

---

### Task 1: Lock compact geometry and tonearm state

**Files:**
- Modify: `index.html:433-847, 1193-1280`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `.hero-middle-stack`, `.vinyl-player`, `.vinyl-record`, `#vinyl-cover`, `.vinyl-tonearm`, and existing `.is-playing` state.
- Produces: compact CSS contracts for desktop and responsive flow.

- [ ] **Step 1: Write failing geometry tests**

```js
test("compact vinyl geometry keeps a large label and fixed middle stack", () => {
  assert.match(page, /\.vinyl-player\s*\{[\s\S]*width: clamp\(304px, 25vw, 348px\)/);
  assert.match(page, /--record-size: clamp\(148px, 12vw, 164px\)/);
  assert.match(page, /#vinyl-cover\s*\{[\s\S]*width: 70%/);
  assert.match(page, /\.hero-middle-stack\s*\{[\s\S]*width: min\(520px, calc\(100vw - 860px\)\)/);
});

test("tonearm enters the record only while playing and the compact layout reflows", () => {
  assert.match(page, /\.vinyl-tonearm\s*\{[\s\S]*transform: rotate\(-28deg\)/);
  assert.match(page, /\.vinyl-player\.is-playing \.vinyl-tonearm\s*\{\s*transform: rotate\(12deg\)/);
  assert.match(page, /@media \(max-width: 1200px\)[\s\S]*\.vinyl-player\s*\{[\s\S]*grid-template-columns: 1fr/);
});
```

- [ ] **Step 2: Run RED**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="compact vinyl geometry|tonearm enters" tests/homepage-hero.test.mjs`

Expected: FAIL because the current player is larger, its cover is smaller, and the tonearm transforms do not use the declared compact positions.

- [ ] **Step 3: Implement the minimum CSS contract**

```css
.vinyl-player { width: clamp(304px, 25vw, 348px); --record-size: clamp(148px, 12vw, 164px); }
#vinyl-cover { width: 70%; height: 70%; }
.vinyl-tonearm { transform: rotate(-28deg); }
.vinyl-player.is-playing .vinyl-tonearm { transform: rotate(12deg); }
@media (max-width: 1200px) { .vinyl-player { grid-template-columns: 1fr; } }
```

Preserve the existing fixed stack rules and add only the required gap/min-width constraints to keep left, middle, and right regions separate.

- [ ] **Step 4: Run GREEN and commit**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="compact vinyl geometry|tonearm enters" tests/homepage-hero.test.mjs`

Expected: 2 passing tests.

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: compact vinyl player layout"
```

### Task 2: Restore graphical social icons and validate collision boundaries

**Files:**
- Modify: `index.html:850-879, 1422-1428`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `.hero-socials` anchor/button semantics and all existing `aria-label` values.
- Produces: local SVG icon markup and static no-overlap/reflow contracts.

- [ ] **Step 1: Write failing icon and safety tests**

```js
test("social controls use local SVG icons and retain accessible labels", () => {
  assert.match(page, /aria-label="GitHub"[\s\S]*<svg/);
  assert.match(page, /aria-label="发送邮件"[\s\S]*<svg/);
  assert.doesNotMatch(page, /class="social-icon"[^>]*>GH</);
});

test("hero reserves independent regions before compact player reflow", () => {
  assert.match(page, /\.hero-top\s*\{[\s\S]*grid-template-columns:/);
  assert.match(page, /\.hero-middle-stack\s*\{[\s\S]*min-width: 0/);
  assert.match(page, /@media \(max-width: 1200px\)[\s\S]*\.hero-top\s*\{[\s\S]*grid-template-columns: 1fr/);
});
```

- [ ] **Step 2: Run RED**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern="social controls use local SVG|hero reserves" tests/homepage-hero.test.mjs`

Expected: FAIL because the social controls use text placeholders and no explicit compact-region safety contract exists.

- [ ] **Step 3: Implement inline SVG only**

Replace each social placeholder span with an `aria-hidden="true"` inline SVG, keep the existing link/button and accessible label, and add only CSS needed to size `svg` inside `.social-icon`. Set grid min-width and responsive one-column rules required by the test; do not add external assets or dependencies.

- [ ] **Step 4: Run full suite and commit**

Run: `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`

Expected: all tests pass.

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "feat: restore graphical social icons"
```
