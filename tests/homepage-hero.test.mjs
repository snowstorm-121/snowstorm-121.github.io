import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import vm from "node:vm";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [html, homepageStyles, shoalStyles, sharedScript, homepageScript] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readOptional("../assets/homepage/homepage.css"),
  readOptional("../assets/cursor-shoal.css"),
  readOptional("../assets/cursor-shoal.js"),
  readOptional("../assets/homepage/homepage.js"),
]);
const styles = `${homepageStyles}\n${shoalStyles}`;
const script = `${sharedScript}\n${homepageScript}`;
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

test("homepage title uses ordered semantic lines and identity copy adapts its wrapping", () => {
  const originTitle = html.match(/<h1 id="origin-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const originLines = [...originTitle.matchAll(/<span class="origin-title-line">([^<]+)<\/span>/g)].map(([, text]) => text);
  const desktopIdentity = styles.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?#identity-title\s*\{([^}]*)\}/)?.[1] ?? "";
  const mobileIdentity = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?#identity-title\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.deepEqual(originLines, ["STILL,", "I GO ON"]);
  assert.match(html, /<h1 id="origin-title"[^>]*aria-label="STILL, I GO ON"/);
  assert.match(styles, /#origin-title\s+\.origin-title-line\s*\{[^}]*display:\s*block/);
  assert.match(desktopIdentity, /font-size:\s*clamp\(/);
  assert.match(desktopIdentity, /white-space:\s*nowrap/);
  assert.match(mobileIdentity, /white-space:\s*normal/);
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

test("prism glass music panel layers a low-alpha island, readable lyrics, and light controls", () => {
  const panelRules = styles.match(/#music-panel\s*\{[^}]*\}/)?.[0] ?? "";
  const prismRules = styles.match(/#music-panel::before\s*\{[^}]*\}/)?.[0] ?? "";
  const lyricsRules = styles.match(/\.music-lyrics\s*\{[^}]*\}/)?.[0] ?? "";
  const glassControls = styles.match(/#music-panel :is\(\.music-transport button, #music-close, #music-queue-toggle\)\s*\{[^}]*\}/)?.[0] ?? "";
  const progressRules = styles.match(/#music-panel #music-progress\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(panelRules, /background:\s*rgba\(6,\s*17,\s*31,\s*\.42\)/);
  assert.match(panelRules, /backdrop-filter:\s*blur\(26px\) saturate\(135%\)/);
  assert.match(panelRules, /isolation:\s*isolate/);
  assert.match(prismRules, /content:\s*""/);
  assert.match(prismRules, /pointer-events:\s*none/);
  assert.match(prismRules, /var\(--track-accent\)/);
  assert.match(prismRules, /radial-gradient/);
  assert.match(lyricsRules, /background:\s*rgba\(6,\s*17,\s*31,\s*\.58\)/);
  assert.match(lyricsRules, /backdrop-filter:\s*blur\(16px\) saturate\(120%\)/);
  assert.match(glassControls, /background:\s*rgba\(255,\s*255,\s*255,\s*\.1\)/);
  assert.match(progressRules, /background:\s*rgba\(255,\s*255,\s*255,\s*\.16\)/);
  assert.match(panelRules, /height:\s*min\(380px,\s*calc\(100dvh - 118px\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?#music-panel\s*\{[\s\S]*?max-height:\s*72dvh/);
});

test("music controls are circular, mobile panel is a bounded safe-area sheet, and playback motion can stop", () => {
  const dockButtonRules = styles.match(/#music-dock button\s*\{[^}]*\}/)?.[0] ?? "";
  const mobileMusicRules = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?#music-panel \{[\s\S]*?\}[\s\S]*?\.music-panel-scroll \{[\s\S]*?\}/)?.[0] ?? "";
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(dockButtonRules, /width:\s*36px/);
  assert.match(dockButtonRules, /height:\s*36px/);
  assert.match(dockButtonRules, /border-radius:\s*50%/);
  assert.match(styles, /#music-dock button\[aria-pressed="true"\][\s\S]*background:\s*rgba\(/);
  assert.match(mobileMusicRules, /bottom:\s*0/);
  assert.match(mobileMusicRules, /max-height:\s*72dvh/);
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

function createMusicRuntime({
  reducedMotion = false,
  finePointer = false,
  nightNavigationValue = null,
  storageFailure = false,
  visitorEndpoint = "",
  visitorCookie = "",
  cookieWritable = true,
} = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const elements = new Map();
  const timers = [];
  const animationFrames = new Map();
  const cancelledAnimationFrames = [];
  let nextAnimationFrame = 0;

  class FakeElement {
    constructor(id = "") {
      this.id = id;
      this.attributes = new Map();
      this.children = [];
      this.parent = null;
      this.dataset = {};
      const properties = new Map();
      this.style = {
        setProperty(name, value) { properties.set(name, String(value)); },
        removeProperty(name) { properties.delete(name); },
        getPropertyValue(name) { return properties.get(name) ?? ""; },
      };
      this.hidden = false;
      this.listeners = new Map();
      const classes = new Set();
      this.classList = {
        add(...tokens) { tokens.forEach((token) => classes.add(token)); },
        remove(...tokens) { tokens.forEach((token) => classes.delete(token)); },
        toggle(token, force) {
          const enabled = force === undefined ? !classes.has(token) : force;
          if (enabled) classes.add(token);
          else classes.delete(token);
          return enabled;
        },
        contains(token) { return classes.has(token); },
      };
      this.textContent = "";
      this.value = "";
      this.queryElements = new Map();
    }

    append(...children) {
      children.forEach((child) => { child.parent = this; });
      this.children.push(...children);
    }
    remove() {
      if (!this.parent?.children) return;
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
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
        const listeners = current.listeners.get(event.type);
        if (Array.isArray(listeners)) listeners.forEach((listener) => listener(event));
        else listeners?.(event);
        if (!event.bubbles || stopped) break;
      }
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { document.activeElement = this; }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
    querySelector(selector) { return this.queryElements.get(selector) ?? new FakeElement(); }
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
    "next-lyric", "music-queue-toggle", "music-elapsed", "music-duration", "wechat-trigger",
    "wechat-popover", "wechat-copy", "wechat-close", "hero-search-form",
    "hero-search-input", "search-status", "moon-ripple", "quote-meta", "quote-progress",
    "visitor-total", "visitor-today", "visitor-counter-status",
  ]) elements.set(`#${id}`, new FakeElement(id));
  for (const selector of [".music-lyrics", ".music-panel-mood", ".music-track-title", ".music-track-artist"]) {
    elements.set(selector, new FakeElement(selector.slice(1)));
  }
  elements.set(".visitor-counter", new FakeElement("visitor-counter"));
  elements.get("#music-panel").hidden = true;
  elements.get("#wechat-popover").hidden = true;
  const archiveCards = ["learning", "living", "research"].map((id) => {
    const card = new FakeElement(id);
    const toggle = new FakeElement(`${id}-toggle`);
    toggle.textContent = "展开预览";
    toggle.setAttribute("aria-expanded", "false");
    card.queryElements.set(".archive-preview-toggle", toggle);
    return card;
  });

  const document = {
    activeElement: null,
    documentElement: new FakeElement("html"),
    listeners: documentListeners,
    querySelector(selector) { return elements.get(selector) ?? new FakeElement(); },
    querySelectorAll(selector) {
      if (selector === ".sentence-line") return [new FakeElement(), new FakeElement()];
      if (selector === ".archive-card[data-preview]") return archiveCards;
      return [];
    },
    createElement() { return new FakeElement(); },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) ?? [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      const listeners = documentListeners.get(type) ?? [];
      documentListeners.set(type, listeners.filter((registered) => registered !== listener));
    },
    dispatch(type, event = {}) { this.dispatchEvent({ type, bubbles: false, ...event }); },
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      event.currentTarget = this;
      documentListeners.get(event.type)?.forEach((listener) => listener(event));
    },
  };
  document.body = new FakeElement("body");
  document.body.parent = document;
  document.documentElement.dataset.visitorCounterEndpoint = visitorEndpoint;
  let cookie = visitorCookie;
  Object.defineProperty(document, "cookie", {
    get() { return cookie; },
    set(value) {
      if (!cookieWritable) throw new Error("cookies unavailable");
      cookie = String(value);
    },
  });
  for (const element of elements.values()) element.parent = document;
  archiveCards.forEach((card) => {
    card.parent = document;
    card.querySelector(".archive-preview-toggle").parent = card;
  });
  const window = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: (query) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : finePointer,
      addEventListener() {},
    }),
    setTimeout(callback, duration) {
      const timer = { callback, duration, active: true };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.active = false;
    },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? [];
      windowListeners.set(type, listeners.filter((registered) => registered !== listener));
    },
    requestAnimationFrame(callback) {
      const frame = ++nextAnimationFrame;
      animationFrames.set(frame, callback);
      return frame;
    },
    cancelAnimationFrame(frame) {
      cancelledAnimationFrames.push(frame);
      animationFrames.delete(frame);
    },
  };
  const storage = new Map();
  if (nightNavigationValue !== null) storage.set("homepage-night-navigation", nightNavigationValue);
  const sessionStorage = {
    getItem(key) {
      if (storageFailure) throw new Error("storage unavailable");
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (storageFailure) throw new Error("storage unavailable");
      storage.set(key, String(value));
    },
  };
  return {
    audio,
    archiveCards,
    currentLyric: elements.get("#current-lyric"),
    document,
    musicDuration: elements.get("#music-duration"),
    musicDock: elements.get("#music-dock"),
    musicDockExpand: elements.get("#music-dock-expand"),
    musicElapsed: elements.get("#music-elapsed"),
    musicLyrics: elements.get(".music-lyrics"),
    musicNext: elements.get("#music-next"),
    musicPanel: elements.get("#music-panel"),
    musicQueueToggle: elements.get("#music-queue-toggle"),
    musicTrackArtist: elements.get(".music-track-artist"),
    musicTrackList: elements.get("#music-track-list"),
    musicTrackTitle: elements.get(".music-track-title"),
    runTimers(duration) {
      const ready = timers.filter((timer) => timer.active && timer.duration === duration);
      ready.forEach((timer) => {
        timer.active = false;
        timer.callback();
      });
    },
    animationFrameCount() { return animationFrames.size; },
    cancelledAnimationFrames,
    runAnimationFrame(timestamp) {
      const [frame, callback] = animationFrames.entries().next().value ?? [];
      if (!callback) return;
      animationFrames.delete(frame);
      callback(timestamp);
    },
    moonRipple: elements.get("#moon-ripple"),
    sessionStorage,
    wechatPopover: elements.get("#wechat-popover"),
    wechatTrigger: elements.get("#wechat-trigger"),
    visitorStatus: elements.get("#visitor-counter-status"),
    visitorToday: elements.get("#visitor-today"),
    visitorTotal: elements.get("#visitor-total"),
    getCookie() { return cookie; },
    window,
  };
}

test("homepage places one semantic anonymous visitor card after contact links", () => {
  const connection = html.match(/<section class="story-section connection"[\s\S]*?<\/section>/)?.[0] ?? "";
  const socialIndex = connection.indexOf('<nav class="social-links"');
  const cardIndex = connection.indexOf('<aside class="visitor-counter"');
  const counterRules = styles.match(/\.visitor-counter\s*\{[^}]*\}[\s\S]*?\.visitor-counter,\s*\.visitor-counter-stats,\s*\.visitor-counter-stats div\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(html, /<html[^>]*data-visitor-counter-endpoint="https:\/\/snowstorm-homepage-visitors\.2971234387\.workers\.dev\/v1\/visit"/);
  assert.equal((html.match(/<aside class="visitor-counter"/g) ?? []).length, 1);
  assert.ok(socialIndex >= 0 && cardIndex > socialIndex, "visitor card follows social links");
  assert.doesNotMatch(connection, /<aside[^>]*class="[^"]*\bpointer-glass\b[^"]*"/);
  assert.match(connection, /<aside class="visitor-counter"[^>]*aria-labelledby="visitor-counter-title"[^>]*aria-busy="true"/);
  assert.match(connection, /<h3 id="visitor-counter-title" class="visitor-counter-label">VISITOR LOG<\/h3>/);
  assert.doesNotMatch(connection, /visitor-counter-kicker/);
  assert.match(connection, /<dt>总访客<\/dt>[\s\S]*?<output id="visitor-total">—<\/output>/);
  assert.match(connection, /<dt>今日<\/dt>[\s\S]*?<output id="visitor-today">—<\/output>/);
  assert.match(connection, /id="visitor-counter-status" class="sr-only" role="status"/);
  assert.match(connection, /仅作匿名统计，不记录 IP/);
  assert.match(counterRules, /width:\s*min\(100%,\s*300px\)/);
  assert.match(counterRules, /display:\s*flex/);
  assert.doesNotMatch(styles, /\.visitor-counter-stats div\s*\{[^}]*padding:/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.visitor-counter\s*\{[^}]*max-width:\s*100%/);
  assert.doesNotMatch(script, /geolocation|fingerprint|userAgent|location\.pathname|analytics/i);
});

test("visitor counter creates a first-party random cookie and posts only it to a configured endpoint", async () => {
  const endpoint = "https://example.workers.dev/v1/visit";
  const runtime = createMusicRuntime({ visitorEndpoint: endpoint });
  const requests = [];
  const crypto = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
      return bytes;
    },
  };
  vm.runInNewContext(script, {
    ...runtime,
    crypto,
    location: { protocol: "https:" },
    navigator: {},
    fetch: async (url, options = {}) => {
      if (url === endpoint) {
        requests.push({ url, options });
        return { ok: true, json: async () => ({ totalVisitors: 1248, todayVisitors: 16 }) };
      }
      return { ok: false, text: async () => "" };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers["Content-Type"], "text/plain");
  assert.equal(requests[0].options.credentials, "omit");
  assert.match(requests[0].options.body, /^[0-9a-f]{32}$/);
  assert.equal(requests[0].options.body, "000102030405060708090a0b0c0d0e0f");
  assert.match(runtime.getCookie(), /homepage_visitor_id=000102030405060708090a0b0c0d0e0f/);
  assert.match(runtime.getCookie(), /Max-Age=34560000/);
  assert.match(runtime.getCookie(), /Path=\//);
  assert.match(runtime.getCookie(), /SameSite=Lax/);
  assert.match(runtime.getCookie(), /Secure/);
  assert.equal(runtime.visitorTotal.textContent, "1,248");
  assert.equal(runtime.visitorToday.textContent, "16");
  assert.equal(runtime.visitorStatus.textContent, "匿名访客统计已同步");
});

test("visitor counter reuses its cookie and fails safely without a usable endpoint or response", async () => {
  const reusedId = "homepage_visitor_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const endpoint = "https://example.workers.dev/v1/visit";
  const runtime = createMusicRuntime({ visitorEndpoint: endpoint, visitorCookie: reusedId });
  let requestBody = "";
  vm.runInNewContext(script, {
    ...runtime,
    crypto: { getRandomValues() { throw new Error("should reuse cookie"); } },
    location: { protocol: "http:" },
    navigator: {},
    fetch: async (url, options = {}) => {
      if (url === endpoint) {
        requestBody = options.body;
        return { ok: false, json: async () => ({}) };
      }
      return { ok: false, text: async () => "" };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requestBody, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(runtime.visitorTotal.textContent, "—");
  assert.equal(runtime.visitorToday.textContent, "—");
  assert.equal(runtime.visitorStatus.textContent, "统计暂时不可用");

  const offline = createMusicRuntime();
  let fetched = false;
  vm.runInNewContext(script, {
    ...offline,
    crypto: { getRandomValues() { throw new Error("offline does not need an id"); } },
    location: { protocol: "https:" },
    navigator: {},
    fetch: async (url) => {
      if (url === "") fetched = true;
      return { ok: false, text: async () => "" };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetched, false);
  assert.equal(offline.visitorStatus.textContent, "统计暂时不可用");

  for (const failure of ["network", "json"]) {
    const broken = createMusicRuntime({ visitorEndpoint: endpoint });
    vm.runInNewContext(script, {
      ...broken,
      crypto: { getRandomValues(bytes) { bytes.fill(1); return bytes; } },
      location: { protocol: "https:" },
      navigator: {},
      fetch: async (url) => {
        if (url !== endpoint) return { ok: false, text: async () => "" };
        if (failure === "network") throw new Error("network unavailable");
        return { ok: true, json: async () => { throw new Error("invalid json"); } };
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(broken.visitorStatus.textContent, "统计暂时不可用");
  }

  const cookieBlocked = createMusicRuntime({ visitorEndpoint: endpoint, cookieWritable: false });
  let cookieBlockedRequests = 0;
  vm.runInNewContext(script, {
    ...cookieBlocked,
    crypto: { getRandomValues(bytes) { bytes.fill(2); return bytes; } },
    location: { protocol: "https:" },
    navigator: {},
    fetch: async (url) => {
      if (url === endpoint) cookieBlockedRequests += 1;
      return { ok: false, text: async () => "" };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cookieBlockedRequests, 0);
  assert.equal(cookieBlocked.visitorStatus.textContent, "统计暂时不可用");
});

test("night navigation persists an accessible stable state and bounds its ceremony", () => {
  assert.match(html, /<button id="moon-ripple"[^>]*aria-pressed="false"[^>]*aria-label="启用夜航模式"/);
  assert.match(script, /homepage-night-navigation/);
  assert.match(styles, /html\[data-night-navigation="on"\]/);
  assert.match(styles, /\.is-night-navigating/);

  const restored = createMusicRuntime({ nightNavigationValue: "on" });
  vm.runInNewContext(script, { ...restored, fetch: async () => ({ ok: false }), navigator: {}, sessionStorage: restored.sessionStorage });
  assert.equal(restored.document.documentElement.dataset.nightNavigation, "on");
  assert.equal(restored.moonRipple.getAttribute("aria-pressed"), "true");
  assert.equal(restored.moonRipple.getAttribute("aria-label"), "停用夜航模式");

  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {}, sessionStorage: runtime.sessionStorage });
  assert.equal(runtime.document.documentElement.dataset.nightNavigation, "off");
  runtime.moonRipple.dispatch("click");
  assert.equal(runtime.document.documentElement.dataset.nightNavigation, "on");
  assert.equal(runtime.moonRipple.getAttribute("aria-pressed"), "true");
  assert.equal(runtime.sessionStorage.getItem("homepage-night-navigation"), "on");
  assert.equal(runtime.document.documentElement.classList.contains("is-night-navigating"), true);
  runtime.runTimers(1350);
  assert.equal(runtime.document.documentElement.classList.contains("is-night-navigating"), false);
  runtime.moonRipple.dispatch("click");
  assert.equal(runtime.document.documentElement.dataset.nightNavigation, "off");
  assert.equal(runtime.sessionStorage.getItem("homepage-night-navigation"), "off");
});

test("night navigation handles unavailable storage and bypasses ceremony with reduced motion", () => {
  const unavailableStorage = createMusicRuntime({ storageFailure: true });
  vm.runInNewContext(script, { ...unavailableStorage, fetch: async () => ({ ok: false }), navigator: {}, sessionStorage: unavailableStorage.sessionStorage });
  unavailableStorage.moonRipple.dispatch("click");
  assert.equal(unavailableStorage.document.documentElement.dataset.nightNavigation, "on");

  const reduced = createMusicRuntime({ reducedMotion: true });
  vm.runInNewContext(script, { ...reduced, fetch: async () => ({ ok: false }), navigator: {}, sessionStorage: reduced.sessionStorage });
  reduced.moonRipple.dispatch("click");
  assert.equal(reduced.document.documentElement.dataset.nightNavigation, "on");
  assert.equal(reduced.document.documentElement.classList.contains("is-night-navigating"), false);
});

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

test("browser validation removes the 320px floor and compacts medium and short origin layouts", () => {
  const bodyRules = styles.match(/body\s*\{[^}]*\}/)?.[0] ?? "";
  const mediumHeightRules = styles.match(/@media \(min-width: 721px\) and \(max-width: 1100px\) and \(max-height: 800px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const mobileRules = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const shortMobileRules = styles.match(/@media \(max-width: 720px\) and \(max-height: 700px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.doesNotMatch(bodyRules, /min-width:\s*320px/);
  assert.match(mediumHeightRules, /--quote-status-slot-height:\s*34px/);
  assert.match(mediumHeightRules, /\.origin-content\s*\{[^}]*row-gap:\s*12px/);
  assert.match(mediumHeightRules, /\.origin-scroll-cue i\s*\{[^}]*height:\s*12px/);
  assert.match(mobileRules, /--quote-status-slot-height:\s*34px/);
  assert.match(mobileRules, /--quote-line-height:\s*24px/);
  assert.match(shortMobileRules, /\.origin\s*\{[^}]*padding-block:\s*32px calc\(var\(--dock-height\) \+ 24px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(shortMobileRules, /\.origin-content\s*\{[^}]*row-gap:\s*4px/);
  assert.match(shortMobileRules, /\.origin-scroll-cue i\s*\{[^}]*height:\s*8px/);
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
  const quoteStatusRules = styles.match(/\.origin-quote-status\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(html, /id="origin-search-slot"[\s\S]*class="origin-quote-status"[\s\S]*id="origin-quote-slot"/);
  assert.match(html, /id="origin-quote-slot"[\s\S]*class="sentence-line"[\s\S]*class="sentence-line"/);
  assert.match(styles, /--quote-status-slot-height:\s*52px/);
  assert.match(styles, /\.origin-story\s*\{[\s\S]*grid-template-rows:\s*var\(--search-slot-height\) var\(--quote-status-slot-height\) var\(--quote-slot-height\)/);
  assert.match(styles, /#origin-search-slot\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(quoteStatusRules, /grid-row:\s*2/);
  assert.match(quoteStatusRules, /height:\s*var\(--quote-status-slot-height\)/);
  assert.match(quoteStatusRules, /position:\s*static/);
  assert.doesNotMatch(quoteStatusRules, /\btop:/);
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

test("every archive card keeps its summary and preview in one fixed copy stage", () => {
  const cards = [...html.matchAll(/<article class="archive-card"[\s\S]*?<\/article>/g)].map(([card]) => card);

  assert.equal(cards.length, 3);
  for (const card of cards) {
    const stages = card.match(/<div class="archive-copy-stage">[\s\S]*?<\/div>\s*<\/div>/g) ?? [];
    assert.equal(stages.length, 1, "each archive card has exactly one copy stage");
    assert.match(stages[0], /<p class="archive-summary">[^<]+<\/p>/);
    assert.match(stages[0], /<div class="archive-preview" id="[^"]+-preview">[\s\S]*?<p>[^<]+<\/p>/);
  }
});

test("archive copy stage swaps summary and preview without a card-relative overlay", () => {
  const stageRules = styles.match(/\.archive-copy-stage\s*\{[^}]*\}/)?.[0] ?? "";
  const summaryRules = styles.match(/\.archive-summary\s*\{[^}]*\}/)?.[0] ?? "";
  const previewRules = styles.match(/\.archive-preview\s*\{[^}]*\}/)?.[0] ?? "";
  const expandedSummary = styles.match(/\.archive-card\.is-expanded \.archive-summary\s*\{[^}]*\}/)?.[0] ?? "";
  const expandedPreview = styles.match(/\.archive-card\.is-expanded \.archive-preview\s*\{[^}]*\}/)?.[0] ?? "";
  const toggleRules = styles.match(/\.archive-preview-toggle\s*\{[^}]*\}/)?.[0] ?? "";
  const destinationRules = styles.match(/\.archive-card a\s*\{[^}]*\}/)?.[0] ?? "";
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(stageRules, /display:\s*grid/);
  assert.match(summaryRules, /grid-area:\s*1\s*\/\s*1/);
  assert.match(previewRules, /grid-area:\s*1\s*\/\s*1/);
  assert.match(previewRules, /opacity:\s*0/);
  assert.match(previewRules, /visibility:\s*hidden/);
  assert.match(previewRules, /pointer-events:\s*none/);
  assert.doesNotMatch(previewRules, /position:\s*absolute|bottom:\s*120px/);
  assert.match(expandedSummary, /opacity:\s*0/);
  assert.match(expandedSummary, /visibility:\s*hidden/);
  assert.match(expandedSummary, /pointer-events:\s*none/);
  assert.match(expandedPreview, /opacity:\s*1/);
  assert.match(expandedPreview, /visibility:\s*visible/);
  assert.match(expandedPreview, /pointer-events:\s*auto/);
  assert.match(toggleRules, /margin-top:\s*auto/);
  assert.match(destinationRules, /margin-top:\s*12px/);
  assert.match(reducedMotion, /\.archive-summary,\s*\.archive-preview\s*\{[^}]*transition:\s*none !important/);
});

test("archive toggles update labels, keep one preview open, and Escape restores focus", () => {
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {} });
  const [learning, living] = runtime.archiveCards;
  const learningToggle = learning.querySelector(".archive-preview-toggle");
  const livingToggle = living.querySelector(".archive-preview-toggle");

  learningToggle.dispatch("click");
  assert.equal(learning.classList.contains("is-expanded"), true);
  assert.equal(learningToggle.getAttribute("aria-expanded"), "true");
  assert.equal(learningToggle.textContent, "收起预览");

  livingToggle.dispatch("click");
  assert.equal(learning.classList.contains("is-expanded"), false);
  assert.equal(learningToggle.textContent, "展开预览");
  assert.equal(living.classList.contains("is-expanded"), true);
  assert.equal(livingToggle.textContent, "收起预览");

  runtime.document.dispatch("keydown", { key: "Escape" });
  assert.equal(living.classList.contains("is-expanded"), false);
  assert.equal(livingToggle.getAttribute("aria-expanded"), "false");
  assert.equal(livingToggle.textContent, "展开预览");
  assert.equal(runtime.document.activeElement, livingToggle);
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

  assert.match(archiveGrid, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.ok(compactArchiveGrid, "archive has a direct narrow-screen fallback");
  assert.ok(Number(compactArchiveGrid[1]) <= 900, "archive remains three columns at 1024px");
  assert.match(compactArchiveGrid[0], /grid-template-columns:\s*1fr/);
  assert.doesNotMatch(archiveGrid, /grid-template-columns:\s*repeat\(2,/);
  assert.match(card, /height:\s*100%/);
  assert.doesNotMatch(styles, /\.archive-card:first-child/);
  assert.match(media, /aspect-ratio:\s*16\s*\/\s*9/);
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

test("moon-scale shoal is shared by the homepage and three archive entries", async () => {
  const entries = await Promise.all(["learning", "living", "research"].map((entry) => readFile(new URL(`../${entry}/index.html`, import.meta.url), "utf8")));
  assert.doesNotMatch(html, /id="bioluminescent-shoal"/);
  assert.match(html, /href="\.\/assets\/cursor-shoal\.css"/);
  assert.match(html, /src="\.\/assets\/cursor-shoal\.js" defer/);
  entries.forEach((entry) => {
    assert.match(entry, /<html[^>]*data-moon-scale-shoal="true"/);
    assert.match(entry, /href="\.\.\/assets\/cursor-shoal\.css"/);
    assert.match(entry, /src="\.\.\/assets\/cursor-shoal\.js" defer/);
  });
  assert.match(sharedScript, /const PARTICLE_COUNT = 6;/);
  assert.match(sharedScript, /function setup\(\)/);
  assert.match(sharedScript, /function sync\(\)/);
  assert.match(sharedScript, /function destroy\(\)/);
  assert.match(sharedScript, /window\.matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(sharedScript, /reduceMotionQuery\.addEventListener\("change", sync\)/);
  assert.match(sharedScript, /pointerQuery\.addEventListener\("change", sync\)/);
  assert.match(sharedScript, /document\.createElement\("div"\)/);
  assert.match(sharedScript, /layer\.id = "bioluminescent-shoal";/);
  assert.match(sharedScript, /layer\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(sharedScript, /Array\.from\(\{ length: PARTICLE_COUNT \}/);
  assert.match(styles, /#bioluminescent-shoal\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /#bioluminescent-shoal\s*\{[^}]*position:\s*fixed/);
  assert.match(styles, /\.shoal-core\s*\{[^}]*width:\s*14px[^}]*height:\s*8px/);
  assert.match(styles, /\.shoal-core::before\s*\{[^}]*clip-path:/);
  assert.match(styles, /html\[data-bioluminescent-shoal="true"\][\s\S]*?cursor:\s*none !important/);
  assert.match(styles, /:is\(input, textarea, \[contenteditable\]\)[\s\S]*?cursor:\s*text !important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#bioluminescent-shoal\s*\{[^}]*display:\s*none/);

  const archiveRuntime = createMusicRuntime({ finePointer: true });
  archiveRuntime.document.documentElement.dataset.moonScaleShoal = "true";
  vm.runInNewContext(sharedScript, { ...archiveRuntime, fetch: async () => ({ ok: false }), navigator: {} });
  assert.equal(archiveRuntime.document.body.children.filter((element) => element.id === "bioluminescent-shoal").length, 1);
  assert.equal(archiveRuntime.animationFrameCount(), 1);
});

test("moon-scale shoal uses one RAF for vector steering, V formation, orbiting controls, and click return", () => {
  assert.doesNotMatch(sharedScript, /INTERACTIVE_SELECTOR[^;]*\[data-preview\]/);
  assert.match(sharedScript, /state\.frame = window\.requestAnimationFrame\(render\);/);
  assert.match(sharedScript, /window\.cancelAnimationFrame\(controller\.frame\);/);
  assert.match(sharedScript, /const TRAIL_DURATION = 180;/);
  assert.match(sharedScript, /Math\.atan2\(deltaY, deltaX\)/);
  assert.match(sharedScript, /speed > 12 \? \.38 : \.1/);
  assert.match(sharedScript, /distance: 41, lateral: 12, damping: \.09/);
  assert.match(sharedScript, /Math\.cos\(angle\) \* 18/);
  assert.match(sharedScript, /32 \+ \(index \* 2\.8\)/);
  assert.match(sharedScript, /controller\.goldUntil = now\(\) \+ 140;/);
  assert.match(styles, /#bioluminescent-shoal\.is-clustered \.shoal-particle\s*\{[^}]*opacity:/);
  assert.match(styles, /html\[data-night-navigation="on"\] #bioluminescent-shoal \.shoal-core/);
  assert.match(styles, /html\[data-night-navigation="on"\] #bioluminescent-shoal\.is-clicking \.shoal-core/);
  assert.doesNotMatch(sharedScript, /document\.createElement\([^)]*\)[\s\S]{0,300}pointermove/);
});

test("archive card surfaces remain free-following while real controls become shoal targets", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  const context = {
    ...runtime,
    performance: { now: () => 16 },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };
  const archiveCard = { closest(selector) { return selector.includes("[data-preview]") ? this : null; } };
  const control = { closest(selector) { return selector.includes("a, button") ? this : null; } };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);

  runtime.document.dispatch("pointerover", { target: archiveCard, clientX: 120, clientY: 80 });
  assert.equal(controller.target, null);
  runtime.document.dispatch("pointerover", { target: control, clientX: 160, clientY: 100 });
  assert.equal(controller.target, control);
});

test("control clicks scatter the shoal and target mode orbits instead of pinning the core", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  let now = 0;
  const context = {
    ...runtime,
    performance: { now: () => now },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };
  const control = {
    closest(selector) { return selector.includes("a, button") ? this : null; },
    getBoundingClientRect() { return { left: 100, top: 50, width: 40, height: 20 }; },
  };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);

  runtime.document.dispatch("pointerover", { target: control, clientX: 120, clientY: 60 });
  now = 110;
  runtime.runAnimationFrame(now);
  assert.doesNotMatch(controller.core.style.transform, /translate3d\(120px, 60px/);
  assert.doesNotMatch(controller.core.style.transform, /rotate\(0deg\)/);
  runtime.document.dispatch("pointerdown", { target: control, clientX: 120, clientY: 60 });
  assert.ok(controller.scatterUntil > now);
});

test("a stationary control pointer resumes its orbit when click scatter ends", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  let now = 0;
  const context = {
    ...runtime,
    performance: { now: () => now },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };
  const control = {
    closest(selector) { return selector.includes("a, button") ? this : null; },
    getBoundingClientRect() { return { left: 100, top: 50, width: 40, height: 20 }; },
  };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);

  runtime.document.dispatch("pointerover", { target: control, clientX: 120, clientY: 60 });
  runtime.document.dispatch("pointerdown", { target: control, clientX: 120, clientY: 60 });
  assert.equal(controller.target, null, "scatter temporarily releases the active orbit target");
  now = 521;
  runtime.runAnimationFrame(now);

  assert.equal(controller.target, control, "the still-hovered control regains its orbit target after scatter");
  assert.equal(controller.layer.classList.contains("is-clustered"), true);
});

test("first in-page pointer movement reveals the shoal without a boundary entry", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  const context = {
    ...runtime,
    performance: { now: () => 16 },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);

  assert.equal(controller.layer.classList.contains("is-visible"), false);
  runtime.document.dispatch("pointermove", { clientX: 120, clientY: 80 });
  assert.equal(controller.layer.classList.contains("is-visible"), true);
});

test("document boundary events hide the shoal and reenter at the new pointer position", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  const context = {
    ...runtime,
    performance: { now: () => 16 },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };
  const boundaryTarget = { closest() { return null; } };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);

  runtime.document.dispatch("pointermove", { target: boundaryTarget, clientX: 120, clientY: 80 });
  assert.equal(controller.layer.classList.contains("is-visible"), true);
  runtime.document.dispatch("pointerout", { target: boundaryTarget, relatedTarget: null, clientX: 120, clientY: 80 });
  assert.equal(controller.layer.classList.contains("is-visible"), false);

  runtime.document.dispatch("pointerover", { target: boundaryTarget, relatedTarget: null, clientX: 420, clientY: 260 });
  assert.equal(controller.layer.classList.contains("is-visible"), true);
  assert.deepEqual([controller.pointer.x, controller.pointer.y], [420, 260]);
  assert.ok(controller.particlePositions.every((position) => position.x === 420 && position.y === 260));
  runtime.runAnimationFrame(32);
  assert.match(controller.core.style.transform, /translate3d\(420px, 260px/);
  assert.equal(runtime.document.body.children.filter((element) => element.id === "bioluminescent-shoal").length, 1);
  assert.equal(runtime.animationFrameCount(), 1);
});

test("first pointer position initializes particles without a viewport-wide corner streak", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  const context = {
    ...runtime,
    performance: { now: () => 16 },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);

  runtime.document.dispatch("pointermove", { clientX: 120, clientY: 80 });
  runtime.runAnimationFrame(16);

  for (const position of controller.particlePositions) {
    assert.ok(Math.hypot(position.x - 120, position.y - 80) < 12, `particle starts near the pointer (${position.x}, ${position.y})`);
  }
});

test("scatter follows a visible arc before returning to the V formation", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  let now = 0;
  const context = {
    ...runtime,
    performance: { now: () => now },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };

  vm.runInNewContext(script, context);
  const controller = vm.runInNewContext("shoalController", context);
  vm.runInNewContext("scatterShoalAt(120, 80)", context);

  now = 260;
  runtime.runAnimationFrame(now);
  const halfwayDistance = Math.hypot(controller.particlePositions[0].x - 120, controller.particlePositions[0].y - 80);
  now = 521;
  runtime.runAnimationFrame(now);

  assert.ok(halfwayDistance > 3, `scatter leaves the core along an arc (${halfwayDistance})`);
  assert.equal(controller.layer.classList.contains("is-scattering"), false);
  assert.equal(controller.layer.classList.contains("is-clicking"), false);
});

test("reduced motion and coarse pointers skip the shoal while resync keeps one layer and RAF", () => {
  for (const options of [{ reducedMotion: true, finePointer: true }, { finePointer: false }]) {
    const runtime = createMusicRuntime(options);
    const context = { ...runtime, fetch: async () => ({ ok: false }), navigator: {} };
    vm.runInNewContext(script, context);
    assert.equal(runtime.document.documentElement.dataset.bioluminescentShoal, "false");
    assert.equal(runtime.document.body.children.filter((element) => element.id === "bioluminescent-shoal").length, 0);
    assert.equal(runtime.animationFrameCount(), 0);
  }

  const runtime = createMusicRuntime({ finePointer: true });
  const context = { ...runtime, fetch: async () => ({ ok: false }), navigator: {} };
  vm.runInNewContext(script, context);
  vm.runInNewContext("syncBioluminescentShoal()", context);
  assert.equal(runtime.document.body.children.filter((element) => element.id === "bioluminescent-shoal").length, 1);
  assert.equal(runtime.animationFrameCount(), 1);
});

test("bioluminescent shoal schedules one cancellable RAF and clears its trail after 180ms", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  let now = 0;
  const context = {
    ...runtime,
    performance: { now: () => now },
    fetch: async () => ({ ok: false }),
    navigator: {},
  };

  vm.runInNewContext(script, context);

  assert.equal(runtime.animationFrameCount(), 1, "setup schedules the first shoal frame");
  const controller = vm.runInNewContext("shoalController", context);
  runtime.document.dispatch("pointermove", { clientX: 10, clientY: 10 });
  now = 16;
  runtime.runAnimationFrame(now);
  runtime.document.dispatch("pointermove", { clientX: 110, clientY: 10 });
  now = 32;
  runtime.runAnimationFrame(now);
  const movingTrail = controller.trailStrength;
  now = 106;
  runtime.runAnimationFrame(now);
  const settlingTrail = controller.trailStrength;
  now = 213;
  runtime.runAnimationFrame(now);

  assert.ok(movingTrail > settlingTrail && settlingTrail > 0, `trail strength decays instead of resetting after one frame (${movingTrail}, ${settlingTrail})`);
  assert.equal(controller.trailStrength, 0, "trail has settled after 180 ms");
  const pendingFrame = controller.frame;
  vm.runInNewContext("destroyBioluminescentShoal()", context);
  assert.ok(runtime.cancelledAnimationFrames.includes(pendingFrame), "destroy cancels the scheduled shoal frame");
});

test("public shoal destroy restores the system cursor contract", () => {
  const runtime = createMusicRuntime({ finePointer: true });
  const context = { ...runtime, fetch: async () => ({ ok: false }), navigator: {} };

  vm.runInNewContext(script, context);
  assert.equal(runtime.document.documentElement.dataset.bioluminescentShoal, "true");
  vm.runInNewContext("window.MoonScaleShoal.destroy()", context);

  assert.equal(runtime.document.documentElement.dataset.bioluminescentShoal, "false", "public teardown restores the native cursor");
  assert.equal(runtime.document.body.children.filter((element) => element.id === "bioluminescent-shoal").length, 0);
  assert.equal(runtime.animationFrameCount(), 0);
});

test("premium motion stages section copy, bounds glass lift and tilt, and adds two moon ripples", () => {
  const stagedReveal = styles.match(/html\[data-motion="full"\]\[data-active-section\]\s+:where\([\s\S]*?\)\s*\{[^}]*\}/)?.[0] ?? "";
  const activeReveal = styles.match(/html\[data-motion="full"\]\[data-active-section="archive"\]\s+#archive\s+:is\([^)]*\)\s*\{[^}]*\}/)?.[0] ?? "";
  const pointerTransform = styles.match(/html\[data-pointer-glass="true"\]\s+:is\(\.pointer-glass,\s*\.archive-card\)\s*\{[^}]*\}/)?.[0] ?? "";
  const finePointerHover = styles.match(/@media \(hover:\s*hover\) and \(pointer:\s*fine\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(stagedReveal, /opacity:\s*\.18/);
  assert.match(stagedReveal, /--reveal-y:\s*20px/);
  assert.match(stagedReveal, /filter:\s*blur\(5px\)/);
  assert.match(stagedReveal, /transition-delay:\s*var\(--reveal-delay\)/);
  assert.match(styles, /:not\(\.pointer-glass\):not\(\.archive-card\)\s*\{[^}]*translateY\(var\(--reveal-y\)\)/);
  assert.match(styles, /\.archive-card:nth-child\(2\)\s*\{[^}]*--reveal-delay:\s*80ms/);
  assert.match(styles, /\.archive-card:nth-child\(3\)\s*\{[^}]*--reveal-delay:\s*160ms/);
  assert.match(activeReveal, /opacity:\s*1/);
  assert.match(activeReveal, /--reveal-y:\s*0px/);
  assert.match(activeReveal, /filter:\s*none/);
  assert.match(pointerTransform, /translateY\(calc\(var\(--reveal-y,\s*0px\) \+ var\(--glass-lift\)\)\)/);
  assert.match(pointerTransform, /rotateX\(var\(--tilt-x\)\)/);
  assert.match(pointerTransform, /rotateY\(var\(--tilt-y\)\)/);
  assert.match(finePointerHover, /--glass-lift:\s*-5px/);
  assert.match(styles, /html\[data-motion="full"\]\[data-pointer-glass="true"\]\s+:is\(\.pointer-glass,\s*\.archive-card\):active\s*\{[^}]*--glass-lift:\s*1px/);
  assert.match(styles, /html\[data-motion="full"\]\s+:is\(\.education-entry,\s*\.social-links a,\s*\.social-links button\):active\s*\{[^}]*scale\(\.985\)/);
  assert.match(script, /--tilt-x", `\$\{\(0\.5 - y\) \* 4\}deg`/);
  assert.match(script, /--tilt-y", `\$\{\(x - 0\.5\) \* 4\}deg`/);
  assert.match(styles, /#moon-ripple\.is-rippling::after\s*\{[^}]*animation:\s*moon-ripple-primary/);
  assert.match(styles, /#moon-ripple\.is-rippling span\s*\{[^}]*animation:\s*moon-ripple-secondary/);
  assert.match(styles, /html\.is-moonlit\s+\.page-backdrop\s*\{[^}]*animation:\s*moonlight-brighten/);
  assert.match(script, /root\.classList\.add\("is-moonlit", "is-night-navigating"\)/);
});

test("active section reveal rules outrank the shared inactive reveal baseline", () => {
  const sharedReveal = styles.match(/html\[data-motion="full"\]\[data-active-section\]\s+:where\([\s\S]*?\)\s*\{[^}]*\}/)?.[0] ?? "";
  const sharedTranslation = styles.match(/html\[data-motion="full"\]\[data-active-section\]\s+:where\([\s\S]*?\):not\(\.pointer-glass\):not\(\.archive-card\)\s*\{[^}]*\}/)?.[0] ?? "";
  const activeOrigin = styles.match(/html\[data-motion="full"\]\[data-active-section="origin"\]\s+#origin\s+:is\([^)]*\)\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(sharedReveal, /opacity:\s*\.18/);
  assert.match(sharedTranslation, /translateY\(var\(--reveal-y\)\)/);
  assert.match(activeOrigin, /--reveal-y:\s*0px/);
  assert.match(activeOrigin, /opacity:\s*1/);
  assert.match(activeOrigin, /filter:\s*none/);
});

test("scene-light pointer parallax is capped at twelve pixels and disabled with reduced motion", () => {
  const fullMotion = createMusicRuntime({ finePointer: true });
  vm.runInNewContext(script, { ...fullMotion, fetch: async () => ({ ok: false }), navigator: {} });
  fullMotion.document.dispatch("pointermove", {
    clientX: fullMotion.window.innerWidth,
    clientY: 0,
  });

  assert.equal(fullMotion.document.documentElement.style.getPropertyValue("--scene-light-offset-x"), "12px");
  assert.equal(fullMotion.document.documentElement.style.getPropertyValue("--scene-light-offset-y"), "-12px");

  const reduced = createMusicRuntime({ reducedMotion: true, finePointer: true });
  vm.runInNewContext(script, { ...reduced, fetch: async () => ({ ok: false }), navigator: {} });
  reduced.document.dispatch("pointermove", {
    clientX: reduced.window.innerWidth,
    clientY: 0,
  });

  assert.equal(reduced.document.documentElement.style.getPropertyValue("--scene-light-offset-x"), "");
  assert.equal(reduced.document.documentElement.style.getPropertyValue("--scene-light-offset-y"), "");
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(reducedMotion, /filter:\s*none !important/);
  assert.match(reducedMotion, /#moon-ripple\.is-rippling span/);
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

test("tidal-island controls use accessible inline SVG icon boxes and softened track rows", () => {
  const controlIds = [
    "music-dock-play", "music-dock-expand", "music-close",
    "music-previous", "music-play", "music-next", "music-queue-toggle",
  ];
  const transport = html.match(/<div class="music-transport"[\s\S]*?<\/div>/)?.[0] ?? "";
  const iconControlRules = styles.match(/\.music-transport button,\s*#music-close\s*\{[^}]*\}/)?.[0] ?? "";
  const iconRules = styles.match(/\.music-control-icon\s*\{[^}]*\}/)?.[0] ?? "";
  const trackRules = styles.match(/\.music-track\s*\{[^}]*\}/)?.[0] ?? "";
  const activeTrackRules = styles.match(/\.music-track\[aria-current="true"\]\s*\{[^}]*\}/)?.[0] ?? "";

  for (const id of controlIds) {
    const button = html.match(new RegExp(`<button id="${id}"[\\s\\S]*?<\\/button>`))?.[0] ?? "";
    assert.match(button, /<svg[^>]*class="music-control-icon"[^>]*aria-hidden="true"/);
    assert.match(button, /<span class="sr-only">[^<]+<\/span>/);
    assert.doesNotMatch(styles, new RegExp(`#${id}(?:\\[[^\\]]+\\])?::(?:before|after)\\s*\\{[^}]*content:`));
  }
  assert.match(transport, /id="music-previous"/);
  assert.match(transport, /id="music-play"/);
  assert.match(transport, /id="music-next"/);
  assert.match(iconControlRules, /width:\s*38px/);
  assert.match(iconControlRules, /height:\s*38px/);
  assert.match(iconControlRules, /border-radius:\s*50%/);
  assert.match(iconControlRules, /display:\s*grid/);
  assert.match(iconControlRules, /place-items:\s*center/);
  assert.match(iconRules, /display:\s*block/);
  assert.match(iconRules, /width:\s*24px/);
  assert.match(iconRules, /height:\s*24px/);
  assert.match(styles, /\.icon-play\s*\{[^}]*transform:\s*translateX\(1px\)/);
  assert.match(trackRules, /border:\s*0/);
  assert.match(trackRules, /border-radius:\s*12px/);
  assert.match(trackRules, /background:\s*rgba\(255,\s*255,\s*255,\s*\.04\)/);
  assert.match(activeTrackRules, /box-shadow:\s*inset 2px 0 var\(--accent\)/);
});

test("tidal-island panel exposes timing and a collapsed bounded queue", () => {
  const panel = html.match(/<section id="music-panel"[\s\S]*?<\/section>/)?.[0] ?? "";
  const queue = panel.match(/<div id="music-track-list"[^>]*>/)?.[0] ?? "";
  const queueRules = styles.match(/#music-track-list\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(panel, /class="music-cover-orbit"[\s\S]*id="music-cover"/);
  assert.match(panel, /class="music-panel-mood"[\s\S]*class="music-track-title"[\s\S]*class="music-track-artist"/);
  assert.match(panel, /class="music-lyrics"[\s\S]*id="previous-lyric"[\s\S]*id="current-lyric"[\s\S]*id="next-lyric"/);
  assert.match(panel, /class="music-timing"[\s\S]*id="music-elapsed"[\s\S]*id="music-duration"/);
  assert.match(panel, /id="music-queue-toggle"[^>]*aria-controls="music-track-list"[^>]*aria-expanded="false"/);
  assert.match(queue, /\shidden(?:\s|>)/);
  assert.match(queueRules, /max-height:\s*132px/);
  assert.match(queueRules, /overflow-y:\s*auto/);
  assert.match(styles, /#music-panel\.is-queue-open\s+#music-track-list/);
});

test("tidal-island collapsed queue exposes a visible nine-track label without growing the panel", () => {
  const panel = html.match(/<section id="music-panel"[\s\S]*?<\/section>/)?.[0] ?? "";
  const toggle = panel.match(/<button id="music-queue-toggle"[\s\S]*?<\/button>/)?.[0] ?? "";
  const toggleRules = styles.match(/#music-queue-toggle\s*\{[^}]*\}/)?.[0] ?? "";
  const panelRules = styles.match(/#music-panel\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(toggle, /aria-label="展开播放队列"/);
  assert.match(toggle, /<span class="music-queue-label" aria-hidden="true">QUEUE · 9 TRACKS<\/span>/);
  assert.match(toggleRules, /grid-template-columns:\s*24px auto/);
  assert.match(toggleRules, /width:\s*max-content/);
  assert.match(panelRules, /height:\s*min\(380px,\s*calc\(100dvh - 118px\)\)/);

  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {} });
  runtime.musicQueueToggle.dispatch("click");
  assert.equal(runtime.musicQueueToggle.getAttribute("aria-label"), "收起播放队列");
});

test("every tidal player SVG uses a centered twenty-four-pixel icon contract", () => {
  const icons = [...html.matchAll(/<svg class="music-control-icon"[^>]*>/g)].map((match) => match[0]);
  const iconRules = styles.match(/\.music-control-icon\s*\{[^}]*\}/)?.[0] ?? "";

  assert.equal(icons.length, 7);
  icons.forEach((icon) => assert.match(icon, /viewBox="0 0 24 24"/));
  assert.match(iconRules, /width:\s*24px/);
  assert.match(iconRules, /height:\s*24px/);
  assert.match(styles, /\.icon-play\s*\{[^}]*translateX\(1px\)/);
  assert.doesNotMatch(styles, /\.music-control-icon\s*\{[^}]*transform:/);
});

test("track and lyric changes drive short-lived motion states while reduced motion stays immediate", async () => {
  assert.match(script, /function triggerPlayerMotion\(element,\s*className\)/);
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, {
    ...runtime,
    fetch: async () => ({ ok: true, text: async () => "[00:00.00]First\n[00:10.00]Second\n[00:20.00]Third" }),
    navigator: {},
  });
  await new Promise((resolve) => setImmediate(resolve));

  runtime.musicPanel.classList.remove("is-track-transitioning");
  runtime.musicLyrics.classList.remove("is-lyric-transitioning");
  runtime.musicNext.dispatch("click");
  assert.equal(runtime.musicPanel.classList.contains("is-track-transitioning"), true);
  assert.equal(runtime.document.documentElement.style.getPropertyValue("--previous-track-accent"), "#8fc5d6");
  assert.equal(runtime.document.documentElement.style.getPropertyValue("--track-accent"), "#e4bb83");
  assert.equal(runtime.musicTrackTitle.textContent, "稻香");
  assert.equal(runtime.musicTrackArtist.textContent, "周杰伦");
  runtime.runTimers(500);
  assert.equal(runtime.musicPanel.classList.contains("is-track-transitioning"), false);

  await new Promise((resolve) => setImmediate(resolve));
  runtime.musicLyrics.classList.remove("is-lyric-transitioning");
  runtime.audio.currentTime = 11;
  runtime.audio.dispatch("timeupdate");
  assert.equal(runtime.musicLyrics.classList.contains("is-lyric-transitioning"), true);
  assert.equal(runtime.currentLyric.textContent, "Second");
  runtime.runTimers(400);
  assert.equal(runtime.musicLyrics.classList.contains("is-lyric-transitioning"), false);

  const reduced = createMusicRuntime({ reducedMotion: true });
  vm.runInNewContext(script, {
    ...reduced,
    fetch: async () => ({ ok: true, text: async () => "[00:00.00]First\n[00:10.00]Second" }),
    navigator: {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  reduced.musicNext.dispatch("click");
  reduced.audio.currentTime = 11;
  reduced.audio.dispatch("timeupdate");
  assert.equal(reduced.musicPanel.classList.contains("is-track-transitioning"), false);
  assert.equal(reduced.musicLyrics.classList.contains("is-lyric-transitioning"), false);
  assert.equal(reduced.musicTrackTitle.textContent, "稻香");
});

test("tidal-island desktop panel stays compact when lyric metadata is long", () => {
  const panelRules = styles.match(/#music-panel\s*\{[^}]*\}/)?.[0] ?? "";
  const lyricsRules = styles.match(/\.music-lyrics\s*\{[^}]*\}/)?.[0] ?? "";
  const lyricLineRules = styles.match(/\.music-lyrics p\s*\{[^}]*\}/)?.[0] ?? "";
  const compactHeight = panelRules.match(/(?:^|[;{])\s*height:\s*min\((\d+)px,\s*calc\(100dvh - 118px\)\)/);

  assert.ok(compactHeight, "desktop panel needs a viewport-safe explicit height");
  assert.ok(Number(compactHeight[1]) >= 340 && Number(compactHeight[1]) <= 380);
  assert.match(lyricsRules, /height:\s*82px/);
  assert.match(lyricsRules, /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(lyricLineRules, /overflow:\s*hidden/);
  assert.match(lyricLineRules, /text-overflow:\s*ellipsis/);
  assert.match(lyricLineRules, /white-space:\s*nowrap/);
});

test("tidal-island reduced motion explicitly disables every new player effect", () => {
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const playerEffects = reducedMotion.match(/#music-panel,\s*#music-track-list,\s*\.music-cover-orbit,\s*#music-cover,\s*\.music-panel-mood,\s*\.music-lyrics,\s*\.music-lyrics p\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(playerEffects, /animation:\s*none !important/);
  assert.match(playerEffects, /transition:\s*none !important/);
});

test("tidal-island runtime updates time and gives an open queue Escape priority", () => {
  assert.match(script, /function setMusicQueueOpen\(expanded\)/);
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {} });

  runtime.audio.currentTime = 65.8;
  runtime.audio.duration = 130;
  runtime.audio.dispatch("timeupdate");
  assert.equal(runtime.musicElapsed.textContent, "1:05");
  assert.equal(runtime.musicDuration.textContent, "2:10");

  runtime.musicDockExpand.dispatch("click");
  runtime.musicQueueToggle.dispatch("click");
  assert.equal(runtime.musicQueueToggle.getAttribute("aria-expanded"), "true");
  assert.equal(runtime.musicTrackList.hidden, false);

  runtime.document.dispatch("keydown", { key: "Escape" });
  assert.equal(runtime.musicQueueToggle.getAttribute("aria-expanded"), "false");
  assert.equal(runtime.musicTrackList.hidden, true);
  assert.equal(runtime.musicPanel.hidden, false);
  assert.equal(runtime.document.activeElement, runtime.musicQueueToggle);

  runtime.document.dispatch("keydown", { key: "Escape" });
  assert.equal(runtime.musicPanel.hidden, true);
  assert.equal(runtime.document.activeElement, runtime.musicDockExpand);
});

test("tidal-island nested SVG clicks inside the Dock or panel do not outside-close it", () => {
  const runtime = createMusicRuntime();
  vm.runInNewContext(script, { ...runtime, fetch: async () => ({ ok: false }), navigator: {} });
  runtime.musicDockExpand.dispatch("click");

  for (const surface of [runtime.musicDock, runtime.musicPanel]) {
    const svg = new runtime.musicPanel.constructor();
    const path = new runtime.musicPanel.constructor();
    svg.append(path);
    surface.append(svg);
    path.dispatchEvent({ type: "click", bubbles: true });
    assert.equal(runtime.musicPanel.hidden, false);
  }
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
