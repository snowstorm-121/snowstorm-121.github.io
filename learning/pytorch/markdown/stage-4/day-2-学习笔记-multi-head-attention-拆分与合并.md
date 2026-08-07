# Multi-Head Attention：拆分与合并

学习目标：理解 Multi-Head Attention 如何从单头 Attention 扩展为多个 head，能够手写并验证拆分、并行计算和合并的完整数据流。

本阶段重点：在 [[stage4/Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention|Day 1：Scaled Dot-Product Attention]] 中已经完成单头 Attention。今天把同一套 Attention 计算并行应用到多个特征子空间，并将结果重新合并。

今天主线：`x -> W_q/W_k/W_v -> split heads -> QK^T -> / sqrt(d_k) -> Softmax -> attention @ V -> merge heads -> W_o`。

本笔记对应 [PyTorch 暑期详细学习计划](PyTorch 暑期详细学习计划) 中第 6 周 Day 2。

关联笔记：[[stage4/Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention|Day 1：Attention 机制]]、[[Stage1/Day 1 学习笔记：Tensor基本操作|Tensor 基本操作]]、[[Stage2/Day 1 学习笔记：nn.Module 与常用层入门|nn.Module 与常用层]]、[[stage3/Day 5 学习笔记：阶段三结果复盘——CNN 与迁移学习|阶段三结果复盘]]。

---

## 〇、今天完成了什么

1. 理解 Multi-Head Attention 为什么要使用多个 head：不同 head 可以学习不同的关注模式。
2. 理解 `d_model`、`num_heads` 和 `d_k` 的关系：`d_k = d_model // num_heads`。
3. 理解三个 `nn.Linear` 如何从输入 `x` 生成 Q、K、V。
4. 完成了 `[B, L, d_model] -> [B, H, L, d_k]` 的 head 拆分。
5. 在多头维度下完成了 `Q @ K^T`、缩放、Softmax 和 `attention_weights @ V`。
6. 完成了 `[B, H, L, d_k] -> [B, L, d_model]` 的 head 合并。
7. 理解输出投影 `W_o` 主要用于混合不同 head 的信息，并保持 `d_model` 以支持残差连接。
8. 使用小 Tensor 验证了关键 shape，并整理成 `MultiHeadAttention(nn.Module)`。
9. 预览了选做的 Transformer Encoder 组成：位置编码、残差、LayerNorm 和 FFN；这些内容只完成了概念理解，没有生成完成完整 Encoder 实现。

---

## 一、从单头 Attention 到 Multi-Head Attention

Day 1 的单头 Attention 使用一套 Q、K、V 表示一类注意力关系：

    Q、K、V -> QK^T -> / sqrt(d_k) -> Softmax -> attention_weights @ V

真实序列中可能同时存在多种关系：

- 局部邻近关系；
- 语法关系；
- 主语和谓语关系；
- 远距离指代关系；
- 语义相似关系。

如果所有关系都由同一个 Attention 表示，可能会混在同一个特征空间中。Multi-Head Attention 把 `d_model` 拆成多个较小的特征子空间，让不同 head 使用不同的 Q/K/V 投影，分别学习不同的关注模式。

重要区分：多个 head 不是把序列长度切成几段。每个 head 都能看到完整的序列 `L`，只是每个 head 使用 `d_k` 维的特征空间。

    d_model = 16
    num_heads = 4
    d_k = 16 / 4 = 4

    一个 token 的 16 个特征
    -> 4 个 head
    -> 每个 head 4 个特征

要求：

    d_model % num_heads == 0

否则无法把特征维度平均拆分给各个 head。

---

## 二、Q、K、V 与线性层的关系

Q、K、V 不是三种特殊的数据类型，而是输入 `x` 经过三套独立线性层得到的三个 Tensor：

    Q = W_q(x)
    K = W_k(x)
    V = W_v(x)

如果：

    x: [B, L, d_model]

通常使用：

    W_q = nn.Linear(d_model, d_model)
    W_k = nn.Linear(d_model, d_model)
    W_v = nn.Linear(d_model, d_model)

