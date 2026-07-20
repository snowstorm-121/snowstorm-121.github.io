import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
const heroMarkup = page.slice(
  page.indexOf('<section class="hero" id="hero">'),
  page.indexOf('<section class="archives" id="archives">'),
);

function directHeroTopChildren(markup) {
  const start = markup.indexOf('<div class="hero-top">') + '<div class="hero-top">'.length;
  const voidTags = new Set(["img", "input"]);
  const children = [];
  let depth = 1;

  for (const match of markup.slice(start).matchAll(/<\/?([a-z][\w-]*)(?:\s[^<>]*?)?>/gi)) {
    const openingTag = match[0];
    const tagName = match[1].toLowerCase();

    if (openingTag.startsWith("</")) {
      depth -= 1;
      if (depth === 0) break;
      continue;
    }

    if (depth === 1) {
      children.push({
        tagName,
        id: openingTag.match(/\bid="([^"]+)"/)?.[1] ?? "",
        className: openingTag.match(/\bclass="([^"]+)"/)?.[1] ?? "",
      });
    }
    if (!voidTags.has(tagName) && !openingTag.endsWith("/>")) depth += 1;
  }

  return children;
}

function mediaBlock(source, condition) {
  const opener = new RegExp(`@media\\s*\\(\\s*${condition}\\s*\\)\\s*\\{`, "i").exec(source);
  assert.ok(opener, `missing @media (${condition}) block`);

  let depth = 1;
  let inComment = false;
  let quote = "";
  const start = opener.index + opener[0].length;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (inComment) {
      if (character === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index);
  }

  assert.fail(`unterminated @media (${condition}) block`);
}

test("hero provides title, Google search, and a safe main region", () => {
  assert.match(page, /id="hero-title"[^>]*>STILL, I GO ON/);
  assert.match(page, /id="hero-search-form"[^>]*action="https:\/\/www\.google\.com\/search"/);
  assert.match(page, /id="hero-search-input"[^>]*name="q"/);
  assert.match(page, /class="hero-content"/);
});

