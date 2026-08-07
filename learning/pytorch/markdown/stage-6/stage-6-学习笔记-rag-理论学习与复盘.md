# Stage 6 学习笔记：RAG 理论学习与复盘

> 这是一份根据我的实际学习过程整理的个人复习笔记。
>
> 本轮目标不是立刻搭框架或训练大模型，而是先理解最小 RAG 的数据流、模块职责、shape、可追溯来源，以及回答出错时如何定位。
>
> 本笔记保留了我在学习中提出的关键问题、自己的回答和需要修正的点，供后续实现、复盘和面试使用。

---

## 0. 本轮学习边界与完成状态

### 已完成

1. RAG 解决的问题，以及它和直接调用 LLM、BERT 微调的区别；
2. 离线建库与在线问答两条数据流；
3. document、chunk、metadata、embedding、向量检索、Top-k、context、Prompt、generator、引用来源；
4. embedding 矩阵、query embedding、相似度分数的 shape；
5. 检索失败、生成失败、引用失败的区分；
6. RAG 理论口述验收。

### 尚未开始

- 没有创建 RAG 项目代码；
- 没有安装新的 Python 依赖；
- 没有下载 Embedding 模型或外部文档；
- 没有接入 API、LangChain、LlamaIndex、向量数据库、本地 LLM、rerank、hybrid search 或 query rewriting；
- 没有进行 RAG 评测。

因此，当前完成的是项目任务 1：RAG 理论学习与复盘。后续实现必须从透明的最小版本开始。

---

## 知识网络：与已有笔记的连接

本笔记不是孤立的 RAG 术语表，而是建立在前面 PyTorch、Attention、BERT 和 LoRA 学习之上。

- **文本如何变成模型输入**：[[Notes/Pytorch学习/stage4/Day 3 学习笔记：HuggingFace BERT tokenizer 与 DataLoader|Stage 4 Day 3：BERT tokenizer 与 DataLoader]]  
  RAG Embedding 同样先把文本转换为模型输入，但 input_ids 不是最终检索向量。

- **Transformer 输出、CLS 与分类任务**：[[Notes/Pytorch学习/stage4/Day 4 学习笔记：BERT 最小微调闭环|Stage 4 Day 4：BERT 最小微调闭环]]  
  对比 BERT 分类的 CLS 表示 -> logits，与 RAG 的 token 表示 -> pooling -> embedding。

- **向量比较的前置知识**：[[Notes/Pytorch学习/stage4/Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention|Stage 4 Day 1：Scaled Dot-Product Attention]]  
  Attention 内部的 QK 相似性与 RAG 的 query-chunk 相似度都涉及向量比较，但对象、目标和输出不同。

- **RAG 与微调的边界，以及后续的本地资料**：[[Notes/Pytorch学习/stage5/Stage 5 学习笔记：BERT 全量微调与 LoRA 参数高效微调对比实验|Stage 5：BERT 全量微调与 LoRA 对比实验]]  
  它既用于理解 RAG 与微调的边界，也可作为后续最小 RAG 的本地知识库文档。

建议复习路径：

~~~text
Stage 4 Day 3：文本如何变成模型输入
-> Stage 4 Day 1：Transformer 如何比较和聚合信息
-> Stage 4 Day 4：BERT 如何输出分类结果
-> Stage 5：为什么微调知识写入参数
-> 本笔记：为什么 RAG 将外部知识留在文档库中
~~~

---

## 1. RAG 要解决什么问题

RAG 的核心不是把新知识训练进模型参数，而是：

~~~text
先从外部资料中检索证据
再把证据交给 LLM 生成回答
~~~

它适合处理会更新、需要来源、需要回查的知识，例如最新岗位 JD、项目资料、制度文档、技术文档。

三种方案的边界：

| 方案 | 知识主要在哪里 | 面对更新资料 | 是否训练 |
| --- | --- | --- | --- |
| 直接调用 LLM | 模型原有参数与当前 Prompt | 可能不知道或猜测 | 否 |
| BERT 微调 | 微调后的模型参数 | 需要新数据并重新训练 | 是 |
| RAG | 外部文档库 | 加入或更新文档后可重新检索 | 否 |

