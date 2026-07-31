# Visitor Counter Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the homepage visitor counter to a quiet, compact status strip so the social links remain the visual focus of the connection section.

**Architecture:** Keep the existing `aside.visitor-counter`, two `output` elements, live status node, Cookie/Worker JavaScript, and count API unchanged. Replace only the counter’s presentational HTML classes and CSS layout: a micro label and inline counters form the glass strip, while the live status becomes screen-reader-only and privacy copy becomes a subdued caption.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript test suite run with Node’s built-in test runner.

## File Structure

- `index.html`: Keep the anonymous counter semantics and IDs; remove the visual kicker and assign classes for compact label and visually-hidden runtime status.
- `assets/homepage/homepage.css`: Replace the large card and nested statistic-card rules with a low-contrast, maximum-300px inline glass strip and a compact mobile rule.
- `tests/homepage-hero.test.mjs`: Assert the compact semantic structure and static styling contract while retaining existing privacy/runtime checks.

## Global Constraints

- Work only in the isolated `feature/visitor-counter-compact` branch and do not modify the main checkout.
- Keep the counter after `.social-links`; social icons remain the connection section’s primary visual element.
- Keep one `aside.visitor-counter`, `#visitor-total`, `#visitor-today`, `#visitor-counter-status[role="status"]`, `aria-busy`, anonymous Cookie behavior, and the existing Cloudflare endpoint unchanged.
- Desktop counter width must not exceed `300px`; do not render a kicker, a large title, or two independent statistic-card panels.
- Keep the low-contrast glass treatment, privacy copy “仅作匿名统计，不记录 IP”, reduced-motion compatibility, and safe failure state.
- At `320px`, allow natural wrapping only; no horizontal overflow and no overlap with the fixed music Dock.
- Do not change the Worker/D1 files, add dependencies or remote assets, add audio elements, or change any social links.

---

### Task 1: Convert the visitor card into a compact status strip

**Files:**
- Modify: `index.html:164-178`
- Modify: `assets/homepage/homepage.css:343-363`
- Modify: `tests/homepage-hero.test.mjs:389-406`

**Interfaces:**
- Consumes: Existing homepage runtime queries `.visitor-counter`, `#visitor-total`, `#visitor-today`, and `#visitor-counter-status`.
- Produces: The same semantic and runtime interface in compact markup; no JavaScript interface changes.

- [ ] **Step 1: Write the failing static-layout test**

Replace the current large-card assertions inside `test("homepage places one semantic anonymous visitor card after contact links", ...)` with these additions while retaining its endpoint, uniqueness, output, status, privacy, and no-analytics assertions:

```js
assert.match(connection, /<h3 id="visitor-counter-title" class="visitor-counter-label">VISITOR LOG<\/h3>/);
assert.doesNotMatch(connection, /visitor-counter-kicker/);
assert.match(connection, /id="visitor-counter-status" class="sr-only" role="status"/);
assert.match(counterRules, /width:\s*min\(100%,\s*300px\)/);
assert.match(counterRules, /display:\s*flex/);
assert.doesNotMatch(styles, /\.visitor-counter-stats div\s*\{[^}]*padding:/);
assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.visitor-counter\s*\{[^}]*max-width:\s*100%/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
```

Expected: the visitor-card test fails because the current markup still has `visitor-counter-kicker`, the status lacks `sr-only`, and CSS still specifies `420px` and nested statistic-card padding.

- [ ] **Step 3: Apply the minimal compact markup and CSS**

In `index.html`, replace the visitor-card internals with this structure. Keep the existing `aside` attributes, output IDs, Chinese labels, status text, and privacy text exactly as shown:

```html
<h3 id="visitor-counter-title" class="visitor-counter-label">VISITOR LOG</h3>
<dl class="visitor-counter-stats">
  <div><dt>总访客</dt><dd><output id="visitor-total">—</output></dd></div>
  <div><dt>今日</dt><dd><output id="visitor-today">—</output></dd></div>
</dl>
<p id="visitor-counter-status" class="sr-only" role="status" aria-live="polite">正在同步匿名访客统计</p>
<p class="visitor-counter-privacy">仅作匿名统计，不记录 IP</p>
```

Replace the former `.visitor-counter` through `.visitor-counter-privacy` rules with the following compact contract; retain the existing global `.sr-only` rule:

```css
.visitor-counter { width: min(100%, 300px); max-width: 100%; margin: 18px auto 0; padding: 10px 13px 8px; border: 1px solid rgba(198, 225, 239, .16); border-radius: 18px; background: rgba(8, 24, 42, .32); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 8px 20px rgba(0, 0, 0, .1); text-align: center; backdrop-filter: blur(14px) saturate(115%); }
.visitor-counter, .visitor-counter-stats, .visitor-counter-stats div { display: flex; align-items: center; justify-content: center; }
.visitor-counter { flex-wrap: wrap; gap: 6px 8px; }
.visitor-counter-label, .visitor-counter-stats, .visitor-counter-stats div { margin: 0; }
.visitor-counter-label { color: rgba(238, 244, 250, .72); font-size: 10px; letter-spacing: .13em; }
.visitor-counter-stats { gap: 8px; }
.visitor-counter-stats div { gap: 4px; }
.visitor-counter-stats dt, .visitor-counter-privacy { color: var(--muted); font-size: 10px; }
.visitor-counter-stats dd { margin: 0; }
.visitor-counter output { color: var(--ink); font-family: Georgia, "Noto Serif SC", "Songti SC", serif; font-size: 15px; font-variant-numeric: tabular-nums; }
.visitor-counter-privacy { flex-basis: 100%; margin: 0; color: rgba(238, 244, 250, .42); font-size: 9px; line-height: 1.4; }
@media (max-width: 480px) { .visitor-counter { max-width: 100%; } }
```

Do not modify `assets/homepage/homepage.js`, any Worker file, the endpoint attribute, or any social-link markup.

- [ ] **Step 4: Run regression verification**

Run:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/homepage/homepage.js
git diff --check
```

Expected: homepage suite passes with no failures, JavaScript syntax check exits `0`, and `git diff --check` is silent.

- [ ] **Step 5: Browser acceptance**

Serve the worktree locally and inspect `1440×900` and `320×568`.

- At desktop width, confirm the social icon row is visually dominant, the strip is at most `300px` wide, and no large title or inner statistic cards remain.
- At `320px`, confirm no horizontal scroll and no intersection between the counter strip and music Dock.
- Toggle reduced-motion preference if the browser supports it; confirm no new motion is introduced and the counter remains readable.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/homepage/homepage.css tests/homepage-hero.test.mjs
git commit -m "style: compact visitor counter"
```

## Final Verification

- Run the Worker suite unchanged to prove the counter backend was not affected:

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test counter-worker/tests/visitor-counter.test.mjs
```

- Run the homepage suite, both JavaScript syntax checks, and `git diff --check`.
- Require a fresh task reviewer and final whole-branch reviewer before merging. Preserve the worktree and branch after merge unless the user expressly requests cleanup.
