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

const rule = (source, selector) => source.match(new RegExp(String.raw`${selector}\s*\{[^}]*\}`))?.[0] ?? "";
const cssPx = (source, property) => Number(source.match(new RegExp(String.raw`${property}:\s*(-?\d+(?:\.\d+)?)px`))?.[1]);
const cssDeclarations = (source) => source.split(";").flatMap((declaration) => {
  const separator = declaration.indexOf(":");
  if (separator < 0) return [];
  const property = declaration.slice(0, separator).trim().toLowerCase();
  const value = declaration.slice(separator + 1).trim();
  return property && value ? [{ property, value }] : [];
});
const cssDeclarationValue = (source, property) => cssDeclarations(
  source.includes("{") ? source.slice(source.indexOf("{") + 1, source.lastIndexOf("}")) : source,
)
  .filter((declaration) => declaration.property === property.toLowerCase())
  .at(-1)?.value;
const cssColor = (value) => {
  const variable = value?.trim().match(/^var\((--[\w-]+)\)$/);
  if (variable) return cssColor(cssDeclarationValue(rule(styles, ":root"), variable[1]));
  const hex = value?.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const normalized = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)).concat(1);
  }
  const functional = value?.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (functional) return functional.slice(1, 4).map(Number).concat(functional[4] === undefined ? 1 : Number(functional[4]));
  throw new Error(`unparseable CSS color: ${value}`);
};
const cssColors = (value) => [...value.matchAll(/#[\da-f]{3,6}\b|rgba?\([^)]*\)/gi)].map(([color]) => cssColor(color));
const compositeColor = (foreground, background) => [
  ...foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3])),
  1,
];
const relativeLuminance = (color) => {
  const [red, green, blue] = color.slice(0, 3).map((channel) => {
    const normalized = channel / 255;
    return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  });
  return .2126 * red + .7152 * green + .0722 * blue;
};
const contrastRatio = (left, right) => {
  const luminances = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (luminances[0] + .05) / (luminances[1] + .05);
};
const saturateColor = (color, amount) => {
  const matrix = [
    [.213 + .787 * amount, .715 - .715 * amount, .072 - .072 * amount],
    [.213 - .213 * amount, .715 + .285 * amount, .072 - .072 * amount],
    [.213 - .213 * amount, .715 - .715 * amount, .072 + .928 * amount],
  ];
  return matrix.map((row) => Math.min(255, Math.max(0, row.reduce(
    (sum, factor, index) => sum + factor * color[index],
    0,
  )))).concat(1);
};
const positionalGeometryProperties = new Set([
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "inset-block",
  "inset-block-start",
  "inset-block-end",
  "inset-inline",
  "inset-inline-start",
  "inset-inline-end",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "transform",
  "transform-origin",
  "translate",
  "rotate",
  "scale",
  "offset",
  "offset-path",
  "offset-distance",
  "offset-position",
  "offset-anchor",
  "offset-rotate",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "box-sizing",
  "border",
  "border-width",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "display",
  "grid",
  "grid-template",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-flow",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-column",
  "grid-row",
  "grid-area",
  "gap",
  "row-gap",
  "column-gap",
  "justify-items",
  "justify-content",
  "justify-self",
  "align-items",
  "align-content",
  "align-self",
  "place-items",
  "place-content",
  "place-self",
  "--node-x",
  "--node-y",
  "--atlas-marker-offset-y",
  "--atlas-marker-origin-y",
]);
const isProtectedGeometryProperty = (selector, property) => (
  positionalGeometryProperties.has(property)
  && !(selector === ".atlas-map-node" && property === "width")
);
const cssBlockContains = (source, prefix, index) => {
  const start = source.indexOf(prefix);
  if (start < 0) return false;
  const open = source.indexOf("{", start + prefix.length);
  let depth = 0;
  for (let cursor = open; cursor < source.length; cursor += 1) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}" && --depth === 0) return index > open && index < cursor;
  }
  return false;
};
const isSafeSharedGeometryOverride = (source, index, selectors, selector, { property, value }) => {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (
    property !== "transform"
    || !cssBlockContains(source, "@media (prefers-reduced-motion: reduce)", index)
  ) return false;
  const signature = selectors.join(", ");
  if (selector === ".atlas-routes") {
    return signature === ".atlas-chart::before, .atlas-routes, .atlas-index-button.is-active"
      && normalized === "none !important";
  }
  if (selector === ".atlas-map-node" || selector === ".atlas-map-node.is-active") {
    return signature === ".atlas-map-node, .atlas-map-node.is-active"
      && normalized === "translate(-50%, var(--atlas-marker-offset-y)) !important";
  }
  return false;
};
const protectedRule = (source, selector, properties) => {
  const protectedProperties = new Set(properties);
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const candidates = [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((match) => {
    const selectors = match[1].split(",").map((branch) => branch.trim());
    if (!selectors.includes(selector)) return [];
    const declarations = cssDeclarations(match[2]);
    const geometry = declarations.filter(({ property }) => (
      protectedProperties.has(property) || isProtectedGeometryProperty(selector, property)
    ));
    if (!geometry.length) return [];
    if (selectors.length > 1) {
      for (const declaration of geometry) {
        if (
          !protectedProperties.has(declaration.property)
          || !isSafeSharedGeometryOverride(uncommented, match.index, selectors, selector, declaration)
        ) {
          assert.fail(`${selector} must not declare unprotected geometry property ${declaration.property} in a selector list`);
        }
      }
      return [];
    }
    return [{ body: match[2], declarations }];
  });
  assert.equal(candidates.length, 1, `${selector} must have one canonical protected rule`);
  for (const { property } of candidates[0].declarations) {
    if (isProtectedGeometryProperty(selector, property) && !protectedProperties.has(property)) {
      assert.fail(`${selector} must not declare unprotected geometry property ${property}`);
    }
  }
  for (const property of properties) {
    assert.equal(
      candidates[0].declarations.filter((declaration) => declaration.property === property).length,
      1,
      `${selector} must declare protected ${property} exactly once`,
    );
  }
  return `${selector} {${candidates[0].body}}`;
};
const keyframes = (source, name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const definitions = [...source.matchAll(new RegExp(`@keyframes\\s+${escapedName}\\s*\\{`, "g"))];
  assert.equal(definitions.length, 1, `${name} must have exactly one definition`);
  const open = definitions[0].index + definitions[0][0].lastIndexOf("{");
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return "";
};

const keyframeDeclarations = (source) => {
  const declarations = new Map();
  for (const declaration of source.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();
    if (!property || !rawValue || /!\s*important\s*$/i.test(rawValue)) continue;
    declarations.set(property, rawValue);
  }
  return declarations;
};
const keyframeOffset = (selector) => {
  const normalized = selector.trim().toLowerCase();
  if (normalized === "from") return 0;
  if (normalized === "to") return 100;
  const match = normalized.match(/^((?:\d+(?:\.\d*)?|\.\d+))%$/);
  if (!match || Number(match[1]) > 100) throw new Error(`unparseable keyframe selector: ${selector}`);
  return Number(match[1]);
};
const markerKeyframeStates = (source) => {
  const frames = new Map();
  for (const [, selectorList, declarationSource] of source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = keyframeDeclarations(declarationSource);
    for (const selector of selectorList.split(",").map((value) => value.trim())) {
      const offset = keyframeOffset(selector);
      const frame = frames.get(offset) ?? { selector, declarations: new Map() };
      for (const [property, value] of declarations) frame.declarations.set(property, value);
      frames.set(offset, frame);
    }
  }
  return [...frames.entries()].sort(([left], [right]) => left - right).map(([, frame]) => {
    for (const [property, value] of frame.declarations) {
      const centerSafe = property === "opacity"
        || (property === "transform" && value.trim().toLowerCase() === "none");
      if (!centerSafe) throw new Error(`unsafe marker keyframe declaration: ${property}: ${value}`);
    }
    return { selector: frame.selector };
  });
};

const atlasParallaxFactors = (source) => {
  const number = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
  const routePattern = new RegExp(`^translate\\(calc\\(var\\(--atlas-parallax-x\\) \\* (${number})\\), calc\\(var\\(--atlas-parallax-y\\) \\* (${number})\\)\\)$`);
  const nodePattern = new RegExp(`^translate\\(calc\\(-50% \\+ var\\(--atlas-parallax-x\\) \\* (${number})\\), calc\\(var\\(--atlas-marker-offset-y\\) \\+ var\\(--atlas-parallax-y\\) \\* (${number})\\)\\)$`);
  const activePattern = new RegExp(`^${nodePattern.source.slice(1, -1)} scale\\((${number})\\)$`);
  const layers = [
    ["routes", protectedRule(source, ".atlas-routes", ["position", "inset", "width", "height", "transform"]), routePattern],
    ["base nodes", protectedRule(source, ".atlas-map-node", [
      "--atlas-marker-offset-y",
      "--atlas-marker-origin-y",
      "--node-x",
      "--node-y",
      "position",
      "top",
      "left",
      "display",
      "justify-items",
      "gap",
      "padding",
      "border",
      "transform",
      "transform-origin",
    ]), nodePattern],
    ["active nodes", protectedRule(source, ".atlas-map-node.is-active", ["transform"]), activePattern],
  ];
  const factors = {};
  for (const [name, ruleSource, pattern] of layers) {
    const transform = ruleSource.match(/\btransform:\s*([^;}]+)/)?.[1].trim() ?? "";
    const match = transform.match(pattern);
    assert.ok(match, `${name} must use the canonical atlas transform`);
    factors[name] = { x: Number(match[1]), y: Number(match[2]) };
    assert.ok(Number.isFinite(factors[name].x) && Number.isFinite(factors[name].y), `${name} parallax factors must be finite`);
    if (name === "active nodes") factors[name].scale = Number(match[3]);
  }
  for (const name of ["base nodes", "active nodes"]) {
    for (const axis of ["x", "y"]) {
      assert.equal(factors[name][axis], factors.routes[axis], `${name} ${axis}-parallax factor must match routes`);
    }
  }
  assert.ok(Number.isFinite(factors["active nodes"].scale), "active node scale must be finite");
  return factors;
};
const atlasMarkerRules = (source) => ({
  baseNode: protectedRule(source, ".atlas-map-node", [
    "--atlas-marker-offset-y",
    "--atlas-marker-origin-y",
    "--node-x",
    "--node-y",
    "position",
    "top",
    "left",
    "display",
    "justify-items",
    "gap",
    "padding",
    "border",
    "transform",
    "transform-origin",
  ]),
  coreMarker: protectedRule(source, ".atlas-map-node.is-core::before", ["width", "height"]),
  coreNode: protectedRule(source, ".atlas-map-node.is-core", ["--atlas-marker-offset-y", "--atlas-marker-origin-y"]),
  marker: protectedRule(source, ".atlas-map-node::before", ["box-sizing", "width", "height", "border", "animation"]),
});

const htmlAttribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find((value) => value !== undefined);
const atlasCoordinateGeometry = (html, pageName) => {
  assert.equal((html.match(/class="atlas-coordinate-plane"/g) ?? []).length, 1, `${pageName} must expose exactly one shared atlas coordinate plane`);
  const directPlane = html.match(/<div class="atlas-coordinate-plane">\s*(<svg class="atlas-routes"[\s\S]*?<\/svg>)\s*((?:<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>[\s\S]*?<\/button>\s*)+)<\/div>/);
  assert.ok(directPlane, `${pageName} coordinate plane must be the direct containing block for routes and every node`);
  const routeLayer = directPlane[1];
  const nodeMarkup = directPlane[2];
  assert.equal((html.match(/<svg class="atlas-routes"/g) ?? []).length, 1, `${pageName} must expose exactly one atlas route layer`);
  const viewBox = (htmlAttribute(routeLayer, "viewBox") ?? "").match(/^0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$/);
  assert.ok(viewBox, `${pageName} coordinate plane has no parseable route viewBox`);
  assert.equal(htmlAttribute(routeLayer, "preserveAspectRatio"), "none", `${pageName} routes must stretch with their shared plane`);

  const directNodes = [...nodeMarkup.matchAll(/<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>[\s\S]*?<\/button>/g)].map(([tag]) => tag);
  assert.equal(directNodes.length, (html.match(/class="[^"]*\batlas-map-node\b/g) ?? []).length, `${pageName} coordinate plane must directly contain every node`);
  const nodes = new Map(directNodes.map((tag) => {
    const key = htmlAttribute(tag, "data-atlas-key");
    const anchor = (htmlAttribute(tag, "style") ?? "").match(/^--node-x:\s*(\d+(?:\.\d+)?)%;\s*--node-y:\s*(\d+(?:\.\d+)?)%$/);
    assert.ok(key, `${pageName} node has no atlas key`);
    assert.ok(anchor, `${pageName}:${key} has no canonical percentage anchor`);
    return [key, { x: Number(anchor[1]) / 100, y: Number(anchor[2]) / 100 }];
  }));
  assert.equal(nodes.size, directNodes.length, `${pageName} nodes must have unique keys`);

  const routes = [...routeLayer.matchAll(/<path class="[^"]*\batlas-route\b[^"]*"[^>]*data-atlas-route="([^"]+)"[^>]*d="([^"]+)"/g)];
  const routeKeys = routes.map((route) => route[1]);
  assert.equal(routes.length, nodes.size, `${pageName} must pair every node with one route`);
  assert.equal(new Set(routeKeys).size, routes.length, `${pageName} routes must have unique node keys`);
  assert.deepEqual([...routeKeys].sort(), [...nodes.keys()].sort(), `${pageName} route and node keys must match`);
  return { nodes, routes, viewWidth: Number(viewBox[1]), viewHeight: Number(viewBox[2]) };
};

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

