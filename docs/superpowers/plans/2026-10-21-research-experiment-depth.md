# “烛微观澜”双层实验手札 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在两个已有研究案例页加入面试友好的默认叙述、可展开的实验细节，以及四个由真实证据驱动的小组件。

**Architecture:** 保持现有静态 HTML 页面与四章节锚点。ScholarLens 与 RetailFlow 分别增加语义化 HTML 的正文旁注、组件和原生 `<details>`；共享样式只进入 `assets/research-cases.css`，不添加运行时脚本。两案例各自先完成内容和测试，再统一做视觉/无障碍与浏览器验收。

**Tech Stack:** 静态 HTML/CSS、现有 `assets/reading-theme.js`、Node 内建 `node:test`、GitHub Pages。

## Global Constraints

- 唯一可写站点工作区：`/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget`；`/Users/yyy/code/ScholarLens` 和 `/Users/yyy/code/RetailFlow` 只读；保留既有未提交 `.superpowers/sdd/task-4-report.md`。
- 设计规格：`docs/superpowers/specs/2026-10-21-research-experiment-depth-design.md`；所有新增事实必须与它以及固定源提交一致：ScholarLens `8b496ae1d8a622fd6fd74ec0be20cfc92fec7c9e`，RetailFlow `8dd99dfc8758385342095275a052ce65a151cc31`。
- 主页外观、学习/生活页、PyTorch 笔记正文及所有既有公开 URL 不变；`/research/` 总览仅在确有必要时调整入口文案。现有“问题航标 → 工程舱图 → 实验潮汐 → 结论星屿”顺序和锚点、真实 ScholarLens 截图、RetailFlow “流程示意”均保留。
- 页面采用 B“实验手札”正文与旁注，借用 A 的克制章节航线；不采用 C 式密集仪表板。四组件均保留：ScholarLens 的“证据刻度”“失败轨迹”，RetailFlow 的“版本潮汐”“证据签”。默认层独立可读，技术层为原生、默认收起的 `<details><summary>`，无新 JavaScript/依赖/后端。
- 不把不同样本/版本画成一条因果漏斗或进步趋势；每个数字就近注明样本与分母。证据覆盖不等于答案正确；工程测试与单例成功不等于业务成功率；RetailFlow 历史 Test 与当前已见 Dev 分区。新增关键主张链接到固定提交的公开报告。
- 使用当前昼夜主题变量与系统光标；颜色不是唯一信息通道；无不必要动画。`summary` 触摸目标至少 44px、键盘焦点可见、文字可选择；表格 caption/th、真实截图 alt 保留。四视口 1440×900、1024×768、720×900、320×568 × 昼夜，无水平溢出；背景失败保底色可读。
- TDD：每项先加测试并观察 RED，最小实现后观察 GREEN；不可删旧测试。最终全量测试不少于基线 323 项，JS syntax、PyTorch real-source sync、`git diff --check` 必须通过。每任务独立实现 agent → commit → 独立任务 reviewer；全任务后全分支 reviewer。合并/推送须依据本轮用户发布授权另行决定。

## File map

- `research/scholarlens/index.html`：ScholarLens 两层实验叙述、证据刻度、失败轨迹、固定来源链接。
- `research/retailflow/index.html`：RetailFlow 两层实验叙述、版本潮汐、证据签、固定来源链接。
- `assets/research-cases.css`：上述四组件及 `<details>` 的共享视觉、触摸和响应式规则。不得改变全站 CSS/主页。
- `tests/research-cases.test.mjs`：在原有 323 项基础上新增两个案例内容合同和共享样式/无障碍合同。

---

### Task 1: ScholarLens 实验证据与双层阅读

**Files:**
- Modify: `research/scholarlens/index.html`（只在四章既有结构内添加）
- Modify: `tests/research-cases.test.mjs`（追加 ScholarLens 测试）

**Interfaces:**
- Consumes: 当前页面的四个 section ID、现有 BM25/Dense/Hybrid 表和截图；ScholarLens 固定提交的 `reports/test.md` 与 `reports/t9-failures.md`。
- Produces: `.research-marginalia`、`.research-evidence-ruler`、`.research-trace`、`.research-deep-dive`、`.research-deep-body`，供 Task 3 样式使用。无 JS API。

- [ ] **Step 1: 在既有测试文件追加失败合同。** 保留原测试与导入，追加完整测试：

