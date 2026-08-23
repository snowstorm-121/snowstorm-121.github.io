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

const identityTransform = () => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];
const multiplyTransforms = (left, right) => {
  const product = Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let index = 0; index < 4; index += 1) {
        product[row * 4 + column] += left[row * 4 + index] * right[index * 4 + column];
      }
    }
  }
  return product;
};
const translationTransform = (x = 0, y = 0, z = 0) => [
  1, 0, 0, x,
  0, 1, 0, y,
  0, 0, 1, z,
  0, 0, 0, 1,
];
class UnsupportedMotionSyntax extends Error {}
const unsupportedMotionSyntax = (value) => new UnsupportedMotionSyntax(`unsupported keyframe motion syntax: ${value}`);
const cssNumber = (value, context) => {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    throw new Error(`unparseable ${context} value: ${value}`);
  }
  return Number(value);
};
const cssLength = (value, context) => {
  const match = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px)?$/i);
  if (!match) {
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:%|[a-z]+)$/i.test(value)
      || /^(?:calc|min|max|clamp|var|env)\(/i.test(value)) {
      throw unsupportedMotionSyntax(`${context}(${value})`);
    }
    throw new Error(`unparseable ${context} value: ${value}`);
  }
  if (!match[2] && Number(match[1]) !== 0) throw new Error(`unparseable ${context} value: ${value}`);
  return Number(match[1]);
};
const transformArguments = (source) => source.split(",").map((value) => value.trim());
const unsupportedTransformFunctions = new Set([
  "perspective", "rotate", "rotate3d", "rotatex", "rotatey", "rotatez",
  "scale", "scale3d", "scalex", "scaley", "scalez", "skew", "skewx", "skewy", "translatez",
]);
const cssWideKeywords = new Set(["inherit", "initial", "revert", "revert-layer", "unset"]);
const rejectCssWideMotion = (source) => {
  if (cssWideKeywords.has(source.trim().toLowerCase())) throw unsupportedMotionSyntax(source);
};
const translateLonghand = (source) => {
  rejectCssWideMotion(source);
  if (source.trim().toLowerCase() === "none") return identityTransform();
  if (source.includes(",")) throw new Error(`unparseable translate value: ${source}`);
  const values = source.trim().split(/\s+/).filter(Boolean);
  if (values.length < 1 || values.length > 3) throw new Error(`unparseable translate value: ${source}`);
  return translationTransform(...values.map((value) => cssLength(value, "translate")));
};
const transformFunction = (name, source) => {
  const values = transformArguments(source);
  const lengths = () => values.map((value) => cssLength(value, name));
  if (name === "translate" && values.length >= 1 && values.length <= 2) {
    const [x, y = 0] = lengths();
    return translationTransform(x, y);
  }
  if (name === "translatex" && values.length === 1) return translationTransform(lengths()[0]);
  if (name === "translatey" && values.length === 1) return translationTransform(0, lengths()[0]);
  if (name === "translate3d" && values.length === 3) return translationTransform(...lengths());
  if (name === "matrix" && values.length === 6) {
    const [a, b, c, d, e, f] = values.map((value) => cssNumber(value, name));
    return [
      a, c, 0, e,
      b, d, 0, f,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }
  if (name === "matrix3d" && values.length === 16) {
    const columns = values.map((value) => cssNumber(value, name));
    return Array.from({ length: 16 }, (_, index) => columns[(index % 4) * 4 + Math.floor(index / 4)]);
  }
  if (unsupportedTransformFunctions.has(name)) throw unsupportedMotionSyntax(`${name}(${source})`);
  throw new Error(`unsupported transform function: ${name}(${source})`);
};
const transformList = (source = "none") => {
  rejectCssWideMotion(source);
  if (source.trim().toLowerCase() === "none") return identityTransform();
  if (/\b(?:calc|min|max|clamp|var|env)\s*\(/i.test(source)) throw unsupportedMotionSyntax(source);
  const pattern = /([a-z][\w-]*)\s*\(([^()]*)\)/gi;
  let transform = identityTransform();
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    if (source.slice(cursor, match.index).trim()) throw new Error(`unparseable transform value: ${source}`);
    transform = multiplyTransforms(transform, transformFunction(match[1].toLowerCase(), match[2]));
    cursor = match.index + match[0].length;
  }
  if (cursor === 0 || source.slice(cursor).trim()) throw new Error(`unparseable transform value: ${source}`);
  return transform;
};
const motionDeclarationMap = (source) => {
  const declarations = new Map();
  for (const declaration of source.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (!["translate", "transform"].includes(property) || /!\s*important\s*$/i.test(value)) continue;
    try {
      const parsed = property === "translate" ? translateLonghand(value) : transformList(value);
      declarations.set(property, parsed);
    } catch (error) {
      if (error instanceof UnsupportedMotionSyntax) throw error;
      // Invalid CSS declarations do not displace an earlier valid declaration.
    }
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
const keyframeMotionStates = (source) => {
  const frames = new Map();
  const keyframes = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectorList, declarationSource] of keyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = motionDeclarationMap(declarationSource);
    for (const selector of selectorList.split(",").map((value) => value.trim())) {
      const offset = keyframeOffset(selector);
      const frame = frames.get(offset) ?? { selector, declarations: new Map() };
      for (const [property, value] of declarations) frame.declarations.set(property, value);
      frames.set(offset, frame);
    }
  }
  return [...frames.entries()].sort(([left], [right]) => left - right).map(([, frame]) => {
    const longhand = frame.declarations.get("translate") ?? identityTransform();
    const transform = multiplyTransforms(longhand, frame.declarations.get("transform") ?? identityTransform());
    const divisor = transform[15];
    if (!divisor) throw new Error("keyframe transform maps its center to infinity");
    return { selector: frame.selector, x: transform[3] / divisor, y: transform[7] / divisor };
  });
};

const atlasCoordinateGeometry = (html, pageName) => {
  const planes = [...html.matchAll(/<div class="atlas-coordinate-plane">([\s\S]*?)<\/div>/g)];
  assert.equal(planes.length, 1, `${pageName} must expose exactly one shared atlas coordinate plane`);
  const plane = planes[0][1];
  const svg = plane.match(/<svg class="atlas-routes"[^>]*>/)?.[0] ?? "";
  const viewBox = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  assert.ok(viewBox, `${pageName} coordinate plane has no parseable route viewBox`);
  assert.match(svg, /preserveAspectRatio="none"/, `${pageName} routes must stretch with their shared plane`);

  const nodes = new Map([...plane.matchAll(/<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*style="([^"]*)"[^>]*data-atlas-key="([^"]+)"/g)].map((match) => {
    const x = Number(match[1].match(/--node-x:\s*(\d+(?:\.\d+)?)%/)?.[1]);
    const y = Number(match[1].match(/--node-y:\s*(\d+(?:\.\d+)?)%/)?.[1]);
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `${pageName}:${match[2]} has no percentage anchor`);
    return [match[2], { x: x / 100, y: y / 100 }];
  }));
  const routes = [...plane.matchAll(/<path class="[^"]*\batlas-route\b[^"]*"[^>]*data-atlas-route="([^"]+)"[^>]*d="([^"]+)"/g)];
  const allNodeCount = (html.match(/class="[^"]*\batlas-map-node\b/g) ?? []).length;
  const routeKeys = routes.map((route) => route[1]);
  assert.equal(nodes.size, allNodeCount, `${pageName} nodes must all be children of the shared coordinate plane`);
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