test("active atlas index metadata meets normal-text contrast in the lightest layered background", () => {
  const body = rule(styles, "body\\.archive-atlas-page");
  const stars = rule(styles, "body\\.archive-atlas-page::before");
  const index = rule(styles, "\\.atlas-index");
  const active = rule(styles, "\\.atlas-index-button\\.is-active");
  const defaultSmall = rule(styles, "\\.atlas-index-button small");
  const activeSmall = rule(styles, "\\.atlas-index-button\\.is-active small");
  const bodyColors = cssColors(cssDeclarationValue(body, "background"));
  const bodyBases = bodyColors.filter((color) => color[3] === 1);
  const bodyOverlays = bodyColors.filter((color) => color[3] < 1);
  const starOpacity = Number(cssDeclarationValue(stars, "opacity"));
  const starLayers = cssColors(cssDeclarationValue(stars, "background-image"))
    .map((color) => [...color.slice(0, 3), color[3] * starOpacity]);
  const indexLayers = cssColors(cssDeclarationValue(index, "background"));
  const backdropFilter = cssDeclarationValue(index, "backdrop-filter");
  const blurRadius = Number(backdropFilter?.match(/\bblur\(([\d.]+)px\)/)?.[1]);
  const saturation = Number(backdropFilter?.match(/\bsaturate\(([\d.]+)%\)/)?.[1]) / 100;
  const activeBackground = cssColor(cssDeclarationValue(active, "background"));
  const activeText = cssColor(
    cssDeclarationValue(activeSmall, "color") ?? cssDeclarationValue(defaultSmall, "color"),
  );

  assert.ok(bodyBases.length > 0, "body background must expose an opaque base color");
  assert.ok(bodyOverlays.length > 0, "body background must expose its translucent atmospheric layers");
  assert.ok(starLayers.length > 0 && Number.isFinite(starOpacity), "body star backdrop must expose colors and opacity");
  assert.ok(indexLayers.length > 0, "index glass must expose parseable background layers");
  assert.ok(blurRadius > 0 && Number.isFinite(saturation), "index backdrop filter must expose blur and saturation");

  const ratios = bodyBases.map((base) => {
    let background = base;
    for (const layer of [...bodyOverlays].reverse()) background = compositeColor(layer, background);
    for (const layer of [...starLayers].reverse()) background = compositeColor(layer, background);
    background = saturateColor(background, saturation);
    for (const layer of [...indexLayers].reverse()) background = compositeColor(layer, background);
    background = compositeColor(activeBackground, background);
    return contrastRatio(compositeColor(activeText, background), background);
  });
  const worstContrast = Math.min(...ratios);

  assert.ok(worstContrast >= 4.5, `active 9px metadata contrast ${worstContrast.toFixed(2)} must be at least 4.5:1`);
  assert.match(activeSmall, /\bcolor\s*:/, "active metadata must keep an explicit selected-state color");
});