```js
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
```

- [ ] **Step 2: 验证 RED。** 运行：

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-cases.test.mjs
```

预期新增两项 FAIL，原因是新组件/固定来源和详细数字尚不存在；其余原测试通过。记录具体失败于任务报告。

- [ ] **Step 3: 最小实现。** 在 `#experiments` 现有表格与正文周围加入默认可见的语义化旁注和独立样本刻度，随后在该 section 末尾加入一个原生技术层。必须保留现有表、截图、四章节和旧链接。组件与技术层采用下列准确结构，允许按当前段落顺序移动，不增加第五个顶层 section：

```html
<aside class="research-marginalia" aria-label="ScholarLens 实验旁注">
  <p class="archive-label">实验手札 / 两种不同分母</p>
  <dl class="research-evidence-ruler">
    <div><dt>检索 Test · 240 道可回答检索题</dt><dd>Dense EvidenceRecall@5 <strong>0.6290</strong><small>gold span 覆盖，不是答案正确率</small></dd></div>
    <div><dt>生成 · 100 题生成子集，其中 80 道可回答生成题</dt><dd>Answer F1 <strong>0.3347</strong><small>可回答题错误拒答 22/80；分母不同，不能画成转化漏斗</small></dd></div>
  </dl>
</aside>
<details class="research-deep-dive">
  <summary>展开实验手札 · 检索、生成与失败定位</summary>
  <div class="research-deep-body">
    <h3>同条件检索对照</h3>
    <p>2026-10-16 冻结 Test 共 300 题，其中 240 道可回答、60 道无答案；三路共用 2400/200 字符切分、论文范围与 Top-5 证据口径。AllEvidence@5 衡量整组标注证据完整覆盖，MRR@10 衡量首个命中位置，均不是答案正确率。</p>
    <p>BM25 / Dense / RRF Hybrid 的 AllEvidence@5 分别为 0.4250 / 0.5542 / 0.5250；MRR@10 分别为 0.3649 / 0.4965 / 0.4878。这次 Dense 在 @5 占优，不代表对所有论文普遍最优。</p>
    <h3>独立的生成子集</h3>
    <p>预先冻结的 100 题生成子集为 80 道可回答与 20 道无答案；Dense Top-5 最多 4500 context tokens，本地 qwen3:4b-instruct-2507-q4_K_M，temperature 0、seed 42。整体 Answer F1 0.3347、Evidence F1 0.3790；无答案题正确拒答 17/20、错误回答 3/20，输出截断 9/100。整体 F1 含无答案题；不能和 240 题检索结果作因果比较。</p>
    <h3>失败轨迹：先定位阶段</h3>
    <ol class="research-trace">
      <li><strong>检索未召回 · 1911.06815</strong><p>实验数据集问题的 Dense Top-10 未覆盖任何 gold；拒答没有凭空编造，但证据未进入候选。</p></li>
      <li><strong>候选交接 · 1805.04579</strong><p>模型权重问题的完整替代 gold 排第 6，被 Top-5 排除；不是 4500-token 截断。</p></li>
      <li><strong>生成拒答 · 1804.07445</strong><p>数据语言问题的 Top-1 已完整覆盖 gold，模型仍拒答；此例不能归咎检索。</p></li>
    </ol>
    <p>三例用于定位阶段，不代表故障类型占比。原始报告：<a href="https://github.com/snowstorm-121/ScholarLens/blob/8b496ae1d8a622fd6fd74ec0be20cfc92fec7c9e/reports/test.md">冻结 Test</a>、<a href="https://github.com/snowstorm-121/ScholarLens/blob/8b496ae1d8a622fd6fd74ec0be20cfc92fec7c9e/reports/t9-failures.md">失败轨迹</a>。</p>
  </div>
</details>
```

旁注与轨迹是两个组件，技术层内容可调整句读以避免与现有正文机械重复，但不得改变事实、口径或来源。

