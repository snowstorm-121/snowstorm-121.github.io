import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import vm from "node:vm";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [learning, living, research, styles, script, manifestSource, relationsSource] = await Promise.all([
  readFile(new URL("../learning/index.html", import.meta.url), "utf8"),
  readFile(new URL("../living/index.html", import.meta.url), "utf8"),
  readFile(new URL("../research/index.html", import.meta.url), "utf8"),
  readOptional("../assets/archive-atlas.css"),
  readOptional("../assets/archive-atlas.js"),
  readFile(new URL("../learning/pytorch/manifest.json", import.meta.url), "utf8"),
  readFile(new URL("../learning/pytorch/atlas-relations.json", import.meta.url), "utf8"),
]);
const pages = { learning, living, research };
const manifest = JSON.parse(manifestSource);
const publishedRelations = JSON.parse(relationsSource);
const validRelations = {
  ...publishedRelations,
  references: [
    { from: publishedRelations.notes[0].id, to: publishedRelations.notes[4].id },
    { from: publishedRelations.notes[4].id, to: publishedRelations.notes[6].id },
    { from: publishedRelations.notes[8].id, to: publishedRelations.notes[4].id },
  ],
};
const directReferences = (relations, noteId) => relations.references
  .map((edge, index) => ({ edge, id: String(index) }))
  .filter(({ edge }) => edge.from === noteId || edge.to === noteId)
  .map(({ id }) => id)
  .join(",");