于是：

    Q/K/V: [B, L, d_model]

`nn.Linear` 只作用于最后一维，不改变 batch 数量 `B` 和序列长度 `L`。

### 2.1 为什么不能每次直接用随机数生成 QKV

Day 1 使用随机 Q/K/V 是为了验证矩阵运算、shape、Softmax 和 mask。真正的模型中，Q/K/V 必须依赖输入 `x`。

    随机初始化的线性层：参数初始随机，但输出依赖 x，并且参数可以通过梯度更新
    每次直接随机生成 QKV：不依赖 x，也没有稳定的可学习参数

线性层的参数满足：

    Q = xW_q + b_q
    K = xW_k + b_k
    V = xW_v + b_v

训练时，反向传播会计算 `W_q`、`W_k`、`W_v` 的梯度，优化器再更新它们。

### 2.2 为什么不直接令 Q=K=V=x

可以做简化实验，但三个角色会使用完全相同的表示，无法分别学习：

    Q：我想找什么
    K：我有什么可被匹配的特征
    V：我最终提供什么内容

三套线性层让这三个角色拥有独立的可学习表示空间。

---

## 三、拆分 heads

输入 Q、K、V 在拆分前都是：

    [B, L, d_model]

以：

    B = 2
    L = 5
    d_model = 16
    num_heads = 4
    d_k = 4

为例。

先把最后一维重新解释成 `num_heads * d_k`：

    [B, L, d_model]
    -> reshape
    [B, L, num_heads, d_k]

    [2, 5, 16]
    -> [2, 5, 4, 4]

再交换序列长度维和 head 维：

    [B, L, H, d_k]
    -> transpose(1, 2)
    -> [B, H, L, d_k]

    [2, 5, 4, 4]
    -> [2, 4, 5, 4]

这里：

- `reshape`：重新组织形状；
- `transpose`：交换两个维度的位置。

拆分后的每个 head 都保留完整序列长度 `L=5`，只是每个 head 的特征维度为 `d_k=4`。

---

## 四、每个 head 独立计算 Attention

拆分后：

    Q/K/V: [B, H, L, d_k]

例如：

    Q/K/V: [2, 4, 5, 4]

转置 K 的最后两个维度：

    K.transpose(-2, -1): [B, H, d_k, L]
                          [2, 4, 4, 5]

矩阵乘法：

    Q @ K^T
    [B, H, L, d_k]
    @
    [B, H, d_k, L]
    -> [B, H, L, L]

    [2, 4, 5, 4]
    @
    [2, 4, 4, 5]
    -> [2, 4, 5, 5]

最后两个维度 `[L, L]` 表示：

- 第一个 `L`：query 位置；
- 第二个 `L`：key 位置。

因此每个样本、每个 head 都有一张自己的注意力分数矩阵。

之后与 Day 1 完全同构：

    scores = Q @ K^T / sqrt(d_k)
    attention_weights = softmax(scores, dim=-1)
    head_output = attention_weights @ V

shape：

    scores:            [B, H, L, L]
    attention_weights: [B, H, L, L]
    V:                 [B, H, L, d_k]
    head_output:       [B, H, L, d_k]

Multi-Head Attention 没有改变 Day 1 的 Attention 公式，只是让这套公式在多个 head 上并行运行。

---

## 五、合并 heads

每个 head 计算完成后：

    out: [B, H, L, d_k]

要重新变回每个 token 的完整特征：

    [B, H, L, d_k]
    -> transpose(1, 2)
    -> [B, L, H, d_k]
    -> reshape
    -> [B, L, H * d_k]
    -> [B, L, d_model]

例如：

    [2, 4, 5, 4]
    -> [2, 5, 4, 4]
    -> [2, 5, 16]

合并前必须先 transpose。不能直接对 `[B, H, L, d_k]` 做 reshape，因为此时 head 维和序列维的顺序还没有恢复，直接 reshape 虽然元素总数正确，但会错误交错不同 token 和不同 head 的数据。

---

