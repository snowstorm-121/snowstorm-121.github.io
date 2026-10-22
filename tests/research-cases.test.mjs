import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const retailPage = new URL("../research/retailflow/index.html", import.meta.url);
const retailHtml = () => readFile(retailPage, "utf8");
const overviewPage = new URL("../research/index.html", import.meta.url);

test("Paper dossiers: four chapter starts carry ordered document labels and breathing room", async () => {
  for (const name of ["scholarlens", "retailflow"]) {
    const text = await readFile(new URL(`../research/${name}/index.html`, import.meta.url), "utf8");
    assert.deepEqual([...text.matchAll(/<p class="research-chapter-label">(\d{2}) \/ CHAPTER<\/p>/g)].map(m => m[1]), ["01", "02", "03", "04"]);
  }
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case \.archive-content > section\s*\{[^}]*padding-top:\s*40px;[^}]*border-top:\s*1px solid var\(--case-rule\)/);
  assert.match(css, /\.research-case \.archive-content > section:first-child\s*\{[^}]*padding-top:\s*48px;[^}]*border-top:\s*0/);
  assert.match(css, /\.research-case \.research-chapter-label\s*\{[^}]*color:\s*var\(--case-copper\)/);
});

test("ScholarLens dossier: Chinese cover name stays together at narrow widths", async () => {
  const text = await readFile(new URL("../research/scholarlens/index.html", import.meta.url), "utf8");
  assert.match(text, /<h1>ScholarLens · <span class="research-cover-name">研知<\/span><\/h1>/);
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case \.research-cover-name\s*\{[^}]*white-space:\s*nowrap/);
});

test("Paper dossiers: chapter index wraps without row borders", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case \.archive-category-index\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*0 18px/);
  assert.match(css, /\.research-case \.archive-category-index li\s*\{[^}]*padding:\s*0;[^}]*border:\s*0/);
  assert.match(css, /\.research-case \.archive-category-index a\s*\{[^}]*min-height:\s*44px/);
});

test("Paper dossiers: mobile evidence grids collapse despite case-specific desktop rules", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  const lastMobile = css.slice(css.lastIndexOf("@media (max-width: 720px)"));
  assert.match(lastMobile, /\.research-case--scholarlens \.research-evidence-ruler,\s*\.research-case \.research-version-ledger\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(lastMobile, /\.research-case \.research-cover\s*\{[^}]*padding:\s*28px 22px/);
});

test("Paper dossiers: smallest covers wrap long titles and identifiers", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(max-width:\s*360px\)\s*\{\s*\.research-case \.research-cover\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("Paper dossiers: dark palette remains case scoped", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  const rule = css.match(/\[data-reading-theme="dark"\] \.research-case\s*\{([^}]+)\}/)?.[1];
  for (const token of ["paper", "ink", "copper", "rule"]) assert.ok(rule?.includes(`--case-${token}:`), token);
});

test("RetailFlow dossier: factual process plate and separate phase ledger", async () => {
  const text = await retailHtml();
  assert.match(text, /<figure class="research-process-plate">/);
  for (const value of ["流程示意", "B0 / B1 / B2 各 0/4", "V5 1/9 · V4 2/9", "不直接比较"])
    assert.ok(text.includes(value), value);
  assert.doesNotMatch(text, /<(?:svg|canvas|img)\b/i);
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case--retailflow \.research-version-ledger\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
});

test("Research dossiers: scoped covers, single-column reading and unchanged overview HTML", async () => {
  for (const name of ["scholarlens", "retailflow"]) {
    const text = await readFile(new URL(`../research/${name}/index.html`, import.meta.url), "utf8");
    assert.match(text, /class="archive-page archive-research research-case research-case--(?:scholarlens|retailflow)"/);
    assert.ok(text.includes(`research-case--${name}`));
    assert.match(text, /class="archive-photo research-cover"/);
  }
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case \.archive-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  const overview = await readFile(overviewPage);
  assert.equal(createHash("sha256").update(overview).digest("hex"), "f817c0b496d799214ddb226d7652de732389041c763180edbda6d03a01bf29db");
});

test("Research dossier covers: labels use the theme-aware copper ink", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case \.research-cover \.archive-label\s*\{[^}]*color:\s*var\(--case-copper\)/);
});