const rule = (source, selector) => source.match(new RegExp(String.raw`${selector}\s*\{[^}]*\}`))?.[0] ?? "";
const cssDeclarations = (source) => source.split(";").flatMap((declaration) => {
  const separator = declaration.indexOf(":");
  if (separator < 0) return [];
  const property = declaration.slice(0, separator).trim().toLowerCase();
  const rawValue = declaration.slice(separator + 1).trim();
  const important = /!\s*important\s*$/i.test(rawValue);
  const value = rawValue.replace(/!\s*important\s*$/i, "").trim();
  return property && value ? [{ property, value, important }] : [];
});
const cssDeclarationValue = (source, property) => {
  const candidates = cssDeclarations(
    source.includes("{") ? source.slice(source.indexOf("{") + 1, source.lastIndexOf("}")) : source,
  ).filter((declaration) => declaration.property === property.toLowerCase());
  const important = candidates.filter((declaration) => declaration.important);
  return (important.length ? important : candidates).at(-1)?.value;
};
const cssColor = (value, source = styles) => {
  const variable = value?.trim().match(/^var\((--[\w-]+)\)$/);
  if (variable) return cssColor(cssDeclarationValue(lastRuleInContext(source, ":root"), variable[1]), source);
  const hex = value?.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const normalized = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)).concat(1);
  }
  const functional = value?.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (functional) return functional.slice(1, 4).map(Number).concat(functional[4] === undefined ? 1 : Number(functional[4]));
  throw new Error(`unparseable CSS color: ${value}`);
};
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
const moonSeaMetadataContrast = (source) => {
  const value = cssCascadeDeclarationValue(source, ".atlas-index-description", "color");
  const globalVeil = compositeColor(cssColor("rgba(3, 7, 19, .30)"), [255, 255, 255, 1]);
  const surface = compositeColor(cssColor("rgba(3, 7, 19, .76)"), globalVeil);
  return contrastRatio(cssColor(value, source), surface);
};
const assertMoonSeaMetadataContrast = (source) => {
  assert.ok(moonSeaMetadataContrast(source) >= 4.5, "moon-sea metadata contrast must remain at least 4.5:1");
};
const normalizeCss = (source) => source.replace(/\s+/g, " ").trim();
const closingBrace = (source, open) => {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return index;
  }
  throw new Error("unclosed CSS block");
};
const cssRuleRecords = (source) => {
  const records = [];
  const parse = (scope, context = "base") => {
    let cursor = 0;
    while (cursor < scope.length) {
      const open = scope.indexOf("{", cursor);
      if (open < 0) break;
      const header = normalizeCss(scope.slice(cursor, open));
      const close = closingBrace(scope, open);
      const body = scope.slice(open + 1, close);
      if (/^@(?:-[\w]+-)?keyframes\b/i.test(header)) {
        records.push({ kind: "keyframes", context, selector: header, body: normalizeCss(body) });
      } else if (/^@(?:media|supports|container|layer|scope|starting-style)\b/i.test(header)) {
        const nestedContext = context === "base" ? header : `${context} > ${header}`;
        parse(body, nestedContext);
      } else if (header.startsWith("@")) {
        records.push({ kind: "at-rule", context, selector: header, body: normalizeCss(body) });
      } else if (header) {
        if (body.includes("{")) {
          throw new Error("nested CSS rules are unsupported by the atlas closed-world parser");
        }
        records.push({ kind: "rule", context, selector: header, body: normalizeCss(body) });
      }
      cursor = close + 1;
    }
    const tail = normalizeCss(scope.slice(cursor));
    if (tail) records.push({ kind: "statement", context, selector: tail, body: "" });
  };
  parse(source.replace(/\/\*[\s\S]*?\*\//g, ""));
  return records;
};
const lastRuleInContext = (source, selector, context = "base") => {
  const winner = cssRuleRecords(source)
    .filter((record) => record.kind === "rule" && record.context === context && record.selector === selector)
    .at(-1);
  return winner ? `${selector} {${winner.body}}` : "";
};
const cssCascadeDeclarationValue = (source, selector, property, context = "base") => {
  const candidates = cssRuleRecords(source)
    .filter((record) => record.kind === "rule" && record.context === context && record.selector === selector)
    .flatMap((record) => cssDeclarations(record.body))
    .filter((declaration) => declaration.property === property.toLowerCase());
  const important = candidates.filter((declaration) => declaration.important);
  return (important.length ? important : candidates).at(-1)?.value;
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

const htmlAttribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find((value) => value !== undefined);

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
    assert.match(html, /class="atlas-scroll"[^>]*data-atlas-map/);
    assert.match(html, /class="atlas-tide"/);
    assert.match(html, /class="atlas-colophon/);
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

test("atlas tide buttons keep valid phrasing content and an accessible native-button name", () => {
  for (const [pageName, html] of Object.entries(pages)) {
    const buttons = [...html.matchAll(/(<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>)([\s\S]*?)<\/button>/g)];
    assert.ok(buttons.length > 0, `${pageName} must expose atlas tide buttons`);
    for (const [, openingTag, content] of buttons) {
      const title = htmlAttribute(openingTag, "data-atlas-title");
      assert.ok(title, `${pageName} index button must expose its title metadata`);
      assert.match(openingTag, /\saria-pressed="(?:true|false)"/);
      assert.doesNotMatch(content, /<(?:h[1-6]|p)\b/i, `${pageName}:${title} button descendants must be phrasing content`);
      assert.ok(content.includes(`<span class="atlas-index-title">${title}</span>`), `${pageName}:${title} must keep its visible title`);
      assert.match(content, /<span class="atlas-index-description">[^<]+<\/span>/, `${pageName}:${title} must keep its visible description`);
      assert.match(content, /<span class="atlas-node-number">[^<]+<\/span>/, `${pageName}:${title} must keep its visible sequence mark`);
      assert.ok(content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").includes(title), `${pageName}:${title} native accessible name must include its visible title`);
    }
  }
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
    const directory = html.match(/<div class="atlas-tide">[\s\S]*?<\/(?:ol|ul)>[\s\S]*?<\/div>/)?.[0] ?? "";
    assert.equal((directory.match(/<li\b/g) ?? []).length, 4);
    assert.doesNotMatch(directory, /<a\b|href=|data-atlas-href=/);
    for (const label of labels) {
      assert.match(directory, new RegExp(`<span class="atlas-index-title">${label}<\/span>`));
    }
    assert.match(html, /data-atlas-empty[^>]*>尚待启航<\/span>/);
  }
});

test("atlas styling keeps an open scroll, borderless colophon, vertical mobile tide, and reduced-motion fallback", () => {
  const scroll = styles.match(/\.atlas-scroll\s*\{[^}]*\}/)?.[0] ?? "";
  const colophon = styles.match(/\.atlas-colophon\s*\{[^}]*\}/)?.[0] ?? "";
  const mobile = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const reduced = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(scroll, /overflow:\s*visible/);
  assert.match(scroll, /min-height:\s*clamp\(/);
  assert.doesNotMatch(colophon, /\bborder(?:-[\w-]+)?\s*:/);
  assert.match(colophon, /background:\s*transparent/);
  assert.doesNotMatch(styles, /backdrop-filter|atlas-route|atlas-drift|--atlas-parallax/);
  assert.match(styles, /\.atlas-map-node\.is-dimmed/);
  assert.match(styles, /animation:\s*atlas-moon-diffusion\s+240ms/);
  assert.match(styles, /\.archive-atlas-learning[\s\S]*url\("\.\/homepage\/coast-background\.png"\)/);
  assert.doesNotMatch(styles, /\.archive-atlas-learning[\s\S]*archive-moon-sea\.webp/);
  assert.match(mobile, /body\.archive-atlas-page\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(mobile, /\.atlas-tide\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(mobile, /\.atlas-tide-stop\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(mobile, /\.atlas-scroll\s*\{[^}]*overflow:\s*visible/);
  assert.match(mobile, /\.atlas-tide\s*\{[^}]*width:\s*100%/);
  assert.match(mobile, /\.atlas-node-copy,[\s\S]*?position:\s*static/);
  assert.match(mobile, /\.atlas-index-title\s*\{[^}]*font-size:\s*16px/);
  assert.match(reduced, /animation:\s*none !important/);
  assert.match(reduced, /transition:\s*none !important/);
  assert.doesNotMatch(reduced, /requestAnimationFrame|scroll-behavior/);
  assert.match(styles, /\.atlas-index-title\s*\{[^}]*font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /font-size:\s*(?:9|10)px/);
  assert.doesNotMatch(script, /pointermove|--atlas-parallax/);
});

test("dimmed atlas controls preserve readable text while dimming only moon marks", () => {
  const mapDimmed = styles.match(/\.atlas-map-node\.is-dimmed\s*\{[^}]*\}/)?.[0] ?? "";

  assert.doesNotMatch(styles, /\.atlas-control\.is-dimmed\s*\{/);
  assert.doesNotMatch(mapDimmed, /\bopacity\s*:/);
  assert.match(styles, /\.atlas-map-node\.is-dimmed::before\s*\{[^}]*opacity:\s*\.3/);
  assert.match(styles, /\.atlas-map-node\.is-dimmed \.atlas-node-title,[^}]*color:\s*var\(--atlas-ink\)/);
  assert.match(styles, /\.atlas-map-node\.is-dimmed \.atlas-index-title\s*\{[^}]*color:\s*var\(--atlas-ink\)/);
  assert.match(styles, /\.atlas-index-description\s*\{[^}]*color:\s*var\(--atlas-silver\)/);
  assert.match(styles, /\.atlas-map-node:hover::before\s*\{[^}]*opacity:\s*\.94/);
});

test("archive metadata meets normal-text contrast over the brightest possible image pixel", () => {
  const globalVeil = compositeColor(cssColor("rgba(3, 7, 19, .30)"), [255, 255, 255, 1]);
  const brightestSurface = compositeColor(cssColor("rgba(3, 7, 19, .76)"), globalVeil);
  const metadata = cssColor("#d7e2ed");
  const worstContrast = contrastRatio(metadata, brightestSurface);

  assert.ok(worstContrast >= 4.5, `metadata contrast ${worstContrast.toFixed(2)} must be at least 4.5:1 over white`);
  assert.match(rule(styles, "body\\.archive-atlas-page"), /linear-gradient\(rgba\(3, 7, 19, \.30\), rgba\(3, 7, 19, \.30\)\)/);
  assert.match(rule(styles, "\\.atlas-node-copy::before"), /rgba\(3, 7, 19, \.76\)/);
});

test("moon-sea metadata contrast lookup uses the later equal-specificity rule", () => {
  const lowContrastOverride = `${styles}\n.atlas-index-description { color: #071421; }`;
  const worstContrast = moonSeaMetadataContrast(lowContrastOverride);

  assert.ok(worstContrast < 4.5, "the later low-contrast override must win the full layered contrast calculation");
});

test("moon-sea metadata contrast lookup honors important declarations before later normal declarations", () => {
  const lowContrastOverride = `${styles}\n.atlas-index-description { color: #071421 !important; color: var(--atlas-silver); }`;
  const worstContrast = moonSeaMetadataContrast(lowContrastOverride);

  assert.ok(worstContrast < 4.5, "the important low-contrast declaration must win the full layered contrast calculation");
});

test("moon-sea metadata contrast lookup honors earlier important equal-specificity rules", () => {
  const lowContrastOverride = `${styles}\n.atlas-index-description { color: #071421 !important; }\n.atlas-index-description { color: var(--atlas-silver); }`;
  const worstContrast = moonSeaMetadataContrast(lowContrastOverride);

  assert.ok(worstContrast < 4.5, "the earlier important low-contrast rule must beat the later normal rule");
});

test("atlas contrast contract protects moon-sea metadata declarations", () => {
  const metadata = rule(styles, "\\.atlas-index-description");
  const lowContrastMutation = styles.replace(metadata, metadata.replace("var(--atlas-silver)", "#071421"));

  assert.throws(
    () => assertMoonSeaMetadataContrast(lowContrastMutation),
    /moon-sea metadata contrast/,
  );
});

const forbiddenArchiveArtifacts = /atlas-(?:chart|coordinate-plane|routes?|coastline)|is-core|--node-[xy]/i;

for (const [pageName, html] of Object.entries(pages)) {
  test(`${pageName} exposes one ordered tide surface rooted in the shared atlas contract`, () => {
    assert.equal((html.match(/data-atlas-root\b/g) ?? []).length, 1);
    assert.equal((html.match(/data-atlas-map\b/g) ?? []).length, 1);
    assert.equal((html.match(/class="atlas-tide"/g) ?? []).length, 1);
    assert.match(html, /<div class="atlas-tide">\s*<(?:ol|ul)\b/);
    assert.match(html, /<\/(?:ol|ul)>[\s\S]*?<\/div>/);
  });

  test(`${pageName} tide controls keep unique complete selection metadata`, () => {
    const controls = [...html.matchAll(/<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>/g)].map(([tag]) => tag);
    const keys = controls.map((tag) => htmlAttribute(tag, "data-atlas-key"));
    assert.ok(controls.length > 0);
    assert.equal(new Set(keys).size, controls.length);
    for (const tag of controls) {
      assert.equal(htmlAttribute(tag, "type"), "button");
      assert.ok(htmlAttribute(tag, "data-atlas-title"));
      assert.ok(htmlAttribute(tag, "data-atlas-count"));
      assert.ok(htmlAttribute(tag, "data-atlas-meta"));
      assert.ok(htmlAttribute(tag, "data-atlas-description"));
      assert.match(htmlAttribute(tag, "aria-pressed") ?? "", /^(?:true|false)$/);
    }
  });

  test(`${pageName} removes radial markup and per-node coordinate positioning`, () => {
    assert.doesNotMatch(html, forbiddenArchiveArtifacts);
    assert.doesNotMatch(html, /style="[^"]*--node-/);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  });

  test(`${pageName} colophon is labelled and keeps live title plus destination states`, () => {
    const aside = html.match(/<aside class="atlas-colophon" aria-labelledby="([^"]+)">([\s\S]*?)<\/aside>/);
    assert.ok(aside);
    assert.match(aside[2], new RegExp(`id="${aside[1]}"`));
    assert.match(aside[2], /data-atlas-title aria-live="polite"/);
    assert.match(aside[2], /data-atlas-count/);
    assert.match(aside[2], /data-atlas-description/);
    assert.match(aside[2], /data-atlas-destination/);
    assert.match(aside[2], /data-atlas-empty/);
  });
}

test("learning orbit controls expose one center and seven stage roles in manifest order", () => {
  const marks = [...learning.matchAll(/<span class="atlas-node-number">([^<]+)<\/span>/g)].map(([, mark]) => mark);
  assert.deepEqual(marks, ["总览", "00", "01", "02", "03", "04", "05", "06"]);
  assert.equal((learning.match(/class="atlas-tide-stop"/g) ?? []).length, 8);
  assert.equal((learning.match(/data-orbit-role="center"/g) ?? []).length, 1);
  assert.equal((learning.match(/data-orbit-role="stage"/g) ?? []).length, 7);
  assert.doesNotMatch(learning, /atlas-moon-bay/);
  assert.match(styles, /\[data-orbit-role="center"\]/);
  assert.match(styles, /\[data-orbit-role="stage"\]/);
});

test("learning tide counts and destinations remain aligned with the manifest", () => {
  const controls = [...learning.matchAll(/<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>/g)].map(([tag]) => tag);
  const byKey = new Map(controls.map((tag) => [htmlAttribute(tag, "data-atlas-key"), tag]));
  assert.equal(htmlAttribute(byKey.get("pytorch"), "data-atlas-count"), `${manifest.notes.length} 篇`);
  for (const stage of manifest.stages) {
    const tag = byKey.get(stage.key);
    const noteCount = manifest.notes.filter((note) => note.stageKey === stage.key).length;
    assert.ok(tag, `missing learning stop ${stage.key}`);
    assert.equal(htmlAttribute(tag, "data-atlas-count"), `${noteCount} 篇`);
    assert.equal(htmlAttribute(tag, "data-atlas-href"), `./pytorch/${stage.key}/`);
  }
});

test("living tide presents exactly four named moon bays in sequence", () => {
  const marks = [...living.matchAll(/<span class="atlas-node-number">([^<]+)<\/span>/g)].map(([, mark]) => mark);
  assert.deepEqual(marks, ["一湾", "二湾", "三湾", "四湾"]);
  for (const title of ["长夜微澜", "纸上星河", "山河来信", "岁序留痕"]) {
    assert.match(living, new RegExp(`data-atlas-title="${title}"`));
  }
});

test("living archive renders four page-specific quiet bay forms instead of generic tide marks", () => {
  const bay = rule(styles, "\\.archive-atlas-living \\.atlas-map-node::before");
  assert.match(bay, /radial-gradient\(/);
  assert.match(bay, /width:\s*clamp\(/);
  assert.match(bay, /height:\s*clamp\(/);
  assert.doesNotMatch(bay, /width:\s*30px|height:\s*10px/);
  for (let index = 1; index <= 4; index += 1) {
    const placement = rule(
      styles,
      `\\.archive-atlas-living \\.atlas-tide-stop:nth-child\\(${index}\\) \\.atlas-map-node::before`,
    );
    assert.match(placement, /transform:/, `moon bay ${index} needs its own static placement`);
  }
});

test("living moon bays stay selectable while all remain awaiting departure", () => {
  const controls = [...living.matchAll(/<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>/g)].map(([tag]) => tag);
  assert.equal(controls.length, 4);
  for (const tag of controls) {
    assert.equal(htmlAttribute(tag, "data-atlas-count"), "0 篇");
    assert.equal(htmlAttribute(tag, "data-atlas-href"), undefined);
  }
  assert.match(living, /data-atlas-empty[^>]*>尚待启航<\/span>/);
});

test("research tide advances through question experiment engineering and conclusion", () => {
  const progression = [...research.matchAll(/data-atlas-meta="([^"]+)"/g)].map(([, value]) => value);
  assert.deepEqual(progression, ["问题", "实验", "工程", "结论"]);
  const marks = [...research.matchAll(/<span class="atlas-node-number">([^<]+)<\/span>/g)].map(([, mark]) => mark);
  assert.deepEqual(marks, ["一灯", "二灯", "三灯", "四灯"]);
});

test("research beacon marks brighten monotonically from first question to conclusion", () => {
  const opacities = [1, 2, 3, 4].map((index) => {
    const source = rule(styles, `\\.atlas-research-tide \\.atlas-tide-stop:nth-child\\(${index}\\) \\.atlas-map-node::before`);
    return Number(source.match(/opacity:\s*([\d.]+)/)?.[1]);
  });
  assert.deepEqual(opacities, [.38, .55, .72, .9]);
  assert.ok(opacities.every((value, index) => index === 0 || value > opacities[index - 1]));
});

test("moon-sea stylesheet keeps a readable deep-color fallback before image paint", () => {
  const body = rule(styles, "body\\.archive-atlas-page");
  assert.match(body, /background-color:\s*#030713/);
  assert.match(body, /color:\s*var\(--atlas-ink\)/);
  assert.match(body, /min-height:\s*100vh/);
});

test("learning artwork declares a dedicated deep-coast fallback color before the image layers", () => {
  const learningBody = rule(styles, "body\\.archive-atlas-page\\.archive-atlas-learning");
  assert.match(learningBody, /background-color:\s*#07101c/);
  assert.match(learningBody, /url\("\.\/homepage\/coast-background\.png"\)/);
});

test("learning artwork switches to the coast background with restrained deep-blue veils", () => {
  const body = rule(styles, "body\\.archive-atlas-page");
  const learningBody = rule(styles, "body\\.archive-atlas-page\\.archive-atlas-learning");
  const pageVeil = rule(styles, "body\\.archive-atlas-page::before");
  const alpha = Number(learningBody.match(/linear-gradient\(rgba\(3, 7, 19, ([\d.]+)\), rgba\(3, 7, 19, [\d.]+\)\)/)?.[1]);
  const bottomAlpha = Number(pageVeil.match(/linear-gradient\(180deg, rgba\(2, 5, 14, [\d.]+\), rgba\(2, 5, 14, ([\d.]+)\)\)/)?.[1]);
  assert.ok(alpha >= .28 && alpha <= .34, `global moon-sea veil ${alpha} must stay between .28 and .34`);
  assert.ok(bottomAlpha <= .40, `bottom moon-sea veil ${bottomAlpha} must not exceed .40`);
  assert.match(learningBody, /linear-gradient\(90deg, rgba\(3, 7, 19, [\d.]+\), transparent 46%\)/);
  assert.match(learningBody, /url\("\.\/homepage\/coast-background\.png"\)/);
  assert.doesNotMatch(learningBody, /archive-moon-sea\.webp/);
  assert.match(body, /url\("\.\/archive-moon-sea\.webp"\)/);
  assert.match(body, /background-size:\s*cover/);
  assert.match(styles, /\.atlas-prologue::before,[\s\S]*?\.atlas-colophon::before\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /\.atlas-prologue::before\s*\{[^}]*background:\s*(?:radial|linear)-gradient/);
  assert.match(styles, /\.atlas-colophon::before\s*\{[^}]*background:\s*(?:radial|linear)-gradient/);
});

test("moon-sea backdrop scrolls with the document instead of creating CSS parallax", () => {
  assert.match(rule(styles, "body\\.archive-atlas-page"), /background-attachment:\s*scroll/);
});

test("desktop tide uses the declared stop count as an ordered horizontal grid", () => {
  const tide = rule(styles, "\\.atlas-tide");
  assert.match(tide, /grid-template-columns:\s*repeat\(var\(--atlas-stop-count\), minmax\(0, 1fr\)\)/);
  assert.match(tide, /min-height:\s*clamp\(/);
  for (const html of Object.values(pages)) assert.match(html, /style="--atlas-stop-count: (?:4|8)"/);
});

test("desktop learning annotation groups alternate stage number title and count above and below the tide", () => {
  assert.match(styles, /\.atlas-tide-stop:nth-child\(odd\) \.atlas-node-copy\s*\{[^}]*top:/s);
  assert.match(styles, /\.atlas-tide-stop:nth-child\(even\) \.atlas-node-copy\s*\{[^}]*bottom:/s);
  const controls = [...learning.matchAll(/<button class="[^"]*\batlas-map-node\b[^"]*"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(controls.length, 8);
  for (const [, contents] of controls) {
    const groupStart = contents.indexOf('<span class="atlas-node-copy">');
    const groupEnd = contents.lastIndexOf("</span>");
    const number = contents.indexOf('<span class="atlas-node-number">');
    const title = contents.indexOf('<span class="atlas-index-title">');
    const count = contents.indexOf('<span class="atlas-index-description">');
    assert.ok(groupStart >= 0 && number > groupStart && title > groupStart && count > groupStart);
    assert.ok(number < groupEnd && title < groupEnd && count < groupEnd);
  }
});

test("wide atlas composes the tide beside a right-side colophon and stacks at narrower desktop widths", () => {
  const layout = rule(styles, "\\.atlas-layout");
  assert.match(layout, /display:\s*grid/);
  assert.match(layout, /grid-template-columns:\s*minmax\(0, 1fr\)\s+clamp\(/);
  const narrower = styles.match(/@media \(max-width: 1024px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(narrower, /\.atlas-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test("desktop learning orbit uses role-based placement instead of moon-bay shapes", () => {
  const desktopLearning = styles.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(desktopLearning, /data-orbit-role="center"|--orbit-x|--orbit-y/);
  assert.match(styles, /\.atlas-note-scale\s*\{[^}]*width:\s*(?:8|9|10)px/s);
  assert.doesNotMatch(styles, /\.archive-atlas-learning \.atlas-moon-bay::before/);
  assert.doesNotMatch(script, /dataset\.atlasStageEdge/);
});

test("orbit uses the fixed seven-stage slot map", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  assert.equal(typeof runtime.orbitSlotWrites, "function");
  assert.deepEqual(runtime.orbitSlotWrites(), {
    pytorch: { x: 50, y: 50 },
    foundation: { x: 50, y: 16 },
    "stage-1": { x: 72, y: 26 },
    "stage-2": { x: 80, y: 53 },
    "stage-3": { x: 64, y: 79 },
    "stage-4": { x: 37, y: 79 },
    "stage-5": { x: 20, y: 53 },
    "stage-6": { x: 29, y: 24 },
  });
  assert.equal(
    cssCascadeDeclarationValue(styles, '.archive-atlas-learning [data-orbit-role="center"]', "top", "@media (min-width: 721px)"),
    "var(--orbit-y)",
  );
  assert.equal(
    cssCascadeDeclarationValue(styles, '.archive-atlas-learning [data-orbit-role="center"]', "left", "@media (min-width: 721px)"),
    "var(--orbit-x)",
  );
  assert.equal(
    cssCascadeDeclarationValue(styles, '.archive-atlas-learning [data-orbit-role="stage"]', "top", "@media (min-width: 721px)"),
    "var(--orbit-y)",
  );
  assert.equal(
    cssCascadeDeclarationValue(styles, '.archive-atlas-learning [data-orbit-role="stage"]', "left", "@media (min-width: 721px)"),
    "var(--orbit-x)",
  );
});

test("moon marks remain decorative while each full tide stop is clickable", () => {
  const control = rule(styles, "\\.atlas-map-node");
  const mark = rule(styles, "\\.atlas-map-node::before");
  assert.match(control, /width:\s*100%/);
  assert.match(control, /height:\s*100%/);
  assert.match(control, /cursor:\s*pointer/);
  assert.match(mark, /border-radius:\s*58% 42% 55% 45%/);
});

test("unselected nodes dim only their moon marks and preserve title color", () => {
  const dimmedMark = rule(styles, "\\.atlas-map-node\\.is-dimmed::before");
  const dimmedTitle = rule(styles, "\\.atlas-map-node\\.is-dimmed \\.atlas-index-title");
  assert.match(dimmedMark, /opacity:\s*\.3/);
  assert.match(dimmedTitle, /color:\s*var\(--atlas-ink\)/);
  assert.doesNotMatch(rule(styles, "\\.atlas-map-node\\.is-dimmed"), /opacity\s*:/);
});

test("colophon remains borderless and transparent instead of becoming a glass card", () => {
  const colophon = rule(styles, "\\.atlas-colophon");
  assert.match(colophon, /background:\s*transparent/);
  assert.doesNotMatch(colophon, /\bborder(?:-[\w-]+)?\s*:|border-radius|box-shadow|backdrop-filter/);
});

test("keyboard focus uses an external high-contrast outline without clipping", () => {
  const focus = rule(styles, "\\.atlas-map-node:focus-visible");
  assert.match(focus, /outline:\s*2px solid var\(--atlas-gold\)/);
  assert.match(focus, /outline-offset:\s*5px/);
  assert.match(rule(styles, "\\.atlas-scroll"), /overflow:\s*visible/);
});

test("selection diffusion is a single 240ms local animation", () => {
  const selecting = rule(styles, "\\.atlas-map-node\\.is-selecting::after");
  assert.equal(cssDeclarationValue(selecting, "animation"), "atlas-moon-diffusion 240ms ease-out");
  assert.doesNotMatch(selecting, /infinite|alternate/);
});

test("moon diffusion has one outward fading definition", () => {
  const frames = keyframes(styles, "atlas-moon-diffusion");
  assert.match(frames, /from\s*\{[^}]*opacity:\s*\.36[^}]*scale\(\.55\)/s);
  assert.match(frames, /to\s*\{[^}]*opacity:\s*0[^}]*scale\(2\.4\)/s);
});

test("archive styles contain no looping animation declarations", () => {
  const animations = [...styles.matchAll(/animation:\s*([^;\n}]+)/g)].map(([, value]) => value.trim());
  assert.deepEqual(animations, ["atlas-moon-diffusion 240ms ease-out", "atlas-thread-reveal 240ms ease-out", "none !important"]);
  assert.doesNotMatch(styles, /\binfinite\b|\balternate\b/);
});

test("archive implementation contains no radial routes central hub or pointer-driven geometry", () => {
  assert.doesNotMatch(styles, /atlas-(?:chart|coordinate-plane|routes?|coastline|drift)|--atlas-parallax/);
  assert.doesNotMatch(script, /data-atlas-route|--atlas-parallax/);
  assert.doesNotMatch(script, /pointermove[\s\S]*getBoundingClientRect/);
  for (const html of Object.values(pages)) assert.doesNotMatch(html, forbiddenArchiveArtifacts);
});

test("720px layout becomes a single vertical tide without horizontal scroll", () => {
  const mobile = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(mobile, /body\.archive-atlas-page\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(mobile, /\.atlas-tide\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(mobile, /\.atlas-map-node\s*\{[^}]*grid-template-columns:\s*68px minmax\(0, 1fr\)/s);
  assert.doesNotMatch(mobile, /overflow-x:\s*auto|white-space:\s*nowrap/);
});

test("720px typography and focus remain readable at 320px", () => {
  const mobile = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const sizes = [...mobile.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(([, size]) => Number(size));
  assert.ok(sizes.length > 0 && Math.min(...sizes) >= 11);
  assert.match(mobile, /\.atlas-index-title\s*\{[^}]*font-size:\s*16px/);
  assert.match(mobile, /\.atlas-map-node:focus-visible\s*\{[^}]*outline-offset:\s*2px/);
});

test("mobile moon bays fit the vertical tide marker column", () => {
  const livingBay = lastRuleInContext(
    styles,
    ".archive-atlas-living .atlas-map-node::before",
    "@media (max-width: 720px)",
  );
  assert.match(livingBay, /width:\s*54px/);
  assert.match(livingBay, /height:\s*28px/);
  assert.doesNotMatch(styles, /\.archive-atlas-learning \.atlas-moon-bay::before/);
});

test("reduced motion disables diffusion and every transition immediately", () => {
  const reduced = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(reduced, /animation:\s*none !important/);
  assert.match(reduced, /transition:\s*none !important/);
  assert.doesNotMatch(reduced, /transform|scroll-behavior/);
});

test("atlas stylesheet parses as balanced top-level rules", () => {
  const records = cssRuleRecords(styles);
  assert.ok(records.length > 0);
  assert.equal(records.filter(({ kind }) => kind === "statement").length, 0);
});

test("learning alone opts into validated note relations while retaining eight static stage fallbacks", () => {
  assert.equal((learning.match(/class="atlas-tide-stop"/g) ?? []).length, 8);
  assert.match(learning, /data-atlas-map[^>]*data-atlas-relations-url="\.\/pytorch\/atlas-relations\.json"/);
  assert.doesNotMatch(learning, /<div data-atlas-notes><\/div>/);
  assert.match(learning, /<svg class="atlas-threads" aria-hidden="true"><\/svg>/);
  const tide = learning.match(/<div class="atlas-tide">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? "";
  assert.doesNotMatch(tide, /class="atlas-note-scale"|\/notes\//, "article links must only come from validated JSON");
  for (const html of [living, research]) {
    assert.doesNotMatch(html, /data-atlas-relations-url|data-atlas-note-id|atlas-threads|atlas-note-scale/);
  }
});

test("atlas geometry is resize-driven and creates hierarchy lines plus stage routes without pointermove reads", () => {
  assert.match(script, /new ResizeObserver\(scheduleGeometry\)/);
  assert.match(script, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "path"\)/);
  assert.match(script, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "line"\)/);
  assert.match(script, /sequencePaths\s*=\s*relationData\.stages\.slice\(1\)\.map/);
  assert.match(script, /hierarchyPaths\s*=\s*relationData\.stages\.slice\(1\)\.map/);
  assert.doesNotMatch(script, /pointermove[\s\S]*getBoundingClientRect/);
  assert.doesNotMatch(`${script}\n${learning}`, /marker-end|stroke-dasharray/);
  assert.doesNotMatch(script, /cubicTide/);
});

test("thread styling distinguishes hierarchy rays, stage routes, and hidden gold references", () => {
  const hierarchy = rule(styles, String.raw`\.atlas-thread\[data-kind="hierarchy"\]`);
  const sequence = rule(styles, String.raw`\.atlas-thread\[data-kind="sequence"\]`);
  const reference = rule(styles, String.raw`\.atlas-thread\[data-kind="reference"\]`);
  const revealed = rule(styles, String.raw`\.atlas-thread\[data-kind="reference"\]\.is-revealed`);
  assert.match(hierarchy, /stroke:\s*var\(--atlas-gold\)/);
  assert.match(sequence, /stroke:\s*var\(--atlas-silver\)/);
  assert.match(reference, /stroke:\s*var\(--atlas-gold\)/);
  assert.ok(Number(cssDeclarationValue(reference, "stroke-width")?.replace("px", "")) <= 1);
  assert.equal(cssDeclarationValue(reference, "opacity"), "0");
  assert.equal(cssDeclarationValue(revealed, "animation"), "atlas-thread-reveal 240ms ease-out");
  assert.doesNotMatch(`${sequence}\n${reference}\n${revealed}`, /marker|dash|infinite|alternate/);
});

test("mobile learning atlas hides SVG geometry and exposes native relationship links", () => {
  const mobile = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(mobile, /\.atlas-threads\s*\{[^}]*display:\s*none/);
  assert.match(mobile, /\.atlas-note-relations\s*\{[^}]*display:\s*flex/);
  assert.match(script, /引用自/);
  assert.match(script, /延伸至/);
});

test("mobile fallback keeps native note links but skips desktop SVG geometry work", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 320 });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  assert.equal(runtime.noteLinks.length, 32);
  assert.equal(runtime.noteLinks.every((link) => link.tagName === "A"), true);
  assert.equal(runtime.threads.hidden, true);
  assert.equal(runtime.observers.length, 0);
  assert.equal(runtime.requestedFrames, 0);
  assert.equal(runtime.threads.getAttribute("viewBox"), null);
  assert.equal(runtime.notes.children.every((item) => item.style.values.size === 0), true);
});

test("mobile first load draws geometry after expanding to desktop without a map size change", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 320 });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);
  assert.equal(runtime.threads.hidden, true);
  assert.equal(runtime.observers.length, 0, "mobile mount avoids desktop geometry observation");

  runtime.window.innerWidth = 1024;
  runtime.window.dispatch("resize");
  runtime.flushAnimationFrames();
  assert.equal(runtime.threads.hidden, false);
  assert.equal(runtime.observers.length, 1, "desktop map observation begins after expansion");
  assert.match(runtime.threads.getAttribute("viewBox") ?? "", /^0 0 /);
  assert.match(runtime.noteLinks.at(-1).parentNode.style.values.get("--atlas-note-x") ?? "", /px$/);
});

test("desktop geometry hides again when the viewport shrinks to mobile", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 1024 });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);
  assert.equal(runtime.threads.hidden, false);

  runtime.window.innerWidth = 320;
  runtime.window.dispatch("resize");
  runtime.flushAnimationFrames();
  assert.equal(runtime.threads.hidden, true);
  assert.equal(runtime.threads.getAttribute("viewBox"), null);
});

test("mobile DOM order interleaves each stage control with its own article links", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 320 });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  assert.deepEqual(runtime.stageStops.map((stop) => stop.children[0].dataset.atlasKey),
    ["pytorch", "foundation", "stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6"]);
  for (const [index, stage] of validRelations.stages.entries()) {
    const stop = runtime.stageStops[index];
    assert.equal(stop.children[0], runtime.controls[index]);
    const links = stop.children.slice(1).flatMap((group) => group.children.map((item) => item.children[0]));
    assert.deepEqual(links.map((link) => link.dataset.atlasNoteId), stage.noteIds);
    assert.equal(links.every((link) => link.tagName === "A"), true);
  }
});

test("stage-2 article points stay inside a 1024px map after a resize observation", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 1024 });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);
  runtime.controlByKey("stage-2").rect = {
    left: runtime.map.rect.left + runtime.map.rect.width * .8 - 75,
    top: runtime.map.rect.top + 250,
    width: 150,
    height: 36,
  };
  runtime.observers[0].callback();
  runtime.flushAnimationFrames();

  const xPositions = runtime.stageStops[3].children[1].children.map((item) =>
    Number.parseFloat(item.style.values.get("--atlas-note-x")));
  assert.equal(xPositions.length, 5);
  assert.equal(xPositions.every((x, index) => x <= runtime.map.rect.width - 16 && (index === 0 || x > xPositions[index - 1])), true);
});