test("hero keeps the quote in its own middle stack", () => {
  assert.doesNotMatch(heroMarkup, /class="hero-middle-stack"[\s\S]*id="hero-search-form"/);
  assert.match(heroMarkup, /class="hero-middle-stack"[\s\S]*class="hero-quote-area"/);
  assert.match(page, /\.hero-middle-stack\s*\{[\s\S]*min-width: 0;/);
  assert.match(page, /\.sentence-wrap\s*\{[\s\S]*height: calc\(2 \* var\(--sentence-line-height\)\)/);
});

test("desktop hero independently anchors the search form while quote height changes", () => {
  const desktopHero = page.match(/\.hero-top\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const desktopMain = page.match(/\.hero-main\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const desktopStack = page.match(/\.hero-middle-stack\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const desktopSearch = page.match(/\.hero-top > #hero-search-form\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";

  assert.match(desktopHero, /position: relative;/);
  assert.match(desktopHero, /min-height: 100svh;/);
  assert.match(page, /\.hero-profile\s*\{[\s\S]*grid-column: 1;/);
  assert.match(page, /\.vinyl-player\s*\{[\s\S]*grid-column: 3;/);
  assert.match(desktopSearch, /position: absolute;/);
  assert.match(desktopSearch, /left: 50%;/);
  assert.match(desktopSearch, /top: clamp\(230px, 32vh, 320px\);/);
  assert.match(desktopSearch, /width: var\(--hero-lane-width\);/);
  assert.match(desktopSearch, /max-width: calc\(100% - 676px\);/);
  assert.match(desktopSearch, /transform: translateX\(calc\(-50% - var\(--hero-lane-offset\)\)\);/);
  assert.doesNotMatch(desktopSearch, /translateY|translate\(-50%, -50%\)|top: 50%/);
  assert.match(desktopStack, /position: absolute;/);
  assert.match(desktopStack, /top: clamp\(312px, calc\(32vh \+ 82px\), 402px\);/);
  assert.doesNotMatch(desktopMain, /position: absolute;|left: 50%;|top: 50%;|transform: translateX\(-50%\)/);
  assert.deepEqual(directHeroTopChildren(heroMarkup), [
    { tagName: "aside", id: "hero-profile", className: "hero-profile" },
    { tagName: "main", id: "", className: "hero-main" },
    { tagName: "form", id: "hero-search-form", className: "hero-search" },
    { tagName: "div", id: "", className: "hero-middle-stack" },
    { tagName: "button", id: "vinyl-player", className: "vinyl-player" },
  ]);
  assert.match(page, /@media \(max-width: 1320px\)\s*\{[\s\S]*\.hero-top > #hero-search-form\s*\{[\s\S]*position: static;[\s\S]*width: min\(520px, 100%\);[\s\S]*transform: none;/);
  assert.match(page, /@media \(max-width: 1320px\)\s*\{[\s\S]*\.hero-middle-stack\s*\{[\s\S]*position: static;[\s\S]*width: min\(520px, 100%\);[\s\S]*transform: none;/);
  assert.doesNotMatch(page, /\.hero-top\s*\{\s*display: contents;/);
  assert.match(page, /@media \(max-width: 1320px\)\s*\{[\s\S]*\.hero-profile,\s*\.vinyl-player\s*\{\s*grid-column: auto;/);
});

test("1320px hero CSS does not visually reorder the source flow", () => {
  const mobileHero = mediaBlock(page, "max-width\\s*:\\s*1320px");

  assert.doesNotMatch(mobileHero, /\border\s*:/i);
  assert.doesNotMatch(mobileHero, /\bdisplay\s*:\s*contents\b/i);
});

test("QQ contact retains its link contract and renders a white penguin SVG", () => {
  const qqLink = page.match(/<a href="https:\/\/wpa\.qq\.com\/msgrd\?v=3&uin=2971234387&site=qq&menu=yes" target="_blank" rel="noreferrer" aria-label="QQ 2971234387">[\s\S]*?<\/a>/)?.[0] ?? "";
  assert.match(qqLink, /<svg[^>]*class="social-icon"[^>]*viewBox="0 0 24 24"/);
  assert.doesNotMatch(qqLink, /data-contact/);
  assert.match(qqLink, /<(?:path|ellipse)[^>]*style="fill:#fff"/);
  assert.doesNotMatch(qqLink, /#(?:111827|f8fafc|f59e0b)/);
});

test("compact vinyl geometry keeps a readable label beside the fixed middle stack", () => {
  assert.match(page, /\.vinyl-player\s*\{[\s\S]*width: clamp\(248px, 19vw, 284px\)/);
  assert.match(page, /--record-size: clamp\(118px, 8\.5vw, 132px\)/);
  assert.match(page, /\.vinyl-player\s*\{[\s\S]*min-height: 250px;/);
  assert.match(page, /\.vinyl-player\s*\{[\s\S]*padding: 14px;/);
  assert.match(page, /#vinyl-cover\s*\{[\s\S]*width: 70%/);
  assert.match(page, /\.vinyl-metadata\s*\{[\s\S]*font-size:/);
});

test("desktop hero lane shifts both middle siblings left and resets below 1320px", () => {
  const desktopHero = page.match(/\.hero-top\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const desktopStack = page.match(/\.hero-middle-stack\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const desktopSearch = page.match(/\.hero-top > #hero-search-form\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const desktopPlayer = page.match(/\.vinyl-player\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const compactHero = mediaBlock(page, "max-width\\s*:\\s*1320px");

  assert.match(desktopHero, /--hero-lane-offset: clamp\(54px, 6vw, 108px\);/);
  assert.match(desktopHero, /--hero-lane-width: 468px;/);
  for (const middleNode of [desktopSearch, desktopStack]) {
    assert.match(middleNode, /width: var\(--hero-lane-width\);/);
    assert.match(middleNode, /transform: translateX\(calc\(-50% - var\(--hero-lane-offset\)\)\);/);
  }
  assert.match(page, /\.hero-quote-area\s*\{[\s\S]*font-size: clamp\(21px, 2\.25vw, 34px\);/);
  assert.match(desktopPlayer, /width: clamp\(248px, 19vw, 284px\);/);
  assert.match(desktopPlayer, /--vinyl-base-y: clamp\(-46px, -3vh, -22px\);/);
  assert.match(desktopPlayer, /translate3d\(var\(--vinyl-x, 0px\), calc\(var\(--vinyl-base-y, 0px\) \+ var\(--vinyl-parallax-y, 0px\) \+ var\(--vinyl-lift, 0px\)\), 0\)/);
  assert.match(compactHero, /\.hero-top\s*\{[\s\S]*--hero-lane-offset: 0px;/);
  assert.match(compactHero, /\.hero-middle-stack\s*\{[\s\S]*transform: none;/);
  assert.match(compactHero, /\.hero-top > #hero-search-form\s*\{[\s\S]*transform: none;/);
  assert.match(compactHero, /\.vinyl-player\s*\{[\s\S]*--vinyl-base-y: 0px;/);
});

test("tonearm enters the record only while playing and the compact layout reflows", () => {
  assert.match(page, /\.vinyl-tonearm\s*\{[\s\S]*transform: rotate\(-28deg\)/);
  assert.match(page, /\.vinyl-player\.is-playing \.vinyl-tonearm\s*\{\s*transform: rotate\(12deg\)/);
  assert.match(page, /@media \(max-width: 1200px\)[\s\S]*\.vinyl-player\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(mediaBlock(page, "max-width\\s*:\\s*720px"), /\.vinyl-deck\s*\{\s*height: 210px;/);
});

test("hero renders a responsive vinyl turntable instead of the film clock", () => {
  assert.match(page, /id="vinyl-player"[^>]*type="button"/);
  assert.match(page, /id="vinyl-record"[^>]*aria-hidden="true"/);
  assert.match(page, /id="vinyl-cover"[^>]*alt=""/);
  assert.match(page, /id="vinyl-tonearm"[^>]*aria-hidden="true"/);
  assert.match(page, /id="vinyl-lyrics-current"/);
  assert.doesNotMatch(page, /film-perforations|film-equalizer|clock-orbit/);
});

test("vinyl metadata stacks until the fixed card can fit two columns", () => {
  const match = page.match(/@media \(max-width: (\d+)px\)\s*\{\s*\.vinyl-player\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?\.vinyl-metadata\s*\{\s*width: 100%;\s*text-align: center;\s*\}/);
  assert.ok(match);

  const breakpoint = Number(match[1]);
  const firstTwoColumnViewport = breakpoint + 1;
  const cardWidth = Math.min(540, Math.max(470, firstTwoColumnViewport * .34));
  const contentWidth = cardWidth - 2 * 26 - 2;
  const requiredWidth = 260 + 170 + Math.min(30, Math.max(18, firstTwoColumnViewport * .02));
  assert.ok(contentWidth >= requiredWidth, `two-column vinyl needs ${requiredWidth}px but has ${contentWidth}px`);

  const rule = match[0];
  assert.match(rule, /\.vinyl-player\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*justify-items: center;/);
  assert.match(rule, /\.vinyl-metadata\s*\{\s*width: 100%;\s*text-align: center;\s*\}/);
  assert.doesNotMatch(rule, /\.hero(?:\s|\{)/);
});

test("mobile hero title can wrap safely within a 320px viewport", () => {
  assert.match(page, /@media \(max-width: 720px\)[\s\S]*#hero-title\s*\{[\s\S]*font-size: clamp\(30px, 10vw, 42px\);[\s\S]*white-space: normal;[\s\S]*overflow-wrap: anywhere;/);
});

test("vinyl player follows the sole native audio and local LRC state", () => {
  assert.match(page, /function syncVinylPlayback\(\)/);
  assert.match(page, /vinylCover\.src = track\.cover/);
  assert.match(page, /vinylTrackTitle\.textContent = track\.title/);
  assert.match(page, /vinylTrackArtist\.textContent = track\.artist/);
  assert.match(page, /vinylPlayer\.classList\.toggle\("is-playing", !profileAudio\.paused\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncVinylPlayback\)/);
  assert.match(page, /profileAudio\.addEventListener\("loadedmetadata", syncVinylPlayback\)/);
  assert.equal(page.match(/new Audio\(\)/g)?.length, 1);
});

test("hero retains supplied social contacts", () => {
  assert.match(page, /data-contact="wechat"/);
  assert.match(page, /https:\/\/github\.com\/snowstorm-121/);
  assert.match(page, /mailto:2971234387@qq\.com/);
  assert.match(page, /https:\/\/www\.youtube\.com\/@yongyiyan/);
  assert.match(page, /https:\/\/x\.com\/yongyi_121/);
});

test("social controls use local icon presentation without a CDN runtime stylesheet", () => {
  assert.doesNotMatch(page, /https:\/\/cdnjs\.cloudflare\.com\//);
  assert.doesNotMatch(page, /\bfa-(?:brands|solid|github|envelope|weixin|qq|youtube|x-twitter)\b/);
  assert.equal((page.match(/class="social-icon" aria-hidden="true"/g) ?? []).length, 6);
});

test("named homepage surfaces share the liquid-glass material tokens", () => {
  const root = page.match(/:root\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
  const surfaceSelectors = [
    ".site-header",
    ".profile-card",
    ".hero-search",
    ".vinyl-player",
    ".contact-popover",
    ".archive-card",
  ];

  for (const token of ["--glass-fill", "--glass-border", "--glass-highlight", "--glass-shadow"]) {
    assert.match(root, new RegExp(`${token}:`));
  }
  for (const selector of surfaceSelectors) {
    const rule = page.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[\\s\\S]*?\\n    \\}`))?.[0] ?? "";
    for (const token of ["--glass-fill", "--glass-border", "--glass-highlight", "--glass-shadow"]) {
      assert.match(rule, new RegExp(`var\\(${token}\\)`), `${selector} must consume ${token}`);
    }
  }
  assert.doesNotMatch(page, /<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']https?:\/\//i);
});

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

test("hero code configures maximum gain", () => {
  assert.match(page, /profileTrackGain\.gain\.exponentialRampToValueAtTime\(1\.00, now \+ \.45\)/);
});

test("vinyl motion and the quote animator respect reduced motion", () => {
  assert.match(page, /function updateVinylParallax\(event\)/);
  assert.match(page, /function syncVinylParallaxListeners\(\)\s*\{[\s\S]*vinylPlayer\.removeEventListener\("pointermove", updateVinylParallax\);[\s\S]*vinylPlayer\.removeEventListener\("pointerleave", clearVinylParallax\);[\s\S]*clearVinylParallax\(\);[\s\S]*if \(reduceMotionQuery\.matches\) return;[\s\S]*vinylPlayer\.addEventListener\("pointermove", updateVinylParallax\);[\s\S]*vinylPlayer\.addEventListener\("pointerleave", clearVinylParallax\);/);
  assert.match(page, /reduceMotionQuery\.addEventListener\("change", syncVinylParallaxListeners\)/);
  assert.match(page, /if \(reduceMotionQuery\.matches\) return;/);
  assert.match(page, /--vinyl-x[\s\S]*--vinyl-parallax-y[\s\S]*--vinyl-rotate-x[\s\S]*--vinyl-rotate-y[\s\S]*--vinyl-glow-x/);
  assert.doesNotMatch(page.match(/function updateVinylParallax\(event\)[\s\S]*?\n    \}/)?.[0] ?? "", /--vinyl-y/);
  assert.match(page, /\.vinyl-player:hover,[\s\S]*--vinyl-lift: -7px;[\s\S]*--vinyl-rotate-x: -1\.25deg;[\s\S]*--vinyl-rotate-y: 1\.5deg;/);
  assert.match(page, /\.vinyl-player\.is-playing \.vinyl-record \{ animation: vinyl-spin/);
  assert.match(page, /\.vinyl-player\.is-playing \.vinyl-tonearm \{ transform: rotate\(12deg\); \}/);
  assert.match(page, /\.vinyl-tonearm\s*\{[\s\S]*transition: transform \.55s/);
  assert.match(page, /\.vinyl-player\.is-switching #vinyl-cover,[\s\S]*\.vinyl-player\.is-switching \.vinyl-metadata/);
  assert.match(page, /let vinylSwitchTimer;[\s\S]*window\.clearTimeout\(vinylSwitchTimer\);[\s\S]*vinylSwitchTimer = window\.setTimeout/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vinyl-record[\s\S]*animation: none;/);
  assert.match(page, /if \(reduceMotionQuery\.matches\)[\s\S]*lineNodes\.forEach/);
  assert.match(page, /await deleteLine\(lineNodes\[lineIndex\], run\)[\s\S]*phraseIndex =/);
  assert.doesNotMatch(page, /while \(true\) \{[\s\S]*lineNodes\.forEach\(\(lineNode\) => \{ lineNode\.textContent = ""; \}\);/);
});

test("live reduced-motion changes invalidate quote animation before static rendering", () => {
  assert.match(page, /let quoteRun = 0;/);
  assert.match(page, /function syncQuoteMotion\(\)\s*\{[\s\S]*quoteRun \+= 1;[\s\S]*window\.clearTimeout\(quoteTimer\);[\s\S]*if \(reduceMotionQuery\.matches\) \{[\s\S]*scheduleStaticPhrase\(quoteRun\);[\s\S]*return;[\s\S]*void play\(quoteRun\);/);
  assert.match(page, /reduceMotionQuery\.addEventListener\("change", syncQuoteMotion\)/);
  assert.match(page, /async function play\(run\) \{[\s\S]*while \(run === quoteRun && !reduceMotionQuery\.matches\)/);
});

test("reduced motion rotates complete quote pairs without a caret animation", () => {
  assert.match(page, /function scheduleStaticPhrase\(run\)\s*\{[\s\S]*renderStaticPhrase\(\);[\s\S]*quoteTimer = window\.setTimeout\(\(\) => \{[\s\S]*phraseIndex = \(phraseIndex \+ 1\) % phrases\.length;[\s\S]*scheduleStaticPhrase\(run\);[\s\S]*\}, TIMING\.hold\);/);
  assert.match(page, /function renderStaticPhrase\(\)\s*\{[\s\S]*lineNodes\.forEach\(\(lineNode, index\) => \{[\s\S]*lineNode\.textContent = current\.lines\[index\] \?\? "";/);
  assert.match(page, /if \(reduceMotionQuery\.matches\) \{[\s\S]*scheduleStaticPhrase\(quoteRun\);[\s\S]*return;/);
});

test("reduced motion overrides active vinyl motion and reflection states", () => {
  const reducedMotionBlock = page.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n    \}/)?.[0] ?? "";
  assert.match(reducedMotionBlock, /\.vinyl-player\.is-playing \.vinyl-record\s*\{\s*animation: none;/);
  assert.match(reducedMotionBlock, /\.vinyl-player\.is-playing \.vinyl-tonearm\s*\{\s*transform: none;/);
  assert.match(reducedMotionBlock, /\.vinyl-player:hover::before,[\s\S]*?\.vinyl-player\.is-expanded::before\s*\{[\s\S]*?transform: none;/);
  assert.match(reducedMotionBlock, /\.vinyl-player\.is-switching #vinyl-cover,[\s\S]*?\.vinyl-player\.is-switching \.vinyl-metadata\s*\{[\s\S]*?transform: none;/);
  assert.match(reducedMotionBlock, /\.caret,[\s\S]*?\{ animation: none; \}/);
});

test("player declares nine local audio tracks with display metadata", () => {
  assert.match(page, /the-nights-avicii\.mp3/);
  assert.match(page, /artist: "Avicii"/);
  assert.match(page, /new Audio\(\)/);
  assert.match(page, /profileAudio\.volume = 1/);
});

test("player maps every local track to a local LRC asset", () => {
  const lyricPaths = page.match(/lyrics: "assets\/music\/lyrics\/[^\"]+\.lrc"/g) ?? [];
  assert.equal(lyricPaths.length, 9);
  assert.match(page, /the-nights-avicii\.lrc/);
  assert.match(page, /long-time-no-see-eason-chan\.lrc/);
});

test("player maps every local track to a distinct local vinyl label", async () => {
  const covers = page.match(/cover: "assets\/music\/covers\/[^\"]+\.png"/g) ?? [];
  assert.equal(covers.length, 9);
  assert.equal(new Set(covers).size, 9);
  for (const cover of covers) {
    const file = cover.match(/assets\/music\/covers\/([^\"]+)/)[1];
    await readFile(new URL(`../assets/music/covers/${file}`, import.meta.url));
  }
});

test("vinyl player syncs local LRC lyrics with the native player", () => {
  assert.match(page, /function parseLrc\(source\)/);
  assert.match(page, /fetch\(track\.lyrics\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncLyrics\)/);
  assert.match(page, /const vinylLyricsCurrent = document\.querySelector\("#vinyl-lyrics-current"\)/);
  assert.match(page, /vinylLyricsCurrent\.textContent = `\$\{track\.title\} · \$\{current\.text\}`/);
  assert.doesNotMatch(page, /#clock-widget|#film-track-title|syncFilmPlayback|syncClockParallaxListeners/);
});

test("vinyl player exposes a persistent lyric disclosure through native button activation", () => {
  assert.match(page, /function toggleVinylLyrics\(\)\s*\{[\s\S]*vinylPlayer\.classList\.toggle\("is-expanded"\)[\s\S]*vinylPlayer\.setAttribute\("aria-expanded", String\(isExpanded\)\)/);
  assert.match(page, /vinylPlayer\.addEventListener\("click", toggleVinylLyrics\)/);
});

test("vinyl lyric rendering skips duplicate live-region writes for an unchanged track and lyric index", () => {
  assert.match(page, /let renderedLyricTrack;\s*let renderedLyricIndex;\s*let renderedLyricLines;/);
  assert.match(page, /function renderLyricLines\(index\)\s*\{[\s\S]*renderedLyricTrack === track[\s\S]*renderedLyricIndex === index[\s\S]*renderedLyricLines === lyricLines[\s\S]*\) return;/);
  assert.match(page, /function renderLyricStatus\(track, message\)\s*\{[\s\S]*renderedLyricIndex === null[\s\S]*renderedLyricLines === lyricLines[\s\S]*\) return;/);
});

test("player uses native audio playback and symmetric transport controls", () => {
  assert.match(page, /profileAudio\.src = track\.src/);
  assert.match(page, /await profileAudio\.play\(\)/);
  assert.match(page, /profileAudio\.addEventListener\("ended"/);
  assert.match(page, /#track-previous,\s*#track-next\s*\{/);
});

test("homepage toggles contacts and submits raw Google keywords", () => {
  assert.match(page, /action="https:\/\/www\.google\.com\/search"/);
  assert.match(page, /contactPopover\.hidden = !contactPopover\.hidden/);
  assert.match(page, /\.hero-search\s*\{[\s\S]*width: 100%;/);
});

test("only the WeChat control binds the contact popover", () => {
  assert.match(page, /document\.querySelectorAll\('\[data-contact="wechat"\]'\)\.forEach\(\(trigger\) => trigger\.addEventListener\("click", \(\) => \{[\s\S]*toggleContact\("wechat"\);/);
  assert.doesNotMatch(page, /document\.querySelectorAll\("\[data-contact\]"\)/);
});
