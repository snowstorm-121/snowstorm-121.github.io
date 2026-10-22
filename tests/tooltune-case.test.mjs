import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const page = new URL("../research/tooltune/index.html", import.meta.url);
const html = () => readFile(page, "utf8");
const revision = "82c53f9eb15e37e01f8f16e7ece33198e11ba1f4";
const source = file => `https://github.com/snowstorm-121/ToolTune/blob/${revision}/${file}`;

test("ToolTune: route, shared theme, chapters and local links", async () => {
  await access(page);
  const text = await html();
  assert.match(text, /research-case--tooltune/);
  assert.match(text, /RESEARCH CASE \/ 03/);
  assert.match(text, /data-reading-theme-toggle/);
  for (const resource of ["library.css", "reading-theme.css", "archive-directory.css", "research-cases.css", "reading-theme.js"])
    assert.ok(text.includes(`../../assets/${resource}`), resource);
  assert.equal((text.match(/<script\b/g) ?? []).length, 1);
  assert.deepEqual([...text.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]),
    ["problem", "engineering", "experiments", "conclusion"]);
  for (const id of ["problem", "engineering", "experiments", "conclusion"])
    assert.ok(text.includes(`href="#${id}"`), id);
  for (const route of ['href="../"', 'href="../scholarlens/"', 'href="../retailflow/"'])
    assert.ok(text.includes(route), route);
  for (const [, href] of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (href.startsWith("https:") || href.startsWith("#")) continue;
    await access(new URL(href.endsWith("/") ? href + "index.html" : href, page));
  }
});

test("ToolTune: training record and Validation selection keep exposure limits", async () => {
  const text = await html();
  assert.match(text, /<dl class="research-training-ledger"/);
  assert.match(text, /<ol class="research-flow"/);
  for (const value of ["112,960", "99,108", "100+100", "95+95", "327,680", "rank 8", "200", "800", "4,000", "40,821", "94/200", "103/200", "107/200", "Validation", "U200", "loss mask", "MLX scale=16", "PEFT alpha"])
    assert.ok(text.includes(value), value);
  assert.match(text, /800[^<]*4,000|4,000[^<]*800/);
});

test("ToolTune: frozen Test table retains paired denominators and limits", async () => {
  const text = await html();
  for (const row of [
    ["严格决策匹配", "89/190", "100/190"],
    ["gold 调用严格匹配", "66/95", "71/95"],
    ["非调用动作匹配且完整结束", "23/95", "29/95"],
    ["调用召回 / 工具名正确", "88/95", "91/95"],
    ["参数 schema 有效", "88/95", "91/95"],
    ["256-token 截断", "72/190", "66/190"],
  ]) {
    const line = text.match(new RegExp(`<tr><th scope="row">${row[0]}[^<]*<\\/th><td>[^<]*${row[1]}[^<]*<\\/td><td>[^<]*${row[2]}[^<]*<\\/td><\\/tr>`));
    assert.ok(line, row[0]);
  }
  for (const value of ["46.84%", "52.63%", "11/190", "5.79 个百分点", "50%", "均衡诊断集", "同一", "greedy", "EOS", "256-token", "无强制 JSON", "首次", "未计算显著性", "置信区间"])
    assert.ok(text.includes(value), value);
  assert.match(text, /50%[^<]*恒不调用|恒不调用[^<]*50%/);
});

test("ToolTune: paired record, examples and native disclosure preserve interpretation", async () => {
  const text = await html();
  assert.match(text, /<dl class="research-paired-record"/);
  for (const [label, count] of [["都对", "83"], ["改善", "17"], ["退化", "6"], ["都错", "84"]])
    assert.match(text, new RegExp(`<dt>[^<]*${label}[^<]*<\\/dt><dd>${count}<\\/dd>`));
  for (const value of ["7 题", "6 题", "4 题", "play_music", "没有播放音乐", "glaive-v2:037855:a4", "口头承诺", "glaive-v2:081350:a2", "不代表内容质量改善", "glaive-v2:095636:a4"])
    assert.ok(text.includes(value), value);
  assert.match(text, /<details class="research-deep-dive">\s*<summary>[^<]+<\/summary>/);
  assert.doesNotMatch(text, /<details class="research-deep-dive" open/);
  assert.doesNotMatch(text, /<img\b|<svg\b|<canvas\b/);
});

test("ToolTune: boundaries, attribution and fixed public evidence", async () => {
  const text = await html();
  for (const value of ["一个候选工具", "95 个非调用", "仅 1 个", "真实 API", "68 项工程测试", "原始数据", "adapter", "MLX-LM", "Glaive", "社区转换"])
    assert.ok(text.includes(value), value);
  for (const file of ["README.md", "UPSTREAM.md", "reports/T2-balanced-protocol.md", "reports/T3-validation.md", "reports/T4-test.md", "reports/evidence/t4/recomputed-comparison.json", "reports/evidence/t3/selection.json", "src/tooltune/metrics.py", "src/tooltune/train.py"])
    assert.ok(text.includes(source(file)), file);
  assert.doesNotMatch(text, /ToolTune\/blob\/main\//);
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case--tooltune \.research-paired-record\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*150px\),\s*1fr\)\)/);
  assert.match(css, /\.research-case--tooltune [^{}]*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  assert.doesNotMatch(css, /user-select:\s*none|cursor\s*:|animation\s*:/);
});