test("right-edge desktop article labels open toward the map interior", () => {
  const desktop = styles.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(desktop, /\.atlas-note-item\[data-atlas-stage-key="stage-2"\] \.atlas-note-scale::after\s*\{[^}]*right:\s*0/);
  assert.match(desktop, /\.atlas-note-item\[data-atlas-stage-key="stage-2"\] \.atlas-note-scale::after\s*\{[^}]*transform:\s*none/);
});

test("mobile relation failure leaves only the eight keyboard-operable static controls", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json", viewportWidth: 320 });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations({ ...validRelations, version: 2 });
  assert.equal(runtime.root.dataset.atlasRelations, "fallback");
  assert.equal(runtime.stageStops.every((stop) => stop.children.length === 1), true);
  assert.equal(runtime.noteLinks.length, 0);
  runtime.controlByKey("stage-6").dispatch("keydown", { key: "Enter" });
  assert.deepEqual(runtime.navigations, ["./pytorch/stage-6/"]);
});

class FakeElement {
  constructor({ tagName = "div", key = "", count = "", meta = "", description = "", href = "", rect, onClassName } = {}) {
    this.tagName = tagName.toUpperCase();
    this.dataset = { atlasKey: key, atlasCount: count, atlasMeta: meta, atlasDescription: description };
    if (href) this.dataset.atlasHref = href;
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.hidden = false;
    this.href = "";
    this.parentNode = null;
    this.rect = rect ?? { left: 0, top: 0, width: 12, height: 8 };
    this.ownTextContent = "";
    Object.defineProperty(this, "textContent", {
      get: () => this.ownTextContent + this.children.map((child) => child.textContent).join(""),
      set: (value) => { this.ownTextContent = String(value); },
    });
    this.style = { values: new Map(), setProperty: (name, value) => this.style.values.set(name, String(value)) };
    const classes = new Set();
    Object.defineProperty(this, "className", {
      get: () => [...classes].join(" "),
      set: (value) => {
        classes.clear();
        String(value).split(/\s+/).filter(Boolean).forEach((token) => classes.add(token));
        onClassName?.(this, classes);
      },
    });
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
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  replaceChildren(...children) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this.append(...children);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  getBoundingClientRect() { return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height }; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

function createAtlasRuntime({ reducedMotion = false, relationsUrl = "", viewportWidth = 1440 } = {}) {
  const root = new FakeElement();
  const map = new FakeElement({ rect: { left: 100, top: 40, width: 960, height: 500 } });
  if (relationsUrl) map.dataset.atlasRelationsUrl = relationsUrl;
  const threads = new FakeElement({ tagName: "svg" });
  const columnWidth = map.rect.width / 8;
  const bayRect = (index) => ({
    left: map.rect.left + index * columnWidth,
    top: map.rect.top + 28,
    width: columnWidth,
    height: 410,
  });
  const controls = [
    new FakeElement({
      key: "pytorch",
      count: "32 篇",
      meta: "7 阶段",
      description: "完整学习航线",
      href: "./pytorch/",
      rect: bayRect(0),
    }),
    ...manifest.stages.map((stage, index) => new FakeElement({
      key: stage.key,
      count: `${manifest.notes.filter((note) => note.stageKey === stage.key).length} 篇`,
      meta: stage.key === "foundation" ? "基础阶段" : `阶段 ${index}`,
      description: stage.label,
      href: `./pytorch/${stage.key}/`,
      rect: bayRect(index + 1),
    })),
    new FakeElement({ key: "empty", count: "0 篇", meta: "未收录", description: "等待新的记录" }),
  ];
  controls.forEach((control, index) => {
    control.className = "atlas-map-node atlas-control";
    if (index === 0) control.dataset.orbitRole = "center";
    else if (index < controls.length - 1) control.dataset.orbitRole = "stage";
  });
  controls.at(-1).className = "atlas-map-node atlas-control";
  const stageStops = controls.slice(0, 8).map((control) => {
    const stop = new FakeElement({ tagName: "li" });
    stop.appendChild(control);
    control.parentElement = stop;
    return stop;
  });
  const title = new FakeElement();
  const count = new FakeElement();
  const meta = new FakeElement();
  const description = new FakeElement();
  const destination = new FakeElement();
  const empty = new FakeElement();
  const created = [];
  let noteRectIndex = 0;
  const onClassName = (element, classes) => {
    if (!classes.has("atlas-note-scale")) return;
    const index = noteRectIndex++;
    element.rect = {
      left: 132 + (index % 8) * 108,
      top: 178 + (index % 5) * 31,
      width: 14,
      height: 8,
    };
  };
  const makeElement = (tagName) => {
    const element = new FakeElement({ tagName, onClassName });
    created.push(element);
    return element;
  };
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
    [".atlas-threads", threads],
  ]);
  const document = {
    documentElement: new FakeElement(),
    querySelector(selector) {
      if (["[data-atlas-title]", "[data-atlas-count]", "[data-atlas-meta]", "[data-atlas-description]"].includes(selector)) return controls[0];
      return selectorMap.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-atlas-control]") return controls;
      return [];
    },
    createElement(tagName) { return makeElement(tagName); },
    createElementNS(_namespace, tagName) { return makeElement(tagName); },
  };
  const motionQuery = { matches: reducedMotion, addEventListener() {} };
  const navigations = [];
  const windowListeners = new Map();
  const window = {
    innerWidth: viewportWidth,
    matchMedia: () => motionQuery,
    location: { assign(href) { navigations.push(href); } },
    addEventListener(type, listener) { windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]); },
    dispatch(type) { windowListeners.get(type)?.forEach((listener) => listener()); },
  };
  const animationFrames = [];
  let nextFrame = 1;
  let requestedFrames = 0;
  let resolveFetch;
  let rejectFetch;
  const observers = [];
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
  }
  const runtime = {
    controls,
    count,
    description,
    destination,
    document,
    empty,
    map,
    meta,
    navigations,
    get notes() {
      return { children: stageStops.flatMap((stop) => stop.children.slice(1).flatMap((group) => group.children)) };
    },
    observers,
    root,
    stageStops,
    threads,
    title,
    window,
    ResizeObserver,
    controlByKey(key) {
      return this.controls.find((control) => control.dataset.atlasKey === key) ?? null;
    },
    requestAnimationFrame(callback) { requestedFrames += 1; animationFrames.push(callback); return nextFrame++; },
    cancelAnimationFrame() {},
    fetch() {
      return new Promise((resolve, reject) => {
        resolveFetch = resolve;
        rejectFetch = reject;
      });
    },
    get noteLinks() { return created.filter((element) => element.classList.contains("atlas-note-scale")); },
    get svgPaths() { return created.filter((element) => element.tagName === "PATH"); },
    get requestedFrames() { return requestedFrames; },
    flushAnimationFrames() { while (animationFrames.length) animationFrames.shift()(0); },
    orbitPositionByKey(key) {
      const control = this.controlByKey(key);
      if (!control) return null;
      return {
        x: control.style.values.get("--orbit-x") ?? "",
        y: control.style.values.get("--orbit-y") ?? "",
      };
    },
    orbitSlotWrites() {
      return Object.fromEntries(
        controls
          .filter((control) => ["pytorch", "foundation", "stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6"].includes(control.dataset.atlasKey))
          .map((control) => [control.dataset.atlasKey, {
            x: Math.round(Number.parseFloat(control.style.values.get("--orbit-x"))),
            y: Math.round(Number.parseFloat(control.style.values.get("--orbit-y"))),
          }]),
      );
    },
    visibleReferenceIds() {
      return this.svgPaths
        .filter((path) => path.dataset.kind === "reference" && path.classList.contains("is-revealed"))
        .map((path) => path.dataset.referenceId)
        .sort((left, right) => Number(left) - Number(right))
        .join(",");
    },
    async flushRelations(value, { ok = true } = {}) {
      resolveFetch?.({ ok, json: async () => value });
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
      while (animationFrames.length) animationFrames.shift()(0);
      await Promise.resolve();
    },
    async failRelations(error = new Error("network failure")) {
      rejectFetch?.(error);
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    },
  };
  return runtime;
}

