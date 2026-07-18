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

test("hero exposes aperture and supplied social contacts", () => {
  assert.match(page, /id="memory-aperture"[^>]*type="button"/);
  assert.match(page, /id="memory-aperture-phrase">GO ON/);
  assert.match(page, /data-contact="wechat"/);
  assert.match(page, /https:\/\/github\.com\/snowstorm-121/);
  assert.match(page, /mailto:2971234387@qq\.com/);
  assert.match(page, /https:\/\/www\.youtube\.com\/@yongyiyan/);
  assert.match(page, /https:\/\/x\.com\/yongyi_121/);
});

test("hero code configures maximum gain and motion-aware aperture", () => {
  assert.match(page, /profileTrackGain\.gain\.exponentialRampToValueAtTime\(1\.00, now \+ \.45\)/);
  assert.match(page, /const aperturePhrases = \["GO ON", "BREATHE", "DRIFT", "BEGIN"\]/);
  assert.match(page, /memoryAperture\.addEventListener\("pointermove"/);
  assert.match(page, /memoryAperture\.addEventListener\("click"/);
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.memory-aperture/);
});
