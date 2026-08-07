# BERT 最小微调闭环

学习目标：使用 Day 3 的 batch 接入 BERT，完成 `BERT -> logits / loss -> backward -> optimizer.step()`，再组织成 1 个 epoch，并使用独立验证数据检查流程。

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 6 周 Day 4。前置：[[stage4/Day 3 学习笔记：HuggingFace BERT tokenizer 与 DataLoader|Day 3：HuggingFace BERT tokenizer 与 DataLoader]]。

主线：`batch -> BERT -> logits / loss -> backward -> optimizer.step() -> 1 个 epoch -> validation`。

---

## 〇、今天完成了什么

1. 使用 `BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=2)` 加载预训练 BERT 分类模型。
2. 理解 `input_ids`、`attention_mask`、`token_type_ids` 和句子级 `labels`。
3. 使用 MPS 完成 BERT 前向计算，得到 `logits` 和 `loss`。
4. 使用 `loss.backward()` 计算梯度。
5. 使用 `AdamW` 和 `optimizer.step()` 更新模型参数。
6. 使用当前小样本跑通 1 个 epoch。
7. 使用独立验证数据完成 `model.eval()`、`torch.no_grad()`、验证 loss 和准确率。
8. 没有使用完整 SST-2 数据集进行正式训练；完整数据集实验属于后置任务。

最终数据流：

```text
batch 字典 -> BERT Encoder + 分类头 -> logits -> loss
    -> loss.backward() -> optimizer.step() -> 1 个 epoch -> validation
```

---

## 一、BERT 到底是什么

BERT 是一个已经预训练过的 Transformer Encoder，负责根据上下文理解输入文本，并将 token 编号转换为有语义的向量表示。

```text
Tokenizer：文本 -> token 编号
BERT：token 编号 -> 上下文表示
分类头：上下文表示 -> 类别分数
```

BERT 不是 tokenizer，也不是标签。Day 3 的 tokenizer 负责准备 BERT 的输入；Day 4 才让 BERT 对这些字段进行前向计算。

BERT 内部会使用 Day 1、Day 2 学过的结构：

```text
输入 token 向量 -> Q/K/V 投影 -> Multi-Head Self-Attention
    -> 残差连接与 LayerNorm -> 前馈网络 -> 多层 Encoder
```

---

## 二、BERT 分类模型的输入和输出

本次 batch 的字段：

| 字段 | shape | 含义 |
|---|---:|---|
| `input_ids` | `[B, L]` | token 的词表编号 |
| `attention_mask` | `[B, L]` | 区分真实 token 与 padding |
| `token_type_ids` | `[B, L]` | 区分句子 A 与句子 B |
| `labels` | `[B]` | 每条句子的分类标签 |

本次：

```text
B = 2, L = 12, num_labels = 2
input_ids / attention_mask / token_type_ids -> [2, 12]
labels -> [2]
```

这是句子级分类，因此每条句子只有一个 label。`labels` 不是 `[B, L]`。

```python
model = BertForSequenceClassification.from_pretrained(
    "bert-base-uncased",
    num_labels=2,
)
```

模型可以理解为：

```text
BERT Encoder + 句子分类头
```

分类头大致是 `Linear(768, 2)`，所以：

```text
logits.shape == [B, 2] == [2, 2]
```

`logits` 是原始类别分数，不是概率；预测类别可以使用：

```python
predictions = outputs.logits.argmax(dim=1)
```

---

## 三、为什么会出现 `UNEXPECTED` 和 `MISSING`

加载报告中出现过：

```text
cls.predictions.*       UNEXPECTED
cls.seq_relationship.*  UNEXPECTED
classifier.weight       MISSING
classifier.bias         MISSING
```

这不是加载失败。

`cls.predictions.*` 属于 BERT 预训练时的掩码语言模型头，用于预测被遮住的 token；`cls.seq_relationship.*` 属于下一句预测头，用于判断句子 B 是否是句子 A 的下一句。当前情感分类任务不用它们，因此显示为 `UNEXPECTED`。

`classifier.weight` 和 `classifier.bias` 是当前句子分类任务需要的参数。原始 BERT 检查点没有当前情感分类任务，所以分类层被新建并随机初始化，显示为 `MISSING`，之后会通过微调训练。

```text
UNEXPECTED -> 预训练检查点中的旧任务头，当前不用
MISSING    -> 当前任务需要、但检查点中没有的新分类头
```

易混淆点：

```text
[CLS] token != cls.* 模块
```

`[CLS]` 是输入开头的特殊 token；`cls.*` 是模型内部预训练任务头的模块命名空间。

---

## 四、BERT 前向计算：得到 logits 和 loss

模型和 batch 必须位于同一个设备：

```python
model = model.to(device)

batch_on_device = {
    key: value.to(device)
    for key, value in batch.items()
}
```