test("validated relations mount one center, seven hierarchy rays, seven stage routes, and 32 native note links", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  assert.equal(runtime.root.dataset.atlasRelations, "ready");
  assert.equal(runtime.controlByKey("pytorch").dataset.orbitRole, "center");
  assert.equal(runtime.noteLinks.length, 32);
  assert.equal(runtime.notes.children.length, 32);
  assert.equal(runtime.noteLinks[4].tagName, "A");
  assert.equal(runtime.noteLinks[4].getAttribute("aria-label"), validRelations.notes[4].title);
  assert.equal(runtime.noteLinks[4].href, validRelations.notes[4].href);
  assert.equal(runtime.noteLinks[4].textContent, validRelations.notes[4].title);

  const hierarchyPaths = runtime.threads.children.filter((node) => node.dataset.kind === "hierarchy");
  const sequencePaths = runtime.svgPaths.filter((path) => path.dataset.kind === "sequence");
  const referencePaths = runtime.svgPaths.filter((path) => path.dataset.kind === "reference");
  assert.equal(hierarchyPaths.length, 7);
  assert.equal(sequencePaths.length, validRelations.stages.length - 1);
  assert.equal(referencePaths.length, validRelations.references.length);
  for (const line of hierarchyPaths) {
    for (const name of ["x1", "y1", "x2", "y2"]) assert.match(line.getAttribute(name) ?? "", /^-?\d+(?:\.\d+)?$/);
    assert.equal(line.getAttribute("marker-end"), null);
  }
  for (const path of [...sequencePaths, ...referencePaths]) {
    assert.match(path.getAttribute("d"), /^M\s[-\d.]+\s[-\d.]+(?:\sC\s[-\d.]+\s[-\d.]+,\s[-\d.]+\s[-\d.]+,\s[-\d.]+\s[-\d.]+)+$/);
    assert.equal(path.getAttribute("marker-end"), null);
    assert.equal(path.getAttribute("stroke-dasharray"), null);
  }

  runtime.noteLinks[4].dispatch("focus");
  assert.equal(runtime.visibleReferenceIds(), directReferences(validRelations, runtime.noteLinks[4].dataset.atlasNoteId));
  assert.equal(runtime.root.dataset.atlasSelected, runtime.noteLinks[4].dataset.atlasNoteId);
  assert.equal(runtime.title.textContent, validRelations.notes[4].title);
  assert.equal(runtime.meta.textContent, validRelations.stages.find((stage) => stage.key === validRelations.notes[4].stageKey).label);
  assert.match(runtime.count.textContent, /3 条直连/);
  assert.match(
    runtime.description.textContent,
    new RegExp(`引用自：${validRelations.notes[0].title}.*引用自：${validRelations.notes[8].title}.*延伸至：${validRelations.notes[6].title}`),
  );
  assert.equal(runtime.destination.textContent, "阅读此篇 →");
  assert.equal(runtime.destination.getAttribute("href"), validRelations.notes[4].href);

  runtime.noteLinks[1].dispatch("focus");
  assert.equal(runtime.description.textContent, "此篇暂无直接引文潮丝。");
});

