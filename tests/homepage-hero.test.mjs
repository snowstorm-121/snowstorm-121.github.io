import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("hero provides title, Google search, and a safe main region", () => {
  assert.match(page, /id="hero-title"[^>]*>STILL, I GO ON/);
  assert.match(page, /id="hero-search-form"[^>]*action="https:\/\/www\.google\.com\/search"/);
  assert.match(page, /id="hero-search-input"[^>]*name="q"/);
  assert.match(page, /class="hero-content"/);
  assert.match(page, /\.hero-main\s*\{[\s\S]*width: min\(680px, calc\(100vw - 720px\)\)[\s\S]*margin:\s*0 clamp\(280px, 21vw, 340px\) 0 clamp\(300px,/);
});

test("hero renders a frosted clock lyric widget instead of an aperture", () => {
  assert.match(page, /id="clock-widget"[^>]*type="button"/);
  assert.match(page, /id="clock-time"/);
  assert.match(page, /id="clock-date"/);
  assert.match(page, /class="clock-orbit clock-orbit-outer"/);
  assert.match(page, /id="lyrics-current"/);
  assert.match(page, /\.clock-widget\s*\{[\s\S]*width: clamp\(220px, 17vw, 250px\)/);
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

test("player uses native audio playback and symmetric transport controls", () => {
  assert.match(page, /profileAudio\.src = track\.src/);
  assert.match(page, /await profileAudio\.play\(\)/);
  assert.match(page, /profileAudio\.addEventListener\("ended"/);
  assert.match(page, /#track-previous,\s*#track-next\s*\{/);
});

test("homepage toggles contacts and submits raw Google keywords", () => {
  assert.match(page, /action="https:\/\/www\.google\.com\/search"/);
  assert.match(page, /contactPopover\.hidden = !contactPopover\.hidden/);
  assert.match(page, /\.hero-search\s*\{[\s\S]*width: min\(760px,/);
  assert.match(page, /\.clock-widget::before/);
});