前向计算：

```python
outputs = model(
    input_ids=batch_on_device["input_ids"],
    attention_mask=batch_on_device["attention_mask"],
    token_type_ids=batch_on_device["token_type_ids"],
    labels=batch_on_device["labels"],
)

logits = outputs.logits
loss = outputs.loss
```

内部数据流大致是：

```text
input_ids [2, 12] -> Embedding [2, 12, 768]
    -> Transformer Encoder -> 句子表示 -> 分类头 -> logits [2, 2]
```

传入 `labels` 后，模型会根据 `logits` 和正确答案计算 loss。实际验证：

```text
logits shape: torch.Size([2, 2])
loss shape: torch.Size([])
```

`loss.shape == torch.Size([])` 表示 loss 是一个标量。

---

## 五、反向传播和参数更新

创建优化器：

```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=2e-5,
)
```

单个 batch 的训练步骤：

```python
optimizer.zero_grad()

outputs = model(
    input_ids=batch_on_device["input_ids"],
    attention_mask=batch_on_device["attention_mask"],
    token_type_ids=batch_on_device["token_type_ids"],
    labels=batch_on_device["labels"],
)

loss = outputs.loss
loss.backward()
optimizer.step()
```

`loss.backward()` 只计算梯度；`optimizer.step()` 才根据梯度修改参数。

实际验证结果：

```text
classifier.weight.grad shape: torch.Size([2, 768])
classifier.bias.grad shape: torch.Size([2])
classifier.weight.grad exists: True
classifier.bias.grad exists: True
weight changed: True
bias changed: True
```

这说明分类层已经获得梯度，并且在 `optimizer.step()` 后发生了参数更新。

---

## 六、1 个 epoch 的最小训练闭环

```python
model.train()

for batch in data_loader:
    batch_on_device = {
        key: value.to(device)
        for key, value in batch.items()
    }

    optimizer.zero_grad()

    outputs = model(
        input_ids=batch_on_device["input_ids"],
        attention_mask=batch_on_device["attention_mask"],
        token_type_ids=batch_on_device["token_type_ids"],
        labels=batch_on_device["labels"],
    )

    loss = outputs.loss
    loss.backward()
    optimizer.step()
```

一个 epoch 表示 DataLoader 中所有 batch 都被模型看过一次。小样本实验中有 2 条样本、`batch_size=2`，因此 1 个 epoch 只有 1 个 batch。

实际验证结果：

```text
epoch 1/1, average loss: 0.7208
```

这里的目标是验证训练闭环，不是要求一次更新后 loss 立刻显著下降。

---

## 七、独立验证

验证阶段不更新参数：

```python
model.eval()

with torch.no_grad():
    outputs = model(
        input_ids=batch_on_device["input_ids"],
        attention_mask=batch_on_device["attention_mask"],
        token_type_ids=batch_on_device["token_type_ids"],
        labels=batch_on_device["labels"],
    )
```

训练与验证的区别：

| 训练 | 验证 |
|---|---|
| `model.train()` | `model.eval()` |
| 计算梯度 | `torch.no_grad()` |
| `loss.backward()` | 不执行 |
| `optimizer.step()` | 不执行 |

预测与准确率：

```python
predictions = outputs.logits.argmax(dim=1)
correct += (predictions == labels).sum().item()
accuracy = correct / total
```

实际验证结果：

```text
validation loss: 0.710591197013855
validation accuracy: 0.5
correct: 1
total: 2
```

验证集只有 2 条样本，因此这个准确率只用于确认流程，不能作为模型泛化能力的可靠结论。

---

## 八、Day 4 必做任务验收结果

- [x] 理解 BERT 是预训练 Transformer Encoder，不是 tokenizer。
- [x] 理解 `BertForSequenceClassification` 是 BERT Encoder 加句子分类头。
- [x] 理解四个输入字段及其 shape。
- [x] 理解 `labels` 是句子级标签，shape 为 `[B]`。
- [x] 成功在 MPS 上加载并运行 BERT。
- [x] 成功得到 `logits.shape == [2, 2]`。
- [x] 成功得到标量 loss。
- [x] 成功执行 `loss.backward()`。
- [x] 检查到分类层梯度存在。
- [x] 成功执行 `optimizer.step()`。
- [x] 确认分类层参数发生变化。
- [x] 成功跑通 1 个 epoch。
- [x] 使用独立验证数据完成 `eval()` 和 `no_grad()`。
- [x] 没有把最终测试集用于训练或调参。

最终闭环：

```text
batch -> BERT -> logits / loss -> backward -> optimizer.step() -> 1 个 epoch -> validation
```

---

## 九、后置实验边界

Day 4 必做任务已经完成。完整数据集实验不属于今天的硬性验收。

后置实验路线：

