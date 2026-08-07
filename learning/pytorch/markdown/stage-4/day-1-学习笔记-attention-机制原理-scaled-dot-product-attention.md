# Attention 机制原理：Scaled Dot-Product Attention

学习目标：理解 Attention 的数据流和 shape 约定，能够手写并验证 Scaled Dot-Product Attention。

本阶段重点：从阶段三 CNN 的局部感受野和特征提取，进入 Transformer 的全局动态加权。今天不展开 Multi-Head Attention、完整 Transformer 或 BERT，而是先把 Attention 最小计算单元吃透。

今天主线：`Q/K/V -> Q @ K^T -> / sqrt(d_k) -> mask -> Softmax -> attention_weights @ V -> output`。

本笔记对应 [PyTorch 暑期详细学习计划](PyTorch 暑期详细学习计划) 中第 6 周 Day 1。

关联笔记：前置 [[stage3/Day 5 学习笔记：阶段三结果复盘——CNN 与迁移学习|阶段三结果复盘]]、[[Stage1/Day 1 学习笔记：Tensor基本操作|Tensor 基本操作]]、[[Stage1/Day 2 学习笔记：PyTorch Autograd 自动微分基础|Autograd]]、[[Stage2/Day 1 学习笔记：nn.Module 与常用层入门|nn.Module 与常用层]]。

---

## 〇、今天完成了什么

1. 理解了 Q、K、V 的职责：Q 表示当前查询，K 用于匹配，V 提供实际内容。
2. 理解了 `Q @ K.transpose(...)` 如何得到 query-key 的匹配分数。
3. 明确了 `query_len` 和 `key_len` 的区别，以及自注意力中二者相等只是因为 Q/K/V 来自同一个序列。
4. 理解了除以 `sqrt(d_k)` 的原因：点积中参与累加的维度越大，分数尺度可能越大，需要在 Softmax 前进行稳定化。
5. 理解了 Softmax 必须沿最后一维，也就是 key 维度，对每个 query 的所有 key 分配权重。
6. 手写并在 Apple Silicon MPS 上验证了无 mask 和带 mask 的 Attention。
7. 定位并修正了 mask 使用 `+inf` 导致 Softmax 输出 `nan` 的问题，应使用 `-inf`。

---

## 一、Attention 要解决什么问题

CNN 使用局部感受野提取邻域特征；Attention 则允许一个位置直接查看序列中的多个位置，并根据当前输入动态决定关注重点。

例如处理：

```text
我 喜欢 吃 苹果
```

处理“吃”时，模型可能需要关注“苹果”。Attention 的核心问题就是：

> 当前这个位置应该从哪些位置获取信息？每个位置应该取多少？

MLP 通常使用固定的可学习参数混合输入特征；CNN 通过固定局部窗口提取邻域信息；Attention 则用当前输入计算出动态的注意力权重。

---

## 二、Q、K、V 的含义

可以先记成：

```text
Q：我想找什么
K：我是什么，能否被匹配
V：匹配之后，我提供什么内容
```

### 2.1 Q：Query

Q 表示当前 query 位置想寻找什么信息。每个序列位置都有一个 query 向量。

### 2.2 K：Key

K 表示每个位置可以用什么特征被匹配。当前 query 会和所有 key 比较，得到匹配分数。

### 2.3 V：Value

V 表示如果某个位置值得关注，真正要从这个位置取出的内容。Q、K 负责决定“关注谁”，V 负责提供“取什么”。

---

## 三、Q、K、V 的 shape 记账

一般 Attention 可以写成：

```text
Q: [batch, query_len, d_k]
K: [batch, key_len, d_k]
V: [batch, key_len, d_v]
```

### 3.1 每个维度的含义

- `batch`：一次处理多少个样本。
- `query_len`：有多少个位置正在发起查询。
- `key_len`：有多少个位置可以被查询、匹配和关注。
- `d_k`：每个 Q/K 向量的特征维度，用于 Q 和 K 的点积。
- `d_v`：每个 V 向量的内容维度，用于生成输出。

例如：

```text
Q: [2, 3, 64]
K: [2, 5, 64]
V: [2, 5, 128]
```