关于 BERT 微调与 LoRA 的实际对比，可回看 [[Notes/Pytorch学习/stage5/Stage 5 学习笔记：BERT 全量微调与 LoRA 参数高效微调对比实验|Stage 5 LoRA 对比实验]]。

我的判断例子：

| 场景 | 合适方案 | 原因 |
| --- | --- | --- |
| 查询学校今年的奖学金申请条件 | RAG | 资料是最新事实，且需要来源 |
| 把评论分为正面或负面 | BERT 微调 | 是稳定的固定分类任务 |
| 将已有中文改写得更简洁 | 直接 LLM | 不依赖特定外部事实 |

注意：RAG 不保证答案一定正确。正确答案依赖于检索是否找对证据，以及 LLM 是否忠实依据 context 回答。

---

## 2. 最小 RAG 的完整数据流

RAG 分为离线建库和在线问答。

~~~text
离线建库：
document
  -> 清洗、切分
  -> chunk + metadata
  -> Embedding
  -> embedding 矩阵与 metadata 索引

在线问答：
query
  -> query embedding
  -> 与全部 chunk embeddings 计算相似度
  -> Top-k chunk
  -> context
  -> Prompt
  -> LLM
  -> 答案 + 引用
~~~

离线建库不是训练：

- 不需要标签；
- 不计算 loss；
- 不执行 backward；
- 不执行 optimizer.step；
- 不更新 Embedding 模型参数。

它只是使用已经预训练好的模型，将文本转换成方便检索和比较的向量。

文档新增或修改时，只需要对变化的文档重新执行：

~~~text
加载 -> 清洗 -> 切分 -> 生成 embedding -> 保存 metadata -> 加入索引
~~~

旧文档没有变化时，不需要重新计算它们的 embedding，更不需要重新训练模型。

---

## 3. Document、chunk 与 metadata

### 3.1 三个对象

| 对象 | 含义 |
| --- | --- |
| document | 一份完整资料，例如一篇 LoRA 学习笔记或一份岗位 JD |
| chunk | 从 document 中切出的、可独立检索的小片段 |
| metadata | 说明 chunk 来源和位置的附加信息 |

后续可把 [[Notes/Pytorch学习/stage5/Stage 5 学习笔记：BERT 全量微调与 LoRA 参数高效微调对比实验|LoRA 对比实验笔记]] 作为本地 document 的示例来源。

如果一篇文档同时讲 Transformer、LoRA、RAG、MPS，整篇只生成一个向量会混合多个主题。将它切成主题相对单一的 chunk 后，query 更容易找回真正相关的证据。

### 3.2 chunk size 与 overlap

| 切分选择 | 影响 |
| --- | --- |
| chunk 太小 | 容易丢失上下文，例如不知道“它”指什么 |
| chunk 太大 | 混入多个主题，检索不够精确，也占用 Prompt 空间 |
| 有适当 overlap | 相邻 chunk 保留少量衔接文本，减少边界断裂 |
| overlap 太大 | 文本重复、chunk 数更多，检索结果可能重复 |

没有对所有资料都正确的 chunk size。第一版先选择容易观察的规则，之后再通过检索结果和失败案例比较。

### 3.3 metadata 的最小内容

~~~text
chunk_id:     lora_note_002
text:         LoRA 冻结预训练模型权重，只训练低秩增量矩阵……
source_file:  LoRA 学习笔记.md
title:        LoRA 基本原理
position:     第 2 节、页码或字符范围
~~~

必须保持：

~~~text
embedding[i] <-> chunks[i].text <-> chunks[i].metadata
~~~

text 负责提供证据内容；metadata 负责证明证据来源并支持追溯。

只保存 text 和 embedding 时，系统仍能找回该 text，但不能可靠知道它来自哪份完整文档、哪个标题或哪个位置，因此无法进行可靠引用、回查和调试。

---

## 4. Embedding：从文本到语义向量

Embedding 模型的计算主线：

~~~text
sentence 或 chunk
  -> tokenizer
  -> input_ids [L]、attention_mask [L]
  -> Transformer Encoder
  -> token hidden states [L,H]
  -> pooling
  -> sentence embedding [D]