## 六、输出投影 W_o

合并 heads 后通常再使用：

    W_o = nn.Linear(d_model, d_model)

    [B, L, d_model]
    -> W_o
    -> [B, L, d_model]

`W_o` 的主要作用是学习如何混合不同 head 的输出信息，不是为了改变 shape。

在完整 Transformer 中，Attention 输出通常要和输入做残差连接：

    output + x

因此通常保持：

    output: [B, L, d_model]
    x:      [B, L, d_model]

严格来说，`W_o` 可以设计成改变最后一维；但标准 Transformer 为了保持残差结构，通常使用 `d_model -> d_model`。

---

## 七、最小实现

    import math
    import torch
    import torch.nn as nn


    class MultiHeadAttention(nn.Module):
        def __init__(self, d_model, num_heads):
            super().__init__()

            assert d_model % num_heads == 0

            self.d_k = d_model // num_heads
            self.num_heads = num_heads

            self.W_q = nn.Linear(d_model, d_model)
            self.W_k = nn.Linear(d_model, d_model)
            self.W_v = nn.Linear(d_model, d_model)
            self.W_o = nn.Linear(d_model, d_model)

        def split_heads(self, x):
            # x: [B, L, d_model]
            B, L, _ = x.shape

            # [B, L, d_model]
            # -> [B, L, num_heads, d_k]
            # -> [B, num_heads, L, d_k]
            return x.reshape(
                B, L, self.num_heads, self.d_k
            ).transpose(1, 2)

        def forward(self, x):
            B, L, _ = x.shape

            Q = self.split_heads(self.W_q(x))
            K = self.split_heads(self.W_k(x))
            V = self.split_heads(self.W_v(x))

            # Q: [B, H, L, d_k]
            # K^T: [B, H, d_k, L]
            scores = torch.matmul(
                Q,
                K.transpose(-2, -1)
            ) / math.sqrt(self.d_k)

            attn = torch.softmax(scores, dim=-1)

            # [B, H, L, L] @ [B, H, L, d_k]
            # -> [B, H, L, d_k]
            out = torch.matmul(attn, V)

            # [B, H, L, d_k]
            # -> [B, L, H, d_k]
            # -> [B, L, d_model]
            out = out.transpose(1, 2).reshape(B, L, -1)

            return self.W_o(out)

---

## 八、MPS 小 Tensor 验证

    device = torch.device(
        "mps" if torch.backends.mps.is_available() else "cpu"
    )

    mha = MultiHeadAttention(
        d_model=16,
        num_heads=4,
    ).to(device)

    x = torch.randn(
        2,
        5,
        16,
        device=device,
    )

    output = mha(x)
    print(output.shape)

预期：

    torch.Size([2, 5, 16])

模型和输入必须在同一设备：

    mha = MultiHeadAttention(16, 4).to(device)
    x = torch.randn(2, 5, 16, device=device)

本次完成的是前向和 shape 验证，没有加入 mask、损失函数、反向传播和训练循环。Multi-Head Attention 仍然可以作为完整训练流程中的一个 `nn.Module`，参与：

    forward -> loss -> backward -> optimizer.step()

---

## 九、关键 shape 验证结果

本次使用：

    B = 2
    L = 5
    d_model = 16
    num_heads = 4
    d_k = 4

    x:                [2, 5, 16]
    Q/K/V:            [2, 4, 5, 4]
    raw_scores:       [2, 4, 5, 5]
    attention_weight: [2, 4, 5, 5]
    head_output:      [2, 4, 5, 4]
    merged_output:    [2, 5, 16]
    final_output:     [2, 5, 16]

---

## 十、与已有知识的连接

### 10.1 与 Day 1 手写 Attention

每个 head 都复用了 Day 1 的核心公式：

    QK^T / sqrt(d_k)
    -> Softmax
    -> attention_weights @ V

变化只是多了一个 head 维度 `H`：

    [B, L, d_k]
    -> [B, H, L, d_k]

### 10.2 与 Tensor 矩阵运算

