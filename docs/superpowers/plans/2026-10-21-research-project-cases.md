# “烛微观澜”项目展示实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 ScholarLens 与 RetailFlow 的研究总览和两个可核实的静态案例页。

**Architecture:** 复用现有档案页眉、横幅、主题资源和静态 GitHub Pages 路由。总览及案例页用原生 HTML；单独的研究页 CSS 只负责项目卡、章节、指标表和流程示意，不新增运行时 JavaScript。

**Tech Stack:** HTML、CSS、Node `node:test`，现有 `assets/reading-theme.js`。

## Global Constraints

- 只修改 `/Users/yyy/Documents/Codex/2026-07-18/https-snowstorm-121-github-io-1-2/work/site/.worktrees/clock-lyrics-widget`；保留已存在的 `.superpowers/sdd/task-4-report.md` 修改。
- `/Users/yyy/code/ScholarLens` 与 `/Users/yyy/code/RetailFlow` 只读；只发布它们已跟踪、公开、可核实的资料。
- 不改变主页外观、PyTorch 笔记正文、图片字节或既有公开 URL，不部署项目后端。
- 新页面沿用 `library.css`、`reading-theme.css`、`archive-directory.css`、现有同底色页眉及原生昼夜开关；默认系统光标；所有文字可选择。
- 案例章节顺序为“问题航标 → 工程舱图 → 实验潮汐 → 结论星屿”；总览和案例页在无脚本下仍有可用内容与相对链接。
- 评测数据不得改变分母或指标含义；RetailFlow 的演示、工程测试、正式模型评测必须分开表述。署明上游来源和研究限制。
- 先 RED 再 GREEN，每任务提交并接受独立审阅。全量测试至少 303 且全部通过；最终独立全分支审阅批准后才合并推送。

## Files and interfaces

- 修改 `research/index.html`：两个 `<li class="archive-project">` 项目入口，标题、状态、简介、要点与两个原生链接。
- 新增 `assets/research-cases.css`：仅作用于 `.archive-research`、`.research-case` 的布局和图表。`/research/` 与两个案例页都加载。
- 新增 `research/scholarlens/index.html`、`research/retailflow/index.html`：共享现有页眉和四章节语义结构，静态相对路径；`research/assets/scholarlens-demo.png` 是从 ScholarLens 已跟踪文件拷贝的原字节。
- 修改 `tests/archive-atlas.test.mjs` 中研究页过时的四个占位断言；新增 `tests/research-cases.test.mjs` 验证案例内容、资源、导航与声明边界。不要改学习、生活和笔记测试。

## Task 1：研究总览与共享布局

**Files:** `research/index.html`, `assets/research-cases.css`, `tests/archive-atlas.test.mjs`。

**Interface:** 总览公开 `./scholarlens/`、`./retailflow/`；两张卡分别链接对应 GitHub 仓库。共享 CSS 后续供两个案例页引用。

- [ ] **Step 1 RED:** 把研究页四个未发布测试换成至少六个针对两项目卡的检查：数量与顺序、具体状态/描述、案例页链接、GitHub 链接、链接目标文件存在、无虚假的“尚未发布”。保留生活页四个未发布测试。命令：`/Users/yyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/archive-atlas.test.mjs`；预期新测试因为入口缺失而失败。
- [ ] **Step 2 GREEN:** 将总览旁栏改成“项目索引 · 2 项”与两个原生锚点；主列改为两张静态项目卡。准确简述 ScholarLens 的单篇论文证据问答和 RetailFlow 的模拟零售 CLI Agent；分别标注“研究原型”与“实验原型”。`archive-photo`、页眉导航、主题按钮保持原样，新增 `research-cases.css` 链接。CSS 提供有留白的卡片、紧凑的两条链接、响应式堆叠、焦点沿用现有规则；不增加脚本或动效。
- [ ] **Step 3 GREEN verification:** 同一单测通过；运行全量测试 `.../node --test tests/*.test.mjs counter-worker/tests/*.test.mjs`，总数不少于 303；`git diff --check`。
- [ ] **Step 4 Commit:** 仅 stage 这三个文件，`git commit -m "feat: publish research project overview"`，自检提交不含既有脏文件。

## Task 2：ScholarLens 案例

**Files:** `research/scholarlens/index.html`, `research/assets/scholarlens-demo.png`, `tests/research-cases.test.mjs`；必要时仅给 `assets/research-cases.css` 补充案例共用样式。

**Interface:** 在 `/research/scholarlens/` 用相对路径加载 `../../assets/` 共享资源，`../assets/scholarlens-demo.png` 图片，`../` 返回总览，`../retailflow/` 去另一案例。四章节 ID 固定 `problem`、`engineering`、`experiments`、`conclusion`。