~~~

### 4.1 D 是如何得到的

D 不是由句子长短算出的，也不是运行时任意指定的数字。它由模型架构决定。

例如，BERT Base 的 hidden size 是 768，表示每个 token 经 Transformer 后有 768 个数：

~~~text
token hidden states: [L,768]
~~~

某个小型 Embedding 模型可以被设计为输出 384 维：

~~~text
token hidden states: [L,384]
sentence embedding: [384]
~~~

因此：

- L 由当前文本的 token 数决定；
- H 或 D 由模型设计决定；
- 简单模型中常见 D = H；
- 若模型在 Encoder 后增加投影层，则可能 D 不等于 H。

384 是常见小型 Embedding 模型的一个示例维度，不是 RAG 的固定规则。实际项目必须读取具体模型实际输出的 shape。

### 4.2 与 BERT tokenizer 的联系和区别

我之前的 BERT 输入处理可回看 [[Notes/Pytorch学习/stage4/Day 3 学习笔记：HuggingFace BERT tokenizer 与 DataLoader|Stage 4 Day 3：BERT tokenizer 与 DataLoader]]；分类闭环可回看 [[Notes/Pytorch学习/stage4/Day 4 学习笔记：BERT 最小微调闭环|Stage 4 Day 4：BERT 最小微调闭环]]。

我之前的 BERT 分类数据流：

~~~text
文本 -> tokenizer -> input_ids / attention_mask / token_type_ids
     -> BERT
     -> [CLS] 表示 [H]
     -> classifier
     -> logits [2]
~~~

RAG Embedding 数据流：

~~~text
chunk -> tokenizer -> Encoder
      -> token 表示 [L,H]
      -> pooling
      -> embedding [D]
~~~

Tokenizer 只是第一步。input_ids 是词表中的离散编号，不是语义向量；真正用于检索的是 Transformer 输出再汇总得到的 embedding。

### 4.3 Pooling 的含义

Pooling 可以理解为一种有信息损失的聚合或压缩：

~~~text
多个 token 表示 [L,D]
      -> pooling
整段文本表示 [D]
~~~

它与 CNN 中 pooling 的核心思想相同：从多个位置的表示中汇总出更小的整体表示。

区别在于压缩方向：

| 场景 | 原始表示 | 汇总方向 |
| --- | --- | --- |
| CNN | [C,H,W] | 图像的高、宽方向 |
| RAG Embedding | [L,D] | token 维度 L |

常见方式：

| 方法 | 从 [L,D] 到 [D] |
| --- | --- |
| Mean pooling | 对所有有效 token 的向量逐维平均 |
| Max pooling | 每个维度取所有 token 的最大值 |
| CLS 表示 | 直接取 CLS token 对应的向量 |

真实 mean pooling 必须结合 attention_mask，避免 PAD token 参与平均。

---

## 5. 向量空间、相似度与 Top-k

Embedding 模型已在训练阶段学习到：语义相近的文本应该在同一向量空间中更接近。

这里的 query 与 Attention 中的 Q 不是同一个工程对象。可关联 [[Notes/Pytorch学习/stage4/Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention|Stage 4 Day 1：Scaled Dot-Product Attention]]：Attention 在一个序列内部计算 token-to-token 的 QK 分数；RAG 则用整段 query 的 embedding 与文档 chunk 的 embedding 进行检索排序。

例如：

~~~text
query：LoRA 为什么能减少可训练参数？

chunk A：LoRA 冻结原始权重，只训练低秩增量矩阵。
chunk B：RAG 先检索相关文档，再把证据交给 LLM。
~~~

经过同一个 Embedding 模型编码后，query 与 chunk A 的相似度通常会高于 query 与 chunk B。

每个维度通常没有可直接命名的人类含义，例如不能说“第 17 维专门表示 LoRA”。语义由全部维度共同表示。

### 5.1 为什么 query 和 document 必须使用兼容模型

Embedding 的数字是模型定义的语义坐标，不是通用坐标。

~~~text
文档用模型 A
query 用不兼容模型 B
-> 即使维度同为 [384]，坐标含义也可能不一致
-> 相似度没有可靠含义
~~~