test("stage routes preserve stage noteId order and empty references stay absent", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  const paths = runtime.threads.children.filter((node) => node.dataset.kind === "sequence");
  assert.equal(paths.length, 7);
  for (const [index, path] of paths.entries()) {
    assert.equal(path.dataset.nodeIds, validRelations.stages[index + 1].noteIds.join(","));
  }
  const noReferences = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, noReferences);
  await noReferences.flushRelations({ ...validRelations, references: [] });
  assert.equal(noReferences.threads.children.filter((node) => node.dataset.kind === "reference").length, 0);
});

test("hierarchy rays leave the center control and arrive at the seven stage controls", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  const center = runtime.controlByKey("pytorch").getBoundingClientRect();
  const centerPoint = {
    x: center.left + center.width / 2 - runtime.map.rect.left,
    y: center.top + center.height / 2 - runtime.map.rect.top,
  };
  const lines = runtime.threads.children.filter((node) => node.dataset.kind === "hierarchy");
  assert.equal(lines.length, 7);
  for (const [index, line] of lines.entries()) {
    const stage = runtime.controlByKey(validRelations.stages[index + 1].key).getBoundingClientRect();
    const stagePoint = {
      x: stage.left + stage.width / 2 - runtime.map.rect.left,
      y: stage.top + stage.height / 2 - runtime.map.rect.top,
    };
    assert.equal(Number(line.getAttribute("x1")), Number(centerPoint.x.toFixed(2)));
    assert.equal(Number(line.getAttribute("y1")), Number(centerPoint.y.toFixed(2)));
    assert.equal(Number(line.getAttribute("x2")), Number(stagePoint.x.toFixed(2)));
    assert.equal(Number(line.getAttribute("y2")), Number(stagePoint.y.toFixed(2)));
  }
});