表示 2 个样本中，每个样本有 3 个 query，5 个可查询的 key/value 位置；Q/K 的匹配维度是 64，V 的内容维度是 128。

### 3.2 为什么自注意力中长度相等

本日基础实验使用自注意力：Q、K、V 来自同一个序列，因此：

```text
query_len = key_len = seq_len
```

于是简化为：

```text
Q, K, V: [batch, seq_len, d_k]
```

这不是 Attention 的普遍规定。交叉注意力中，Q 和 K/V 可以来自不同序列，`query_len` 和 `key_len` 可以不同。

---

## 四、`Q @ K^T` 如何得到匹配分数

对单个样本，假设：

```text
Q: [query_len, d_k]
K: [key_len, d_k]
```

转置 K 后：

```text
K^T: [d_k, key_len]
```

因此：

```text
Q @ K^T
[query_len, d_k] @ [d_k, key_len]
-> [query_len, key_len]
```

矩阵中第 `i` 行第 `j` 列是：

```text
Q[i] · K[j]
```

表示第 `i` 个 query 与第 `j` 个 key 的匹配分数。

保留 batch 后：

```text
Q:       [batch, query_len, d_k]
K^T:     [batch, d_k, key_len]
scores:  [batch, query_len, key_len]
```

`scores[batch编号, query位置, key位置]` 是一个原始匹配分数，还不是概率，也还不是最终输出。

例如：

```text
Q: [2, 3, 4]
K: [2, 5, 4]
K.transpose(1, 2): [2, 4, 5]
scores: [2, 3, 5]
```

注意 Python 索引从 0 开始，所以 `scores[0, 1, 3]` 表示第 0 个样本中，第 2 个 query 与第 4 个 key 的原始匹配分数。

---

## 五、为什么要除以 `sqrt(d_k)`

一个点积是多个乘积项的累加：

```text
q · k = q_1 k_1 + q_2 k_2 + ... + q_dk k_dk
```

`d_k` 越大，参与相加的项越多，点积分数的数值波动可能越大。如果直接送入 Softmax，分数可能变得过大，使 Softmax 过度尖锐，某个位置接近 1，其余位置接近 0，梯度也可能变小。

因此使用：

```text
scaled_scores = scores / sqrt(d_k)
```

`d_k` 与点积内部的特征维度有关，而不是与 `seq_len` 有关：`seq_len` 只表示每个 query 有多少个候选 key。

---

## 六、Softmax 如何得到注意力权重

```python
attention_weights = F.softmax(scaled_scores, dim=-1)
```

`scaled_scores` 的 shape 是：

```text
[batch, query_len, key_len]
```

最后一维是 key 位置，因此 `dim=-1` 表示：

> 对每一个 query，在所有 key 之间分配注意力。

Softmax 后 shape 不变：

```text
scores:           [batch, query_len, key_len]
attention_weights:[batch, query_len, key_len]
```

每个权重非负，同一个 query 对所有 key 的权重之和接近 1：

```python
attention_weights.sum(dim=-1)
```

结果 shape 是：

```text
[batch, query_len]
```

Softmax 必须在 `attention_weights @ V` 之前，因为它先把匹配分数变成“关注比例”，后续矩阵乘法才使用这些比例聚合 V。若在聚合后再 Softmax，归一化的将是 V 的内容特征维度，而不是 key 位置维度。

---

## 七、加权求和得到输出

```text
attention_weights: [batch, query_len, key_len]
V:                 [batch, key_len, d_v]
```

矩阵乘法：

```text
[batch, query_len, key_len]
@
[batch, key_len, d_v]
-> [batch, query_len, d_v]
```

每个 query 的输出是所有 V 向量的加权组合：

```text
output[i] = w_i0 V[0] + w_i1 V[1] + ... + w_iK V[K]
```

`key_len` 被加权求和消掉；输出保留 query 的位置数和 V 的内容维度。

在本日简化实验中 `d_v = d_k`，因此：

```text
Q, K, V: [batch, seq_len, d_k]
output:   [batch, seq_len, d_k]
```

---

## 八、Mask 的作用

Mask 在 Softmax 之前作用于分数：

```text
Q @ K^T
-> / sqrt(d_k)
-> mask
-> Softmax
-> attention_weights @ V
```

约定：