基础 RAG 中，chunk 与 query 应使用同一个 Embedding 模型，以及兼容的 tokenizer、pooling 和归一化方式。

### 5.2 核心 shape

设知识库中有 N 个 chunk，模型输出 D 维向量：

~~~text
全部 chunk embeddings：E [N,D]
一个 query embedding： q [D]
相似度分数：scores [N]
Top-k 索引：top_k_indices [k]
Top-k 分数：top_k_scores [k]
~~~

例如：

~~~text
E [100,384] @ q [384] -> scores [100]
~~~

每个 scores[i] 对应第 i 个 chunk。

### 5.3 余弦相似度

基础检索常用余弦相似度：

~~~text
cosine_similarity(q,e)
= (q · e) / (||q|| x ||e||)
~~~

分数越高，表示当前向量方向越接近、语义越可能相关。

但相似度分数不是答案正确率：

~~~text
score = 0.91
不等于
答案有 91% 的正确概率
~~~

### 5.4 Top-k

示例：

~~~text
scores = [0.72, 0.91, 0.34, 0.88, 0.65]
index     0     1     2     3     4
k = 3

top_k_indices = [1,3,0]
top_k_scores  = [0.91,0.88,0.72]
~~~

必须区分：

- score 是相关程度；
- index 是去 chunks[index] 和 metadata[index] 找原文与来源的位置。

k 也不是越大越好：

| k 的选择 | 风险或收益 |
| --- | --- |
| 太小 | 可能漏掉多证据问题所需的片段 |
| 合适 | 保留足够证据，减少无关内容 |
| 太大 | 把低相关内容塞入 Prompt，干扰生成并占用上下文 |

---

## 6. Context、Prompt 与生成

Top-k 检索结果中，真正进入 LLM 的是 chunk 原文与来源，不是 embedding：

~~~text
embedding：用于找到相关 chunk
chunk 原文：用于给 LLM 阅读
metadata：用于显示来源和定位原文
~~~

context 的例子：

~~~text
[S1：LoRA 学习笔记.md，lora_002]
LoRA 冻结预训练模型权重，只训练低秩增量矩阵。

[S2：LoRA 学习笔记.md，lora_003]
低秩矩阵使可训练参数量显著减少。
~~~

最小 Prompt 应包含：

~~~text
回答规则：
只能依据提供的 context 回答。
证据不足时明确说明无法确定。
回答应标注引用来源。

context：
[S1] ...
[S2] ...

用户问题：
...
~~~

无证据时的正确行为：

~~~text
context 只说明：LoRA 使用低秩矩阵。
问题：本项目 LoRA 的 rank 是多少？

正确回答：
提供的资料没有说明本项目的 LoRA rank，无法确定。
~~~

不能因为常见设置可能是 rank=8，就将猜测写成项目事实。

Prompt 不是绝对保证。LLM 仍可能曲解或编造，所以每次问答要保存：

~~~text
query
retrieved chunk_id、rank、score
context
prompt
answer
citations
~~~

---

## 7. 来源、引用与可信度

检索到来源，只代表 chunk 与 query 相近；不代表它一定支持答案中的每一句话。

一个可靠引用至少要满足：

| 检查点 | 含义 |
| --- | --- |
| 来源存在 | chunk_id 与文档真实存在 |
| 定位准确 | 能回到正确文件、标题、页码或文本位置 |
| 证据支持 | 原文支持答案中的具体说法 |
| 覆盖完整 | 答案的重要事实都有对应证据 |

例如：

~~~text
[S1] 本项目的 LoRA rank 设置为 8。
[S2] LoRA 作用于 BERT 的 query 和 value 模块。

答案：
本项目使用 rank=8，并将 LoRA 应用于 query 和 value 模块。

正确引用：[S1][S2]
~~~

原因不是两个 chunk 都“涉及”答案，而是答案中有两个可核查事实：

- rank=8 由 S1 支持；
- query 与 value 由 S2 支持。

程序应检查回答中的引用标签是否存在于本次检索出的标签列表中，避免 LLM 编造不存在的 S3。

---

## 8. 为什么第一版暂不实现高级模块

基础版本只做：

