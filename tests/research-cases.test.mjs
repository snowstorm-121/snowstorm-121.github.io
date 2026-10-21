import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const retailPage = new URL("../research/retailflow/index.html", import.meta.url);
const retailHtml = () => readFile(retailPage, "utf8");
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

const page = new URL("../research/scholarlens/index.html", import.meta.url);
const html = () => readFile(page, "utf8");
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