test("RetailFlow deep reading: separated version ledger and proof slip", async () => {
  const text = await retailHtml();
  for (const token of ["research-version-ledger", "research-proof-slip", "research-deep-dive", "research-deep-body"])
    assert.ok(text.includes(token), token);
  assert.match(text, /<details class="research-deep-dive">\s*<summary>[^<]+<\/summary>/);
  assert.match(text, /<dl class="research-proof-slip"/);
  assert.match(text, /历史冻结 Test[\s\S]*?当前已见 Dev/);
});

test("RetailFlow deep reading: honest denominators, actual failures and fixed reports", async () => {
  const text = await retailHtml();
  for (const value of ["27 次运行", "12 次运行", "3 道退货", "1 道查询", "task 51", "task 53", "task 68", "task 108", "AUTH_REQUIRED", "PROTOCOL_ERROR", "$829.43", "#W2417020", "$62.00", "$2736.40", "$2674.40", "未重跑 Test", "不直接比较"])
    assert.ok(text.includes(value), value);
  for (const file of ["reports/t6-dev.md", "reports/t7-test.md", "reports/repair-native-dialogue.md"])
    assert.ok(text.includes(`https://github.com/snowstorm-121/RetailFlow/blob/8dd99dfc8758385342095275a052ce65a151cc31/${file}`));
  assert.match(text, /工程测试[^<]*不等于业务成功率|工程测试[^<]*不能代替业务成功率/);
});

test("Research overview: both published case destinations exist", async () => {
  const text = await readFile(overviewPage, "utf8");
  const destinations = [...text.matchAll(/href="(\.\/(?:scholarlens|retailflow)\/)"/g)].map(m => m[1]);
  assert.deepEqual(destinations, ["./scholarlens/", "./retailflow/"]);
  for (const href of destinations) await access(new URL(`${href}index.html`, overviewPage));
});