test("normal marker keyframes evaluate cascade winners with a center-safe allowlist", () => {
  const fixture = `
    from { transform: translateX(8px); transform: none; opacity: .68; }
    50% { opacity: .84; }
    to { opacity: 1; }
  `;

  assert.deepEqual(markerKeyframeStates(fixture), [
    { selector: "from" },
    { selector: "50%" },
    { selector: "to" },
  ]);
});

for (const [name, declaration] of [
  ["individual scale", "scale: 1.2"],
  ["transform origin", "transform-origin: 0 0"],
  ["offset path", 'offset-path: path("M0 0 L10 10")'],
  ["offset distance", "offset-distance: 50%"],
  ["scale combined with translation", "transform: translateX(0) scale(1.2)"],
  ["unknown property", "--marker-shift: 10px"],
]) {
  test(`normal marker keyframes reject ${name}`, () => {
    assert.throws(
      () => markerKeyframeStates(`from { ${declaration}; } to { opacity: 1; }`),
      /unsafe marker keyframe declaration/,
    );
  });
}

test("normal marker keyframes reject an unsupported winning transform", () => {
  assert.throws(
    () => markerKeyframeStates("from { transform: none; transform: translateX(1px); } to { opacity: 1; }"),
    /unsafe marker keyframe declaration/,
  );
});