~~~text
清洗 -> chunk -> embedding -> 向量相似度 -> Top-k -> Prompt -> LLM
~~~

原因是先建立可观察、可评测的基线。若一开始加入太多模块：

~~~text
chunking + embedding + rerank + hybrid search + query rewriting
~~~

回答出错时就很难判断问题出在哪一层。

| 模块 | 解决什么问题 | 何时考虑 |
| --- | --- | --- |
| rerank | 在候选集合内做更精细排序 | 正确 chunk 已进 Top-K，但未进最终 Top-k |
| hybrid search | 结合语义检索与关键词检索 | 精确术语、文件名、rank=8 等常被遗漏 |
| query rewriting | 改写模糊 query | 用户问题太短、代词不清或表达差异很大 |

rerank 的两阶段流程：

~~~text
向量检索：全部 N 个 chunk -> Top-K 候选，例如 K=10
rerank：query 与 K 个候选逐对判断 -> rerank scores [K]
最终选择：Top-k，例如 k=3
~~~

如果正确 chunk 已在 Top-10 的第 8 位，但系统只将前 3 个 chunk 放进 Prompt，应优先考虑 rerank。

---

## 9. RAG 失败定位

出现错误时，按证据流动顺序排查：

~~~text
文档是否有证据？
-> 正确事实是否被切入一个 chunk？
-> 正确 chunk 是否进入 Top-k？
-> 是否被放入 context？
-> LLM 是否忠于 context？
-> 引用是否真的支持答案？
~~~

| 层级 | 失败现象 | 可能原因 |
| --- | --- | --- |
| 文档覆盖 | 知识库没有答案 | 文档未导入、资料过期或缺失 |
| chunking | 事实被拆散、上下文丢失 | chunk 太小、边界不合理 |
| 检索 | 正确 chunk 未进 Top-k | Embedding、query 表达或关键词问题 |
| 排序与 context | 正确候选未进 Prompt | Top-k 太小、排序或组装问题 |
| 生成 | context 有正确证据，答案仍错误 | Prompt 约束弱、LLM 曲解或编造 |
| 引用 | 引用不支持答案 | 标签选错或未验证 |

例子：

~~~text
[C7]：本项目的 LoRA rank 设置为 8。

Top-3：[C2,C7,C9]
context：[C2,C7,C9]
answer：本项目的 LoRA rank 是 16。[C7]
~~~

此例首先是生成失败：正确证据 C7 已经在 context 中，LLM 仍生成 16。

同时也是引用失败：C7 支持 rank=8，与答案中的 rank=16 矛盾。

检索质量和生成质量必须分开：

| 质量类型 | 核心问题 | 示例 |
| --- | --- | --- |
| 检索质量 | 正确证据有没有找回来 | Recall@k |
| 生成质量 | 回答是否正确、忠于证据、引用正确 | 人工正确性、忠实性、引用检查 |

---

## 10. 我在本轮提出的关键问题与回答

### Q1：Embedding 的 384 维是怎么得到的？是随便举的例子吗？

答：384 是常见小型 Embedding 模型的一个示例，不是 RAG 固定规则，也不是由句子长度计算得到。最终向量维度 D 由模型架构决定；实际项目应读取具体模型输出的 shape。

### Q2：离线建库是否相当于 BERT tokenizer 把 sentence 转成 input_ids、attention_mask、token_type_ids？

答：两者有联系，但不相同。Embedding 流程通常包含 tokenizer；不过 input_ids 等只是模型输入。真正保存用于检索的是 Transformer 输出经 pooling 后的语义向量，而不是 input_ids。

### Q3：Pooling 是不是 CNN 中的知识？可以理解为信息压缩吗？

答：是同一类“聚合多个位置的信息”的思想。CNN 常在空间维度汇总，RAG Embedding 在 token 维度 L 汇总。它可以理解为有信息损失的压缩：从 [L,D] 得到 [D]，保留整段文本的语义概括，但不再保留每个 token 的完整细节和位置。

### Q4：只有 chunk text 和 embedding，不保存 metadata，能否检索？