for (const route of ["index.html", "scholarlens/index.html", "retailflow/index.html"]) {
  test(`Research accessibility: ${route} has native navigation and semantic content`, async () => {
    const text = await readFile(new URL(`../research/${route}`, import.meta.url), "utf8");
    assert.equal([...text.matchAll(/<h1\b/g)].length, 1);
    const nav = text.match(/<nav class="archive-switcher"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav);
    assert.equal([...nav.matchAll(/aria-current="page"/g)].length, 1);
    assert.match(nav, /<a href="[^"]*\/" aria-current="page">烛微观澜<\/a>/);
    const ids = [...text.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, "IDs must be unique");
    for (const [, id] of text.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Missing anchor ${id}`);
    for (const [img] of text.matchAll(/<img\b[^>]*>/g)) assert.match(img, /\balt="[^"\s][^"]*"/);
    for (const [table] of text.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
      assert.match(table, /<caption>[^<]+<\/caption>/);
      assert.match(table, /<th\b/);
      for (const [th] of table.matchAll(/<th\b[^>]*>/g)) assert.match(th, /scope="(?:col|row)"/);
    }
    for (const [, href] of text.matchAll(/href="([^"]+)"/g)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href))
        assert.equal(new URL(href).origin, "https://github.com", href);
    }
  });
}

test("Research CSS: narrow layouts wrap links and contain scrolling tables", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  const shared = await readFile(new URL("../assets/archive-directory.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.research-links\s*\{[^}]*flex-direction:\s*column/);
  assert.match(shared, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.archive-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.research-links a\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.research-table\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.research-case img\s*\{[^}]*max-width:\s*100%;[^}]*height:\s*auto/);
  assert.doesNotMatch(css, /user-select:\s*none|cursor\s*:|animation\s*:/);
  assert.match(shared, /:focus-visible\s*\{[^}]*outline:\s*2px solid/);
});

test("Research touch navigation: links and chapter anchors provide 44px targets", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  for (const selector of [".research-links a", ".archive-category-index a"]) {
    const rule = css.slice(css.indexOf(selector)).match(/\{([^}]*)\}/)?.[1];
    assert.match(rule, /min-height:\s*44px/, selector);
    assert.match(rule, /box-sizing:\s*border-box/, selector);
  }
});
test("RetailFlow: static case exists with shared theme and ordered sections", async () => {
  await access(retailPage);
  const text = await retailHtml();
  assert.match(text, /<header class="archive-header">/);
  assert.match(text, /data-reading-theme-toggle/);
  for (const resource of ["library.css", "reading-theme.css", "archive-directory.css", "research-cases.css", "reading-theme.js"])
    assert.ok(text.includes(`../../assets/${resource}`));
  assert.equal((text.match(/<script\b/g) ?? []).length, 1);
  assert.deepEqual([...text.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]), ["problem", "engineering", "experiments", "conclusion"]);
  for (const id of ["problem", "engineering", "experiments", "conclusion"]) assert.ok(text.includes(`href="#${id}"`));
});
test("RetailFlow: all local resources and native navigation resolve", async () => {
  const text = await retailHtml();
  for (const route of ['href="../"', 'href="../scholarlens/"']) assert.ok(text.includes(route));
  for (const [, href] of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (href.startsWith("https:") || href.startsWith("#")) continue;
    assert.ok(href.startsWith("../"), href);
    await access(new URL(href.endsWith("/") ? href + "index.html" : href, retailPage));
  }
});
test("RetailFlow: semantic flow distinguishes model, application and confirmation", async () => {
  const text = await retailHtml();
  assert.match(text, /<figcaption[^>]*>流程示意/);
  assert.match(text, /<ol class="research-flow">/);
  for (const value of ["模型提出", "应用校验/提案", "用户确认", "事务提交/回执", "LangGraph", "Ollama", "身份", "所有权", "具体参数", "参数变化", "旧确认失效", "SQLite", "同一事务", "confirm_action", "全局事务", "exactly-once"])
    assert.ok(text.includes(value), value);
  assert.doesNotMatch(text, /<img\b|<svg\b|<canvas\b/);
});
test("RetailFlow: frozen results retain every variant and denominator", async () => {
  const text = await retailHtml();
  for (const variant of ["B0", "B1", "B2"])
    assert.match(text, new RegExp(`<tr><th scope="row">${variant}</th><td>0/9</td><td>0/4</td></tr>`));
  for (const value of ["Dev 9", "Test 4", "身份追问", "工具协议", "不调用模型", "跨进程", "工程回归", "不能代替", "不证明", "生产", "真实订单", "支付", "react-agent", "τ2", "新增代码尚未选择独立许可证"])
    assert.ok(text.includes(value), value);
  for (const file of ["README.md", "reports/t7-test.md", "docs/demos.md", "UPSTREAM.md"])
    assert.ok(text.includes(`https://github.com/snowstorm-121/RetailFlow/blob/main/${file}`), file);
});

test("RetailFlow: historical comparison is separated from current seen-Dev repairs", async () => {
  const text = await retailHtml();
  assert.match(text, /<caption>历史 T6\/T7 冻结结果 · 2026-10-20[^<]*<\/caption>/);
  assert.match(text, /历史版本[^<]*104 个确定性测试/);
  assert.match(text, /历史冻结版本[^<]*混合答复[^<]*PROTOCOL_ERROR/);
  for (const value of ["2026-10-21", "V5", "Dev 1/9", "V4", "Dev 2/9", "129 项工程测试", "已见 Dev", "提示", "协议", "用户脚本", "未重跑 Test", "未完成新版本 B0/B1/B2 对照"])
    assert.ok(text.includes(value), value);
  assert.match(text, /当前允许说明文字与单个原生工具调用并存[^<]*文字不提供确认权限[^<]*多工具调用仍拒绝/);
  assert.ok(text.includes("https://github.com/snowstorm-121/RetailFlow/blob/main/reports/repair-native-dialogue.md"));
});

const page = new URL("../research/scholarlens/index.html", import.meta.url);
const html = () => readFile(page, "utf8");

test("ScholarLens dossier: source plate preserves authentic evidence and separates metrics", async () => {
  const text = await html();
  assert.match(text, /<figure class="research-source-plate">\s*<img[^>]+src="\.\.\/assets\/scholarlens-demo.png"/);
  assert.match(text, /演示题不计入正式评测/);
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  assert.match(css, /\.research-case--scholarlens \.research-evidence-ruler\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  const bytes = await readFile(new URL("../research/assets/scholarlens-demo.png", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "35ed26e1bce896f10a91d9a1d22c6b24af8c5dc6ecac229d875c2716e6e065be");
});

test("ScholarLens deep reading: two evidence widgets and native disclosure", async () => {
  const text = await html();
  for (const token of ["research-marginalia", "research-evidence-ruler", "research-trace", "research-deep-dive", "research-deep-body"])
    assert.ok(text.includes(token), token);
  assert.match(text, /<details class="research-deep-dive">\s*<summary>[^<]+<\/summary>/);
  assert.doesNotMatch(text, /<details class="research-deep-dive" open/);
  assert.match(text, /<dl class="research-evidence-ruler"/);
  assert.match(text, /<ol class="research-trace"/);
});

test("ScholarLens deep reading: distinct denominators, failures and fixed reports", async () => {
  const text = await html();
  for (const value of ["240 道可回答检索题", "100 题生成子集", "80 道可回答生成题", "AllEvidence@5", "0.4250", "0.5542", "0.5250", "MRR@10", "0.3649", "0.4965", "0.4878", "Evidence F1", "0.3790", "17/20", "3/20", "1911.06815", "1805.04579", "1804.07445", "4500", "temperature 0", "seed 42"])
    assert.ok(text.includes(value), value);
  for (const file of ["reports/test.md", "reports/t9-failures.md"])
    assert.ok(text.includes(`https://github.com/snowstorm-121/ScholarLens/blob/8b496ae1d8a622fd6fd74ec0be20cfc92fec7c9e/${file}`));
  assert.match(text, /不同样本|分母不同/);
  assert.match(text, /不是答案正确率|不等于答案正确率/);
});
test("ScholarLens: static case exists", async () => { await access(page); });
test("ScholarLens: shared header, theme and ordered native sections", async () => {
  const text = await html();
  assert.match(text, /<header class="archive-header">/);
  assert.match(text, /data-reading-theme-toggle/);
  for (const resource of ["library.css", "reading-theme.css", "archive-directory.css", "research-cases.css", "reading-theme.js"])
    assert.ok(text.includes(`../../assets/${resource}`));
  assert.equal((text.match(/<script\b/g) ?? []).length, 1);
  const ids = [...text.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ["problem", "engineering", "experiments", "conclusion"]);
  for (const id of ids) assert.ok(text.includes(`href="#${id}"`));
});
test("ScholarLens: relative resources resolve and cross-case route is explicit", async () => {
  const text = await html();
  assert.ok(text.includes('href="../retailflow/"'));
  assert.ok(text.includes('href="../"'));
  for (const [, href] of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (href.startsWith("https:") || href.startsWith("#") || href === "../retailflow/") continue;
    assert.ok(href.startsWith("../"), href);
    await access(new URL(href.endsWith("/") ? href + "index.html" : href, page));
  }
});
test("ScholarLens: screenshot retains tracked public source bytes", async () => {
  const bytes = await readFile(new URL("../research/assets/scholarlens-demo.png", import.meta.url));
  // SHA-256 of ScholarLens tracked assets/scholarlens-demo.png; no local checkout required in CI.
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "35ed26e1bce896f10a91d9a1d22c6b24af8c5dc6ecac229d875c2716e6e065be");
  const text = await html();
  assert.match(text, /<img[^>]+src="\.\.\/assets\/scholarlens-demo.png"[^>]+width="1440"[^>]+height="900"[^>]+alt="[^"]+"/);
  assert.match(text, /演示题不计入正式评测/);
});
test("ScholarLens: exact retrieval and generation denominators stay distinct", async () => {
  const text = await html();
  for (const value of ["300 道", "240 道可回答", "EvidenceRecall@5", "span", "不是答案正确率", "BM25", "0.4654", "Dense", "0.6290", "RRF Hybrid", "0.5901", "100 题", "Answer F1", "0.3347", "22/80", "9/100"])
    assert.ok(text.includes(value), value);
});
test("ScholarLens: failure stages, limitations and public attribution are explicit", async () => {
  const text = await html();
  for (const value of ["Top-10", "第 6", "Top-1", "不保证事实正确", "跨论文", "生产服务", "Kotaemon", "QASPER", "正文与标注", "段落", "审计"])
    assert.ok(text.includes(value), value);
  for (const file of ["README.md", "reports/test.md", "reports/t9-failures.md", "UPSTREAM.md"])
    assert.ok(text.includes(`https://github.com/snowstorm-121/ScholarLens/blob/main/${file}`), file);
});
test("Research deep reading: native disclosure styling is responsive and accessible", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  for (const selector of [".research-marginalia", ".research-evidence-ruler", ".research-trace", ".research-version-ledger", ".research-proof-slip", ".research-deep-dive", ".research-deep-body"])
    assert.ok(css.includes(selector), selector);
  assert.match(css, /\.research-deep-dive summary\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.research-deep-dive summary:focus-visible\s*\{[^}]*outline:/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.research-version-ledger/);
  assert.doesNotMatch(css, /user-select:\s*none|cursor\s*:|animation\s*:/);
});
