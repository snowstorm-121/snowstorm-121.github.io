import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("hero provides title, Google search, and a safe main region", () => {
  assert.match(page, /id="hero-title"[^>]*>STILL, I GO ON/);
  assert.match(page, /id="hero-search-form"[^>]*action="https:\/\/www\.google\.com\/search"/);
  assert.match(page, /id="hero-search-input"[^>]*name="q"/);
  assert.match(page, /class="hero-content"/);
});

test("hero locks search directly above a two-line quote stack", () => {
  assert.match(page, /class="hero-middle-stack"[\s\S]*id="hero-search-form"[\s\S]*class="hero-quote-area"/);
  assert.match(page, /\.hero-middle-stack\s*\{[\s\S]*width: min\(520px, calc\(100vw - 860px\)\)/);
  assert.match(page, /\.sentence-wrap\s*\{[\s\S]*height: calc\(2 \* var\(--sentence-line-height\)\)/);
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

test("hero code configures maximum gain", () => {
  assert.match(page, /profileTrackGain\.gain\.exponentialRampToValueAtTime\(1\.00, now \+ \.45\)/);
});

test("vinyl motion and the quote animator respect reduced motion", () => {
  assert.match(page, /function updateVinylParallax\(event\)/);
  assert.match(page, /function syncVinylParallaxListeners\(\)\s*\{[\s\S]*vinylPlayer\.removeEventListener\("pointermove", updateVinylParallax\);[\s\S]*vinylPlayer\.removeEventListener\("pointerleave", clearVinylParallax\);[\s\S]*clearVinylParallax\(\);[\s\S]*if \(reduceMotionQuery\.matches\) return;[\s\S]*vinylPlayer\.addEventListener\("pointermove", updateVinylParallax\);[\s\S]*vinylPlayer\.addEventListener\("pointerleave", clearVinylParallax\);/);
  assert.match(page, /reduceMotionQuery\.addEventListener\("change", syncVinylParallaxListeners\)/);
  assert.match(page, /if \(reduceMotionQuery\.matches\) return;/);
  assert.match(page, /--vinyl-x[\s\S]*--vinyl-y[\s\S]*--vinyl-rotate-x[\s\S]*--vinyl-rotate-y[\s\S]*--vinyl-glow-x/);
  assert.match(page, /\.vinyl-player:hover,[\s\S]*--vinyl-lift: -7px;[\s\S]*--vinyl-rotate-x: -1\.25deg;[\s\S]*--vinyl-rotate-y: 1\.5deg;/);
  assert.match(page, /\.vinyl-player\.is-playing \.vinyl-record \{ animation: vinyl-spin/);
  assert.match(page, /\.vinyl-player\.is-playing \.vinyl-tonearm \{ transform: rotate\(-3deg\); \}/);
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
