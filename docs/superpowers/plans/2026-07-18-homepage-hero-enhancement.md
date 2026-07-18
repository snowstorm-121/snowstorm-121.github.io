# Homepage Hero Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Enhance the static homepage hero while preserving its existing profile/player, adding the approved title/search/social structure and the interactive Memory Aperture.

**Architecture:** Keep the page as one static HTML document. Add scoped hero markup, CSS, and DOM event handlers directly to index.html; use Node built-in static-contract tests plus browser checks for visual behavior.

**Tech Stack:** HTML, CSS, browser DOM APIs, Web Audio API, Font Awesome CDN, Node.js built-in test runner.

## Global Constraints

- Preserve the avatar, education card, player controls, track switching, profile interaction, background, navigation, archives, quote rotation, and mobile profile-first order.
- Change the profile audio gain ramp target from 0.80 to exactly 1.00.
- Do not add a framework, build system, package manager, or third-party JavaScript.
- Scope new visual selectors with hero- or memory-aperture.
- On wide screens quote content must start to the right of the 280px profile column.
- At max-width 1320px and max-width 720px, no hero blocks may rely on absolute positioning that can overlap other hero blocks.
- Search submits a Bing query restricted to snowstorm-121.github.io.
- WeChat is an on-page copyable contact ID, not a fake profile link.
- Memory Aperture supports keyboard activation and reduced motion.

---

## File Structure

- index.html — static homepage; receives the hero markup, styling, links, audio target, and interaction handlers.
- tests/homepage-hero.test.mjs — Node built-in tests for static markup, supplied links, gain target, and reduced-motion contract.

### Task 1: Add contract tests and the title/search layout shell

**Files:**
- Create: tests/homepage-hero.test.mjs
- Modify: index.html:401-463, index.html:746-820, index.html:868-877

**Interfaces:**
- Consumes: existing #hero, .hero-profile, #sentence, #eyebrow, and #progress.
- Produces: #hero-title, #hero-search-form, #hero-search-input, .hero-content, and .hero-socials.