- [ ] **Step 4: 验证 GREEN 与全量。** 同 Step 2 的命令应全过；再运行：

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs counter-worker/tests/*.test.mjs
git diff --check
```

预期全量不少于 325/325、0 fail；`git diff --check` 无输出。注意 Task 3 尚未提供最终组件样式，Task 1 的验收重点是静态内容与语义合同。

- [ ] **Step 5: 自审并提交。** 只暂存本任务两个文件：

```bash
git add research/scholarlens/index.html tests/research-cases.test.mjs
git diff --cached --check
git commit -m "feat: deepen ScholarLens experiment case"
```

记录 RED/GREEN、全量输出与自审于 `.superpowers/sdd/task-1-research-depth-report.md`，然后交独立 reviewer。

### Task 2: RetailFlow 历史/当前实验与证据签

**Files:**
- Modify: `research/retailflow/index.html`
- Modify: `tests/research-cases.test.mjs`（追加 RetailFlow 测试）

**Interfaces:**
- Consumes: Task 1 已建立的 `.research-marginalia`/`.research-deep-dive` 语义约定；RetailFlow 固定提交的 `reports/t6-dev.md`、`reports/t7-test.md`、`reports/repair-native-dialogue.md`；现有历史 B0/B1/B2 表与“流程示意”。
- Produces: `.research-version-ledger`、`.research-proof-slip`，供 Task 3 样式使用。无 JS API。

- [ ] **Step 1: 追加失败合同。** 在现有测试文件加入：

```js
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
```

- [ ] **Step 2: 验证 RED。** 运行：

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-cases.test.mjs
```

预期新增两项 FAIL，仅因新账页、证据签、详细口径与固定来源尚不存在；旧测试保持通过。

- [ ] **Step 3: 最小实现。** 保留现有历史表、流程示意、当前 V5 文案和旧来源链接；在 `#experiments` 附近新增下面的默认层组件与技术层，绝不把历史和当前连成趋势线：

```html
<div class="research-version-ledger" aria-label="RetailFlow 不同阶段的实验记录">
  <div><p class="archive-label">历史冻结 Test · 2026-10-20</p><strong>B0 / B1 / B2 各 0/4</strong><p>四道独立 Test 题，各组一次；冻结对照，不是当前 V5 成绩。</p></div>
  <div><p class="archive-label">当前已见 Dev · 2026-10-21</p><strong>V5 1/9 · V4 2/9</strong><p>开发排障修改过协议、提示和用户脚本；未重跑 Test，不直接比较，也不是因果提升。</p></div>
</div>
<aside class="research-marginalia" aria-label="RetailFlow 单例证据签">
  <p class="archive-label">证据签 / 一次已见 Dev 取消</p>
  <dl class="research-proof-slip">
    <div><dt>请求</dt><dd>取消订单 #W2417020</dd></div>
    <div><dt>权限</dt><dd>身份核查、具体提案与用户明确确认</dd></div>
    <div><dt>实际末态</dt><dd>订单 cancelled；礼品卡余额 $62.00 → $2736.40；新增退款 $2674.40</dd></div>
    <div><dt>证据边界</dt><dd>V5 已见 Dev task 69 单例；不是总体成功率或生产安全证明</dd></div>
  </dl>
</aside>
<details class="research-deep-dive">
  <summary>展开实验手札 · 对照、逐题失败与当前修复</summary>
  <div class="research-deep-body">
    <h3>历史冻结对照的共同条件</h3>
    <p>Dev 为 9 道独立题，三组共 27 次运行；Test 为 4 道独立题，三组共 12 次运行，不能改称 27 或 12 道题。B0 保留近期完整消息块；B1 加一次已知执行前只读故障重试；B2 再加结构化关键状态与工具结果裁剪。三组的权限、具体提案、确认和回执保护相同。成功同时要求业务末态、必要确认、无禁止副作用与必要沟通。</p>
    <p>历史 T7 Test 包含 3 道退货、1 道查询，没有需求变更，也没有触发故障；B0/B1/B2 各 0/4。schema 合法 3/3 不是业务成功；观察违规 0/4 不证明通用安全，不能据此推断恢复或长上下文收益。</p>
    <h3>全部四道 Test 的失败路径</h3>
    <ol class="research-trace">
      <li><strong>task 51</strong><p>未定位身份先读取订单，应用返回 AUTH_REQUIRED；后续文字追问未形成结构化身份交互。</p></li>
      <li><strong>task 53</strong><p>只以普通文字询问身份，未创建退货确认，也未执行写入。</p></li>
      <li><strong>task 68</strong><p>编造示例身份，两次混合答复中的工具请求被历史协议以 PROTOCOL_ERROR 拒绝；最终未回答 $829.43。</p></li>
      <li><strong>task 108</strong><p>只以普通文字询问身份，未退货、未回答金额。</p></li>
    </ol>
    <h3>当前 V5 是开发排障，不是新版 Test</h3>
    <p>V4 已见 Dev 2/9，V5 已见 Dev 1/9；期间修改协议适配、提示和用户脚本。V5 task 69 在身份查询、订单检查、取消原因追问、提案和当前用户明确确认后取消 #W2417020，礼品卡余额 $62.00 → $2736.40，新增退款 $2674.40。这仅是单例链路；129 项工程测试不等于业务成功率。当前协议允许说明文字与单个原生工具调用并存，文字不构成确认，多工具调用仍拒绝。V5 未重跑 Test，也没有新版 B0/B1/B2 对照；与历史结果不直接比较。</p>
    <p>原始报告：<a href="https://github.com/snowstorm-121/RetailFlow/blob/8dd99dfc8758385342095275a052ce65a151cc31/reports/t6-dev.md">T6 Dev</a>、<a href="https://github.com/snowstorm-121/RetailFlow/blob/8dd99dfc8758385342095275a052ce65a151cc31/reports/t7-test.md">T7 Test</a>、<a href="https://github.com/snowstorm-121/RetailFlow/blob/8dd99dfc8758385342095275a052ce65a151cc31/reports/repair-native-dialogue.md">V5 修复记录</a>。</p>
  </div>
</details>
```

若现有段落已经提供同一内容，可合并重复句，保留关键事实、技术层与默认层完整可读；不可为压缩篇幅牺牲日期/分母/边界。

- [ ] **Step 4: 验证 GREEN 与全量。** 同 Step 2 的 focused 命令应全过；运行：

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs counter-worker/tests/*.test.mjs
git diff --check
```

预期不少于 327/327、0 fail，无 diff whitespace 错误。

- [ ] **Step 5: 自审并提交。**

```bash
git add research/retailflow/index.html tests/research-cases.test.mjs
git diff --cached --check
git commit -m "feat: deepen RetailFlow experiment case"
```

报告保存 `.superpowers/sdd/task-2-research-depth-report.md`，包含 RED/GREEN、全量与自审证据，随后独立 reviewer。

### Task 3: 共享视觉、响应式与无障碍验收

**Files:**
- Modify: `assets/research-cases.css`
- Modify: `tests/research-cases.test.mjs`（追加共享样式合同）
- Read-only browser QA: `/research/`、`/research/scholarlens/`、`/research/retailflow/`

**Interfaces:**
- Consumes: Task 1/2 的 `.research-marginalia`、`.research-evidence-ruler`、`.research-trace`、`.research-deep-dive`、`.research-deep-body`、`.research-version-ledger`、`.research-proof-slip`。
- Produces: 仅静态 CSS；现有页面和 theme toggle 的 JS 接口不变。

- [ ] **Step 1: 追加失败合同。**

```js
test("Research deep reading: native disclosure styling is responsive and accessible", async () => {
  const css = await readFile(new URL("../assets/research-cases.css", import.meta.url), "utf8");
  for (const selector of [".research-marginalia", ".research-evidence-ruler", ".research-trace", ".research-version-ledger", ".research-proof-slip", ".research-deep-dive", ".research-deep-body"])
    assert.ok(css.includes(selector), selector);
  assert.match(css, /\.research-deep-dive summary\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.research-deep-dive summary:focus-visible\s*\{[^}]*outline:/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.research-version-ledger/);
  assert.doesNotMatch(css, /user-select:\s*none|cursor\s*:|animation\s*:/);
});
```

- [ ] **Step 2: 验证 RED。** 运行：

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-cases.test.mjs
```

预期新增样式合同 FAIL，内容合同继续通过。

- [ ] **Step 3: 添加最少共享样式。** 在 `assets/research-cases.css` 末尾追加以下起点；如浏览器观察有具体缺陷，只针对缺陷微调，不改 `archive-directory.css`/`reading-theme.css`：

```css
.research-case .research-marginalia,
.research-case .research-version-ledger,
.research-case .research-deep-dive {
  margin: 28px 0;
  padding: 20px;
  border: 1px solid var(--reading-line);
  background: var(--reading-surface);
}
.research-case .research-marginalia { border-left: 3px solid var(--reading-accent); }
.research-case .research-evidence-ruler,
.research-case .research-proof-slip { margin: 0; }
.research-case .research-evidence-ruler > div,
.research-case .research-proof-slip > div { padding: 12px 0; border-top: 1px solid var(--reading-line); }
.research-case .research-evidence-ruler dt,
.research-case .research-proof-slip dt { color: var(--reading-muted); font-size: 14px; }
.research-case .research-evidence-ruler dd,
.research-case .research-proof-slip dd { margin: 4px 0 0; }
.research-case .research-evidence-ruler strong { display: inline-block; margin-left: 8px; font-size: 1.4em; color: var(--archive-accent-text); }
.research-case .research-evidence-ruler small { display: block; font-size: 13px; color: var(--reading-muted); }
.research-case .research-version-ledger { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.research-case .research-version-ledger > div + div { border-left: 1px solid var(--reading-line); padding-left: 20px; }
.research-case .research-version-ledger strong { display: block; font-size: 1.2em; color: var(--archive-accent-text); }
.research-case .research-trace { list-style: none; margin: 18px 0; padding: 0 0 0 14px; border-left: 1px solid var(--reading-line); }
.research-case .research-trace li { position: relative; padding: 0 0 20px 18px; }
.research-case .research-trace li::before { content: ""; position: absolute; top: .6em; left: -19px; width: 9px; height: 9px; border: 1px solid var(--reading-accent); border-radius: 50%; background: var(--reading-surface); }
.research-case .research-trace li p { margin: 5px 0 0; }
.research-deep-dive summary { box-sizing: border-box; min-height: 44px; padding: 8px 0; color: var(--archive-accent-text); font-weight: 650; }
.research-deep-dive summary:focus-visible { outline: 2px solid var(--reading-accent); outline-offset: 4px; }
.research-deep-body { padding-top: 18px; border-top: 1px solid var(--reading-line); }
.research-deep-body h3 { margin: 24px 0 10px; }
@media (max-width: 720px) {
  .research-case .research-version-ledger { grid-template-columns: minmax(0, 1fr); }
  .research-case .research-version-ledger > div + div { border-left: 0; border-top: 1px solid var(--reading-line); padding: 16px 0 0; }
  .research-case .research-marginalia,
  .research-case .research-version-ledger,
  .research-case .research-deep-dive { padding: 16px; }
}
```

研究组件本身不添加动画，遵从现有全站 `prefers-reduced-motion`。样式使用现有 CSS 变量；背景资源失败时保留现有 `background-color: #0a1623`。

- [ ] **Step 4: 验证 GREEN、全量及静态检查。**

```bash
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/research-cases.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs counter-worker/tests/*.test.mjs
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/reading-theme.js
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check assets/learning-directory.js
/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-pytorch.mjs --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习' --check
git diff --check
```

预期全量不少于 328/328、0 fail；同步检查 32 notes、7 stages、29 remote images、0 warnings；语法和 diff 检查 exit 0。

- [ ] **Step 5: 浏览器验收。** 从隔离工作区启动本地静态预览，用浏览器逐页检验 1440×900、1024×768、720×900、320×568 × 昼夜；每页检查无水平溢出，两个案例的 `<details>` 默认收起且键盘 Enter/Space 可展开/收起、焦点可见、文字可选择、44px 触摸目标、长 ID 和外链不裁切、截图比例正常；总览仍可到两个案例。检查 reduced-motion、系统光标、背景图失败时底色可读。工具无法直接模拟的 OS 设置、真实手指触摸或请求拦截必须在报告中标明“仅静态/CSS 合同验证”，不得声称实际模拟。

- [ ] **Step 6: 自审并提交。**

```bash
git add assets/research-cases.css tests/research-cases.test.mjs
git diff --cached --check
git commit -m "style: present research experiments as readable field notes"
```

报告保存 `.superpowers/sdd/task-3-research-depth-report.md`，附四视口/昼夜验收矩阵和不能直接模拟的边界，随后独立 reviewer。

## Final gate

三任务均经独立 task reviewer 批准后，针对本计划起点（规格提交 `eac0bc4`）至当前 HEAD 生成完整 diff package，派独立全分支 reviewer 核对事实、分母、来源、范围、无障碍和测试。按 reviewer 结果由独立修复 agent 修复并复审。最终重新跑全量 ≥328、JS syntax、真实来源 sync 和 `git diff --check`；核对只改了本计划允许的文件、原有未提交报告未被暂存、主页/笔记正文/现有 URL 未变。是否合并推送，按本轮明确的发布授权处理，不以测试通过代替授权。
