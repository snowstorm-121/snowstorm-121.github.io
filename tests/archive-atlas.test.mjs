import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import vm from "node:vm";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [learning, living, research, styles, script, manifestSource] = await Promise.all([
  readFile(new URL("../learning/index.html", import.meta.url), "utf8"),
  readFile(new URL("../living/index.html", import.meta.url), "utf8"),
  readFile(new URL("../research/index.html", import.meta.url), "utf8"),
  readOptional("../assets/archive-atlas.css"),
  readOptional("../assets/archive-atlas.js"),
  readFile(new URL("../learning/pytorch/manifest.json", import.meta.url), "utf8"),
]);
const pages = { learning, living, research };
const manifest = JSON.parse(manifestSource);

test("three archive entries share one semantic midnight atlas shell and local runtime", async () => {
  const titles = {
    learning: "星野问津",
    living: "人间照影",
    research: "烛微观澜",
  };

  for (const [key, html] of Object.entries(pages)) {
    assert.match(html, /class="archive-atlas-page /);
    assert.match(html, /<header class="atlas-header">[\s\S]*?href="\.\.\/index\.html"[\s\S]*?返回主页/);
    assert.match(html, new RegExp(`<span class="atlas-current"[^>]*>${titles[key]}<\/span>`));
    assert.match(html, /<nav class="atlas-switcher" aria-label="档案分类">/);
    for (const href of ["../learning/", "../living/", "../research/"]) {
      assert.match(html, new RegExp(`href="${href.replaceAll("/", "\\/")}"`));
    }
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, /class="atlas-layout"/);
    assert.match(html, /class="atlas-chart"[^>]*data-atlas-map/);
    assert.match(html, /class="atlas-index/);
    assert.match(html, /data-atlas-title[^>]*aria-live="polite"/);
    assert.match(html, /href="\.\.\/assets\/archive-atlas\.css"/);
    assert.match(html, /src="\.\.\/assets\/archive-atlas\.js" defer/);
    assert.match(html, /href="\.\.\/assets\/cursor-shoal\.css"/);
    assert.match(html, /src="\.\.\/assets\/cursor-shoal\.js" defer/);
    assert.match(html, /rel="icon" href="\.\.\/assets\/homepage\/profile-coast-backview\.png" type="image\/png"/);
    assert.doesNotMatch(html, /https?:\/\/(?:fonts|cdn|unpkg|jsdelivr)/i);
  }
  await access(new URL("../assets/homepage/profile-coast-backview.png", import.meta.url));
});

test("learning atlas reflects the 32-note seven-stage manifest and links to real PyTorch destinations", async () => {
  assert.equal(manifest.notes.length, 32);
  assert.equal(manifest.stages.length, 7);
  assert.match(learning, /data-atlas-key="pytorch"[^>]*data-atlas-count="32 篇"[^>]*data-atlas-meta="7 阶段"/);
  assert.match(learning, /data-atlas-title[^>]*aria-live="polite"[^>]*>PyTorch<\/h2>[\s\S]*?data-atlas-count>32 篇<\/strong>[\s\S]*?data-atlas-meta>7 阶段<\/span>/);
  assert.match(learning, /data-atlas-destination[^>]*href="\.\/pytorch\/"/);

  const keys = [...learning.matchAll(/class="atlas-map-node[^>]*data-atlas-key="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(keys, ["pytorch", ...manifest.stages.map((stage) => stage.key)]);

  for (const stage of manifest.stages) {
    const count = manifest.notes.filter((note) => note.stageKey === stage.key).length;
    assert.match(learning, new RegExp(`data-atlas-key="${stage.key}"[^>]*data-atlas-count="${count} 篇"`));
    await access(new URL(`../learning/pytorch/${stage.key}/index.html`, import.meta.url));
    assert.match(learning, new RegExp(`data-atlas-key="${stage.key}"[^>]*data-atlas-href="\\.\\/pytorch\\/${stage.key}\\/"`));
  }
  await access(new URL("../learning/pytorch/index.html", import.meta.url));
});

test("living and research keep their exact four selectable empty categories without dead links", () => {
  const expected = {
    living: ["长夜微澜", "纸上星河", "山河来信", "岁序留痕"],
    research: ["问题航标", "实验潮汐", "工程舱图", "结论星屿"],
  };

  for (const [pageName, labels] of Object.entries(expected)) {
    const html = pages[pageName];
    const directory = html.match(/<ul (?:class="[^"]*atlas-directory[^"]*"|class="living-directory" data-atlas-directory)[\s\S]*?<\/ul>/)?.[0] ?? "";
    assert.equal((directory.match(/<li\b/g) ?? []).length, 4);
    assert.doesNotMatch(directory, /<a\b|href=|data-atlas-href=/);
    for (const label of labels) {
      assert.match(directory, new RegExp(`<h3>${label}<\/h3>`));
    }
    assert.match(html, /data-atlas-empty[^>]*>尚待启航<\/span>/);
  }
});

test("atlas styling keeps an open chart, narrow glass index, mobile stack, and complete reduced-motion fallback", () => {
  const chart = styles.match(/\.atlas-chart\s*\{[^}]*\}/)?.[0] ?? "";
  const index = styles.match(/\.atlas-index\s*\{[^}]*\}/)?.[0] ?? "";
  const mobile = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const reduced = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(chart, /border:\s*0/);
  assert.match(chart, /box-shadow:\s*none/);
  assert.match(index, /width:\s*min\(/);
  assert.match(index, /backdrop-filter:\s*blur/);
  assert.match(styles, /\.atlas-route\.is-active/);
  assert.match(styles, /\.atlas-(?:map-node|index-button)\.is-dimmed/);
  assert.match(styles, /animation:\s*atlas-drift/);
  assert.match(styles, /--atlas-parallax-x/);
  assert.match(mobile, /\.atlas-layout\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(mobile, /\.atlas-switcher\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(mobile, /\.atlas-chart\s*\{[^}]*order:\s*1/);
  assert.match(mobile, /\.atlas-index\s*\{[^}]*order:\s*2/);
  assert.match(mobile, /\.atlas-layout > \*\s*\{[^}]*min-width:\s*0/);
  assert.match(mobile, /\.atlas-index\s*\{[^}]*max-width:\s*100%/);
  assert.match(reduced, /scroll-behavior:\s*auto/);
  assert.match(reduced, /animation:\s*none !important/);
  assert.match(reduced, /transition:\s*none !important/);
  assert.match(reduced, /transform:\s*none !important/);
  assert.match(reduced, /\.atlas-map-node, \.atlas-map-node\.is-active\s*\{[^}]*transform:\s*translate\(-50%,\s*var\(--atlas-marker-offset-y\)\) !important/);
  assert.match(reduced, /stroke-dashoffset:\s*0/);
  assert.match(styles, /\.atlas-index \.atlas-index-button h3\s*\{[^}]*font-size:\s*13px/);
});

test("dimmed atlas controls preserve readable text while dimming only star decoration", () => {
  const mapDimmed = styles.match(/\.atlas-map-node\.is-dimmed\s*\{[^}]*\}/)?.[0] ?? "";
  const indexDimmed = styles.match(/\.atlas-index-button\.is-dimmed\s*\{[^}]*\}/)?.[0] ?? "";

  assert.doesNotMatch(styles, /\.atlas-control\.is-dimmed\s*\{/);
  assert.doesNotMatch(mapDimmed, /\bopacity\s*:/);
  assert.doesNotMatch(indexDimmed, /\bopacity\s*:/);
  assert.match(styles, /\.atlas-map-node\.is-dimmed::before\s*\{[^}]*border-color:[^}]*background:[^}]*box-shadow:/);
  assert.match(styles, /\.atlas-map-node\.is-dimmed span\s*\{[^}]*color:/);
  assert.match(styles, /\.atlas-index-button\.is-dimmed h3\s*\{[^}]*color:/);
  assert.match(styles, /\.atlas-index-button\.is-dimmed small\s*\{[^}]*color:/);
  assert.match(styles, /\.atlas-control:hover,\s*\.atlas-control:focus-visible\s*\{[^}]*opacity:\s*1/);
});

test("atlas route endpoints and node anchors share one responsive coordinate plane", () => {
  const body = styles.match(/body\.archive-atlas-page\s*\{[^}]*\}/)?.[0] ?? "";
  const shell = styles.match(/\.archive-atlas-page \.library-shell\s*\{[^}]*\}/)?.[0] ?? "";
  const layout = styles.match(/\.atlas-layout\s*\{[^}]*\}/)?.[0] ?? "";
  const chart = styles.match(/\.atlas-chart\s*\{[^}]*\}/)?.[0] ?? "";
  const baseNode = styles.match(/\.atlas-map-node\s*\{[^}]*\}/)?.[0] ?? "";
  const mobileSection = styles.slice(
    styles.indexOf("@media (max-width: 720px)"),
    styles.indexOf("@media (max-width: 420px)"),
  );
  const compactSection = styles.slice(
    styles.indexOf("@media (max-width: 420px)"),
    styles.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  const mobileChart = mobileSection.match(/\.atlas-chart\s*\{[^}]*\}/)?.[0] ?? "";
  const compactChart = compactSection.match(/\.atlas-chart\s*\{[^}]*\}/)?.[0] ?? "";
  const mobileNode = mobileSection.match(/\.atlas-map-node\s*\{[^}]*\}/)?.[0] ?? "";
  const compactNode = compactSection.match(/\.atlas-map-node\s*\{[^}]*\}/)?.[0] ?? "";
  const marker = styles.match(/\.atlas-map-node::before\s*\{[^}]*\}/)?.[0] ?? "";
  const coreNode = styles.match(/\.atlas-map-node\.is-core\s*\{[^}]*\}/)?.[0] ?? "";
  const coreMarker = styles.match(/\.atlas-map-node\.is-core::before\s*\{[^}]*\}/)?.[0] ?? "";
  const baseLabel = styles.match(/\.atlas-map-node span\s*\{[^}]*\}/)?.[0] ?? "";
  const coreLabel = styles.match(/\.atlas-map-node\.is-core span\s*\{[^}]*\}/)?.[0] ?? "";
  const mobileLabel = mobileSection.match(/\.atlas-map-node span\s*\{[^}]*\}/)?.[0] ?? "";
  const compactLabel = compactSection.match(/\.atlas-map-node span\s*\{[^}]*\}/)?.[0] ?? "";
  const compactCoreLabel = compactSection.match(/\.atlas-map-node\.is-core span\s*\{[^}]*\}/)?.[0] ?? "";
  const keyframes = (name) => {
    const start = styles.indexOf(`@keyframes ${name}`);
    const open = styles.indexOf("{", start);
    let depth = 0;
    for (let index = open; index < styles.length; index += 1) {
      if (styles[index] === "{") depth += 1;
      if (styles[index] === "}") depth -= 1;
      if (depth === 0) return styles.slice(open + 1, index);
    }
    return "";
  };
  const driftKeyframes = keyframes("atlas-drift");
  const cssNumber = (rule, property) => Number(rule.match(new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)px`))?.[1]);
  const cssSignedNumber = (rule, property) => Number(rule.match(new RegExp(`${property}:\\s*(-?\\d+(?:\\.\\d+)?)px`))?.[1]);
  const cssUnitless = (rule, property) => Number(rule.match(new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)`))?.[1]);
  const cssMotionOffset = (declarations) => {
    const number = "(-?\\d+(?:\\.\\d+)?)(?:px)?";
    const translate = declarations.match(new RegExp(`\\btranslate:\\s*${number}(?:\\s+${number})?`));
    if (translate) return { x: Number(translate[1]), y: Number(translate[2] ?? 0) };
    const transform = declarations.match(new RegExp(`\\btransform:\\s*translate(?:3d)?\\(\\s*${number}(?:\\s*,?\\s*${number})?`));
    return transform ? { x: Number(transform[1]), y: Number(transform[2] ?? 0) } : { x: 0, y: 0 };
  };

  assert.doesNotMatch(body, /overflow(?:-x)?:\s*hidden/);
  assert.match(styles, /\.atlas-chart\s*\{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(styles, /\.atlas-map-node\[data-atlas-key=/);
  assert.match(shell, /width:\s*min\(1360px,\s*calc\(100% - 48px\)\)/);
  assert.match(layout, /min-height:\s*min\(660px,\s*calc\(100vh - 190px\)\)/);
  assert.match(mobileSection, /\.archive-atlas-page \.library-shell\s*\{[^}]*width:\s*min\(100% - 28px,\s*1360px\)/);
  assert.match(mobileSection, /\.atlas-layout\s*\{[^}]*gap:\s*12px/);

  const animatedMarkerOffsets = [...driftKeyframes.matchAll(/(?:from|to)\s*\{([^}]*)\}/g)]
    .map(([, declarations]) => cssMotionOffset(declarations));
  assert.equal(animatedMarkerOffsets.length, 2, "atlas-drift must expose both animation endpoints");

  const focusInset = 8;
  const activeScale = 1.08;
  const maxNodeParallax = 5 * .22;
  const gap = cssNumber(baseNode, "gap");
  const markerHeight = cssNumber(marker, "height");
  const coreMarkerHeight = cssNumber(coreMarker, "height");
  const lineHeight = cssUnitless(baseLabel, "line-height");
  const baseUsesMarkerOffset = /transform:[^;}]*var\(--atlas-marker-offset-y\)/.test(baseNode);
  const baseUsesMarkerOrigin = /transform-origin:[^;}]*var\(--atlas-marker-origin-y\)/.test(baseNode);
  const chartForViewport = (width, height) => {
    const mobile = width <= 720;
    const compact = width <= 420;
    const shellWidth = Math.min(1360, width - (mobile ? 28 : 48));
    const gap = mobile ? 12 : width <= 1024 ? 18 : Math.min(44, Math.max(20, width * .03));
    const chartWidth = mobile ? shellWidth : shellWidth - (width <= 1024 ? 260 : 300) - gap;
    const chartMinHeight = compact ? cssNumber(compactChart, "min-height")
      : mobile ? cssNumber(mobileChart, "min-height")
      : width <= 1024 ? cssNumber(styles.match(/@media \(max-width: 1024px\)\s*\{[\s\S]*?\.atlas-chart\s*\{[^}]*\}/)?.[0] ?? "", "min-height")
      : cssNumber(chart, "min-height");
    const layoutMinHeight = Math.min(660, height - 190);
    return {
      chartWidth,
      chartHeight: mobile ? chartMinHeight : Math.max(chartMinHeight, layoutMinHeight),
      nodeWidth: cssNumber(compact ? compactNode : mobile ? mobileNode : baseNode, "width"),
      safeX: cssNumber(compact ? compactChart : mobile ? mobileChart : chart, "--atlas-node-safe-x"),
      fontSize: cssNumber(compact ? compactLabel : mobile ? mobileLabel : baseLabel, "font-size"),
      coreFontSize: cssNumber(compact ? compactCoreLabel : coreLabel, "font-size"),
    };
  };
  const responsiveCases = [
    { viewport: "1440x900", width: 1440, height: 900 },
    { viewport: "1024x768", width: 1024, height: 768 },
    { viewport: "720x900", width: 720, height: 900 },
    { viewport: "320x568", width: 320, height: 568 },
  ].map(({ viewport, width, height }) => ({ viewport, ...chartForViewport(width, height) }));

  assert.match(styles, /\.atlas-map-node\.is-active\s*\{[^}]*scale\(1\.08\)/);
  assert.match(styles, /\.atlas-control:focus-visible::after\s*\{[^}]*inset:\s*-8px/);
  let worstMiss = { distance: 0, label: "" };
  for (const { viewport, chartWidth, chartHeight, nodeWidth, safeX, fontSize, coreFontSize } of responsiveCases) {
    assert.ok(Number.isFinite(nodeWidth));
    assert.ok(Number.isFinite(safeX));
    for (const [pageName, html] of Object.entries(pages)) {
      const viewBox = html.match(/<svg class="atlas-routes"[^>]*viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"[^>]*>/);
      assert.ok(viewBox, `${pageName} has no parseable atlas viewBox`);
      const viewWidth = Number(viewBox[1]);
      const viewHeight = Number(viewBox[2]);
      const preserveNone = /preserveAspectRatio="none"/.test(viewBox[0]);
      const coordinatePlane = /<div class="atlas-coordinate-plane">[\s\S]*?<svg class="atlas-routes"[\s\S]*?<button class="atlas-map-node[\s\S]*?<\/div>/.test(html);
      const nodes = new Map([...html.matchAll(/<button class="(atlas-map-node[^"]*)" style="[^"]*--node-x:\s*(\d+(?:\.\d+)?)%;\s*--node-y:\s*(\d+(?:\.\d+)?)%"[^>]*data-atlas-key="([^"]+)"/g)]
        .map((match) => [match[4], {
          x: Number(match[2]) / 100,
          y: Number(match[3]) / 100,
          active: match[1].split(/\s+/).includes("is-active"),
          core: match[1].split(/\s+/).includes("is-core"),
        }]));
      const routes = [...html.matchAll(/<path class="atlas-route[^"]*" data-atlas-route="([^"]+)" d="([^"]+)"/g)];

      for (const [, key, data] of routes) {
        const node = nodes.get(key);
        assert.ok(node, `${pageName}:${key} has no matching node`);
        const numbers = [...data.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
        const endpoint = { x: numbers.at(-2), y: numbers.at(-1) };
        let routeX;
        let routeY;
        let nodeX;
        if (coordinatePlane && preserveNone) {
          const planeWidth = chartWidth - 2 * safeX;
          routeX = safeX + endpoint.x / viewWidth * planeWidth;
          routeY = endpoint.y / viewHeight * chartHeight;
          nodeX = safeX + node.x * planeWidth;
        } else {
          const svg = { x: chartWidth * .01, y: chartHeight * .02, width: chartWidth * .98, height: chartHeight * .97 };
          const scale = Math.min(svg.width / viewWidth, svg.height / viewHeight);
          routeX = svg.x + (svg.width - viewWidth * scale) / 2 + endpoint.x * scale;
          routeY = svg.y + (svg.height - viewHeight * scale) / 2 + endpoint.y * scale;
          nodeX = Math.max(safeX, Math.min(chartWidth - safeX, node.x * chartWidth));
        }
        const currentMarkerHeight = node.core ? coreMarkerHeight : markerHeight;
        const currentFontSize = node.core ? coreFontSize : fontSize;
        const minimumButtonHeight = currentMarkerHeight + gap + currentFontSize * lineHeight;
        const configuredOffset = cssSignedNumber(node.core ? coreNode : baseNode, "--atlas-marker-offset-y");
        const configuredOrigin = cssNumber(node.core ? coreNode : baseNode, "--atlas-marker-origin-y");
        const translateY = baseUsesMarkerOffset && Number.isFinite(configuredOffset)
          ? configuredOffset
          : -minimumButtonHeight / 2;
        const transformOriginY = baseUsesMarkerOrigin && Number.isFinite(configuredOrigin)
          ? configuredOrigin
          : minimumButtonHeight / 2;
        const scale = node.active ? activeScale : 1;
        const markerCenterY = node.y * chartHeight
          + transformOriginY
          + scale * (currentMarkerHeight / 2 - transformOriginY)
          + translateY;
        for (const { x: animationX, y: animationY } of animatedMarkerOffsets) {
          const distance = Math.hypot(routeX - nodeX - animationX, routeY - markerCenterY - animationY);
          if (distance > worstMiss.distance) {
            worstMiss = { distance, label: `${viewport} ${pageName}:${key} animated by ${animationX},${animationY}` };
          }
        }

        const focusLeft = nodeX - ((nodeWidth + focusInset * 2) * activeScale) / 2 - maxNodeParallax;
        const focusRight = nodeX + ((nodeWidth + focusInset * 2) * activeScale) / 2 + maxNodeParallax;
        assert.ok(focusLeft >= 0, `${viewport} ${pageName}:${key} focus left edge ${focusLeft}px escapes the chart`);
        assert.ok(focusRight <= chartWidth, `${viewport} ${pageName}:${key} focus right edge ${focusRight}px exceeds the chart`);
      }
    }
  }
  assert.ok(worstMiss.distance <= 1, `${worstMiss.label} route misses its node by ${worstMiss.distance.toFixed(1)}px`);
  assert.match(driftKeyframes, /(?:opacity|box-shadow|background|scale)\s*:/, "atlas-drift must retain a center-safe visual pulse");
});