test("article hover and click select locally without intercepting native navigation", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  const touchHover = runtime.noteLinks[2].dispatch("pointerenter", { pointerType: "touch" });
  assert.equal(touchHover.defaultPrevented, undefined);
  assert.notEqual(runtime.root.dataset.atlasSelected, runtime.noteLinks[2].dataset.atlasNoteId);

  const mouseHover = runtime.noteLinks[2].dispatch("pointerenter", { pointerType: "mouse" });
  assert.equal(mouseHover.defaultPrevented, undefined);
  assert.equal(runtime.root.dataset.atlasSelected, runtime.noteLinks[2].dataset.atlasNoteId);

  runtime.controls[2].dispatch("focus");
  const mouseClick = runtime.noteLinks[3].dispatch("click", { pointerType: "mouse" });
  assert.equal(mouseClick.defaultPrevented, undefined);
  assert.equal(runtime.root.dataset.atlasSelected, "stage-1", "mouse click relies on prior hover or focus selection");

  const touchClick = runtime.noteLinks[3].dispatch("click", { pointerType: "touch" });
  assert.equal(touchClick.defaultPrevented, undefined);
  assert.equal(runtime.root.dataset.atlasSelected, runtime.noteLinks[3].dataset.atlasNoteId);
});

test("invalid or unavailable relation JSON leaves the static archive in fallback state", async () => {
  for (const invalid of [
    { version: 2 },
    { ...validRelations, notes: validRelations.notes.slice(0, -1) },
    { ...validRelations, references: [{ from: validRelations.notes[0].id, to: "missing" }] },
  ]) {
    const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
    vm.runInNewContext(script, runtime);
    await runtime.flushRelations(invalid);
    assert.equal(runtime.noteLinks.length, 0);
    assert.equal(runtime.notes.children.length, 0);
    assert.equal(runtime.svgPaths.length, 0);
    assert.equal(runtime.root.dataset.atlasRelations, "fallback");
    assert.ok(runtime.controls.length >= 8, "static stage controls remain available");
  }

  const networkRuntime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, networkRuntime);
  await networkRuntime.failRelations();
  assert.equal(networkRuntime.root.dataset.atlasRelations, "fallback");
  assert.equal(networkRuntime.noteLinks.length, 0);
});