```text
1：允许关注
0：禁止关注
```

实现：

```python
scaled_scores = scaled_scores.masked_fill(
    mask == 0,
    float("-inf")
)
```

被屏蔽位置填 `-inf`，因为：

```text
exp(-inf) = 0
```

Softmax 后该位置权重就是 0。之前实验中误写成 `float("inf")`，导致 `inf / inf`，最终所有权重变成 `nan`；改成 `-inf` 后 MPS 验证通过。

常见 mask：

- Padding mask：屏蔽补齐的 `[PAD]` 位置。
- Causal mask：生成任务中屏蔽未来位置，防止当前位置偷看答案。

Mask 的 shape 通常对应：

```text
[batch, query_len, key_len]
```

它不会改变 scores、weights 或 output 的 shape。

---

## 九、手写实现

```python
import math
import torch
import torch.nn.functional as F


def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)

    scaled_scores = (
        torch.bmm(Q, K.transpose(1, 2))
        / math.sqrt(d_k)
    )

    if mask is not None:
        scaled_scores = scaled_scores.masked_fill(
            mask == 0,
            float("-inf")
        )

    attention_weights = F.softmax(
        scaled_scores,
        dim=-1
    )

    output = torch.bmm(attention_weights, V)

    return output, attention_weights
```

---

## 十、MPS 验证结果

使用：

```text
Q, K, V: [2, 5, 8]
mask:    [2, 5, 5]
device:  mps
```

无 mask：

```text
output shape: torch.Size([2, 5, 8])
attention_weights shape: torch.Size([2, 5, 5])
row sums: 每一行均为 1.0000
无 mask 验证通过
```

mask 屏蔽最后一个 key：

```text
masked output shape: torch.Size([2, 5, 8])
masked weights shape: torch.Size([2, 5, 5])
被屏蔽位置的权重: 全部为 0
mask 验证通过
```

本次验证说明：

1. 输出 shape 正确；
2. 注意力权重 shape 正确；
3. Softmax 确实沿 key 维度归一化；
4. mask 没有改变 shape；
5. 被屏蔽位置不会获得注意力权重。

---

## 十一、与此前 PyTorch 学习内容的连接

### 11.1 与纯 Tensor 矩阵运算

Attention 的核心不是新的神秘运算，而是已有 Tensor 运算的组合：

```text
transpose -> batch matrix multiplication -> 除法 -> Softmax -> batch matrix multiplication
```

重点是给每一次矩阵乘法记清楚 shape。

### 11.2 与 autograd

Q、K、V 如果来自可训练层，整个 Attention 计算会进入 autograd 计算图。Softmax、mask、矩阵乘法都参与前向数据流，损失函数反向传播时，梯度可以回到生成 Q/K/V 的参数。

### 11.3 与 MLP 的线性层

`nn.Linear` 使用固定的可学习参数混合特征；Attention 使用输入相关的 `attention_weights` 动态混合不同位置的 V。

### 11.4 与 CNN

CNN 通过局部感受野提取邻域特征；Attention 可以让每个位置直接访问整个序列，并动态决定关注哪些位置。

### 11.5 与 DataLoader 和完整训练流程

今天只验证单个小 batch 的前向 shape，没有进入数据集、损失函数和参数更新。但在完整训练中，Attention 会嵌入：

```text
DataLoader batch
-> token/embedding 表示
-> Q/K/V
-> Attention
-> 后续 Transformer 层
-> logits
-> loss
-> backward
-> optimizer.step()
```

---

## 十二、Day 1 验收结论

- 能解释 Q、K、V 的职责；
- 能区分 `query_len`、`key_len`、`d_k`、`d_v`；
- 能解释 `Q @ K^T` 的矩阵乘法和 `[batch, query_len, key_len]`；
- 能解释为什么除以 `sqrt(d_k)`；
- 能解释为什么 Softmax 使用 `dim=-1`，并且必须在加权求和前；
- 能解释 `attention_weights @ V` 如何得到 `[batch, query_len, d_v]`；
- 能解释 padding mask 和 causal mask 的用途；
- 已完成无 mask 和带 mask 的 MPS 前向验证。

Day 1 完成。下一步进入 Day 2：Multi-Head Attention 的拆分与合并。
