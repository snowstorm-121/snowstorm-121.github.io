import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import vm from "node:vm";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [html, styles, script] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readOptional("../assets/homepage/homepage.css"),
  readOptional("../assets/homepage/homepage.js"),
]);
const page = `${html}\n${styles}\n${script}`;

test("living journal presents one non-navigable semantic four-entry directory", async () => {
  const [living, libraryStyles] = await Promise.all([
    readFile(new URL("../living/index.html", import.meta.url), "utf8"),
    readFile(new URL("../assets/library.css", import.meta.url), "utf8"),
  ]);
  const directory = living.match(/<ul class="living-directory"[\s\S]*?<\/ul>/)?.[0] ?? "";
  const entries = [
    ["长夜微澜", "个人思考与随笔"],
    ["纸上星河", "读书笔记"],
    ["山河来信", "旅行日记"],
    ["岁序留痕", "年度与阶段记录"],
  ];

  assert.match(living, /<main class="library-shell living-journal">/);
  assert.ok(directory, "living journal exposes one semantic directory list");
  assert.equal((living.match(/<ul class="living-directory"/g) ?? []).length, 1);
  assert.equal((directory.match(/<li\b/g) ?? []).length, 4);
  assert.doesNotMatch(directory, /<a\b/);
  for (const [title, description] of entries) {
    assert.match(directory, new RegExp(`<h3>${title}<\/h3>[\\s\\S]*?<p>${description}<\/p>`));
  }
  assert.match(libraryStyles, /\.living-journal \.living-directory h3\s*\{/);
  assert.doesNotMatch(libraryStyles, /\.living-journal \.living-directory h2\s*\{/);
});

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

test("music surfaces use a compact glass Dock and an anchored expanded panel", () => {
  const dock = html.match(/<aside id="music-dock"[\s\S]*?<\/aside>/)?.[0] ?? "";
  const dockRules = styles.match(/#music-dock\s*\{[^}]*\}/)?.[0] ?? "";
  const panelRules = styles.match(/#music-panel\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(dock, /id="music-dock-cover"[\s\S]*id="music-dock-title"[\s\S]*id="music-dock-play"[\s\S]*id="music-dock-expand"/);
  assert.equal((dock.match(/<button\b/g) ?? []).length, 2);
  assert.match(styles, /--dock-height:\s*56px/);
  assert.match(dockRules, /width:\s*clamp\(240px,\s*[\d.]+vw,\s*296px\)/);
  assert.match(dockRules, /border-radius:\s*999px/);
  assert.match(dockRules, /background:\s*rgba\([^)]*,\s*\.5/);
  assert.match(dockRules, /backdrop-filter:\s*blur/);
  assert.match(panelRules, /bottom:\s*calc\(var\(--dock-height\) \+ [\d.]+px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(panelRules, /border-radius:\s*22px/);
  assert.match(panelRules, /background:\s*rgba\(/);
  assert.match(panelRules, /backdrop-filter:\s*blur/);
  assert.match(html, /id="music-panel"[\s\S]*class="music-panel-controls"[\s\S]*class="music-lyrics"[\s\S]*id="music-track-list"/);
});

test("music controls are circular, mobile panel is a safe-area sheet, and playback motion can stop", () => {
  const dockButtonRules = styles.match(/#music-dock button\s*\{[^}]*\}/)?.[0] ?? "";
  const mobileMusicRules = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?#music-panel \{[\s\S]*?\}[\s\S]*?\.music-panel-scroll \{[\s\S]*?\}/)?.[0] ?? "";
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(dockButtonRules, /width:\s*36px/);
  assert.match(dockButtonRules, /height:\s*36px/);
  assert.match(dockButtonRules, /border-radius:\s*50%/);
  assert.match(styles, /#music-dock button\[aria-pressed="true"\][\s\S]*background:\s*rgba\(/);
  assert.match(mobileMusicRules, /bottom:\s*0/);
  assert.match(mobileMusicRules, /padding-bottom:\s*calc\(16px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(mobileMusicRules, /border-radius:\s*22px 22px 0 0/);
  assert.match(mobileMusicRules, /\.music-panel-scroll\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(reducedMotion, /#music-dock, #music-panel[\s\S]*transition:\s*none !important/);
});

test("music Dock uses the sole native audio and all local track resources", async () => {
  assert.equal((html.match(/<audio\s+id="profileAudio"/g) ?? []).length, 1);
  assert.doesNotMatch(script, /new Audio\s*\(/);
  assert.equal((script.match(/lyrics:\s*"assets\/music\/lyrics\/[^\"]+\.lrc"/g) ?? []).length, 9);
  const covers = script.match(/cover:\s*"assets\/music\/covers\/[^\"]+\.png"/g) ?? [];
  assert.equal(covers.length, 9);
  assert.equal(new Set(covers).size, 9);
  assert.match(html, /id="music-dock"[\s\S]*aria-controls="music-panel"/);
  assert.match(html, /id="current-lyric"[^>]*aria-live="polite"/);
});

test("music panel has deterministic close and lyric interfaces", () => {
  assert.match(script, /function openMusicPanel\(\)/);
  assert.match(script, /function closeMusicPanel\(\{ returnFocus \}\)/);
  assert.match(script, /function parseLrc\(source\)/);
  assert.match(script, /function syncLyrics\(\)/);
  assert.match(script, /profileAudio\.addEventListener\("timeupdate", syncLyrics\)/);
  assert.match(script, /profileAudio\.addEventListener\("ended"/);
});

test("unavailable lyrics remain unavailable after time updates without pausing audio", () => {
  const loadLyrics = script.match(/async function loadLyrics\(track\) \{[\s\S]*?\n\}\n\nfunction loadTrack/)?.[0] ?? "";
  assert.match(script, /let lyricStatus = "";/);
  assert.match(script, /function syncLyrics\(\) \{\s*if \(lyricStatus\) \{\s*renderLyricStatus\(lyricStatus\);\s*\} else \{\s*const activeIndex/);
  assert.match(loadLyrics, /if \(!lyricLines\.length\) \{\s*lyricStatus = "歌词暂不可用";\s*return renderLyricStatus\(lyricStatus\);\s*\}/);
  assert.match(loadLyrics, /catch \{\s*if \(request === lyricLoad\) \{\s*lyricStatus = "歌词暂不可用";\s*renderLyricStatus\(lyricStatus\);\s*\}\s*\}/);
  assert.doesNotMatch(loadLyrics, /profileAudio\.pause\(\)/);
});

test("music outside-close returns focus to the Dock expand control", () => {
  assert.match(script, /if \(!musicPanel\.hidden && !musicPanel\.contains\(event\.target\) && !musicDock\.contains\(event\.target\)\) \{\s*closeMusicPanel\(\{ returnFocus: true \}\);\s*\}/);
});

test("mobile music panel keeps fixed controls above independently scrolling content", () => {
  assert.match(html, /<div class="music-panel-scroll">[\s\S]*id="music-track-list"/);
  const mobileMusicRules = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?#music-panel \{[\s\S]*?\}[\s\S]*?\}/)?.[0] ?? "";
  assert.match(mobileMusicRules, /#music-panel\s*\{[\s\S]*?z-index:\s*11[\s\S]*?display:\s*flex[\s\S]*?overflow:\s*hidden/);
  assert.match(mobileMusicRules, /\.music-panel-scroll\s*\{[\s\S]*?overflow-y:\s*auto/);
});

function createMusicRuntime() {
  const documentListeners = new Map();
  const elements = new Map();

  class FakeElement {
    constructor(id = "") {
      this.id = id;
      this.attributes = new Map();
      this.children = [];
      this.parent = null;
      this.dataset = {};
      this.style = { setProperty() {}, removeProperty() {} };
      this.hidden = false;
      this.listeners = new Map();
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      this.textContent = "";
      this.value = "";
    }

    append(...children) {
      children.forEach((child) => { child.parent = this; });
      this.children.push(...children);
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    dispatch(type, event = {}) { this.dispatchEvent({ type, bubbles: false, target: this, ...event }); }
    dispatchEvent(event) {
      let stopped = false;
      const stopPropagation = event.stopPropagation;
      event.stopPropagation = () => {
        stopped = true;
        stopPropagation?.call(event);
      };
      if (!event.target) event.target = this;
      for (let current = this; current; current = current.parent) {
        event.currentTarget = current;
        current.listeners.get(event.type)?.(event);
        if (!event.bubbles || stopped) break;
      }
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { document.activeElement = this; }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
    querySelector() { return new FakeElement(); }
  }

  const audio = new FakeElement("profileAudio");
  audio.paused = true;
  audio.currentTime = 0;
  audio.duration = 120;
  audio.load = () => {};
  audio.pause = () => { audio.paused = true; audio.dispatch("pause"); };
  audio.play = async () => { audio.paused = false; audio.dispatch("play"); };
  elements.set("#profileAudio", audio);
  for (const id of [
    "music-dock", "music-dock-cover", "music-dock-title", "music-dock-play", "music-dock-expand",
    "music-panel", "music-close", "music-track-list", "music-cover", "music-now-playing",
    "music-previous", "music-play", "music-next", "music-progress", "previous-lyric", "current-lyric",
    "next-lyric", "wechat-trigger", "wechat-popover", "wechat-copy", "wechat-close", "hero-search-form",
    "hero-search-input", "search-status", "moon-ripple", "quote-meta", "quote-progress",
  ]) elements.set(`#${id}`, new FakeElement(id));
  elements.get("#music-panel").hidden = true;
  elements.get("#wechat-popover").hidden = true;

  const document = {
    activeElement: null,
    documentElement: new FakeElement("html"),
    listeners: documentListeners,
    querySelector(selector) { return elements.get(selector) ?? new FakeElement(); },
    querySelectorAll(selector) {
      if (selector === ".sentence-line") return [new FakeElement(), new FakeElement()];
      return [];
    },
    createElement() { return new FakeElement(); },
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    dispatch(type, event = {}) { this.dispatchEvent({ type, bubbles: false, ...event }); },
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      event.currentTarget = this;
      documentListeners.get(event.type)?.(event);
    },
  };
  for (const element of elements.values()) element.parent = document;
  const window = {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout: () => 0,
    clearTimeout() {},
  };
  return {
    audio,
    currentLyric: elements.get("#current-lyric"),
    document,
    musicDockExpand: elements.get("#music-dock-expand"),
    musicPanel: elements.get("#music-panel"),
    wechatPopover: elements.get("#wechat-popover"),
    wechatTrigger: elements.get("#wechat-trigger"),
    window,
  };
}

test("failed lyric fetch remains visible through timeupdate and outside-close restores Dock focus", async () => {
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, {
    ...runtime,
    fetch: async () => { throw new Error("blocked LRC"); },
    navigator: {},
  });
  await new Promise((resolve) => setImmediate(resolve));

  runtime.audio.paused = false;
  runtime.audio.currentTime = 12;
  runtime.audio.dispatch("timeupdate");
  assert.equal(runtime.currentLyric.textContent, "歌词暂不可用");
  assert.equal(runtime.audio.paused, false);

  runtime.musicDockExpand.dispatch("click");
  runtime.document.dispatch("click", { target: {} });
  assert.equal(runtime.musicPanel.hidden, true);
  assert.equal(runtime.document.activeElement, runtime.musicDockExpand);
});

test("WeChat popover remains open when one bubbling SVG-path click reaches document", () => {
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {} });

  const icon = new runtime.wechatTrigger.constructor();
  const path = new runtime.wechatTrigger.constructor();
  icon.append(path);
  runtime.wechatTrigger.append(icon);

  path.dispatchEvent({ type: "click", bubbles: true });

  assert.equal(runtime.wechatPopover.hidden, false);
});

test("WeChat popover closes when one bubbling click comes from outside its trigger", () => {
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {} });

  runtime.wechatTrigger.dispatchEvent({ type: "click", bubbles: true });
  const outside = new runtime.wechatTrigger.constructor();
  outside.parent = runtime.document;
  outside.dispatchEvent({ type: "click", bubbles: true });

  assert.equal(runtime.wechatPopover.hidden, true);
});

test("body reserves the desktop Dock bottom gap and keeps mobile safe-area spacing", () => {
  assert.match(styles, /--dock-offset:\s*14px/);
  assert.match(styles, /body\s*\{[\s\S]*padding-bottom:\s*calc\(var\(--dock-height\) \+ var\(--dock-offset\) \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?--dock-offset:\s*0px/);
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

test("origin keeps search and quote in separate fixed story slots", () => {
  assert.match(html, /id="origin-search-slot"[\s\S]*id="hero-search-form"/);
  assert.match(html, /id="origin-quote-slot"[\s\S]*class="sentence-line"[\s\S]*class="sentence-line"/);
  assert.match(styles, /\.origin-story\s*\{[\s\S]*grid-template-rows:\s*var\(--search-slot-height\) var\(--origin-stack-gap\) var\(--quote-slot-height\)/);
  assert.match(styles, /#origin-search-slot\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(styles, /#origin-quote-slot\s*\{[\s\S]*grid-row:\s*3[\s\S]*height:\s*var\(--quote-slot-height\)/);
  assert.match(styles, /--quote-slot-height:\s*calc\(2 \* var\(--quote-line-height\)\)/);
});

test("origin story fills its grid row to keep search geometry stable", () => {
  const originStoryRules = styles.match(/\.origin-story\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(originStoryRules, /width:\s*100%/);
});

test("origin places its content, story, and desktop scroll cue in normal-flow rows", () => {
  const originContent = html.match(/<div class="section-inner origin-content">[\s\S]*?<\/div>\s*<\/section>/)?.[0] ?? "";
  const originRules = styles.match(/\.origin-content\s*\{[^}]*\}/)?.[0] ?? "";
  const scrollCueRules = styles.match(/\.origin-scroll-cue\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(originContent, /class="origin-declaration"[\s\S]*class="origin-story"[\s\S]*class="origin-scroll-cue"/);
  assert.match(originRules, /grid-template-areas:\s*"content"\s*"story"\s*"cue"/);
  assert.match(originRules, /grid-template-rows:\s*auto auto auto/);
  assert.match(scrollCueRules, /grid-area:\s*cue/);
  assert.doesNotMatch(scrollCueRules, /position:\s*absolute/);
});

test("quote reserves two lines from the sentence line-height length", () => {
  const lineHeight = styles.match(/--quote-line-height:\s*clamp\(([\d.]+)px,\s*[\d.]+vw,\s*([\d.]+)px\)/);
  assert.ok(lineHeight, "quote line-height is a parseable responsive length");
  assert.match(styles, /--quote-slot-height:\s*calc\(2 \* var\(--quote-line-height\)\)/);
  assert.match(styles, /\.sentence\s*\{[\s\S]*line-height:\s*var\(--quote-line-height\)/);
  assert.ok(Number(lineHeight[1]) * 2 >= 2 * 18 * 1.6);
  assert.ok(Number(lineHeight[2]) * 2 >= 2 * 30 * 1.6);
});

test("origin supporting copy wraps responsively without orphaning its closing phrase", () => {
  assert.match(html, /class="origin-supporting-copy"[\s\S]*class="origin-closing-phrase"/);
  assert.match(styles, /\.origin-supporting-copy\s*\{[\s\S]*max-width:\s*100%[\s\S]*white-space:\s*nowrap/);
  assert.match(styles, /\.origin-closing-phrase\s*\{[\s\S]*white-space:\s*nowrap/);
  const narrowRules = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\.origin-supporting-copy\s*\{[\s\S]*?\}[\s\S]*?\}/)?.[0] ?? "";
  assert.match(narrowRules, /white-space:\s*normal/);
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

test("archive has one expandable preview at a time and keeps direct destinations", () => {
  assert.equal((html.match(/class="archive-card"/g) ?? []).length, 3);
  assert.equal((html.match(/data-preview/g) ?? []).length, 3);
  assert.match(script, /function setArchivePreview\(card, expanded\)/);
  assert.match(script, /document\.querySelectorAll\("\.archive-card\[data-preview\]"\)/);
  assert.match(styles, /\.archive-card\.is-expanded\s*\{/);
});

test("archive cards keep three columns at 1024px before a direct narrow single-column fallback", async () => {
  const cards = [...html.matchAll(/<article class="archive-card"[\s\S]*?<\/article>/g)].map(([card]) => card);
  const imagePaths = [
    "../assets/homepage/archive-learning.jpg",
    "../assets/homepage/archive-living.jpg",
    "../assets/homepage/archive-research.jpg",
  ];

  assert.equal(cards.length, 3);
  await Promise.all(imagePaths.map((path) => access(new URL(path, import.meta.url))));
  cards.forEach((card, index) => {
    assert.match(card, new RegExp(`<figure class="archive-media">[\\s\\S]*?<img[^>]+src="\\./assets/homepage/${imagePaths[index].split("/").at(-1)}"`));
  });

  const archiveGrid = styles.match(/\.archive-grid\s*\{[^}]*\}/)?.[0] ?? "";
  const compactArchiveGrid = styles.match(/@media \(max-width:\s*(\d+)px\)\s*\{\s*\.archive-grid\s*\{[^}]*\}/);
  const card = styles.match(/\.archive-card\s*\{[^}]*\}/)?.[0] ?? "";
  const media = styles.match(/\.archive-media\s*\{[^}]*\}/)?.[0] ?? "";
  const preview = styles.match(/\.archive-preview\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(archiveGrid, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.ok(compactArchiveGrid, "archive has a direct narrow-screen fallback");
  assert.ok(Number(compactArchiveGrid[1]) <= 900, "archive remains three columns at 1024px");
  assert.match(compactArchiveGrid[0], /grid-template-columns:\s*1fr/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*repeat\(2,/);
  assert.match(card, /height:\s*100%/);
  assert.doesNotMatch(styles, /\.archive-card:first-child/);
  assert.match(media, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(preview, /position:\s*absolute/);
  assert.match(preview, /height:\s*\d+px/);
});

test("QQ remains a direct link while WeChat is a copyable dialog", () => {
  assert.match(html, /id="wechat-trigger"[^>]*aria-controls="wechat-popover"/);
  assert.match(html, /id="wechat-popover"[^>]*role="dialog"/);
  assert.match(html, /https:\/\/wpa\.qq\.com\/msgrd[^\"]+/);
  assert.doesNotMatch(html, /data-contact="qq"/);
  assert.match(script, /function closeWeChatPopover\(\{ returnFocus \}\)/);
  assert.match(script, /navigator\.clipboard\?\.writeText/);
});

test("QQ stays a direct link with a filled penguin silhouette", () => {
  const qqLink = html.match(/<a href="https:\/\/wpa\.qq\.com\/msgrd[^>]*aria-label="QQ 2971234387"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";

  assert.ok(qqLink, "QQ contact remains an anchor with its accessible label");
  assert.doesNotMatch(qqLink, /aria-controls=|role="dialog"|data-contact=/);
  assert.match(qqLink, /<svg[^>]*data-icon="qq-penguin"[^>]*fill="currentColor"/);
  assert.match(qqLink, /<path[^>]*data-part="head-body"/);
  assert.match(qqLink, /<path[^>]*data-part="left-wing"/);
  assert.match(qqLink, /<path[^>]*data-part="right-wing"/);
  assert.match(qqLink, /<path[^>]*data-part="feet"/);
});

test("WeChat dialog traps Tab focus and returns it to its trigger when closed", () => {
  assert.match(script, /event\.key === "Tab"/);
  assert.match(script, /event\.shiftKey/);
  assert.match(script, /event\.preventDefault\(\)/);
  assert.match(script, /wechatCopy\.focus\(\)/);
  assert.match(script, /if \(returnFocus\) wechatTrigger\.focus\(\)/);
});

test("WeChat copy reports manual copy when the clipboard API is unavailable or rejects", () => {
  assert.match(script, /typeof navigator\.clipboard\?\.writeText !== "function"/);
  assert.match(script, /wechatCopy\.textContent = "请手动复制";\s*return;/);
  assert.match(script, /await navigator\.clipboard\.writeText\(wechatId\)/);
  assert.match(script, /catch \{\s*wechatCopy\.textContent = "请手动复制";/);
});

test("motion is capability-gated and has a complete reduced-motion fallback", () => {
  assert.match(script, /const reduceMotionQuery = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(script, /function syncMotionPreferences\(\)/);
  assert.match(script, /if \(reduceMotionQuery\.matches\) return;/);
  assert.match(script, /window\.matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*scroll-behavior:\s*auto/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
});

test("navigation, idle state, and close controls remain keyboard reachable", () => {
  assert.match(script, /function setupSectionObserver\(\)/);
  assert.match(script, /document\.documentElement\.dataset\.activeSection/);
  assert.match(script, /window\.setTimeout\([\s\S]*20000/);
  assert.match(script, /event\.key === "Escape"/);
  assert.match(styles, /:focus-visible\s*\{/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.section-rail\s*\{[\s\S]*display:\s*none/);
});

test("active section state drives reveal, light direction, and the bright Archive environment", () => {
  assert.match(html, /class="origin-scroll-cue"[^>]*href="#identity"/);
  const defaultSection = styles.match(/\.story-section > \.section-inner\s*\{[^}]*\}/)?.[0] ?? "";
  const activeArchive = styles.match(/html\[data-active-section="archive"\]\s*\{[^}]*\}/)?.[0] ?? "";
  const archiveReveal = styles.match(/html\[data-motion="full"\]\[data-active-section="archive"\]\s+#archive > \.section-inner\s*\{[^}]*\}/)?.[0] ?? "";
  const backdrop = styles.match(/\.page-backdrop\s*\{[^}]*\}/)?.[0] ?? "";
  const mainLight = styles.match(/\.page-backdrop::before\s*\{[^}]*\}/)?.[0] ?? "";
  const scrollCue = styles.match(/\.origin-scroll-cue\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(defaultSection, /opacity:\s*1/);
  assert.match(defaultSection, /transform:\s*none/);
  assert.match(activeArchive, /--section-wash:\s*rgba\([^)]*\)/);
  assert.match(activeArchive, /--main-light-x:/);
  assert.match(activeArchive, /--backdrop-brightness:\s*1\.[1-9]/);
  assert.match(archiveReveal, /opacity:\s*1/);
  assert.match(archiveReveal, /transform:\s*none/);
  assert.match(backdrop, /background-color:\s*var\(--section-wash\)/);
  assert.match(mainLight, /var\(--main-light-x\)/);
  assert.match(mainLight, /var\(--main-light-y\)/);
  assert.match(scrollCue, /grid-area:\s*cue/);
  assert.doesNotMatch(scrollCue, /position:\s*absolute/);
});

test("track, playback, Dock progress, and lyric accent states are consumed by CSS", () => {
  assert.match(script, /style\.setProperty\("--track-accent", track\.accent\)/);
  assert.match(script, /dataset\.playing = String\(!profileAudio\.paused\)/);
  assert.match(script, /musicDock\.style\.setProperty\("--dock-progress", String\(progress\)\)/);
  assert.match(styles, /#music-dock::before\s*\{[^}]*var\(--dock-progress\)[^}]*var\(--track-accent\)/);
  assert.match(styles, /html\[data-playing="true"\]\s+#music-dock\s*\{[^}]*animation:\s*dock-breathe/);
  assert.match(styles, /\.page-backdrop::after\s*\{[^}]*var\(--track-accent\)[^}]*var\(--lyric-accent\)/);
  assert.match(styles, /\.page-backdrop::after\s*\{[^}]*transition:\s*background-color/);
  assert.match(styles, /html\[data-playing="true"\]\s+\.page-backdrop::after\s*\{[^}]*animation:\s*spectrum-breathe/);
});

test("the closed music panel remains visually hidden despite its flex layout", () => {
  assert.match(styles, /#music-panel\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
});

test("idle only slows and weakens an existing ambient animation", () => {
  const root = styles.match(/:root\s*\{[^}]*\}/)?.[0] ?? "";
  const ambient = styles.match(/\.page-backdrop::before\s*\{[^}]*\}/)?.[0] ?? "";
  const idle = styles.match(/html\[data-idle="true"\]\s*\{[^}]*\}/)?.[0] ?? "";
  const baseDuration = Number(root.match(/--ambient-duration:\s*([\d.]+)s/)?.[1]);
  const idleDuration = Number(idle.match(/--ambient-duration:\s*([\d.]+)s/)?.[1]);
  const baseStrength = Number(root.match(/--ambient-strength:\s*([\d.]+)/)?.[1]);
  const idleStrength = Number(idle.match(/--ambient-strength:\s*([\d.]+)/)?.[1]);

  assert.match(ambient, /animation:\s*ambient-breathe var\(--ambient-duration\)/);
  assert.doesNotMatch(idle, /\banimation\s*:/);
  assert.ok(idleDuration > baseDuration, "idle ambient duration is slower than the ordinary state");
  assert.ok(idleStrength < baseStrength, "idle ambient strength is lower than the ordinary state");
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transform:\s*none !important/);
});
