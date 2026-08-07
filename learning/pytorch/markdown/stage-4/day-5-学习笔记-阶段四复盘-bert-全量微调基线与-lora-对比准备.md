# 阶段四 Day 5 复盘：BERT 全量微调基线与 LoRA 对比准备

## 〇、今天完成了什么

- 回顾了 BERT 在 SST-2 上的完整微调闭环。
- 复习了 `BertForSequenceClassification` 的输入、输出和 shape。
- 明确了 train、validation、test 的职责边界。
- 分析了训练曲线、验证集 loss 和过拟合迹象。
- 根据混淆矩阵理解 accuracy、precision、recall 和 F1。
- 检查了 Day 4 代码中的路径、数据划分和复现注意点。
- 初步理解 LoRA：冻结原始参数，只训练低秩更新参数。
- 确认继续使用 SST-2 作为全量微调与 LoRA 的受控对比数据集。

## 一、Day 4 完整数据流

```text
原始句子
  → train / validation / test 划分
  → tokenizer
  → input_ids、attention_mask、token_type_ids
  → Dataset / DataLoader
  → batch
  → BERT 分类模型
  → logits、loss
  → 预测与指标
  → backward
  → optimizer.step()
  → validation
  → 最终 test
```

一个训练 batch 的顺序是：

```text
取出 batch
→ 移动到 MPS
→ optimizer.zero_grad()
→ 前向传播
→ 得到 logits 和 loss
→ 计算预测结果与指标
→ loss.backward()
→ optimizer.step()
```

验证阶段只进行前向计算和指标统计，不执行 `backward()` 或 `optimizer.step()`。

## 二、关键输入与输出 shape

设 batch size 为 `B`，序列最大长度为 `L`，二分类类别数为 `2`：

```text
input_ids       [B, L]
attention_mask  [B, L]
token_type_ids  [B, L]
labels          [B]

logits          [B, 2]
loss            []  # 标量 Tensor
predictions     [B]
```

在当前实验中：

```text
input_ids       [8, 64]
attention_mask  [8, 64]
token_type_ids  [8, 64]
labels          [8]
logits          [8, 2]
loss            []
```

`labels` 是 `[B]`，因为 SST-2 是句子级分类：每个句子只有一个情感标签，而不是每个 token 一个标签。

`logits.argmax(dim=1)` 将 `[B, 2]` 转换为 `[B]`，因此可以和 `labels` 逐样本比较。

## 三、数据边界与 checkpoint 规则

### 3.1 三个 split 的职责

| 数据集 | 是否更新参数 | 是否选择模型 | 主要用途 |
|---|---:|---:|---|
| train | 是 | 否 | 学习模型参数 |
| validation | 否 | 是 | 选择 checkpoint、调参 |
| test | 否 | 否 | 最终一次性报告结果 |

当前实验只使用有标签数据，将原始 `train` 和 `validation` 合并后重新分层划分：

```text
80% train
10% validation
10% local held-out test
```

官方 SST-2 test 没有参与本次本地实验。因此当前测试结果是本地重新划分的 labeled held-out test 结果，不是官方 GLUE hidden-test leaderboard 结果。

### 3.2 选择最佳模型

当前验证集 loss 在 epoch 1 最低，为 `0.1452`。如果预先规定“validation loss 最低优先”，应选择 epoch 1 的 checkpoint，然后只在最后使用它评估 test。

不能因为某个 epoch 的 test accuracy 更高，就事后改变 checkpoint 选择规则。

## 四、实验结果与过拟合分析

| Epoch | Train Accuracy | Validation Accuracy |
|---:|---:|---:|
| 1 | 0.9153 | 0.9488 |
| 2 | 0.9608 | 0.9381 |
| 3 | 0.9746 | 0.9506 |

训练 accuracy 持续上升，说明模型越来越适应训练数据；验证集表现没有同步稳定提升，且 validation loss 在 epoch 1 后回升，说明继续训练后出现了过拟合迹象。

判断模型是否变好，不能只看 train accuracy，还要观察 validation loss、validation accuracy 以及训练集与验证集之间的差距。

## 五、混淆矩阵与指标

当前混淆矩阵约定为“行是真实标签，列是预测标签”：

```text
              预测 0   预测 1
真实 0          2852     169
真实 1           151    3651
```

因此：

```text
TN = 2852
FP = 169
FN = 151
TP = 3651
```

```text
accuracy = (TP + TN) / 总样本数
precision = TP / (TP + FP)
recall = TP / (TP + FN)
F1 = 2 × precision × recall / (precision + recall)
```