今天的核心仍然是：

    reshape -> transpose -> matmul -> softmax -> reshape

重点不是死记代码，而是每一次运算都能说清输入和输出 shape。

### 10.3 与 MLP 线性层

`W_q/W_k/W_v/W_o` 都是 `nn.Linear`。它们和 MLP 中的线性层一样，通过可学习参数变换最后一维；不同之处是它们服务于 Attention 的查询、匹配、内容和输出混合。

### 10.4 与 CNN 特征提取

CNN 使用多个通道并行提取不同局部特征；Multi-Head Attention 使用多个 head 并行学习不同的 token 关系。两者最后都需要把并行分支的结果组织回统一表示。

### 10.5 与完整训练流程

    DataLoader batch
    -> embedding
    -> Multi-Head Attention
    -> 后续 Transformer 层
    -> logits
    -> loss
    -> backward
    -> optimizer.step()

---

## 十一、选做部分概念预览

本日计划中的选做/后置内容是阅读《动手学深度学习》10.6–10.7 节、Transformer 图解，并从零补齐完整 Transformer Encoder。今天完成了概念预览，但没有把完整 Encoder 写成已完成实验。

### 11.1 位置编码

Self-Attention 不会自动知道 token 的先后顺序，因此需要把位置编码加入 token embedding：

    token_embedding:   [B, L, d_model]
    position_encoding: [L, d_model]

    x = token_embedding + position_encoding

通过广播，结果仍然是：

    [B, L, d_model]

位置编码可以是：

- 可学习的位置向量：类似 `nn.Embedding`，训练中更新；
- Sinusoidal 位置编码：由正弦和余弦公式生成，不是可训练参数。

### 11.2 残差与 LayerNorm

Attention 子层后通常使用：

    attention_output + x
    -> LayerNorm(d_model)

残差连接保留原始信息并改善梯度传播，这与 ResNet 的思想相同。`LayerNorm(d_model)` 作用在每个 token 的最后一个特征维度上，输入输出 shape 不变。

### 11.3 前馈网络 FFN

FFN 本质上是对每个 token 独立使用的 MLP：

    [B, L, d_model]
    -> Linear(d_model, d_ff)
    -> 激活函数
    -> Linear(d_ff, d_model)
    -> [B, L, d_model]

例如：

    [2, 5, 16]
    -> [2, 5, 64]
    -> [2, 5, 16]

Attention 负责不同 token 之间的信息交流；FFN 负责每个 token 自己的非线性特征加工。扩展到 `d_ff` 后，模型可以在更大的隐藏空间中组合特征；激活函数提供非线性，使 FFN 不只是两个线性层的简单合并。

### 11.4 简化 Encoder Block 数据流

    x
    -> Multi-Head Attention
    -> 残差 + LayerNorm
    -> FFN
    -> 残差 + LayerNorm
    -> 输出

完整位置编码和 Encoder Block 实现留作后续选做内容，不与今天已经完成的 Multi-Head Attention 实验混淆。

---

## 十二、Day 2 验收结论

- 能解释为什么 Multi-Head Attention 使用多个 head；
- 能计算 `d_k = d_model // num_heads`；
- 能解释三个线性层如何生成 Q、K、V；
- 能完成 `[B, L, d_model] -> [B, H, L, d_k]`；
- 能解释 `[B, H, L, d_k] @ [B, H, d_k, L] -> [B, H, L, L]`；
- 能完成每个 head 的 Scaled Dot-Product Attention；
- 能完成 `[B, H, L, d_k] -> [B, L, d_model]`；
- 能解释合并前为什么必须 transpose；
- 能解释 `W_o` 为什么主要负责混合 head 信息；
- 已用小 Tensor 验证关键 shape；
- 已整理出可运行的 `MultiHeadAttention(nn.Module)`；
- 已理解位置编码、残差、LayerNorm 和 FFN 的基本作用，但未声称完成完整 Transformer Encoder。

Day 2 完成。下一主线是 Day 3–4：HuggingFace BERT 的 tokenizer、DataLoader 和最小微调闭环。