- [ ] **Step 1 RED:** 添加测试检查页面存在、页眉/主题与四章节次序、站内相对路径解析、真实图片字节与源仓库已跟踪文件的 SHA-256 一致、评测分母及数值、限制与上游链接；先跑 `.../node --test tests/research-cases.test.mjs`，预期因页面不存在而失败。
- [ ] **Step 2 GREEN:** 创建静态案例。问题：单篇论文内可核对的问答。工程：正文/标注隔离、段落位置、BM25/Dense/RRF、Top-5、本地生成和引用/审计；截图与“演示题不计入正式评测”说明。实验：Test300 中240可回答的 EvidenceRecall@5 表（BM25 0.4654、Dense 0.6290、Hybrid 0.5901）；冻结100题生成的 Answer F1 0.3347、错误拒答22/80、截断9/100；三个仓库公开失败案例。结论：不保证事实正确、未做跨论文综合或生产服务；标注 Kotaemon、QASPER 与自身改造，链接仓库 `README.md`、`reports/test.md`、`reports/t9-failures.md`、`UPSTREAM.md`。
- [ ] **Step 3 Asset:** 将已跟踪 `/Users/yyy/code/ScholarLens/assets/scholarlens-demo.png` 原字节复制到 `research/assets/scholarlens-demo.png`，不编辑图像。页面使用 `width`/`height`、`max-width:100%`、`height:auto` 和叙述性替代文本。
- [ ] **Step 4 GREEN verification:** 聚焦测试、全量测试（≥303）、`git diff --check` 均通过；自行核对数据与仓库公开报告相同。
- [ ] **Step 5 Commit:** 仅 stage 本任务的文件，`git commit -m "feat: add ScholarLens research case"`。

## Task 3：RetailFlow 案例

**Files:** `research/retailflow/index.html`, `tests/research-cases.test.mjs`；必要时仅给 `assets/research-cases.css` 补充流程示意样式。

**Interface:** 同 Task 2 的页眉/章节 ID；`../` 返回总览，`../scholarlens/` 去另一案例。流程示意是语义 HTML 列表，标注“流程示意”，不用伪截图、SVG 外链或 JS 绘制。

- [ ] **Step 1 RED:** 添加测试检查页面存在、四章节次序、站内相对链接、原生流程示意标签、B0/B1/B2 的 Dev/Test 数据、评测结论及上游链接；先跑聚焦测试，预期页面缺失失败。
- [ ] **Step 2 GREEN:** 问题：模拟零售执行时的确认与恢复边界。工程：LangGraph/Ollama 工具循环、身份/所有权校验、具体参数提案、用户确认、参数变更失效、SQLite 业务状态与回执事务；绘制“模型提出 → 应用校验/提案 → 用户确认 → 事务提交/回执”的静态流程。实验：真实跨进程取消订单演示与无需模型的保护层演示明确区分；Dev9/Test4 下 B0/B1/B2 均 0/9、0/4，并解释身份追问/工具协议失败，不夸大一次演示和回归测试。结论：实验性本地 CLI/模拟业务、不接真实订单或支付；署明 react-agent 与 τ2 retail；链接仓库 `README.md`、`reports/t7-test.md`、`docs/demos.md`、`UPSTREAM.md`。
- [ ] **Step 3 GREEN verification:** 聚焦测试、全量测试（≥303）、`git diff --check` 均通过；核对数字与公开报告。
- [ ] **Step 4 Commit:** 仅 stage 本任务文件，`git commit -m "feat: add RetailFlow research case"`。

## Task 4：响应式与可访问性合同

**Files:** `tests/research-cases.test.mjs`, `assets/research-cases.css`；若验收发现确切缺陷，可触及对应研究页 HTML。

- [ ] **Step 1 RED:** 为研究页增加有意义的合同测试：每页只有一个 `h1` 和当前研究导航、章节原生锚点均有对应 ID、图片带替代文本、指标表有 `<caption>` 与 `<th scope>`、外链是 HTTPS GitHub 地址、CSS 在 720px 堆叠并允许长链接换行、无 `user-select:none` 和自定义 cursor；使至少一项测试先因缺失而失败。
- [ ] **Step 2 GREEN:** 只修测试暴露的研究页缺陷；保持选择、焦点、系统指针和昼夜主题。长数字表允许容器内滚动但页面不得水平溢出。无动画，尊重现有 reduced-motion 处理。
- [ ] **Step 3 Verify:** 运行聚焦与全量测试（≥303）、相关 JS `node --check assets/reading-theme.js` 和 `node --check assets/learning-directory.js`、真实 PyTorch 来源的 `scripts/sync-pytorch.mjs --source '/Users/yyy/Documents/知识库/Notes/Pytorch学习' --check`、`git diff --check`。对照 `git diff` 证明主页和 32 篇笔记正文未变。
- [ ] **Step 4 Browser acceptance:** 用真实浏览器检查 `/research/` 及两个案例在 1440×900、1024×768、720×900、320×568 的昼夜模式；记录水平溢出、内容顺序、截图、流程、表格、键盘、触摸目标、文本选择和背景资源失败回退。浏览器不能直接模拟的条件由 CSS/自动化合同核对，并如实记录。
- [ ] **Step 5 Commit:** 仅 stage 本任务实际变更，`git commit -m "test: verify research cases accessibility"`；如无代码变更，只记录验收，不制造空提交。

## Final gate

每任务由全新实现 agent 按 RED→GREEN、验证、提交；全新 reviewer 对照任务 brief 与 diff 作规格/质量两项判定。重要问题交修复 agent，再由 reviewer 复审。所有任务后派独立全分支 reviewer，对照本规格、计划和分支 diff 审查真实性、范围、可访问性和测试。最终批准后，在主 checkout 快进合并 `master`、推送 GitHub，核对功能分支 HEAD、本地 `master` 与 `origin/master` SHA 完全一致；验证公开 `/research/`、`/research/scholarlens/`、`/research/retailflow/` 及截图 HTTP 可访问。