当前结果：

```text
test loss       = 0.1709
test accuracy   = 0.9531
正类 precision  ≈ 0.955
正类 recall     ≈ 0.960
正类 F1         ≈ 0.958
```

其中：

- `FP=169`：真实为负面，但预测为正面；
- `FN=151`：真实为正面，但预测为负面。

后续失败案例分析可以分别抽取 FP 和 FN 的原始句子，观察否定、反讽、复杂从句和上下文冲突等现象。

## 六、代码与复现检查

代码使用：

```python
CODE_DIR = Path(__file__).resolve().parent.parent
```

相较于 `Path.cwd()`，它不依赖启动脚本时所在的目录，因此缓存和输出路径更稳定。

当前关键配置：

```text
SEED = 42
BATCH_SIZE = 8
MAX_LENGTH = 64
NUM_EPOCHS = 3
LEARNING_RATE = 2e-5
DEVICE = MPS（如果可用）
```

`SEED=42` 主要保证数据划分一致；它不一定保证 MPS 上每次训练结果完全逐位一致。模型初始化、DataLoader shuffle 和硬件算子仍可能带来少量差异。

## 七、LoRA 最小概念

全量微调直接更新原始参数：

```text
W → W + ΔW
```

LoRA 冻结原始参数 `W`，只训练两个较小的矩阵 `A` 和 `B`：

```text
ΔW = B × A
W' = W + B × A
```

因此：

```text
全量微调：更新 BERT 几乎所有原始参数
LoRA：冻结原始参数，只训练少量 A、B 参数
```

后续对比实验的自变量是微调方法：全量微调 vs LoRA；控制变量包括数据划分、模型、tokenizer、最大长度、batch size、随机种子和评价流程。

如果 LoRA 的 accuracy 接近全量微调，但可训练参数量大幅减少，说明 LoRA 可能以更低的训练成本取得接近的任务效果。

## 八、SST-2 作为求职项目的数据集边界

SST-2 是 GLUE 中的标准英文情感二分类任务，适合用来验证 BERT 微调、参数高效微调和实验评价流程。

它适合本项目的原因：

- 数据和任务容易解释；
- 适合控制变量对比全量微调与 LoRA；
- 可以同时记录参数量、训练时间、accuracy、F1、混淆矩阵和 MPS 资源占用；
- 数据规模适合本地 MPS 实验。

它的局限是情感分类较常见，业务相关性有限。因此简历中不应只强调 SST-2 accuracy，而应强调：

```text
可复现实验设计
→ 全量微调与 LoRA 对比
→ 参数效率分析
→ 资源占用分析
→ 失败案例分析
```

推荐的项目表述：

> 基于 BERT 在 SST-2 上实现全量微调与 LoRA 参数高效微调对比实验，固定数据划分与训练配置，系统比较可训练参数量、训练时间、Accuracy、F1、混淆矩阵及 MPS 资源占用，并分析过拟合与误分类案例。

项目中必须注明：测试结果来自本地重新划分的 labeled held-out test，不是官方 GLUE hidden-test leaderboard 结果。

## 九、今天的易错点

1. 句子分类的 `labels` 是 `[B]`，不是 `[B, L]`。
2. `outputs.loss` 是标量，不是每个样本一个 `[B]` 的 Tensor。
3. validation 用于选择模型，test 不能参与调参。
4. train accuracy 上升不等于泛化能力一定提升。
5. `argmax(dim=1)` 后的预测 shape 是 `[B]`。
6. LoRA 不是只训练“一个低秩矩阵”，而是训练两个小矩阵，其乘积构成低秩更新。
7. 本地 held-out test 结果不能写成官方 SST-2 leaderboard 结果。

## 十、下一步行动

1. 学习 LoRA 论文的核心机制：低秩假设、冻结基座模型和增量更新。
2. 明确 LoRA 插入 BERT 哪些线性层，以及分类头是否训练。
3. 在相同 split 和评价流程下实现 LoRA 对比实验。
4. 记录可训练参数量、训练时间、accuracy、F1、混淆矩阵和 MPS 资源占用。

## 参考资料

- [[Day 4 学习笔记：BERT 最小微调闭环]]
- [GLUE: A Multi-Task Benchmark and Analysis Platform for Natural Language Understanding](https://aclanthology.org/W18-5446.pdf)
- [Hugging Face GLUE 数据集卡片](https://huggingface.co/datasets/nyu-mll/glue/blob/main/README.md)
- [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685)