答：能找回 chunk text，但无法可靠知道它来自哪份完整文档、哪个位置。因此最终答案无法可靠引用、用户无法回查，调试和文档管理也会变困难。

### Q5：Top-k 的分数和索引有什么区别？

答：分数表示相关程度；索引表示对应 chunk 在列表中的位置。以 scores = [0.72,0.91,0.34,0.88,0.65]、k=3 为例：

~~~text
top_k_scores  = [0.91,0.88,0.72]
top_k_indices = [1,3,0]
~~~

程序利用 indices 取回 chunks[index] 和 metadata[index]。

### Q6：context 只说明 LoRA 使用低秩矩阵，却被问到本项目 rank 是多少，应怎样回答？

答：提供的资料没有说明本项目的 LoRA rank，无法确定。不能以模型已有知识、常见配置或猜测替代证据。

### Q7：一个答案同时说明 rank=8 和作用于 query/value，应该引用哪个 chunk？

答：应同时引用分别支持这两个事实的 chunk。引用的目标是让每个重要事实有对应证据，而不是仅仅让答案后面出现一个来源标签。

### Q8：正确 chunk 已在 Top-10 但排第 8，最终只用 Top-3，优先考虑什么？

答：优先考虑 rerank。正确证据已经被第一轮检索找到，问题在候选排序不够精细；此时 Prompt 修改不是首要改进方向。

### Q9：正确证据已进入 context，LLM 却给出相反答案并引用该证据，属于什么失败？

答：首先是生成失败，同时也是引用失败；不是检索失败。

### Q10：query embedding 是什么？为什么不能把 embedding 直接喂给 LLM？

答：query embedding 是使用与文档相同的 Embedding 模型，将用户问题编码为 q [D]，以便在同一向量空间中比较相似度。embedding 是用于快速比较语义的压缩向量，不保留完整、可读、可引用的原文细节。RAG 不是把向量喂给 LLM，而是用向量找到文本，再把文本交给 LLM。

---

## 11. 我的任务 1 口述版本

~~~text
最小 RAG 分为离线建库和在线问答。

离线阶段，我先把文档清洗、切成带 metadata 的 chunk，
再用预训练 Embedding 模型生成全部 chunk 的向量矩阵 E [N,D]。
这个过程只做前向编码，不训练模型参数。

在线阶段，用户问题被编码为 query embedding q [D]。
系统计算 q 和 E 中每个 chunk 向量的相似度，得到 scores [N]，
排序后取 Top-k 的索引、分数、原文和来源。

向量只用于检索；真正放入 Prompt 的是 Top-k chunk 的原文和 metadata。
LLM 依据 context 回答，并标注已有来源；若证据不足，应明确无法确定。

若答案出错，我依次检查：文档是否有证据、chunk 是否保留事实、
正确 chunk 是否进入 Top-k 和 context、LLM 是否忠于 context、
以及引用是否真的支持答案。
~~~

---

## 12. 任务 1 验收清单

- [x] 能解释 RAG、直接 Prompt、BERT 微调的适用边界
- [x] 能说明离线建库与在线问答
- [x] 能画出 document -> chunk -> embedding -> retrieval -> context -> Prompt -> LLM 的流程
- [x] 能解释 E [N,D]、q [D]、scores [N]、Top-k
- [x] 能解释 D 由模型架构决定，以及 pooling 的作用
- [x] 能说明 embedding 与原文在 RAG 中的不同职责
- [x] 能解释 metadata、来源和引用的必要性
- [x] 能说明 rerank、hybrid search、query rewriting 暂不进入第一版的原因
- [x] 能区分检索失败、生成失败和引用失败
- [x] 完成一次最小 RAG 理论口述

---

## 13. 下一步

进入任务 2 前，先只设计最小 RAG 项目的实现范围、目录和数据边界。

第一版目标保持透明：

~~~text
少量本地文档
-> 加载、清洗、切分
-> Embedding
-> NumPy 向量相似度
-> Top-k 原文、分数和来源
-> Prompt 组装
-> 可替换的生成器接口
-> 保存完整检索与生成日志
~~~

后续涉及依赖安装、模型下载、网络访问或 API Key 时，需要先说明用途、成本、网络要求和替代方案，再决定是否执行。