test("atlas drift contract rejects a later same-name keyframe definition", () => {
  const unsafeWinner = `${styles}\n@keyframes atlas-drift { from { transform: translateX(8px); } to { opacity: 1; } }`;

  assert.throws(
    () => keyframes(unsafeWinner, "atlas-drift"),
    /atlas-drift must have exactly one definition/,
  );
});

test("shared coordinate-plane guard rejects the former separate full-chart SVG model", () => {
  const plane = learning.match(/<div class="atlas-coordinate-plane">([\s\S]*?)<\/div>/);
  assert.ok(plane);
  const separateSvgAndNodes = learning
    .replace(plane[0], plane[1])
    .replace(' preserveAspectRatio="none"', "");

  assert.throws(
    () => atlasCoordinateGeometry(separateSvgAndNodes, "historical separate model"),
    /exactly one shared atlas coordinate plane/,
  );
});

test("shared coordinate-plane guard requires a one-to-one route/node key mapping", () => {
  const duplicateRouteKey = learning.replace('data-atlas-route="foundation"', 'data-atlas-route="pytorch"');

  assert.throws(
    () => atlasCoordinateGeometry(duplicateRouteKey, "duplicate route fixture"),
    /routes must have unique node keys/,
  );
});

test("shared coordinate-plane guard rejects an intervening positioned wrapper", () => {
  const positionedWrapper = learning
    .replace('<div class="atlas-coordinate-plane">', '<div class="atlas-coordinate-plane"><div style="position: relative">')
    .replace("        </div>\n      </div>\n\n      <aside", "        </div></div>\n      </div>\n\n      <aside");

  assert.throws(
    () => atlasCoordinateGeometry(positionedWrapper, "positioned wrapper fixture"),
    /coordinate plane must be the direct containing block/,
  );
});