class FakeElement {
  constructor({ key = "", count = "", meta = "", description = "", href = "" } = {}) {
    this.dataset = { atlasKey: key, atlasCount: count, atlasMeta: meta, atlasDescription: description };
    if (href) this.dataset.atlasHref = href;
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = "";
    this.style = { values: new Map(), setProperty: (name, value) => this.style.values.set(name, String(value)) };
    const classes = new Set();
    this.classList = {
      add: (...tokens) => tokens.forEach((token) => classes.add(token)),
      remove: (...tokens) => tokens.forEach((token) => classes.delete(token)),
      toggle: (token, force) => {
        const enabled = force === undefined ? !classes.has(token) : force;
        if (enabled) classes.add(token); else classes.delete(token);
        return enabled;
      },
      contains: (token) => classes.has(token),
    };
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatch(type, event = {}) {
    const payload = { type, target: this, preventDefault() { this.defaultPrevented = true; }, ...event };
    this.listeners.get(type)?.forEach((listener) => listener(payload));
    return payload;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

function createAtlasRuntime({ reducedMotion = false } = {}) {
  const root = new FakeElement();
  const map = new FakeElement();
  const pytorchMap = new FakeElement({ key: "pytorch", count: "32 篇", meta: "7 阶段", description: "完整学习航线", href: "./pytorch/" });
  const pytorchIndex = new FakeElement({ key: "pytorch", count: "32 篇", meta: "7 阶段", description: "完整学习航线", href: "./pytorch/" });
  const stageMap = new FakeElement({ key: "stage-1", count: "4 篇", meta: "阶段 1", description: "Tensor 与自动微分", href: "./pytorch/stage-1/" });
  const stageIndex = new FakeElement({ key: "stage-1", count: "4 篇", meta: "阶段 1", description: "Tensor 与自动微分", href: "./pytorch/stage-1/" });
  const emptyMap = new FakeElement({ key: "empty", count: "0 篇", meta: "未收录", description: "等待新的记录" });
  const controls = [pytorchMap, pytorchIndex, stageMap, stageIndex, emptyMap];
  const routes = ["pytorch", "stage-1", "empty"].map((key) => {
    const route = new FakeElement();
    route.dataset.atlasRoute = key;
    return route;
  });
  const title = new FakeElement();
  const count = new FakeElement();
  const meta = new FakeElement();
  const description = new FakeElement();
  const destination = new FakeElement();
  const empty = new FakeElement();
  const selectorMap = new Map([
    ["[data-atlas-root]", root],
    ["[data-atlas-map]", map],
    ["[data-atlas-title]", title],
    ["[data-atlas-title]:not([data-atlas-control])", title],
    ["[data-atlas-count]", count],
    ["[data-atlas-count]:not([data-atlas-control])", count],
    ["[data-atlas-meta]", meta],
    ["[data-atlas-meta]:not([data-atlas-control])", meta],
    ["[data-atlas-description]", description],
    ["[data-atlas-description]:not([data-atlas-control])", description],
    ["[data-atlas-destination]", destination],
    ["[data-atlas-empty]", empty],
  ]);
  const document = {
    documentElement: new FakeElement(),
    querySelector(selector) {
      if (["[data-atlas-title]", "[data-atlas-count]", "[data-atlas-meta]", "[data-atlas-description]"].includes(selector)) return controls[0];
      return selectorMap.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-atlas-control]") return controls;
      if (selector === "[data-atlas-route]") return routes;
      return [];
    },
  };
  const motionQuery = { matches: reducedMotion, addEventListener() {} };
  const navigations = [];
  const window = {
    matchMedia: () => motionQuery,
    location: { assign(href) { navigations.push(href); } },
  };
  return { controls, count, description, destination, document, empty, map, meta, navigations, root, routes, title, window };
}

test("mouse, focus, Enter, Space, and touch clicks converge on one selected atlas state", () => {
  const runtime = createAtlasRuntime();
  vm.runInNewContext(script, runtime);
  const [pytorchMap, pytorchIndex, stageMap, stageIndex, emptyMap] = runtime.controls;

  assert.equal(runtime.root.dataset.atlasSelected, "pytorch");
  assert.equal(runtime.count.textContent, "32 篇");
  assert.equal(runtime.meta.textContent, "7 阶段");
  assert.equal(runtime.destination.getAttribute("href"), "./pytorch/");
  assert.equal(pytorchMap.getAttribute("aria-pressed"), "true");
  assert.equal(pytorchIndex.getAttribute("aria-pressed"), "true");

  stageMap.dispatch("pointerenter", { pointerType: "mouse" });
  assert.equal(runtime.root.dataset.atlasSelected, "stage-1");
  assert.equal(runtime.count.textContent, "4 篇");
  assert.equal(stageIndex.getAttribute("aria-pressed"), "true");
  assert.equal(pytorchMap.classList.contains("is-dimmed"), true);
  assert.equal(runtime.routes[1].classList.contains("is-active"), true);

  pytorchIndex.dispatch("focus");
  assert.equal(runtime.root.dataset.atlasSelected, "pytorch");
  const enter = stageIndex.dispatch("keydown", { key: "Enter" });
  assert.equal(enter.defaultPrevented, true);
  assert.equal(runtime.root.dataset.atlasSelected, "stage-1");
  assert.deepEqual(runtime.navigations, ["./pytorch/stage-1/"]);
  const space = emptyMap.dispatch("keydown", { key: " " });
  assert.equal(space.defaultPrevented, true);
  assert.equal(runtime.root.dataset.atlasSelected, "empty");
  assert.equal(runtime.empty.hidden, false);
  assert.equal(runtime.empty.textContent, "尚待启航");
  assert.equal(runtime.destination.hidden, true);
  assert.equal(runtime.destination.getAttribute("href"), null);
  assert.deepEqual(runtime.navigations, ["./pytorch/stage-1/"], "empty nodes remain selectable without navigating");

  pytorchMap.dispatch("click", { pointerType: "touch" });
  assert.equal(runtime.root.dataset.atlasSelected, "pytorch");
});

test("parallax is capability-gated and reduced motion never registers it", () => {
  const standard = createAtlasRuntime();
  vm.runInNewContext(script, standard);
  assert.ok(standard.map.listeners.has("pointermove"));
  standard.map.dispatch("pointermove", { clientX: 80, clientY: 20 });
  assert.notEqual(standard.map.style.values.get("--atlas-parallax-x"), undefined);

  const reduced = createAtlasRuntime({ reducedMotion: true });
  vm.runInNewContext(script, reduced);
  assert.equal(reduced.document.documentElement.dataset.atlasReducedMotion, "true");
  assert.equal(reduced.map.listeners.has("pointermove"), false);
});