```text
完整 SST-2 数据集
    -> batch_size=16 先跑 50 step 测速
    -> 重新加载干净的 BERT
    -> 完整训练集跑 1 个 epoch
    -> 独立 validation
    -> 再决定是否跑 3 个 epoch
```

已完成的后置准备与测速结果：

```text
设备：MPS
batch_size=8 时完成 50 step 测速
50 step 用时：10.057424333994277 秒
平均每 step：0.20114848667988552 秒
训练集 batch 数：8419
估算 batch_size=8 时单 epoch：约 28 分钟
```

后续使用 `M5、16GB` 的 `batch_size=16` 时，应先重新跑 50 step 测速；如果出现 MPS 内存错误，则退回 `batch_size=8`。

保持数据边界：

```text
train -> 更新参数
validation -> 检查实验设置
test -> 最终实验完成后再评估
```

---

## 十一、完整数据集后置实验结果

### 11.1 实验设置

这次后置实验只使用有标签数据：

```text
原始 train + 原始 validation
    -> 合并
    -> 过滤 label ∈ {0, 1}
    -> 80% train / 10% validation / 10% test
```

原始 HuggingFace 官方 `test` split 没有参与本次实验。训练配置：

```text
设备：MPS
芯片：Apple M5
内存：16GB 统一内存
batch_size：8
max_length：64
learning rate：2e-5
epoch：3
模型：bert-base-uncased + sequence classification head
```

### 11.2 每个 epoch 的结果

| epoch | 用时 | train loss | train accuracy | validation loss | validation accuracy |
|---:|---:|---:|---:|---:|---:|
| 1 | 22.74 min | 0.2170 | 0.9153 | 0.1452 | 0.9488 |
| 2 | 21.50 min | 0.1139 | 0.9608 | 0.1866 | 0.9381 |
| 3 | 20.98 min | 0.0766 | 0.9746 | 0.1651 | 0.9506 |

总训练时间约为 65.22 分钟。训练 loss 持续下降，但 validation loss 在第 1 个 epoch 后回升，说明继续训练后出现了轻微过拟合迹象。validation accuracy 在第 3 个 epoch 为 0.9506，略高于第 1 个 epoch 的 0.9488。

### 11.3 最终 test 结果

```text
test loss: 0.1709
test accuracy: 0.9531
```

混淆矩阵的行是真实标签，列是预测标签：

```text
              预测 0   预测 1
真实 0          2852     169
真实 1           151    3651
```

因此：

```text
真实为 0 且预测为 0：2852
真实为 0 但预测为 1：169
真实为 1 但预测为 0：151
真实为 1 且预测为 1：3651
```

正确预测数量为 `2852 + 3651 = 6503`，测试准确率为 `0.9531`。

### 11.4 结果图

训练曲线：

![[training_curves.png]]

测试集混淆矩阵：

![[test_confusion_matrix.png]]

### 11.5 结果解释

- 训练集准确率从 `0.9153` 上升到 `0.9746`，说明模型在训练集上持续拟合。
- validation accuracy 始终约为 `0.94–0.95`，说明模型具有较好的泛化表现。
- 第 1 个 epoch 的 validation loss 最低；如果实验事先规定固定训练 3 个 epoch，使用第 3 个 epoch 的最终模型评估 test 是一致的。
- 如果后续要根据 validation 选择最佳模型，应提前规定选择指标，例如选择 validation loss 最低的 checkpoint，然后只在最后对该 checkpoint 做一次 test 评估。
- 当前 test accuracy `0.9531` 只能说明这次重新划分出的有标签测试集结果，不能与官方隐藏 test 的排行榜结果直接等同。

---

## 十二、完整实验代码

当前实际运行的完整脚本已复制到本笔记同级目录：

```text
stage4/Day5.py
```

也可以直接打开：[[Day5.py|Day5 完整训练代码]]。

下面直接嵌入当前完整脚本：

![[Day5.py]]

## 十三、下一步行动

1. 将 Day 4 必做任务和完整数据集后置实验都记录为已完成。
2. 保留训练曲线、混淆矩阵和测试指标。
3. 后续如需比较 epoch，增加 checkpoint 保存，并预先确定按 validation loss 还是 validation accuracy 选择最佳模型。
4. 不使用最终测试集反复调参。

参考资料：

- [[PyTorch 暑期详细学习计划]]
- [[stage4/Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention|Day 1：Scaled Dot-Product Attention]]
- [[stage4/Day 2 学习笔记：Multi-Head Attention——拆分与合并|Day 2：Multi-Head Attention]]
- [[stage4/Day 3 学习笔记：HuggingFace BERT tokenizer 与 DataLoader|Day 3：HuggingFace BERT tokenizer 与 DataLoader]]
- [HuggingFace BERT 文本分类文档](https://huggingface.co/docs/transformers/tasks/sequence_classification)