- [ ] **Step 1: Write the failing static-contract test**

    import assert from "node:assert/strict";
    import test from "node:test";
    import { readFile } from "node:fs/promises";

    const page = await readFile(new URL("../index.html", import.meta.url), "utf8");

    test("hero provides title, Bing search, and a safe main region", () => {
      assert.match(page, /id="hero-title"[^>]*>STILL, I GO ON/);
      assert.match(page, /id="hero-search-form"[^>]*action="https:\/\/www\.bing\.com\/search"/);
      assert.match(page, /id="hero-search-input"[^>]*name="q"/);
      assert.match(page, /class="hero-content"/);
      assert.match(page, /\.hero-main\s*\{[\s\S]*margin:\s*0 clamp\(22px, 4vw, 78px\) 0 clamp\(300px,/);
    });

- [ ] **Step 2: Run the test to verify it fails**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
    Expected: FAIL because the title, search form, and hero-content do not exist.

- [ ] **Step 3: Replace only the current hero-main contents**

    <main class="hero-main">
      <div class="hero-content">
        <div class="hero-heading">
          <p class="hero-heading-kicker">PERSONAL ARCHIVE / 121</p>
          <h1 id="hero-title">STILL, I GO ON</h1>
        </div>
        <form id="hero-search-form" class="hero-search" action="https://www.bing.com/search" method="get" target="_blank">
          <label class="sr-only" for="hero-search-input">搜索个人主页</label>
          <span class="hero-search-label">SEARCH</span>
          <input id="hero-search-input" name="q" type="search" placeholder="搜索你的档案…" autocomplete="off">
          <button type="submit" aria-label="搜索"><span aria-hidden="true">⌕</span></button>
        </form>
        <div class="hero-quote-area">
          <div class="eyebrow" id="eyebrow">NOTES ON LIFE · 01 / 10</div>
          <div class="sentence-wrap"><p class="sentence" id="sentence"><span class="sentence-line" data-line="0"></span><span class="sentence-line" data-line="1"></span></p></div>
          <div class="progress" id="progress" aria-label="文案播放进度"></div>
        </div>
      </div>
    </main>

- [ ] **Step 4: Add the wide-screen layout and responsive overrides**

    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .hero-main {
      width: min(960px, calc(100vw - 390px));
      margin: 0 clamp(22px, 4vw, 78px) 0 clamp(300px, 27vw, 380px);
      text-align: center;
    }
    .hero-content { display: grid; justify-items: stretch; gap: clamp(20px, 3vh, 36px); }
    .hero-heading { text-align: left; }
    .hero-heading-kicker { margin: 0 0 13px; color: rgba(234,242,248,.58); font-size: 10px; letter-spacing: .42em; }
    #hero-title { margin: 0; font: italic 700 clamp(38px, 5.2vw, 76px)/.9 Georgia, serif; letter-spacing: .08em; text-shadow: 5px 6px 0 rgba(3,10,19,.34); transform: skewX(-10deg); }
    .hero-search { display: flex; align-items: center; min-height: 62px; padding: 0 18px; border: 1px solid rgba(255,255,255,.38); border-radius: 999px; background: rgba(4,13,24,.40); backdrop-filter: blur(14px); }
    .hero-search-label { padding-right: 16px; border-right: 1px solid rgba(255,255,255,.24); font-size: 10px; font-weight: 700; letter-spacing: .18em; }
    .hero-search input { min-width: 0; flex: 1; padding: 0 15px; border: 0; outline: 0; color: var(--text); background: transparent; font: inherit; }
    .hero-search button { border: 0; color: var(--text); background: transparent; font-size: 29px; cursor: pointer; }
    .hero-quote-area { width: min(100%, 780px); justify-self: center; }
    .sentence-wrap { height: 198px; }
    .sentence { max-width: 780px; font-size: clamp(24px, 2.7vw, 42px); }

    @media (max-width: 1320px) {
      .hero-main { width: 100%; margin: 0; }
      .hero-content { width: min(860px, 100%); margin-inline: auto; }
    }
    @media (max-width: 720px) {
      #hero-title { font-size: clamp(34px, 12vw, 54px); }
      .hero-heading-kicker { font-size: 8px; }
      .hero-search { min-height: 54px; }
      .sentence-wrap { height: 204px; }
      .sentence { font-size: clamp(14px, 3.7vw, 19px); }
    }

- [ ] **Step 5: Verify the first contract and commit**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
    Expected: PASS with one passing subtest.

    git add index.html tests/homepage-hero.test.mjs
    git commit -m "feat: add homepage hero title and search"

### Task 2: Add Memory Aperture and social-contact UI

**Files:**
- Modify: index.html:401-463, index.html:879-885, tests/homepage-hero.test.mjs

**Interfaces:**
- Consumes: .hero-content created in Task 1 and the preserved .hero-profile column.
- Produces: #memory-aperture, #memory-aperture-phrase, .hero-socials, #contact-popover, and a WeChat trigger.

- [ ] **Step 1: Extend the test with aperture and link contracts**

    test("hero exposes aperture and supplied social contacts", () => {
      assert.match(page, /id="memory-aperture"[^>]*type="button"/);
      assert.match(page, /id="memory-aperture-phrase">GO ON/);
      assert.match(page, /data-contact="wechat"/);
      assert.match(page, /https:\/\/github\.com\/snowstorm-121/);
      assert.match(page, /mailto:2971234387@qq\.com/);
      assert.match(page, /https:\/\/www\.youtube\.com\/@yongyiyan/);
      assert.match(page, /https:\/\/x\.com\/yongyi_121/);
    });

- [ ] **Step 2: Run the extended test to verify it fails**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
    Expected: FAIL in the aperture and social-contact subtest.

- [ ] **Step 3: Add Font Awesome once and insert the approved markup**

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" referrerpolicy="no-referrer">

    <button class="memory-aperture" id="memory-aperture" type="button" aria-label="切换记忆短句">
      <span class="memory-aperture-ticks" aria-hidden="true"></span>
      <span class="memory-aperture-blades" aria-hidden="true"></span>
      <span class="memory-aperture-core" id="memory-aperture-phrase">GO ON</span>
    </button>

    <nav class="hero-socials" aria-label="联系方式">
      <a href="https://github.com/snowstorm-121" target="_blank" rel="noreferrer" aria-label="GitHub"><i class="fa-brands fa-github" aria-hidden="true"></i></a>
      <a href="mailto:2971234387@qq.com" aria-label="发送邮件"><i class="fa-solid fa-envelope" aria-hidden="true"></i></a>
      <button type="button" data-contact="wechat" aria-label="查看微信号"><i class="fa-brands fa-weixin" aria-hidden="true"></i></button>
      <a href="https://wpa.qq.com/msgrd?v=3&uin=2971234387&site=qq&menu=yes" target="_blank" rel="noreferrer" data-contact="qq" data-contact-value="2971234387" aria-label="QQ 2971234387"><i class="fa-brands fa-qq" aria-hidden="true"></i></a>
      <a href="https://www.youtube.com/@yongyiyan" target="_blank" rel="noreferrer" aria-label="YouTube"><i class="fa-brands fa-youtube" aria-hidden="true"></i></a>
      <a href="https://x.com/yongyi_121" target="_blank" rel="noreferrer" aria-label="X"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i></a>
    </nav>
    <div class="contact-popover" id="contact-popover" hidden role="status"><span id="contact-popover-value">微信：yan_yongyi</span><button type="button" id="copy-contact">复制</button></div>

- [ ] **Step 4: Add the visual styles with these non-negotiable contracts**

    .memory-aperture {
      --depth-x: 0px; --depth-y: 0px;
      position: absolute; top: clamp(110px, 17vh, 180px); right: clamp(22px, 4vw, 62px);
      width: 148px; height: 148px; display: grid; place-items: center; overflow: hidden;
      border: 1px solid rgba(219,243,246,.8); border-radius: 50%;
      background: linear-gradient(145deg, rgba(240,254,255,.27), rgba(3,13,21,.55));
      box-shadow: inset 12px 9px 16px rgba(241,255,255,.16), inset -14px -12px 20px rgba(0,9,16,.42), 0 20px 60px rgba(0,0,0,.35);
      transform: translate(var(--depth-x), var(--depth-y)) rotate(var(--turn, 0deg));
      transition: transform .16s ease-out, box-shadow .35s ease;
    }
    .memory-aperture-ticks { position: absolute; inset: 8px; border-radius: inherit; background: repeating-conic-gradient(from 12deg, rgba(221,243,243,.54) 0 1deg, transparent 1.5deg 11deg); -webkit-mask: radial-gradient(transparent 0 62%, #000 63% 65%, transparent 66%); mask: radial-gradient(transparent 0 62%, #000 63% 65%, transparent 66%); }
    .memory-aperture-blades { width: 102px; height: 102px; border-radius: 50%; background: conic-gradient(from 15deg, #0a1823 0 38deg, #1d4a5a 40deg 57deg, #07131d 59deg 98deg, #285766 100deg 116deg, #06131d 118deg 157deg, #1d4857 159deg 176deg, #06131d 178deg 217deg, #285867 219deg 236deg, #07141e 238deg 277deg, #1c4756 279deg 296deg, #06121c 298deg 337deg, #2a5966 339deg 356deg, #0b1922 358deg); box-shadow: inset 0 0 24px rgba(0,0,0,.72); transform: scale(var(--blade-scale, .86)) rotate(var(--blade-turn, 0deg)); transition: transform .38s cubic-bezier(.2,.75,.2,1); }
    .memory-aperture-core { position: absolute; z-index: 1; width: 58px; height: 58px; display: grid; place-items: center; border: 1px solid rgba(225,244,246,.65); border-radius: 50%; background: rgba(4,21,34,.74); font-size: 9px; letter-spacing: .14em; }
    .hero-socials { position: absolute; bottom: 28px; left: clamp(22px, 3.8vw, 58px); display: flex; gap: 10px; }
    .hero-socials a, .hero-socials button { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.30); border-radius: 50%; color: var(--text); background: rgba(4,15,28,.42); cursor: pointer; transition: transform .25s ease, background .25s ease; }
    .hero-socials a:hover, .hero-socials a:focus-visible, .hero-socials button:hover, .hero-socials button:focus-visible { transform: translateY(-4px); background: rgba(101,203,229,.32); }
    .contact-popover { position: absolute; z-index: 6; bottom: 76px; left: clamp(22px, 3.8vw, 58px); display: flex; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid rgba(255,255,255,.22); border-radius: 12px; background: rgba(4,15,28,.82); box-shadow: 0 12px 28px rgba(0,0,0,.28); font-size: 11px; }
    .contact-popover button { border: 0; border-radius: 999px; padding: 5px 8px; color: var(--text); background: rgba(101,203,229,.30); cursor: pointer; }

    Add these overrides at max-width 1320px so the stacked hero cannot overlap: .memory-aperture { position: relative; inset: auto; margin: 8px auto 28px; } .hero-socials { position: relative; inset: auto; justify-content: center; margin-top: 26px; } .contact-popover { position: relative; inset: auto; width: fit-content; margin: 12px auto 0; }.

- [ ] **Step 5: Verify the added contract and commit**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
    Expected: PASS with two passing subtests.

    git add index.html tests/homepage-hero.test.mjs
    git commit -m "feat: add interactive memory aperture and social links"

### Task 3: Wire search, contact, aperture, audio, and reduced motion

**Files:**
- Modify: index.html:944-1262, index.html:807-820, tests/homepage-hero.test.mjs

**Interfaces:**
- Consumes: #hero-search-form, #hero-search-input, #memory-aperture, #memory-aperture-phrase, #contact-popover, #contact-popover-value, #copy-contact, and data-contact triggers.
- Produces: scoped search submission, contact copy behavior, aperture pointer/click behavior, maximum audio gain, and motion reduction.

- [ ] **Step 1: Extend test coverage**

    test("hero code configures maximum gain and motion-aware aperture", () => {
      assert.match(page, /profileTrackGain\.gain\.exponentialRampToValueAtTime\(1\.00, now \+ \.45\)/);
      assert.match(page, /const aperturePhrases = \["GO ON", "BREATHE", "DRIFT", "BEGIN"\]/);
      assert.match(page, /memoryAperture\.addEventListener\("pointermove"/);
      assert.match(page, /memoryAperture\.addEventListener\("click"/);
      assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.memory-aperture/);
    });

- [ ] **Step 2: Run test to verify it fails**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
    Expected: FAIL in the maximum-gain and aperture subtest.

- [ ] **Step 3: Make the exact audio change and add the interaction handlers**

    profileTrackGain.gain.exponentialRampToValueAtTime(1.00, now + .45);

    const heroSearchForm = document.querySelector("#hero-search-form");
    const heroSearchInput = document.querySelector("#hero-search-input");
    const memoryAperture = document.querySelector("#memory-aperture");
    const memoryAperturePhrase = document.querySelector("#memory-aperture-phrase");
    const contactPopover = document.querySelector("#contact-popover");
    const contactPopoverValue = document.querySelector("#contact-popover-value");
    const copyContact = document.querySelector("#copy-contact");
    const aperturePhrases = ["GO ON", "BREATHE", "DRIFT", "BEGIN"];
    let aperturePhraseIndex = 0;

    heroSearchForm.addEventListener("submit", () => {
      const query = heroSearchInput.value.trim();
      heroSearchInput.value = ("site:snowstorm-121.github.io " + query).trim();
    });
    document.querySelectorAll("[data-contact]").forEach((trigger) => trigger.addEventListener("click", () => {
      const isWechat = trigger.dataset.contact === "wechat";
      contactPopoverValue.textContent = isWechat ? "微信：yan_yongyi" : "QQ：2971234387";
      copyContact.dataset.value = isWechat ? "yan_yongyi" : "2971234387";
      contactPopover.hidden = false;
    }));
    copyContact.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(copyContact.dataset.value);
      copyContact.textContent = "已复制";
    });
    if (!reduceMotion) {
      memoryAperture.addEventListener("pointermove", (event) => {
        const bounds = memoryAperture.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - .5;
        const y = (event.clientY - bounds.top) / bounds.height - .5;
        memoryAperture.style.setProperty("--depth-x", (x * 10) + "px");
        memoryAperture.style.setProperty("--depth-y", (y * 8) + "px");
        memoryAperture.style.setProperty("--turn", (x * 7 + y * 4) + "deg");
        memoryAperture.style.setProperty("--blade-scale", String(.84 + Math.abs(x) * .1));
        memoryAperture.style.setProperty("--blade-turn", (x * 18 - y * 11) + "deg");
      });
      memoryAperture.addEventListener("pointerleave", () => ["--depth-x", "--depth-y", "--turn", "--blade-scale", "--blade-turn"].forEach((name) => memoryAperture.style.removeProperty(name)));
    }
    memoryAperture.addEventListener("click", () => {
      aperturePhraseIndex = (aperturePhraseIndex + 1) % aperturePhrases.length;
      memoryAperturePhrase.textContent = aperturePhrases[aperturePhraseIndex];
      memoryAperture.classList.remove("is-pulsing");
      void memoryAperture.offsetWidth;
      memoryAperture.classList.add("is-pulsing");
      window.setTimeout(() => memoryAperture.classList.remove("is-pulsing"), 720);
    });

- [ ] **Step 4: Extend the existing reduced-motion CSS**

    .memory-aperture,
    .memory-aperture-blades,
    .hero-socials a,
    .hero-socials button { transition: none; }
    .memory-aperture { transform: none; }

- [ ] **Step 5: Run tests and commit**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs
    Expected: PASS with three passing subtests.

    git add index.html tests/homepage-hero.test.mjs
    git commit -m "feat: wire homepage hero interactions"

### Task 4: Verify responsive layout and interaction behavior

**Files:**
- Modify only if verification reveals a defect: index.html
- Test: tests/homepage-hero.test.mjs

**Interfaces:**
- Consumes: the static page and Task 1–3 contracts.
- Produces: desktop, medium, and mobile visual evidence.

- [ ] **Step 1: Start the static server**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4173 --directory .
    Expected: Serving HTTP on http://0.0.0.0 port 4173.

- [ ] **Step 2: Check layout at three widths**

    At 1440px: profile remains in its left column; title/search are directly above the quote; the quote never enters the profile column; aperture is visible at the right edge; socials are below the profile.

    At 1024px: profile is first; title/search, quote, aperture, and socials are separate stacked blocks; no overlap or horizontal scroll.

    At 390px: same stacked order; controls remain visible and tap targets remain usable.

- [ ] **Step 3: Exercise behavior**

    1. Start preserved audio and confirm it reaches the 1.00 gain target.
    2. Move over the aperture and confirm small parallax and blade movement.
    3. Click aperture four times: GO ON → BREATHE → DRIFT → BEGIN → GO ON.
    4. Tab to aperture and press Enter; phrase changes.
    5. Open WeChat and QQ; confirm each shows the copyable value 微信：yan_yongyi and QQ：2971234387, while QQ also opens its direct-contact URL.
    6. Enable reduced motion; aperture movement stops.

- [ ] **Step 4: Run final static checks and commit only if a verification edit was required**

    Run: /Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/homepage-hero.test.mjs && git diff --check && git status --short
    Expected: three passing tests, no diff-check output, and no unexpected files.

    If Task 4 changed index.html:

    git add index.html tests/homepage-hero.test.mjs
    git commit -m "fix: refine responsive homepage hero"
