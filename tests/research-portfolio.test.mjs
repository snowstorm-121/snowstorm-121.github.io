import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const html = await readFile(new URL("../research/index.html", import.meta.url), "utf8");
const exhibit = slug => {
  const start = html.indexOf(`<li class="archive-project portfolio-exhibit" id="${slug}">`);
  assert.ok(start >= 0, `missing ${slug} exhibit`);
  const next = html.indexOf('<li class="archive-project portfolio-exhibit"', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
};

test("overview has scoped style, semantic intro and three ordered exhibits", () => {
  assert.match(html, /<body class="archive-page archive-research research-portfolio">/);
  assert.match(html, /<h1>烛微观澜<\/h1>/);
  const intro = html.match(/<p class="archive-intro">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(intro);
  assert.deepEqual([...intro.matchAll(/<span>([^<]+)<\/span>/g)].map(match => match[1]), ["从原文证据，", "到执行边界，", "再到模型训练。"]);
  assert.equal(intro.replace(/<[^>]+>/g, ""), "从原文证据，到执行边界，再到模型训练。");
  assert.match(html, /href="\.\.\/assets\/research-cases\.css">\s*<link rel="stylesheet" href="\.\.\/assets\/research-portfolio\.css">/);
  assert.deepEqual([...html.matchAll(/<li class="archive-project portfolio-exhibit" id="([^"]+)"/g)].map(m => m[1]), ["scholarlens", "retailflow", "tooltune"]);
  assert.match(html, /<aside class="archive-index portfolio-index"/);
});

test("all original project descriptions, work summaries, statuses and routes remain", () => {
  const facts = [
    ["scholarlens", "研究原型", "面向用户选定单篇论文的本地 RAG 证据问答，保留可回看的原文位置与引用记录。", "主要工作：正文与标注隔离、混合检索、引用审计与冻结评测。", "ScholarLens"],
    ["retailflow", "实验原型", "模拟零售环境中的本地 CLI Agent，探索工具执行前的身份校验、用户确认与事务恢复边界。", "主要工作：具体参数提案、确认失效机制、SQLite 事务回执与冻结评测；不连接真实订单或支付。", "RetailFlow"],
    ["tooltune", "实验原型", "在 Apple Silicon 上进行本地量化 LoRA 微调，记录工具调用决策、参数输出与冻结 Test 的逐题变化。", "主要工作：严格数据处理、分组抽样、训练目标校验与冻结对照；均衡诊断集结果不代表真实 API 执行成功率。", "ToolTune"],
  ];
  for (const [slug, status, description, work, name] of facts) {
    const block = exhibit(slug);
    for (const value of [status, description, work, `href="./${slug}/"`, `href="https://github.com/snowstorm-121/${name}"`]) assert.ok(block.includes(value), value);
  }
});

test("ScholarLens exhibit uses verified real screenshot and qualified retrieval result", async () => {
  const block = exhibit("scholarlens");
  const bytes = await readFile(new URL("../research/assets/scholarlens-demo.png", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "35ed26e1bce896f10a91d9a1d22c6b24af8c5dc6ecac229d875c2716e6e065be");
  assert.match(block, /<figure class="portfolio-visual portfolio-visual--scholarlens">[\s\S]*?<img src="\.\/assets\/scholarlens-demo.png" width="1440" height="900" alt="[^"]+">/);
  for (const value of ["真实演示界面 · 不计入正式评测", "0.6290", "Dense EvidenceRecall@5", "冻结 Test 240 道可回答题", "不是答案正确率", "./scholarlens/", "https://github.com/snowstorm-121/ScholarLens"]) assert.ok(block.includes(value), value);
});

test("RetailFlow exhibit marks the four roles as schematic and reports failed Test", () => {
  const block = exhibit("retailflow");
  assert.match(block, /<ol class="portfolio-flow">[\s\S]*?<\/ol>/);
  for (const value of ["流程示意", "模型提出", "应用校验", "用户确认", "事务与回执", "参数变化", "旧确认失效", "B0/B1/B2", "各 0/4", "2026-10-20", "业务效果未达标"]) assert.ok(block.includes(value), value);
});

test("ToolTune exhibit exposes two exact scores on one visible 0–100% scale", () => {
  const block = exhibit("tooltune");
  assert.match(block, /<dl class="portfolio-score-list">[\s\S]*?<\/dl>/);
  for (const value of ["严格决策匹配 · 冻结均衡 Test", "0%", "100%", "89/190", "46.84%", "100/190", "52.63%", "17 题改善 / 6 题退化", "95 调用 + 95 非调用", "不代表真实 API 成功或生产流量准确率"]) assert.ok(block.includes(value), value);
  assert.match(block, /<div class="portfolio-bar" aria-hidden="true"><span style="width:46\.84%"><\/span><\/div>/);
  assert.match(block, /<div class="portfolio-bar" aria-hidden="true"><span style="width:52\.63%"><\/span><\/div>/);
});

test("shared presentation CSS stays scoped and collapses exhibits image-first", async () => {
  const css = await readFile(new URL("../assets/research-portfolio.css", import.meta.url), "utf8");
  for (const selector of [".portfolio-visual", ".portfolio-copy", ".portfolio-tags", ".portfolio-cta", ".portfolio-visual--scholarlens", ".portfolio-visual--retailflow", ".portfolio-visual--tooltune"]) assert.ok(css.includes(selector), selector);
  assert.match(css, /\[data-reading-theme="dark"\] :is\(\.research-portfolio, \.research-editorial\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.portfolio-exhibit[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.portfolio-bar\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.portfolio-visual--scholarlens img\s*\{[^}]*object-fit:\s*contain/);
  assert.match(css, /\.research-portfolio \.portfolio-intro \.archive-intro\s*\{[^}]*max-width:\s*16em;[^}]*text-wrap:\s*balance/);
  assert.match(css, /\.research-portfolio \.portfolio-intro \.archive-intro span\s*\{[^}]*display:\s*inline-block/);
  assert.match(css, /\.research-editorial \.research-cover h1\s*\{[^}]*text-wrap:\s*balance/);
});

const caseHashes = {
  scholarlens: "2bfdef34dd4fb228d0df56c52a8e1980cd3643271f103f15de06c7f97ae32d83",
  retailflow: "0f3c2e0ec797633892e6090116a005eff2ad2595c44e7a27ee855e6bdadd9cc2",
  tooltune: "15764e8270f3d7e07104ab1c1340777de0d08714d00979ae2709723366a8aacd",
};

for (const [slug, expectedHash] of Object.entries(caseHashes)) {
  test(`${slug} keeps its original article and adds a sourced editorial cover`, async () => {
    const text = await readFile(new URL(`../research/${slug}/index.html`, import.meta.url), "utf8");
    const article = text.match(/<article class="archive-content">[\s\S]*?<\/article>/)?.[0];
    assert.ok(article);
    assert.equal(createHash("sha256").update(article).digest("hex"), expectedHash);
    assert.match(text, new RegExp(`<body class="archive-page archive-research research-case research-case--${slug} research-editorial">`));
    assert.match(text, /href="\.\.\/\.\.\/assets\/research-cases\.css">\s*<link rel="stylesheet" href="\.\.\/\.\.\/assets\/research-portfolio\.css">/);
    assert.match(text, new RegExp(`<section class="archive-photo research-cover"[^>]*>\\s*<div class="portfolio-cover-copy">[\\s\\S]*?<ul class="portfolio-tags">[\\s\\S]*?<a class="portfolio-cover-cta" href="#experiments">查看实验结果<\\/a>[\\s\\S]*?<figure class="portfolio-visual portfolio-visual--${slug}">`));
    assert.match(text, /<dl class="portfolio-facts" aria-label="项目资料">(?:[\s\S]*?<div><dt>[^<]+<\/dt><dd>[^<]+<\/dd><\/div>){3}\s*<\/dl>\s*<div class="archive-layout">/);
    assert.deepEqual([...text.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]), ["problem", "engineering", "experiments", "conclusion"]);
  });
}

test("case graphics state what their evidence does and does not establish", async () => {
  const cases = await Promise.all(Object.keys(caseHashes).map(slug => readFile(new URL(`../research/${slug}/index.html`, import.meta.url), "utf8")));
  const [scholarlens, retailflow, tooltune] = cases;
  for (const value of ["../assets/scholarlens-demo.png", "真实演示界面 · 不计入正式评测", "240 道可回答题", "100 道生成题", "不是答案正确率"]) assert.ok(scholarlens.includes(value), value);
  for (const value of ["流程示意", "模型提出", "应用校验", "用户确认", "事务与回执", "参数变化使旧确认失效", "2026-10-20", "B0/B1/B2 各 0/4", "已见 Dev", "模拟"]) assert.ok(retailflow.includes(value), value);
  for (const value of ["严格决策匹配 · 冻结均衡 Test", "89/190", "46.84%", "100/190", "52.63%", "17 题改善 / 6 题退化", "95 调用 + 95 非调用", "Validation", "单工具", "不代表真实 API 成功或生产流量准确率"]) assert.ok(tooltune.includes(value), value);
  assert.match(tooltune, /<div class="portfolio-bar" aria-hidden="true"><span style="width:46\.84%"><\/span><\/div>/);
  assert.match(tooltune, /<div class="portfolio-bar" aria-hidden="true"><span style="width:52\.63%"><\/span><\/div>/);
});

test("ToolTune cover keeps its title text while balancing wrapped lines", async () => {
  const text = await readFile(new URL("../research/tooltune/index.html", import.meta.url), "utf8");
  assert.match(text, /<h1>ToolTune · 工具调用微调<\/h1>/);
  const css = await readFile(new URL("../assets/research-portfolio.css", import.meta.url), "utf8");
  assert.match(css, /\.research-editorial \.research-cover h1\s*\{[^}]*text-wrap:\s*balance/);
});

test("editorial layout keeps the index reachable and table values intact", async () => {
  const css = await readFile(new URL("../assets/research-portfolio.css", import.meta.url), "utf8");
  assert.match(css, /\.research-editorial \.research-cover::after\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.research-editorial \.archive-layout\s*\{[^}]*minmax\(0, 150px\) minmax\(0, 820px\)/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.research-editorial \.archive-index[^{]*\{[^}]*position:\s*static/);
  assert.match(css, /\.research-editorial \.research-table td\s*\{[^}]*white-space:\s*nowrap/);
});