test("keyframe motion honors cascade-last declarations across named and comma-separated states", () => {
  const fixture = `
    from, 12.5% {
      translate: 90px 80px;
      translate: 1px 2px;
      transform: translateX(70px);
      transform: translateX(3px) translateY(-4px);
    }
  `;

  assert.deepEqual(keyframeMotionStates(fixture), [
    { selector: "from", x: 4, y: -2 },
    { selector: "12.5%", x: 4, y: -2 },
  ]);
});

test("keyframe motion resolves every supported translation syntax across arbitrary states", () => {
  const fixture = `
    from { transform: translate(1px, 2px); }
    25% { transform: translateX(3px) translateY(4px); }
    50% { transform: translate3d(5px, 6px, 0); }
    75% { transform: matrix(1, 0, 0, 1, 7, 8); }
    to { transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 9, 10, 0, 1); }
  `;

  assert.deepEqual(keyframeMotionStates(fixture), [
    { selector: "from", x: 1, y: 2 },
    { selector: "25%", x: 3, y: 4 },
    { selector: "50%", x: 5, y: 6 },
    { selector: "75%", x: 7, y: 8 },
    { selector: "to", x: 9, y: 10 },
  ]);
});

test("keyframe motion supports none and three-value translate longhand states", () => {
  const fixture = "from { translate: none; } 50% { translate: 1px 2px 3px; } to { translate: 4px; }";

  assert.deepEqual(keyframeMotionStates(fixture), [
    { selector: "from", x: 0, y: 0 },
    { selector: "50%", x: 1, y: 2 },
    { selector: "to", x: 4, y: 0 },
  ]);
});

test("keyframe motion merges cascading declarations at equivalent offsets", () => {
  const fixture = `
    from { translate: 1px; }
    0%, 50% { transform: translateX(2px); }
    50% { translate: 3px 4px; }
    to { translate: 5px; }
    100% { transform: translateY(6px); }
  `;

  assert.deepEqual(keyframeMotionStates(fixture), [
    { selector: "from", x: 3, y: 0 },
    { selector: "50%", x: 5, y: 4 },
    { selector: "to", x: 5, y: 6 },
  ]);
});

