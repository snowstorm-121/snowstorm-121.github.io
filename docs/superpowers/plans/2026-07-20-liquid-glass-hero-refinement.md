# Liquid Glass Hero Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove desktop copy/player collisions while refining the homepage with a cohesive, restrained liquid-glass material system.

**Architecture:** Keep the existing independent desktop search and quote siblings under `.hero-top`, but use a shared clamped left offset and reduced central dimensions. Make the vinyl card compact through local sizing variables and a desktop-only vertical translation. Define shared CSS surface tokens in `index.html` and consume them on existing surfaces without altering markup, scripts, assets, or dependencies.

**Tech Stack:** Static HTML, CSS custom properties, existing browser JavaScript, Node built-in test runner.

## Global Constraints

- Modify only the isolated worktree branch `feature/vinyl-player-card`; do not reset or delete existing work.
- Preserve one `profileAudio`, all local MP3/LRC/cover paths, original local social SVGs, existing search/lyrics/player behavior, and no new dependencies, remote images, or CDN stylesheets.
- Desktop means widths above `1320px`; at `1320px` and below preserve normal source/visual order and reset desktop-only geometry.
- Keep the typewriter quote wrapper at exactly two lines and preserve `prefers-reduced-motion` behavior.
- Use `apply_patch` for edits; run `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs` for every task.

---

### Task 1: Reserve the desktop hero lane and compact the player

**Files:**
- Modify: `index.html:422-570,612-760,1230-1300`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: independent `.hero-top > #hero-search-form` and `.hero-middle-stack` desktop siblings.
- Produces: CSS geometry that leaves a central lane clear of the third-column `.vinyl-player` and resets at `max-width: 1320px`.

- [ ] **Step 1: Write the failing test**

Add a focused test that extracts the desktop selectors and asserts all of the following: both middle nodes use the same nonzero negative `translateX` offset in addition to centering; their desktop width is below `520px`; quote font maximum is below `42px`; the player has a maximum width below `316px` and a negative desktop `--vinyl-y`; the `max-width: 1320px` block resets the lane translation and player vertical offset.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Expected: the new hero-lane assertions fail because the current lane is centered at `translateX(-50%)`, uses `520px`, quote maximum `42px`, and the player retains its older dimensions.

- [ ] **Step 3: Write minimal implementation**

In the existing desktop rules, use shared values equivalent to:

```css
--hero-lane-offset: clamp(54px, 6vw, 108px);
--hero-lane-width: 468px;
transform: translateX(calc(-50% - var(--hero-lane-offset)));
```

for both lane siblings. Reduce `.hero-quote-area` to `clamp(21px, 2.25vw, 34px)`. Set the desktop player to a width no larger than `284px`, reduce record/deck sizes proportionally, and add a desktop `--vinyl-y: clamp(-46px, -3vh, -22px)`. In the existing `max-width: 1320px` block, restore neutral lane and player custom-property values.

- [ ] **Step 4: Run test to verify it passes**

Run the exact command above. Expected: all existing tests plus the geometry test pass.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "refine: reserve hero lane for compact vinyl"
```

### Task 2: Apply restrained liquid-glass materials

**Files:**
- Modify: `index.html:20-85,370-385,483-500,612-667,910-925,1028-1065`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: the geometry from Task 1 and existing surface selectors `.site-header`, `.profile-card`, `.hero-search`, `.vinyl-player`, `.contact-popover`, and `.archive-card`.
- Produces: one shared tokenized material system consumed by every named surface without changing its HTML or interaction selectors.

- [ ] **Step 1: Write the failing test**

Add a test that asserts `:root` defines `--glass-fill`, `--glass-border`, `--glass-highlight`, and `--glass-shadow`; each named surface consumes both the shared fill and shared border; and no external stylesheet URL is introduced.

- [ ] **Step 2: Run test to verify it fails**

Run the exact Node test command. Expected: the new material-token assertions fail because the shared tokens and selector consumption do not exist.

- [ ] **Step 3: Write minimal implementation**

Define the four tokens near existing root color variables. Update the six named selectors to use a low-opacity blue fill, shared thin border, inset highlight, deep ambient shadow, and their existing backdrop blur. Add only static pseudo-element or background highlights already compatible with each selector; do not add animation or JavaScript.

- [ ] **Step 4: Run test to verify it passes**

Run the exact command. Expected: all tests pass, with no changes to player, quote, social, or local asset tests.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/homepage-hero.test.mjs
git commit -m "style: unify homepage liquid glass surfaces"
```

## Final Verification

- [ ] Run the full Node suite on the feature branch.
- [ ] Inspect the final CSS for `max-width: 1320px` resets, two-line quote wrapper, and existing reduced-motion block.
- [ ] Conduct independent task reviews and a final whole-branch review.
- [ ] Merge to `master`, run the same suite on `master`, push, and verify the remote tracking reference.