test("reordered note arrays that violate manifest order contract fall back to static atlas controls", async () => {
  const relations = JSON.parse(JSON.stringify(validRelations));
  [relations.notes[3], relations.notes[4]] = [relations.notes[4], relations.notes[3]];

  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(relations);

  assert.equal(runtime.root.dataset.atlasRelations, "fallback");
  assert.equal(runtime.noteLinks.length, 0);
  assert.equal(runtime.notes.children.length, 0);
  assert.equal(runtime.svgPaths.length, 0);
  assert.ok(runtime.controls.length >= 8, "static stage controls remain available");
});

test("reordered stage noteIds that violate manifest order contract fall back to static atlas controls", async () => {
  const relations = JSON.parse(JSON.stringify(validRelations));
  [relations.stages[1].noteIds[0], relations.stages[1].noteIds[1]] = [relations.stages[1].noteIds[1], relations.stages[1].noteIds[0]];

  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(relations);

  assert.equal(runtime.root.dataset.atlasRelations, "fallback");
  assert.equal(runtime.noteLinks.length, 0);
  assert.equal(runtime.notes.children.length, 0);
  assert.equal(runtime.svgPaths.length, 0);
  assert.ok(runtime.controls.length >= 8, "static stage controls remain available");
});

test("untrusted stage schema or note URLs never mount dynamic atlas relations", async () => {
  const cloneRelations = () => JSON.parse(JSON.stringify(validRelations));
  const invalidCases = [
    ["unknown stage key", (relations) => {
      relations.stages[0].key = "untrusted-stage";
      relations.notes[0].stageKey = "untrusted-stage";
    }],
    ["reordered stages", (relations) => {
      [relations.stages[0], relations.stages[1]] = [relations.stages[1], relations.stages[0]];
    }],
    ["untrusted stage href", (relations) => {
      relations.stages[0].href = "https://example.invalid/stage";
    }],
    ["external note href", (relations) => {
      relations.notes[0].href = "https://example.invalid/note.html";
    }],
    ["relative note href", (relations) => {
      relations.notes[0].href = "./notes/overview/pytorch.html";
    }],
    ["non-note public href", (relations) => {
      relations.notes[0].href = "/learning/pytorch/stage-1/";
    }],
  ];

  for (const [name, mutate] of invalidCases) {
    const relations = cloneRelations();
    mutate(relations);
    const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
    vm.runInNewContext(script, runtime);
    await runtime.flushRelations(relations);

    assert.equal(runtime.root.dataset.atlasRelations, "fallback", name);
    assert.equal(runtime.noteLinks.length, 0, `${name}: no dynamic note links`);
    assert.equal(runtime.svgPaths.length, 0, `${name}: no dynamic paths`);
    assert.ok(runtime.controls.length >= 8, `${name}: static controls remain available`);
  }
});

