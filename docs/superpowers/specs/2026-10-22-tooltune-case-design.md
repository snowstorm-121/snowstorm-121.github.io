# ToolTune · 烛微观澜第三篇案例

## 已授权范围

用户要求将本地新项目 ToolTune 按 ScholarLens、RetailFlow 相同方式同步至个人主页。继续使用现有纸本研究手札与昼夜模式：研究总览增加第三个项目，新建 /research/tooltune/。仅在指定 clock-lyrics-widget 隔离工作区编辑；项目仓库只读。保持主页、两篇既有案例、笔记正文及既有 URL 不变。独立审阅通过后沿用已授权发布流程合并 master 并推送。

## 来源与内容

2026-10-22 核验本地干净 ToolTune HEAD 与 GitHub main 均为 82c53f9eb15e37e01f8f16e7ece33198e11ba1f4。页面证据链接固定此提交。来源是 README.md、UPSTREAM.md、reports/T2-balanced-protocol.md、reports/T3-validation.md、reports/T4-test.md、reports/evidence/t4/recomputed-comparison.json、reports/evidence/t3/selection.json，以及 src/tooltune/metrics.py、src/tooltune/train.py。历史报告的“未运行 T4”是阶段快照；当前状态以 T4 和 README 为准。

四章顺序继续为问题航标、工程舱图、实验潮汐、结论星屿。标题为 ToolTune · 工具调用微调；性质为本地量化 LoRA 实验，日期 2026-10-22。

- 问题：在 Apple M5 / 16 GB 上，对 MLX 4-bit Qwen3-4B-Instruct-2507 的单轮工具调用决策和参数输出做小预算可审计实验。
- 工程：Glaive 112,960 条原始对话，99,108 条严格解析通过；完整来源对话、工具家族和近重复规则分组，保留隔离记录。均衡抽样在正式评测前确定；Validation 100+100，Test 95+95，分组不拆分。规则内审计不等于语义或预训练层面无泄漏。
- 训练：冻结基座、最后 4 个 block q/v 投影、rank 8、327,680 可训练参数；200 optimizer updates / 800 microsteps，实际曝光训练池 4,000 条中的 800 条与 40,821 个监督 token。只监督当前 assistant，padding loss 边界通过回调修正。MLX scale=16 不是 PEFT alpha。Validation 的 B0/U100/U200 为 94/200、103/200、107/200，仅以 Validation 选 U200。
- 冻结 Test：严格决策匹配 B0 89/190（46.84%）、U200 100/190（52.63%），净增 11/190（5.79 个百分点）。gold 调用严格匹配 66/95→71/95；非调用动作匹配且完整结束 23/95→29/95；调用召回/工具名和全部 gold 调用中的 schema 有效均 88/95→91/95；截断 72/190→66/190。两臂同 prompt token、greedy、EOS、256-token 上限，无强制 JSON，首次失败保留。
- 配对记录：83 都对、17 改善、6 退化、84 都错；17=7 非调用在预算内结束+6 调用包裹恢复+4 参考参数对齐。展示明文标签和数字，不仅依赖颜色。均衡集恒不调用的动作参照是 50%，不是另一个实测模型。未计算显著性或置信区间。
- 真实样例：play_music 文本调用正确但没有播放音乐；日历样例 glaive-v2:037855:a4 退化为口头承诺；Ruby 代码样例 glaive-v2:081350:a2 的拒绝回答按动作计对，不代表内容质量改善。参考密码不在可见上下文的标签疑点可放展开细节，不复制密码字符串。
- 边界：所有 held-out 调用仅一个候选工具；Test 95 个非调用只有 1 个带可用工具；不证明复杂路由、广泛不适配工具拒绝、自然语言质量或真实 API 成功。局部只读工具演示使用构造文本，不计入 Test。
- 原创工作：解析/隔离、分组采样、训练编排与 loss mask、冻结契约、评分与复算。MLX/MLX-LM、Qwen 和 Glaive 的架构、量化、优化器、模型、数据归上游；量化权重是社区转换。68 项工程测试不等于模型质量。原始数据、权重、adapter、完整原始预测未随公开仓库发布，不声称一键完整复现。

## 呈现方式

复用纸白/深炭纸、铜色文字、封面条纹和横向章节索引。新增专属的训练记录（dl）、冻结对照表、配对结果四格记录（dl）和原生 details 深读。训练流程使用有序列表并标明流程示意；不造假产品截图、动态图或网络调用。CSS 仅新增 .research-case--tooltune 范围，充分复用现有共享样式，四格窄屏两列/单列自然收拢。

研究总览索引改 3 项，在原两项后增加 ToolTune 简介、实验原型状态、案例与 GitHub 链接；原两项文字保持不变。新案例提供研究总览及其他两个案例入口，旧案例不修改。

## 验收

基线 334/334。新增有意义的路由/资源/事实分母/证据链接检查，保留原覆盖；旧总览整页哈希保护改成原两项内容保护，以允许第三项新增。完整测试不得少于 334，相关 JS syntax、真实笔记源 --check 与 git diff --check 通过。浏览器检查总览与新案例四种视口 1440×900、1024×768、720×900、320×568、昼夜模式、原生 details 键盘操作、主题保持、长样本 ID、表格横向滚动、触摸目标；静态无动画与系统光标，无新图片依赖。实际浏览器工具不能模拟的条件应明确记录。

最终独立审阅后发布，验证功能分支、本地 master、origin/master 一致及公开页面资源可访问。保留已有 .superpowers/sdd/task-4-report.md 改动和主 checkout .DS_Store。
