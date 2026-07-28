# Prism Glass Island and Night Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task-by-task, with a fresh implementer and independent reviewer for each task.

**Goal:** Turn the expanded local music player into a readable prism-glass island and make the origin moon a session-scoped, accessible Night Navigation control.

**Architecture:** Keep the existing player and lyrics interfaces intact. Task 1 changes only the player’s visual layers and visual-state CSS. Task 2 adds the Night Navigation root state, session persistence, accessible control semantics, and one-shot ambient ceremony while reusing the existing motion preference plumbing.

**Tech Stack:** Existing static HTML, CSS, vanilla browser JavaScript, Node test runner.

## Global Constraints

- Work only in the linked worktree on branch `feature/prism-glass-night-navigation`; never modify the main checkout during implementation.
- Preserve the only `#profileAudio`, all nine local tracks, local MP3/LRC/cover paths, `TRACKS`, lyric live region, player IDs, queue, Escape/focus behavior, social controls, and existing search/quote layout.
- Add no dependency, remote image, network font, third-party icon, second audio element, or long-lived user profile storage.
- Desktop player height remains exactly `380px`; mobile player remains at most `72dvh` with its safe-area behavior and internal scrolling unchanged.
- `prefers-reduced-motion` disables every new continuous or ceremonial animation while state, music, lyrics, queue, and controls continue working.

---

### Task 1: Build the prism-glass music island

**Files:**
- Modify: `assets/homepage/homepage.css`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: existing `#music-panel`, `.music-lyrics`, `--track-accent`, `--previous-track-accent`, queue state classes, and current player motion classes.
- Produces: `.music-prism-*` visual-layer contracts expressed through CSS only; no new JavaScript or DOM IDs.

- [ ] **Step 1: Write failing visual-contract tests**

Add focused assertions requiring the open panel to use a low-alpha layered glass background, a `::before` prism highlight, a separate higher-opacity lyric reading surface, translucent control/queue surfaces, and no change to the existing `380px`/`72dvh` bounds.

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='prism glass' tests/homepage-hero.test.mjs
```

Expected: FAIL because the current panel uses the old opaque dark background and has no prism layer contract.

- [ ] **Step 3: Implement the minimal prism-glass CSS**

Replace the opaque panel treatment with a low-alpha navy glass base plus backdrop blur/saturation, a pointer-inert `#music-panel::before` specular/refraction layer using `--track-accent`, and a separate readable `.music-lyrics` inner-glass surface. Keep panel geometry, queue scrolling, and the existing track/lyric transition selectors unchanged; make controls, progress, and queue a lighter glass family.

- [ ] **Step 4: Run GREEN and the full suite**

Run the focused command above, then:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
git diff --check
```

Expected: focused tests pass, complete suite passes, diff check has no output.

- [ ] **Step 5: Commit**

```bash
git add assets/homepage/homepage.css tests/homepage-hero.test.mjs
git commit -m "feat: restyle music panel as prism glass"
```

### Task 2: Add accessible, session-scoped Night Navigation

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Test: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `#moon-ripple`, `reduceMotionQuery`, `syncMotionPreferences()`, existing root datasets/classes, and section rail styles.
- Produces: root `data-night-navigation="on|off"`, `sessionStorage` key `homepage-night-navigation`, button `aria-pressed`, and bounded `.is-night-navigating` ceremony state.

- [ ] **Step 1: Write failing behavior tests**

Add focused tests requiring an off-by-default button with `aria-pressed="false"`, safe restoration of `homepage-night-navigation` from session storage, guarded storage failures, toggled root state and accessible labels, bounded ceremony cleanup, and no ceremony classes under reduced motion.

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-name-pattern='night navigation' tests/homepage-hero.test.mjs
```

Expected: FAIL because the current moon is a stateless one-shot ripple without session persistence or `aria-pressed`.

- [ ] **Step 3: Implement state, persistence, and ceremony**

Give `#moon-ripple` an initial `aria-pressed="false"`. Add guarded `sessionStorage` read/write helpers around the exact key `homepage-night-navigation`; write `data-night-navigation="on|off"` on the root and synchronize button labels/pressed state. Reuse the existing motion preference handler so reduced motion clears/avoids `.is-night-navigating`. In full motion, use a bounded class only for the 1.35s activation ceremony; CSS supplies the 180ms bloom, crescent shadow, two rings, section-rail sweep, and single star expansion before leaving the stable active visual state.

- [ ] **Step 4: Run GREEN and the full suite**

Run the focused command above, then:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js
git diff --check
```

Expected: all tests and syntax check pass, diff check has no output.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/homepage/homepage.css assets/homepage/homepage.js tests/homepage-hero.test.mjs
git commit -m "feat: add session night navigation"
```

### Task 3: Whole-branch validation and delivery

- [ ] Generate a review package from merge base `b22839e` and dispatch one independent whole-branch reviewer.
- [ ] Validate desktop `1440×900`, `1024×768`, `720×900`, and `320×568` in a browser: prism transparency/readability, player bounds, queue, Escape/focus, Night Navigation activation/recovery, keyboard state, no horizontal overflow.
- [ ] Verify reduced-motion rules and runtime behavior; if browser emulation is unavailable, record that limitation and supplement it with static/runtime regression tests.
- [ ] After approval, merge into `master`, rerun the complete test command on the merge result, push `origin/master`, and verify local `HEAD`, `origin/master`, and `git ls-remote` SHA agree. Preserve the worktree and feature branch.
