# Homepage Anonymous Visitor Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-preserving visitor card to the root homepage that shows all-time and Beijing-day unique browser counts without persisting or exposing IP addresses.

**Architecture:** The static GitHub Pages homepage creates a first-party random identifier and POSTs it to one Cloudflare Worker endpoint. The Worker HMAC-hashes it with a Cloudflare secret, stores only the hash and day fields in D1, and returns aggregate counts. The homepage renders the response non-blockingly and degrades safely on any client or network failure.

**Tech Stack:** Existing static HTML/CSS/JavaScript and Node built-in tests; Cloudflare Workers module runtime and D1; Wrangler only for deployment.

## Global Constraints

- Create a new isolated branch and do not modify the main checkout until final merge.
- Root homepage only; subpages must not call the counter.
- Count unique browsers, not page views; a cleared cookie, private window, or other browser is a new visitor.
- The day boundary is `Asia/Shanghai` at 00:00.
- Do not persist, return, log, or display IP addresses, User-Agent values, page paths, geolocation, fingerprints, account data, or third-party analytics data.
- Preserve the sole `#profileAudio`, nine local tracks/LRC files, existing social interactions, night navigation, and reduced-motion behavior.
- Add no production dependencies, external analytics script, CAPTCHA, remote image, or new audio element.
- Worker production Origin is exactly `https://snowstorm-121.github.io`; local development Origin may be configured only through an untracked local Wrangler config.
- Cloudflare secrets, local configs, and credentials are never committed.

---

### Task 1: Build and test the anonymous counter Worker

**Files:**
- Create: `counter-worker/src/index.mjs`
- Create: `counter-worker/migrations/0001_visitors.sql`
- Create: `counter-worker/tests/visitor-counter.test.mjs`
- Create: `counter-worker/wrangler.toml`

**Interfaces:**
- Consumes: `POST /v1/visit`, a 32-character lowercase hexadecimal request body, `COUNTER_PEPPER`, `VISITORS` D1 binding, and `ALLOWED_ORIGIN`.
- Produces: JSON `{ totalVisitors: number, todayVisitors: number }` on HTTP 200; no other application fields.

- [ ] Write Worker tests that prove first visit, same-day repeat, second visitor, cross-day repeat, rejected method/path/Origin/body, CORS headers, and absence of IP-related fields.
- [ ] Run the Worker test first and confirm it fails because the Worker module is absent.
- [ ] Add the exact D1 schema: `visitors(visitor_hash TEXT PRIMARY KEY, first_seen_day TEXT NOT NULL, last_seen_day TEXT NOT NULL)` plus `visitors_last_seen_day_idx` on `last_seen_day`.
- [ ] Implement `fetch(request, env)` with exact POST path/origin validation; HMAC-SHA-256 with `COUNTER_PEPPER`; `Asia/Shanghai` day calculation; D1 upsert followed by aggregate count query; exact CORS, `Vary: Origin`, and `Cache-Control: no-store` headers.
- [ ] Run `node --test counter-worker/tests/visitor-counter.test.mjs` and the existing homepage suite; both must pass.
- [ ] Commit with `feat: add anonymous visitor counter worker`.

### Task 2: Add the homepage visitor-glass card and client behavior

**Files:**
- Modify: `index.html`
- Modify: `assets/homepage/homepage.css`
- Modify: `assets/homepage/homepage.js`
- Modify: `tests/homepage-hero.test.mjs`

**Interfaces:**
- Consumes: `VISITOR_COUNTER_ENDPOINT` pointing to a deployed Worker `/v1/visit` URL and the Task 1 response shape.
- Produces: one `.visitor-counter` inside `#connection`, first-party `homepage_visitor_id` cookie, and status-safe count rendering.

- [ ] Add failing tests for one correctly ordered semantic card, two labelled outputs (`#visitor-total`, `#visitor-today`), status element, privacy copy, secure random 32-hex cookie reuse, request success, and failure fallback.
- [ ] Run the focused homepage tests and confirm the newly added assertions fail.
- [ ] Add the card after the existing social navigation with title `VISITOR LOG`, labels `累计访客` and `今日到访`, initial `—` outputs, `role="status"`, and exact privacy text `仅作匿名统计，不记录 IP`.
- [ ] Implement a 400-day, `Path=/`, `SameSite=Lax` first-party `homepage_visitor_id` cookie with `Secure` only on HTTPS; POST only its raw ID to `VISITOR_COUNTER_ENDPOINT`; use `Intl.NumberFormat("zh-CN")`; set an accessible unavailable state without disrupting page initialization.
- [ ] Style one compact deep-blue liquid-glass card with existing pointer-glass conventions, responsive two-column-to-stack layout, and no new continuous animation; reduced motion must retain updates while suppressing transition-only effects.
- [ ] Run the canonical homepage suite and JS syntax check; all existing behavior must remain green.
- [ ] Commit with `feat: show anonymous homepage visitor counts`.

### Task 3: Provision Cloudflare resources and bind the production endpoint

**Files:**
- Modify: `counter-worker/wrangler.toml`
- Modify: `assets/homepage/homepage.js`
- Create: `counter-worker/README.md`

**Interfaces:**
- Consumes: Task 1 Worker and a user-authorized Cloudflare login.
- Produces: live `workers.dev` endpoint, D1 binding with the real non-secret `database_id`, Cloudflare-only `COUNTER_PEPPER`, and an exact endpoint constant ending `/v1/visit`.

- [ ] Ask for Cloudflare authorization only at deployment time; do not attempt login or create remote resources before it is granted.
- [ ] Create D1 database `snowstorm-homepage-visitors`, copy its returned `database_id` into the committed Worker config, and set `COUNTER_PEPPER` through `wrangler secret put` only.
- [ ] Apply `0001_visitors.sql` remotely, deploy the Worker, then copy the returned production `workers.dev` endpoint into the sole homepage endpoint constant.
- [ ] Write a concise README containing the non-secret deploy, migration, secret rotation, and local-origin configuration commands; it must not contain tokens or the pepper value.
- [ ] Smoke-test production with one valid request and one invalid Origin request; inspect response headers/body for CORS, counts, and no IP fields.
- [ ] Re-run both Node suites after inserting the live URL and commit with `chore: connect homepage counter endpoint`.

### Task 4: Whole-branch review, browser regression, merge, and push

**Files:**
- Review only; no planned product-file changes.

- [ ] Independently review each task after its implementation with a fresh reviewer and fix all Critical or Important findings before continuing.
- [ ] Run `node --test counter-worker/tests/visitor-counter.test.mjs`, `/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs`, JS syntax checks, and `git diff --check`.
- [ ] Browser-test 1440×900, 1024×768, 720×900, and 320×568 for readable initial/success/failure card states, no collision with music/social controls, no horizontal overflow, and reduced-motion functional updates.
- [ ] Obtain a whole-branch independent review. If approved, merge into current `master`, re-run the full test suite on the merged result, push `origin master`, and verify local, `origin/master`, and `git ls-remote` SHAs match.