test("atlas parallax contract rejects missing and divergent active factors", () => {
  const active = rule(styles, "\\.atlas-map-node\\.is-active");
  const divergent = styles.replace(active, active.replace("--atlas-parallax-x) * .22", "--atlas-parallax-x) * .31"));
  const missing = styles.replace(active, active.replace("var(--atlas-parallax-y)", "var(--missing-parallax-y)"));

  assert.throws(() => atlasParallaxFactors(divergent), /active nodes x-parallax factor must match routes/);
  assert.throws(() => atlasParallaxFactors(missing), /active nodes must use the canonical atlas transform/);
});

test("atlas parallax contract rejects later active transform declarations and rules", () => {
  const active = rule(styles, "\\.atlas-map-node\\.is-active");
  const laterDeclaration = styles.replace(active, active.replace(/\s*\}$/, " transform: translateX(12px); }"));
  const laterActive = `${styles}\n.atlas-map-node.is-active { transform: translateX(12px); }`;

  assert.throws(
    () => atlasParallaxFactors(laterDeclaration),
    /.atlas-map-node.is-active must declare protected transform exactly once/,
  );
  assert.throws(
    () => atlasParallaxFactors(laterActive),
    /.atlas-map-node.is-active must have one canonical protected rule/,
  );
});

test("atlas parallax contract rejects an immediately adjacent active transform override", () => {
  const active = rule(styles, "\\.atlas-map-node\\.is-active");
  const adjacentActive = styles.replace(active, `${active}.atlas-map-node.is-active { transform: translateX(12px); }`);

  assert.throws(
    () => atlasParallaxFactors(adjacentActive),
    /.atlas-map-node.is-active must have one canonical protected rule/,
  );
});

test("atlas protected geometry contract rejects an unlisted active positional override", () => {
  const positionalOverride = `${styles}\n.atlas-map-node.is-active { top: calc(var(--node-y) + 12px); }`;

  assert.throws(
    () => atlasParallaxFactors(positionalOverride),
    /.atlas-map-node.is-active must have one canonical protected rule/,
  );
});

for (const [name, override] of [
  ["active sizing", ".atlas-map-node.is-active { width: 300px; }"],
  ["selector-list positioning", ".fixture, .atlas-map-node.is-active { top: calc(var(--node-y) + 12px); }"],
  ["active marker alignment", ".atlas-map-node.is-active { justify-items: start; }"],
]) {
  test(`atlas protected geometry contract rejects ${name} overrides`, () => {
    assert.throws(
      () => atlasParallaxFactors(`${styles}\n${override}`),
      /atlas-map-node.is-active.*(?:canonical protected rule|unprotected geometry property)/,
    );
  });
}

test("atlas parallax contract rejects a responsive base transform override", () => {
  const responsiveOverride = `${styles}\n@media (max-width: 720px) { .atlas-map-node { transform: translateX(12px); } }`;

  assert.throws(
    () => atlasParallaxFactors(responsiveOverride),
    /.atlas-map-node must have one canonical protected rule/,
  );
});

test("atlas marker contract rejects a tablet marker-offset override", () => {
  const tabletOffset = `${styles}\n@media (max-width: 1024px) { .atlas-map-node { --atlas-marker-offset-y: -8px; } }`;

  assert.throws(
    () => atlasMarkerRules(tabletOffset),
    /.atlas-map-node must have one canonical protected rule/,
  );
});

test("atlas marker contract rejects a later content-box override", () => {
  const contentBox = `${styles}\n.atlas-map-node::before { box-sizing: content-box; }`;

  assert.throws(
    () => atlasMarkerRules(contentBox),
    /.atlas-map-node::before must have one canonical protected rule/,
  );
});

