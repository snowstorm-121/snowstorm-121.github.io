import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [html, styles, script] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readOptional("../assets/homepage/homepage.css"),
  readOptional("../assets/homepage/homepage.js"),
]);
const page = `${html}\n${styles}\n${script}`;

test("homepage uses a semantic four-act shell and one local runtime", () => {
  for (const id of ["origin", "identity", "archive", "connection"]) {
    assert.match(html, new RegExp(`<section[^>]+id="${id}"`));
  }
  assert.match(html, /href="\.\/assets\/homepage\/homepage\.css"/);
  assert.match(html, /src="\.\/assets\/homepage\/homepage\.js" defer/);
  assert.equal((html.match(/<audio\s+id="profileAudio"/g) ?? []).length, 1);
  assert.doesNotMatch(script, /new Audio\s*\(/);
  assert.doesNotMatch(html, /<style[\s>]/);
  assert.doesNotMatch(html, /<script>(?:.|\n)*?<\/script>/);
});

test("music panel retains all nine local tracks and native playback controls", () => {
  const trackEntries = script.match(/\{ title: ".*?", artist: ".*?", mood: ".*?", accent: ".*?", src: ".*?", lyrics: ".*?", cover: ".*?" \}/g) ?? [];
  assert.equal(trackEntries.length, 9);
  for (const asset of [
    "the-nights-avicii", "daoxiang-jay-chou", "houlai-rene-liu", "meet-stefanie-sun",
    "viva-la-vida-coldplay", "ordinary-road-pu-shu", "stubborn-mayday",
    "counting-stars-onerepublic", "long-time-no-see-eason-chan",
  ]) {
    assert.match(script, new RegExp(`assets/music/${asset}\\.mp3`));
    assert.match(script, new RegExp(`assets/music/lyrics/${asset}\\.lrc`));
  }
  assert.match(html, /id="music-track-list"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(script, /profileAudio\.src = track\.src/);
  assert.match(script, /await profileAudio\.play\(\)/);
  assert.match(script, /document\.createElement\("button"\)/);
  assert.match(script, /trackButton\.dataset\.trackIndex/);
});

test("music now-playing surface renders the selected local cover", () => {
  assert.match(html, /<img[^>]+id="music-cover"[^>]+src="assets\/music\/covers\/the-nights\.png"/);
  assert.match(html, /id="music-cover"[^>]+alt="The Nights — Avicii 的封面"/);
  assert.match(script, /musicCover\.src = track\.cover/);
  assert.match(script, /musicCover\.alt = `\$\{track\.title\} — \$\{track\.artist\} 的封面`/);
});

test("origin restores the ten original quotes with typing and deletion", () => {
  const phraseEntries = script.match(/\{ tone: ".*?", lines: \[".*?", ".*?"\] \}/g) ?? [];
  assert.equal(phraseEntries.length, 10);
  for (const line of [
    "人生并不总在向前，", "真正的勇气，不是忽略代价，", "失败很少给出答案，",
    "路途漫长，走得慢并不妨碍抵达；", "成长并非得到所有答案，", "热望不必始终沸腾，",
    "世界习惯用结果衡量价值，", "清醒不是告别理想，", "选择未必通向预期的结局，",
    "所谓向上，并非永远站在高处，",
  ]) assert.match(script, new RegExp(line));
  assert.match(html, /id="sentence"/);
  assert.match(script, /async function typeLine/);
  assert.match(script, /async function deleteLine/);
  assert.match(script, /while \(run === quoteRun && !reduceMotionQuery\.matches\)/);
  assert.match(script, /function renderStaticPhrase\(\)/);
});

test("homepage honors reduced motion for scrolling, animations, and transitions", () => {
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(reducedMotion, /scroll-behavior:\s*auto/);
  assert.match(reducedMotion, /animation:\s*none/);
  assert.match(reducedMotion, /transition:\s*none/);
  assert.match(reducedMotion, /\.caret/);
});

test("origin fixes search and quote into separate geometry slots", () => {
  assert.match(html, /id="origin-search-slot"[\s\S]*id="hero-search-form"/);
  assert.match(html, /id="origin-quote-slot"[\s\S]*class="sentence-line"[\s\S]*class="sentence-line"/);
  assert.match(styles, /\.origin-story\s*\{[\s\S]*grid-template-rows:\s*var\(--search-slot-height\) var\(--origin-stack-gap\) var\(--quote-slot-height\)/);
  assert.match(styles, /#origin-search-slot\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(styles, /#origin-quote-slot\s*\{[\s\S]*grid-row:\s*3[\s\S]*height:\s*var\(--quote-slot-height\)/);
  assert.match(styles, /--quote-slot-height:\s*calc\(2 \* var\(--quote-line-height\)\)/);
});

test("quote reserves two lines from the sentence line-height length", () => {
  const lineHeight = styles.match(/--quote-line-height:\s*clamp\(([\d.]+)px,\s*[\d.]+vw,\s*([\d.]+)px\)/);
  assert.ok(lineHeight, "quote line-height is a parseable responsive length");
  assert.match(styles, /--quote-slot-height:\s*calc\(2 \* var\(--quote-line-height\)\)/);
  assert.match(styles, /\.sentence\s*\{[\s\S]*line-height:\s*var\(--quote-line-height\)/);
  assert.ok(Number(lineHeight[1]) * 2 >= 2 * 18 * 1.6);
  assert.ok(Number(lineHeight[2]) * 2 >= 2 * 30 * 1.6);
});

test("mobile quote keeps every logical phrase line on its assigned physical row", () => {
  const phraseLines = [...script.matchAll(/lines: \["([^"]+)", "([^"]+)"\]/g)].flatMap((match) => match.slice(1));
  const longestLineLength = Math.max(...phraseLines.map((line) => Array.from(line).length));
  const mobileRules = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const availableWidth = mobileRules.match(/--quote-mobile-available-width:\s*([\d.]+)px/);
  const minimumFontSize = mobileRules.match(/--quote-mobile-font-size:\s*([\d.]+)px/);
  const letterSpacing = mobileRules.match(/--quote-mobile-letter-spacing:\s*([\d.]+)px/);

  assert.match(mobileRules, /\.sentence-line\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.ok(availableWidth, "mobile quote declares its smallest usable width");
  assert.ok(minimumFontSize, "mobile quote declares its minimum readable font size");
  assert.ok(letterSpacing, "mobile quote declares the spacing used by the capacity calculation");
  const requiredWidth = longestLineLength * Number(minimumFontSize[1]) + (longestLineLength - 1) * Number(letterSpacing[1]);
  assert.ok(requiredWidth <= Number(availableWidth[1]), `longest ${longestLineLength}-character line needs ${requiredWidth}px within the declared mobile width`);
});

test("quote preserves delete-before-type and reduced-motion static rendering", () => {
  assert.match(script, /async function deleteVisibleLines\(run\)/);
  assert.match(script, /await deleteLine\(lineNodes\[lineIndex\], run\)/);
  assert.match(script, /async function play\(run\)[\s\S]*deleteVisibleLines\(run\)[\s\S]*phraseIndex = \(phraseIndex \+ 1\)/);
  assert.match(script, /function renderStaticPhrase\(\)/);
  assert.match(script, /if \(reduceMotionQuery\.matches\)[\s\S]*scheduleStaticPhrase\(quoteRun\)/);
});

test("origin keeps the existing Google form and reports an empty submit accessibly", () => {
  assert.match(html, /id="hero-search-form"[^>]*action="https:\/\/www\.google\.com\/search"/);
  assert.match(html, /id="hero-search-input"[^>]*name="q"/);
  assert.match(html, /id="search-status"[^>]*aria-live="polite"/);
  assert.match(script, /heroSearchForm\.addEventListener\("submit"/);
  assert.match(script, /heroSearchInput\.setAttribute\("aria-invalid", "true"\)/);
});