test("mobile relationship copy is rendered as native links sourced from direct references", async () => {
  const runtime = createAtlasRuntime({ relationsUrl: "./pytorch/atlas-relations.json" });
  vm.runInNewContext(script, runtime);
  await runtime.flushRelations(validRelations);

  const relationGroups = runtime.notes.children
    .flatMap((item) => item.children)
    .filter((child) => child.classList.contains("atlas-note-relations"));
  assert.equal(relationGroups.length, 32);
  const linkedGroup = relationGroups[4];
  assert.match(linkedGroup.textContent, /引用自/);
  assert.match(linkedGroup.textContent, /延伸至/);
  assert.ok(linkedGroup.children.every((link) => link.tagName === "A"));
  assert.deepEqual(
    linkedGroup.children.map((link) => link.href),
    [validRelations.notes[0].href, validRelations.notes[8].href, validRelations.notes[6].href],
  );
});

test("selection remains functional when timer globals are unavailable", () => {
  const runtime = createAtlasRuntime();
  vm.runInNewContext(script, runtime);

  assert.doesNotThrow(() => runtime.controlByKey("stage-1").dispatch("pointerenter", { pointerType: "mouse" }));
  assert.equal(runtime.root.dataset.atlasSelected, "stage-1");
  assert.equal(runtime.count.textContent, "4 篇");
});

test("selection diffusion schedules one 240ms cleanup around the selected control", () => {
  const runtime = createAtlasRuntime();
  const scheduled = [];
  runtime.setTimeout = (callback, delay) => {
    scheduled.push({ callback, delay });
    return 0;
  };
  runtime.clearTimeout = () => {};
  vm.runInNewContext(script, runtime);

  runtime.controlByKey("stage-1").dispatch("pointerenter", { pointerType: "mouse" });
  assert.equal(runtime.controlByKey("stage-1").classList.contains("is-selecting"), true);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 240);
  scheduled[0].callback();
  assert.equal(runtime.controlByKey("stage-1").classList.contains("is-selecting"), false);
});

test("public ArchiveAtlas selectNode compatibility entrypoint remains available", () => {
  const runtime = createAtlasRuntime();
  vm.runInNewContext(script, runtime);

  assert.equal(typeof runtime.window.ArchiveAtlas.selectNode, "function");
  assert.equal(runtime.window.ArchiveAtlas.selectNode(runtime.controlByKey("stage-1")), "./pytorch/stage-1/");
  assert.equal(runtime.root.dataset.atlasSelected, "stage-1");
});

test("mouse, focus, Enter, Space, and touch clicks converge on one selected atlas state", () => {
  const runtime = createAtlasRuntime();
  vm.runInNewContext(script, runtime);
  const pytorchMap = runtime.controlByKey("pytorch");
  const stageMap = runtime.controlByKey("stage-1");
  const emptyMap = runtime.controlByKey("empty");

  assert.equal(runtime.root.dataset.atlasSelected, "pytorch");
  assert.equal(runtime.count.textContent, "32 篇");
  assert.equal(runtime.meta.textContent, "7 阶段");
  assert.equal(runtime.destination.getAttribute("href"), "./pytorch/");
  assert.equal(pytorchMap.getAttribute("aria-pressed"), "true");

  stageMap.dispatch("pointerenter", { pointerType: "mouse" });
  assert.equal(runtime.root.dataset.atlasSelected, "stage-1");
  assert.equal(runtime.count.textContent, "4 篇");
  assert.equal(pytorchMap.classList.contains("is-dimmed"), true);

  pytorchMap.dispatch("focus");
  assert.equal(runtime.root.dataset.atlasSelected, "pytorch");
  const enter = stageMap.dispatch("keydown", { key: "Enter" });
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

test("motion preference updates state without registering pointer-driven map effects", () => {
  const standard = createAtlasRuntime();
  vm.runInNewContext(script, standard);
  assert.equal(standard.document.documentElement.dataset.atlasReducedMotion, "false");
  assert.equal(standard.map.listeners.has("pointermove"), false);
  assert.equal(standard.map.listeners.has("pointerleave"), false);

  const reduced = createAtlasRuntime({ reducedMotion: true });
  vm.runInNewContext(script, reduced);
  assert.equal(reduced.document.documentElement.dataset.atlasReducedMotion, "true");
  assert.equal(reduced.map.listeners.has("pointermove"), false);
  reduced.controlByKey("stage-1").dispatch("pointerenter", { pointerType: "mouse" });
  assert.equal(reduced.controlByKey("stage-1").classList.contains("is-selecting"), false);
});

test("three archives keep the shared atlas shell without radial route artifacts", () => {
  for (const [name, html] of Object.entries(pages)) {
    assert.match(html, /class="atlas-scroll"/, `${name} must expose the horizontal scroll`);
    assert.match(html, /class="atlas-tide"/, `${name} must expose the ordered moon tide`);
    assert.match(html, /class="atlas-colophon"/, `${name} must expose the borderless colophon`);
    assert.doesNotMatch(html, /atlas-routes|atlas-route|atlas-coastline|is-core/, `${name} must remove radial map artifacts`);
  }
});

test("archive styling uses coast-or-moon background art without glass, parallax, or looping motion", async () => {
  await access(new URL("../assets/archive-moon-sea.webp", import.meta.url));
  await access(new URL("../assets/homepage/coast-background.png", import.meta.url));
  assert.match(styles, /url\("\.\/archive-moon-sea\.webp"\)/);
  assert.match(styles, /url\("\.\/homepage\/coast-background\.png"\)/);
  assert.match(styles, /@keyframes\s+atlas-moon-diffusion/);
  assert.match(styles, /animation:\s*atlas-moon-diffusion\s+240ms/);
  assert.doesNotMatch(styles, /backdrop-filter|infinite|alternate|parallax|atlas-drift|atlas-route-draw/);
  assert.doesNotMatch(script, /pointermove|--atlas-parallax/);
});

test("720px archives become one non-overflowing vertical tide with readable type", () => {
  const mobile = styles.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(mobile, /\.atlas-tide\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(mobile, /body\.archive-atlas-page\s*\{[^}]*overflow-x:\s*hidden/s);
  const sizes = [...mobile.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(([, size]) => Number(size));
  assert.ok(sizes.length > 0 && Math.min(...sizes) >= 11);
});
