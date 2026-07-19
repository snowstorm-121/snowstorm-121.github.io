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

test("vinyl metadata stacks before the fixed card can fit two columns", () => {
  const start = page.indexOf("@media (max-width: 1470px)");
  const end = page.indexOf("@media (max-width: 1320px)", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const rule = page.slice(start, end);
  assert.match(rule, /\.vinyl-player\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*justify-items: center;/);
  assert.match(rule, /\.vinyl-metadata\s*\{\s*width: 100%;\s*text-align: center;\s*\}/);
  assert.doesNotMatch(rule, /\.hero(?:\s|\{)/);
});

test("mobile hero title can wrap safely within a 320px viewport", () => {
  assert.match(page, /@media \(max-width: 720px\)[\s\S]*#hero-title\s*\{[\s\S]*font-size: clamp\(30px, 10vw, 42px\);[\s\S]*white-space: normal;[\s\S]*overflow-wrap: anywhere;/);
});

test("film clock mirrors existing player metadata progress and motion-safe playback state", () => {
  assert.match(page, /function formatPlaybackTime\(seconds\)/);
  assert.match(page, /function syncFilmPlayback\(\)/);
  assert.match(page, /filmTrackTitle\.textContent = track\.title/);
  assert.match(page, /filmTrackArtist\.textContent = track\.artist/);
  assert.match(page, /filmProgress\.style\.width = `\$\{progress\}%`/);
  assert.match(page, /clockWidget\.classList\.toggle\("is-playing", !profileAudio\.paused\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncFilmPlayback\)/);
  assert.match(page, /profileAudio\.addEventListener\("loadedmetadata", syncFilmPlayback\)/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.film-equalizer i\s*\{\s*animation: none;/);
});

test("reduced motion overrides the active equalizer animation with matching specificity", () => {
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.clock-widget\.is-playing \.film-equalizer i\s*\{\s*animation: none;/);
});

test("hero retains supplied social contacts", () => {
  assert.match(page, /data-contact="wechat"/);
  assert.match(page, /https:\/\/github\.com\/snowstorm-121/);
  assert.match(page, /mailto:2971234387@qq\.com/);
  assert.match(page, /https:\/\/www\.youtube\.com\/@yongyiyan/);
  assert.match(page, /https:\/\/x\.com\/yongyi_121/);
});

test("hero code configures maximum gain and motion-aware clock widget", () => {
  assert.match(page, /profileTrackGain\.gain\.exponentialRampToValueAtTime\(1\.00, now \+ \.45\)/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.clock-widget/);
});

test("clock widget has no obsolete aperture binding", () => {
  assert.doesNotMatch(page, /memoryAperture/);
});

test("reduced motion disables clock shine and lyric transitions", () => {
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.clock-widget::before,\s*\.clock-lyrics\s*\{\s*transition:\s*none;/);
});

test("clock parallax responds to live reduced-motion preference changes", () => {
  assert.match(page, /function updateClockParallax\(event\)/);
  assert.match(page, /function syncClockParallaxListeners\(\)\s*\{[\s\S]*clockWidget\.removeEventListener\("pointermove", updateClockParallax\);[\s\S]*clockWidget\.removeEventListener\("pointerleave", clearClockParallax\);[\s\S]*clearClockParallax\(\);[\s\S]*if \(reduceMotionQuery\.matches\) return;[\s\S]*clockWidget\.addEventListener\("pointermove", updateClockParallax\);[\s\S]*clockWidget\.addEventListener\("pointerleave", clearClockParallax\);/);
  assert.match(page, /reduceMotionQuery\.addEventListener\("change", syncClockParallaxListeners\)/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.clock-orbits,\s*\.film-now-playing,\s*\.film-track,\s*\.film-progress-row\s*\{\s*transform:\s*none;/);
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

test("clock widget syncs local time and LRC lyrics with the native player", () => {
  assert.match(page, /function parseLrc\(source\)/);
  assert.match(page, /fetch\(track\.lyrics\)/);
  assert.match(page, /profileAudio\.addEventListener\("timeupdate", syncLyrics\)/);
  assert.match(page, /window\.setInterval\(syncClock, 1000\)/);
  assert.match(page, /clockWidget\.addEventListener\("pointermove"/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.clock-orbit/);
});

test("clock widget exposes a persistent lyric disclosure through its native button activation", () => {
  assert.match(page, /id="clock-widget"[^>]*type="button"[^>]*aria-expanded="false"/);
  assert.match(page, /function toggleClockLyrics\(\)\s*\{[\s\S]*clockWidget\.classList\.toggle\("is-expanded"\)[\s\S]*clockWidget\.setAttribute\("aria-expanded", String\(isExpanded\)\)/);
  assert.match(page, /clockWidget\.addEventListener\("click", toggleClockLyrics\)/);
  assert.match(page, /\.clock-widget\.is-expanded\s*\{[\s\S]*--clock-lift: -9px;/);
  assert.match(page, /\.clock-widget\.is-expanded \.clock-lyrics\s*\{\s*max-height: 82px;/);
});

test("clock lyric rendering skips duplicate live-region writes for an unchanged track and lyric index", () => {
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
  assert.match(page, /\.clock-widget::before/);
});