test("atlas marker contract rejects an immediately adjacent content-box override", () => {
  const marker = rule(styles, "\\.atlas-map-node::before");
  const adjacentContentBox = styles.replace(marker, `${marker}.atlas-map-node::before { box-sizing: content-box; }`);

  assert.throws(
    () => atlasMarkerRules(adjacentContentBox),
    /.atlas-map-node::before must have one canonical protected rule/,
  );
});

test("atlas routes and marker centers share a size-independent coordinate plane", () => {
  const body = styles.match(/body\.archive-atlas-page\s*\{[^}]*\}/)?.[0] ?? "";
  const shell = styles.match(/\.archive-atlas-page \.library-shell\s*\{[^}]*\}/)?.[0] ?? "";
  const layout = styles.match(/\.atlas-layout\s*\{[^}]*\}/)?.[0] ?? "";
  const chart = rule(styles, "\\.atlas-chart");
  const coordinatePlane = protectedRule(styles, ".atlas-coordinate-plane", ["position", "inset"]);
  const routeLayer = protectedRule(styles, ".atlas-routes", ["position", "inset", "width", "height", "transform"]);
  const mobileSection = styles.slice(
    styles.indexOf("@media (max-width: 720px)"),
    styles.indexOf("@media (max-width: 420px)"),
  );
  const compactSection = styles.slice(
    styles.indexOf("@media (max-width: 420px)"),
    styles.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  const mobileChart = rule(mobileSection, "\\.atlas-chart");
  const compactChart = rule(compactSection, "\\.atlas-chart");
  const mobileNode = rule(mobileSection, "\\.atlas-map-node");
  const compactNode = rule(compactSection, "\\.atlas-map-node");
  const { baseNode, marker, coreNode, coreMarker } = atlasMarkerRules(styles);
  const focusRing = rule(styles, "\\.atlas-control:focus-visible::after");
  const driftKeyframes = keyframes(styles, "atlas-drift");
  const parallax = atlasParallaxFactors(styles);

  assert.doesNotMatch(body, /overflow(?:-x)?:\s*hidden/);
  assert.match(styles, /\.atlas-chart\s*\{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(styles, /\.atlas-map-node\[data-atlas-key=/);
  assert.match(shell, /width:\s*min\(1360px,\s*calc\(100% - 48px\)\)/);
  assert.match(layout, /min-height:\s*min\(660px,\s*calc\(100vh - 190px\)\)/);
  assert.match(mobileSection, /\.archive-atlas-page \.library-shell\s*\{[^}]*width:\s*min\(100% - 28px,\s*1360px\)/);
  assert.match(mobileSection, /\.atlas-layout\s*\{[^}]*gap:\s*12px/);
  assert.match(coordinatePlane, /position:\s*absolute/);
  assert.match(coordinatePlane, /inset:\s*0 var\(--atlas-node-safe-x\)/);
  assert.match(routeLayer, /position:\s*absolute/);
  assert.match(routeLayer, /inset:\s*0/);
  assert.match(routeLayer, /width:\s*100%/);
  assert.match(routeLayer, /height:\s*100%/);
  assert.match(baseNode, /position:\s*absolute/);
  assert.match(baseNode, /top:\s*var\(--node-y\)/);
  assert.match(baseNode, /left:\s*var\(--node-x\)/);
  assert.match(baseNode, /justify-items:\s*center/);
  assert.match(baseNode, /padding:\s*0/);
  assert.match(baseNode, /border:\s*0/);
  assert.match(baseNode, /transform-origin:\s*50% var\(--atlas-marker-origin-y\)/);
  assert.match(marker, /box-sizing:\s*border-box/);
  assert.match(marker, /animation:\s*atlas-drift\b/);

  const animatedMarkerOffsets = markerKeyframeStates(driftKeyframes);
  assert.ok(animatedMarkerOffsets.length >= 2, "atlas-drift must expose start/end states and may add intermediates");
  assert.ok(animatedMarkerOffsets.some(({ selector }) => selector === "from" || selector === "0%"), "atlas-drift has no start state");
  assert.ok(animatedMarkerOffsets.some(({ selector }) => selector === "to" || selector === "100%"), "atlas-drift has no end state");

  for (const [pageName, html] of Object.entries(pages)) {
    const { nodes, routes, viewWidth, viewHeight } = atlasCoordinateGeometry(html, pageName);
    for (const [, key, data] of routes) {
      const node = nodes.get(key);
      assert.ok(node, `${pageName}:${key} has no matching node`);
      const numbers = [...data.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
      const routeX = numbers.at(-2) / viewWidth;
      const routeY = numbers.at(-1) / viewHeight;
      assert.ok(Math.abs(routeX - node.x) <= 1e-12, `${pageName}:${key} route/node x coordinates diverge`);
      assert.ok(Math.abs(routeY - node.y) <= 1e-12, `${pageName}:${key} route/node y coordinates diverge`);
    }
  }

  const activeScale = parallax["active nodes"].scale;
  const markerVariants = [
    { name: "base", node: baseNode, marker, expected: { width: 9, height: 9, offset: -4.5, origin: 4.5 } },
    { name: "core", node: coreNode, marker: coreMarker, expected: { width: 15, height: 15, offset: -7.5, origin: 7.5 } },
  ];
  const markerBorderWidth = cssPx(marker, "border");
  assert.equal(markerBorderWidth, 1, "atlas markers must keep the fixed 1px border used by every viewport");
  assert.equal(activeScale, 1.08, "atlas markers must keep the fixed active scale used by every viewport");
  for (const variant of markerVariants) {
    const actual = {
      width: cssPx(variant.marker, "width"),
      height: cssPx(variant.marker, "height"),
      offset: cssPx(variant.node, "--atlas-marker-offset-y"),
      origin: cssPx(variant.node, "--atlas-marker-origin-y"),
    };
    assert.deepEqual(actual, variant.expected, `${variant.name} marker must keep its fixed cross-viewport geometry`);
    for (const viewport of ["desktop", "tablet", "mobile", "compact"]) {
      for (const scale of [1, activeScale]) {
        for (const { selector } of animatedMarkerOffsets) {
          const centerY = variant.expected.offset
            + variant.expected.origin
            + scale * (variant.expected.height / 2 - variant.expected.origin);
          const miss = Math.abs(centerY);
          assert.ok(miss <= 1, `${viewport} ${variant.name} marker misses its route by ${miss.toFixed(2)}px at ${selector} with scale ${scale}`);
        }
      }
    }
  }

  const focusInset = Math.abs(cssPx(focusRing, "inset"));
  const pointerSpan = Number(script.match(/const x = [^;]*\*\s*(\d+(?:\.\d+)?)\s*;/)?.[1]);
  const maxNodeParallax = pointerSpan / 2 * parallax["base nodes"].x;
  for (const [name, activeChart, activeNodeRule] of [
    ["desktop", chart, baseNode],
    ["mobile", mobileChart, mobileNode],
    ["compact", compactChart, compactNode],
  ]) {
    const safeX = cssPx(activeChart, "--atlas-node-safe-x");
    const nodeWidth = cssPx(activeNodeRule, "width");
    const minimumSafeX = (nodeWidth + focusInset * 2) * activeScale / 2 + maxNodeParallax;
    assert.ok([safeX, nodeWidth, focusInset, maxNodeParallax].every(Number.isFinite), `${name} focus geometry is incomplete`);
    assert.ok(safeX >= minimumSafeX, `${name} focus ring can escape the chart at the coordinate-plane edge`);
  }

  assert.match(driftKeyframes, /opacity\s*:/, "atlas-drift must retain its center-safe opacity pulse");
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
