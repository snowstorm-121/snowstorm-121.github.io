import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../learning/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/learning-handbook.css", import.meta.url), "utf8").catch(error => {
  if (error.code === "ENOENT") return "";
  throw error;
});
const stageLinks = [
  ["overview", "./pytorch/", "学习路线"],
  ["foundation", "./pytorch/foundation/", "基础阶段"],
  ["stage-1", "./pytorch/stage-1/", "Tensor 与自动微分"],
  ["stage-2", "./pytorch/stage-2/", "模型与训练闭环"],
  ["stage-3", "./pytorch/stage-3/", "卷积网络"],
  ["stage-4", "./pytorch/stage-4/", "Transformer 与 BERT"],
  ["stage-5", "./pytorch/stage-5/", "全量微调与 LoRA"],
  ["stage-6", "./pytorch/stage-6/", "RAG"],
];

test("handbook stylesheet loads last and styles only the learning page", () => {
  assert.match(html, /class="archive-page archive-learning learning-handbook"/);
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(links.at(-1), "../assets/learning-handbook.css");
  assert.match(css, /\.learning-handbook\.archive-page\s*\{/);
  assert.match(css, /\.learning-handbook \.archive-photo\s*\{/);
  assert.doesNotMatch(css, /(^|\n)\s*\.(?:archive|library|reading)-[\w-]+\s*\{/);
});

test("hero keeps the original reading invitation and provides a native directory jump", async () => {
  assert.match(html, /<section class="archive-photo" aria-label="星野问津">/);
  assert.match(html, /<div class="learning-hero-copy">[\s\S]*?<h1>星野问津<\/h1>[\s\S]*?从近岸基础走向远处模型，沿学习路线与七个阶段次第阅读。/);
  assert.match(html, /<a class="learning-browse" href="#learning-directory">浏览学习目录 ↓<\/a>/);
  assert.match(html, /<div class="learning-hero-image" aria-hidden="true"><\/div>/);
  assert.match(html, /<section class="archive-layout" id="learning-directory" data-learning-directory data-relations-url="\.\/pytorch\/atlas-relations\.json"/);
  assert.match(css, /\.learning-handbook \.archive-photo\s*\{[^}]*background-image:\s*none/);
  assert.match(css, /\.learning-handbook \.learning-hero-image\s*\{[^}]*background-image:[^;]*coast-background\.png/);
  await access(new URL("../assets/homepage/coast-background.png", import.meta.url));
});

test("all eight native stage destinations, titles and controller hooks stay intact", () => {
  const actual = [...html.matchAll(/<a data-directory-stage data-stage-key="([^"]+)" href="([^"]+)">([^<]+)<\/a>/g)]
    .map(([, key, href, label]) => [key, href, label]);
  assert.deepEqual(actual, stageLinks);
  for (const hook of ["data-directory-count", "data-directory-title", "data-directory-destination", "data-directory-status", "data-directory-articles"]) {
    assert.ok(html.includes(hook), hook);
  }
  assert.match(html, /data-directory-status role="status">文章列表暂不可用/);
  assert.match(html, /data-directory-title aria-live="polite"/);
});

test("active stage has a non-color marker, and stage controls and article links meet touch sizing", () => {
  assert.match(css, /\.learning-handbook[^\{]*\[aria-pressed="true"\]\s*\{[^}]*font-weight:[^;]+;[^}]*border-inline-start:/);
  assert.match(css, /\.learning-handbook \.archive-stage-list button\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.learning-handbook \.archive-stage-list button \+ a\s*\{[^}]*min-height:\s*44px/);
  const articleHeight = Number(css.match(/\.learning-handbook \.archive-articles a\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
  assert.ok(articleHeight >= 44, "article links need at least 44px of height");
  assert.match(css, /\.learning-handbook :focus-visible\s*\{[^}]*outline:/);
  assert.match(css, /\.learning-handbook \.archive-stage-list\s*\{[^}]*counter-reset:/);
  assert.match(css, /\.learning-handbook \.archive-articles\s*\{[^}]*list-style:\s*decimal-leading-zero/);
});

test("desktop reading layout and narrow two-column index use fluid widths", () => {
  assert.match(css, /\.learning-handbook \.archive-shell\s*\{[^}]*1200px/);
  assert.match(css, /\.learning-handbook \.archive-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 280px\) minmax\(0, 1fr\);[^}]*gap:\s*48px/);
  assert.match(css, /\.learning-handbook \.archive-index\s*\{[^}]*position:\s*sticky;[^}]*max-height:\s*calc\(100dvh - 32px\);[^}]*overflow-y:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.learning-handbook \.archive-stage-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.learning-handbook \.archive-stage-list[^}]*overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(css, /animation:|transition:/);
});

test("phone stage labels leave room for Transformer beside the stage number", () => {
  const phoneCss = css.split(/@media\s*\(max-width:\s*480px\)/)[1];
  assert.ok(phoneCss, "phone styles must be present");
  assert.match(phoneCss, /\.learning-handbook \.archive-stage-list \{ gap:\s*8px; \}/);
  assert.match(phoneCss, /\.learning-handbook \.archive-stage-list button,\s*\.learning-handbook \.archive-stage-list button \+ a\s*\{[^}]*font-size:\s*14px/);
  assert.match(phoneCss, /\.learning-handbook \.archive-stage-list button,\s*\.learning-handbook \.archive-stage-list a,\s*\.learning-handbook \.archive-stage-list button \+ a\s*\{[^}]*padding-inline-start:\s*24px/);
});