test("keyframe motion ignores important and invalid later declarations", () => {
  const fixture = `
    from {
      translate: 1px 2px;
      translate: 90px !important;
      transform: translateX(3px);
      transform: translate(8px 9px);
    }
    to { transform: translate3d(4px 5px 0); }
  `;

  assert.deepEqual(keyframeMotionStates(fixture), [
    { selector: "from", x: 4, y: 2 },
    { selector: "to", x: 0, y: 0 },
  ]);
});

test("keyframe motion fails closed for valid motion outside its pixel translation contract", () => {
  for (const fixture of [
    "from { transform: translateX(100%); } to { opacity: 1; }",
    "from { transform: translateX(2px) scale(1); } to { opacity: 1; }",
    "from { transform: inherit; } to { opacity: 1; }",
    "from { translate: 1em; } to { opacity: 1; }",
    "from { translate: revert-layer; } to { opacity: 1; }",
  ]) {
    assert.throws(() => keyframeMotionStates(fixture), /unsupported keyframe motion syntax/);
  }
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

test("atlas routes and marker centers share a size-independent coordinate plane", () => {
  const body = styles.match(/body\.archive-atlas-page\s*\{[^}]*\}/)?.[0] ?? "";
  const shell = styles.match(/\.archive-atlas-page \.library-shell\s*\{[^}]*\}/)?.[0] ?? "";
  const layout = styles.match(/\.atlas-layout\s*\{[^}]*\}/)?.[0] ?? "";
  const chart = rule(styles, "\\.atlas-chart");
  const coordinatePlane = rule(styles, "\\.atlas-coordinate-plane");
  const routeLayer = rule(styles, "\\.atlas-routes");
  const baseNode = rule(styles, "\\.atlas-map-node");
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
  const marker = rule(styles, "\\.atlas-map-node::before");
  const coreNode = rule(styles, "\\.atlas-map-node\\.is-core");
  const coreMarker = rule(styles, "\\.atlas-map-node\\.is-core::before");
  const activeNode = rule(styles, "\\.atlas-map-node\\.is-active");
  const focusRing = rule(styles, "\\.atlas-control:focus-visible::after");
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
  const parallaxFactor = (source, axis) => Number(source.match(new RegExp(`--atlas-parallax-${axis}\\)\\s*\\*\\s*(\\d*\\.?\\d+)`))?.[1]);

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
  assert.match(baseNode, /transform:[^;}]*calc\(-50% \+ var\(--atlas-parallax-x\)/);
  assert.match(baseNode, /transform:[^;}]*var\(--atlas-marker-offset-y\)/);
  assert.match(baseNode, /transform-origin:[^;}]*var\(--atlas-marker-origin-y\)/);
  assert.match(activeNode, /transform:[^;}]*calc\(-50% \+ var\(--atlas-parallax-x\)/);
  assert.match(activeNode, /transform:[^;}]*var\(--atlas-marker-offset-y\)/);
  assert.match(styles, /\*\s*\{[^}]*box-sizing:\s*border-box/);
  for (const axis of ["x", "y"]) {
    assert.equal(parallaxFactor(routeLayer, axis), parallaxFactor(baseNode, axis), `${axis}-parallax must preserve route/node coincidence`);
  }

  const animatedMarkerOffsets = keyframeMotionStates(driftKeyframes);
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

  const activeScale = Number(activeNode.match(/scale\((\d+(?:\.\d+)?)\)/)?.[1]);
  const markerVariants = [
    { name: "base", node: baseNode, marker },
    { name: "core", node: coreNode, marker: coreMarker },
  ];
  const markerBorderWidth = cssPx(marker, "border");
  const markerUsesBorderBox = /box-sizing:\s*border-box/.test(marker);
  for (const variant of markerVariants) {
    const markerHeight = cssPx(variant.marker, "height");
    const markerOffset = cssPx(variant.node, "--atlas-marker-offset-y");
    const markerOrigin = cssPx(variant.node, "--atlas-marker-origin-y");
    const markerBoxHeight = markerHeight + (markerUsesBorderBox ? 0 : markerBorderWidth * 2);
    assert.ok([markerBoxHeight, markerOffset, markerOrigin, activeScale].every(Number.isFinite), `${variant.name} marker contract is incomplete`);
    for (const scale of [1, activeScale]) {
      for (const { selector, x, y } of animatedMarkerOffsets) {
        const centerY = markerOffset + markerOrigin + scale * (markerBoxHeight / 2 + y - markerOrigin);
        const miss = Math.hypot(scale * x, centerY);
        assert.ok(miss <= 1, `${variant.name} marker misses its route by ${miss.toFixed(2)}px at ${selector} with scale ${scale}`);
      }
    }
  }

  const focusInset = Math.abs(cssPx(focusRing, "inset"));
  const pointerSpan = Number(script.match(/const x = [^;]*\*\s*(\d+(?:\.\d+)?)\s*;/)?.[1]);
  const maxNodeParallax = pointerSpan / 2 * parallaxFactor(baseNode, "x");
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
