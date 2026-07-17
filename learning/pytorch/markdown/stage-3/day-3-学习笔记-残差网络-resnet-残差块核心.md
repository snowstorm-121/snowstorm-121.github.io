学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版 ResNet 章节，He et al.《Deep Residual Learning for Image Recognition》，PyTorch 官方文档 `torch.nn.BatchNorm2d`、`torch.nn.Identity`

本阶段重点：在 [[Day 1 学习笔记：卷积操作基础——shape 与参数量]] 已建立卷积 shape/参数共享的基础，并在 [[Day 2 学习笔记：经典 CNN——LeNet]] 完成第一个可训练 CNN 后，理解深层 CNN 为什么需要残差连接，并能将残差块翻译成可验证的 `nn.Module` 代码。

今天主线：`退化问题 -> 残差学习 y = F(x) + x -> ResidualBlock 数据流 -> shortcut shape 对齐 -> MPS shape 验证`。本日不训练完整 ResNet，不比较准确率，也不把 ResNet 描述成所有任务中必然优于普通网络的结构。

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 5 周 Day 3。

---

## 〇、今天完成了什么

1. 区分了深层网络的退化问题与过拟合：退化是更深的普通网络连训练集也可能更难优化，不是训练集好而测试集差。
2. 理解残差块不直接要求主分支学习完整映射 `H(x)`，而是学习残差 `F(x) = H(x) - x`，最后输出 `y = F(x) + x`。
3. 理解 shortcut 的两种形式：shape 一致时直接传递；通道数或标准 ResNet 的下采样设置变化时，用 `1×1 Conv + BatchNorm2d` 对齐。
4. 手写并读懂最小通用 `ResidualBlock`：两层卷积主分支、条件 shortcut、相加后 ReLU。
5. 重点澄清了 `self.shortcut` 与 `identity`：前者是模块，后者是当前 batch 经过 shortcut 后得到的 Tensor。
6. 在 Apple Silicon 的 MPS 上完成最小验证：`64 -> 64, stride=1` 与 `64 -> 128, stride=2` 两种 shape 都通过断言。

---

## 一、深层网络的退化问题：不是过拟合

直觉上，网络更深时参数更多、表达能力更强，似乎应该不比浅网络差。但实际训练普通深层网络时，可能出现：增加层数后，连训练集 loss 都更难下降，训练准确率反而变低。

这叫**退化问题（degradation problem）**。

| 现象 | 训练集表现 | 验证/测试集表现 | 核心原因 |
| --- | --- | --- | --- |
| 过拟合 | 好 | 变差 | 模型过度贴合训练样本，泛化不足 |
| 退化 | 可能已经变差 | 通常也不会更好 | 深层普通网络的优化更困难 |

因此，退化不是“模型表达能力变弱”。相反，深网络理论上至少可以表示浅网络能表示的函数；困难在于优化器未必容易找到那组合适参数。

### 为什么“新增层什么也不做”并不容易？

设浅网络想学习的完整映射是：

```text
H(x)
```

若新增的层最理想的行为是保留输入，那么普通深层网络仍要让多层卷积、归一化、激活等组合出：

```text
H(x) = x
```

即恒等映射。它不是“没有参数”，而是需要许多参数共同达到恰好复制输入的效果；在深层非线性网络中，这不一定容易优化。

---

## 二、残差学习：从完整映射转为学习改变量

残差网络将输出写成：

```text
y = F(x) + x
```

其中：

```text
x    ：shortcut 分支保留/变换后的输入
F(x) ：主分支学习到的残差，即输入需要被修改的部分
y    ：残差块输出
```

若完整目标映射为 `H(x)`，则残差定义为：

```text
F(x) = H(x) - x
```

因此：

```text
F(x) + x
= H(x) - x + x
= H(x)
```

### 1. 为什么学习残差通常更容易优化？

若最合适的行为是保持输入不变：

```text
H(x) = x
```

普通网络需要直接学出 `H(x) = x`；残差主分支只需接近：

```text
F(x) = H(x) - x = 0
```

从“重新生成完整输入”转为“只生成需要变化的部分”，是残差学习的主要心智模型。

用两层线性映射作简化类比：

```text
普通网络：H(x) = W2 W1 x
目标 H(x) = x，需要 W2 W1 = I

残差网络：y = W2 W1 x + x
目标 y = x，只需 W2 W1 = 0
```

真实 ResNet 有卷积、BatchNorm 和 ReLU，不能将其完全等同于这个线性例子；这个例子只用于说明：当某些新增层不需要改变已有特征时，残差分支可以学习较小的改动。

### 2. shortcut 也提供了更直接的梯度路径

对：

```text
y = F(x) + x
```

求导可写为：

```text
dy/dx = dF(x)/dx + I
```

其中 `I` 对应 shortcut 的直接通路。即使主分支局部梯度较小，梯度仍有一条经过加法节点的直接路径可传播。

这有助于缓解很深的普通网络中梯度经过许多层而逐渐消失或不稳定的问题，但不表示残差网络自动解决一切训练问题。

### 3. 残差不是永远等于 0

例如目标是：

```text
H(x) = 2x
```

则：

```text
F(x) = H(x) - x = x
y = F(x) + x = x + x = 2x
```

所以主分支不是只负责“输出 0”；它学习的是相对于已有输入需要增加、减少或改变的内容。

---

## 三、最小 ResidualBlock 的数据流

本日使用的是常见的 post-activation 基础残差块：

```text
主分支：Conv -> BatchNorm -> ReLU -> Conv -> BatchNorm
shortcut：Identity，或 1×1 Conv -> BatchNorm
合并：out = F(x) + shortcut(x)
最后：ReLU(out)
```

```text
                 ┌── shortcut(x) ────────────────┐
输入 x ──────────┤                                 ├─ 相加 ─ ReLU ─ y
                 └── Conv -> BN -> ReLU -> Conv -> BN ─┘
```

### 1. `nn.BatchNorm2d`

```python
nn.BatchNorm2d(num_features)
```

输入和输出都保持四维 CNN shape：

```text
[B, C, H, W] -> BatchNorm2d(C) -> [B, C, H, W]
```

例如：

```python
self.bn1 = nn.BatchNorm2d(64)
```

表示对输入的 64 个通道分别归一化，并学习每个通道的缩放 `gamma` 和平移 `beta`。它不改变 batch 数、通道数或空间尺寸。

训练模式下，BatchNorm 使用当前 mini-batch 的统计量，并更新运行统计量；评估模式下使用累计的运行统计量。因此有 BatchNorm 的模型在验证/测试时仍应使用：

```python
model.eval()
```

本日仅做随机输入的 shape 验证，使用 `model.eval()` 保持验证行为明确。

### 2. 为什么第二个 BatchNorm 后先相加，再 ReLU？

此版本的顺序是：

```python
out = self.bn2(out)
out = out + identity
out = self.relu(out)
```

若在相加前对残差提前 ReLU，负残差会被截断，无法表示“减少某些输入特征”的作用。

例如：

```text
x = 1
F(x) = -2

先相加：F(x) + x = -1，ReLU(-1) = 0
若先截断 F(x)：ReLU(-2) + 1 = 0 + 1 = 1
```

两种顺序的结果不同。因此本日基础块先合并两条分支，再做最后激活。

---

## 四、通用 `ResidualBlock`：模块与数据要分清

最容易混淆的三类名字：

| 名字 | 所在位置 | 本质 | 作用 |
| --- | --- | --- | --- |
| `self.bn1` | `__init__` 创建 | BatchNorm 模块 | 处理第一层卷积输出 |
| `self.shortcut` | `__init__` 创建 | shortcut 分支模块 | 决定输入如何走捷径 |
| `identity` | `forward` 中产生 | Tensor | 当前输入经过 shortcut 后的结果 |

`self.xxx` 和 LeNet 中的 `self.conv1` 一样，是模型长期拥有、会被 `model.parameters()` 或状态管理识别的层。`out`、`identity` 则是一次前向传播中的数据。

```python
import torch
import torch.nn as nn


class ResidualBlock(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()

        # 主分支 F(x)
        self.conv1 = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=3,
            stride=stride,
            padding=1,
            bias=False,
        )
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU()

        self.conv2 = nn.Conv2d(
            out_channels,
            out_channels,
            kernel_size=3,
            stride=1,
            padding=1,
            bias=False,
        )
        self.bn2 = nn.BatchNorm2d(out_channels)

        # shortcut 分支：只有 shape 不一致时才做 projection
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(
                    in_channels,
                    out_channels,
                    kernel_size=1,
                    stride=stride,
                    bias=False,
                ),
                nn.BatchNorm2d(out_channels),
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x):
        identity = self.shortcut(x)

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)

        out = out + identity
        out = self.relu(out)
        return out
```

这里 `bias=False` 是常见惯例：卷积后立刻接 BatchNorm 时，卷积 bias 的作用通常可被 BatchNorm 的可学习平移参数替代。即使写成默认的 `bias=True`，代码也能运行；本日用 `False` 是为了贴近常见 ResNet 写法。

### 1. 为什么 `identity = self.shortcut(x)` 是通用写法？

不要只写：

```python
identity = x
```

因为那只适用于输入与主分支输出 shape 已经相同的情况。通用写法是：

```python
identity = self.shortcut(x)
```

它统一覆盖两种场景：

```text
shape 一致：self.shortcut = nn.Identity()
identity = self.shortcut(x) = x

shape 不一致：self.shortcut = 1×1 Conv + BatchNorm
identity = self.shortcut(x) = 已对齐 shape 的 Tensor
```

因此 `identity` 是“shortcut 分支的输出”这个概念名，并不保证其数值或 shape 与原始 `x` 完全相同。

### 2. 何时需要 projection shortcut？

相加要求两个 Tensor 完全同 shape：

```text
[B, C, H, W] + [B, C, H, W]
```

标准 ResNet 使用：

```python
if stride != 1 or in_channels != out_channels:
```

表示只要该 block 按标准配置要下采样，或通道数变化，就使用 projection shortcut。

`1×1` 卷积主要承担：

```text
1. 调整通道数，例如 64 -> 128
2. 通过 stride=2 同步调整空间尺寸，例如 32×32 -> 16×16
3. 不使用 3×3 邻域，保持 shortcut 路径尽量简单
```

严格从卷积公式看，`stride != 1` 不是在任意 padding、kernel_size 组合下都必然改变输出尺寸的数学定理；但标准 ResNet 的 `3×3, padding=1, stride=2` 明确表达“本 block 下采样”的结构约定。shortcut 使用同一个 stride，以确保两条分支按同一规则对齐。

---

## 五、两种核心 shape 推导

### 1. `ResidualBlock(64, 64, stride=1)`

输入：

```text
[B, 64, 32, 32]
```

主分支：

```text
Conv2d(64, 64, k=3, s=1, p=1) -> [B, 64, 32, 32]
BatchNorm2d(64)                -> [B, 64, 32, 32]
ReLU                           -> [B, 64, 32, 32]
Conv2d(64, 64, k=3, s=1, p=1) -> [B, 64, 32, 32]
BatchNorm2d(64)                -> [B, 64, 32, 32]
```

shortcut：

```text
nn.Identity() -> [B, 64, 32, 32]
```

相加与最终激活：

```text
[B, 64, 32, 32] + [B, 64, 32, 32]
-> [B, 64, 32, 32]
-> ReLU
-> [B, 64, 32, 32]
```

### 2. `ResidualBlock(64, 128, stride=2)`

输入：

```text
[B, 64, 32, 32]
```

主分支：

```text
Conv2d(64, 128, k=3, s=2, p=1) -> [B, 128, 16, 16]
BatchNorm2d(128)                -> [B, 128, 16, 16]
ReLU                            -> [B, 128, 16, 16]
Conv2d(128, 128, k=3, s=1, p=1)-> [B, 128, 16, 16]
BatchNorm2d(128)                -> [B, 128, 16, 16]
```

shortcut：

```text
Conv2d(64, 128, k=1, s=2)      -> [B, 128, 16, 16]
BatchNorm2d(128)                -> [B, 128, 16, 16]
```

最终：

```text
[B, 128, 16, 16] + [B, 128, 16, 16]
-> [B, 128, 16, 16]
-> ReLU
-> [B, 128, 16, 16]
```

对于 `H_in = 32, K = 3, P = 1, S = 2`：

```text
H_out = floor((H_in + 2P - K) / S) + 1
      = floor((32 + 2 - 3) / 2) + 1
      = 16
```

---

## 六、最小 MPS shape 验证

本日只验证残差块数据流和 shape，不进行完整训练。

```python
device = torch.device(
    "mps" if torch.backends.mps.is_available() else "cpu"
)

print("device:", device)

x = torch.randn(2, 64, 32, 32, device=device)

block_same = ResidualBlock(64, 64, stride=1).to(device)
block_downsample = ResidualBlock(64, 128, stride=2).to(device)

block_same.eval()
block_downsample.eval()

with torch.no_grad():
    y_same = block_same(x)
    y_downsample = block_downsample(x)

print("input shape:              ", x.shape)
print("same block output shape:  ", y_same.shape)
print("downsample output shape:  ", y_downsample.shape)

assert y_same.shape == (2, 64, 32, 32)
assert y_downsample.shape == (2, 128, 16, 16)

print("shape validation passed!")
```

本次实际输出：

```text
device: mps
input shape:               torch.Size([2, 64, 32, 32])
same block output shape:   torch.Size([2, 64, 32, 32])
downsample output shape:   torch.Size([2, 128, 16, 16])
shape validation passed!
```

这次验证证明：

1. `ResidualBlock(64, 64, stride=1)` 中 `nn.Identity()` shortcut 可与主分支直接相加。
2. `ResidualBlock(64, 128, stride=2)` 中 projection shortcut 已把输入调整为与主分支相同的 shape。
3. 模块和随机输入均成功放在 MPS 上执行。

它不证明：

1. 完整 ResNet 已经训练成功。
2. 残差网络一定在任何任务上优于 LeNet 或 MLP。
3. 当前随机初始化的残差块已经学到了有意义特征。

---

## 七、常见错误与排查顺序

### 1. 直接相加时报 shape 不匹配

先打印两条分支：

```python
print(out.shape)
print(identity.shape)
```

重点检查：

```text
in_channels / out_channels 是否一致？
主分支与 shortcut 的 stride 是否一致？
shortcut 是否使用了同一个 stride？
```

### 2. 把模块和 Tensor 混淆

错误心智模型：

```text
self.shortcut 和 identity 都是“输入本身”
```

正确区分：

```text
self.shortcut：定义在 __init__ 中的路径模块
identity：forward 中 self.shortcut(x) 的输出数据
```

### 3. 第一层主分支误用未定义的 `out`

错误：

```python
out = self.conv1(out)
```

此时 `out` 还没有创建。第一层应使用输入 `x`：

```python
out = self.conv1(x)
```

### 4. 在相加前忘记处理 shortcut

不要把通用代码写死为：

```python
identity = x
```

通用版本应始终写：

```python
identity = self.shortcut(x)
```

### 5. 把退化误认为过拟合

复习口诀：

```text
训练好、测试差：优先怀疑过拟合
网络加深、训练也变差：优先考虑退化/优化困难
```

---

## 八、今日真实卡点与澄清

这一节不只记录结论，也记录本次第一次接触残差块时真正卡住的位置。后续复习 ResNet 时，应优先回看这些问题，而不是只重复阅读已经看懂的定义。

### 1. “为什么学习 `F(x)` 比直接学习 `H(x)` 更容易？”

困惑点：若目标是保持输入，为什么“输出 0”会比“复制输入”更容易？

澄清：残差结构不是数学上保证任何任务都更简单，而是换了一种更利于优化的参数化。对于：

```text
y = F(x) + x
```

若理想目标是 `y = x`，主分支只需让 `F(x)` 接近 0；普通深层网络则需让许多层的组合直接近似恒等映射 `H(x) = x`。另外 shortcut 使：

```text
dy/dx = dF(x)/dx + I
```

梯度多了一条直接通路。因此“更容易”有两个层面：学习的是相对改变量，以及梯度不必只依赖逐层传播。

### 2. “`self.bn1`、`self.shortcut`、`identity` 到底分别是什么？”

困惑点：它们都出现在残差块中，但不应把模型层和一次前向传播的数据混在一起。

澄清：

```text
self.bn1       ：在 __init__ 中创建的 BatchNorm 模块
self.shortcut  ：在 __init__ 中创建的 shortcut 路径模块
identity        ：在 forward 中，由 self.shortcut(x) 得到的 Tensor
```

可用 LeNet 中的关系类比：

```text
self.conv1：卷积层这个“工具”
out = self.conv1(x)：x 经过该工具后得到的数据
```

同理：

```python
identity = self.shortcut(x)
```

不是在创建新层，而是在取得当前输入经过 shortcut 后的输出。

### 3. “为什么不能总写 `identity = x`？”

困惑点：在 `64 -> 64, stride=1` 的简单例子中，shortcut 就是输入本身；但通用残差块不能把这个特例写死。

澄清：

```python
identity = self.shortcut(x)
```

是通用写法。当两条分支 shape 一致时：

```python
self.shortcut = nn.Identity()
```

于是 `self.shortcut(x) = x`。当通道数或标准 ResNet 的下采样设置变化时，`self.shortcut` 则是 `1×1 Conv + BatchNorm`，输出已被对齐。因此：

```text
identity 的含义是“shortcut 分支输出”，不等于“原始 x 永远不变”。
```

### 4. “这个条件分支到底在判断什么？”

```python
if stride != 1 or in_channels != out_channels:
    self.shortcut = nn.Sequential(
        nn.Conv2d(in_channels, out_channels, kernel_size=1,
                  stride=stride, bias=False),
        nn.BatchNorm2d(out_channels),
    )
else:
    self.shortcut = nn.Identity()
```

困惑点：为什么是 `or`，以及 `nn.Sequential` 在 shortcut 中做了什么？

澄清：相加要求两条分支的 `[B, C, H, W]` 完全一致。只要通道数不同，或该 block 按标准设置改变空间分辨率，就需要 projection shortcut；因此必须用 `or`，不能用 `and`。

`nn.Sequential(...)` 表示输入依次经过其中的层：

```text
x -> 1×1 Conv（对齐 C 与可能的 H/W） -> BatchNorm -> identity
```

例如 `ResidualBlock(64, 128, stride=2)`：

```text
[B,64,32,32] -> [B,128,16,16]
```

之后才能与主分支的 `[B,128,16,16]` 相加。

### 5. “`stride=2` 时，padding 合适是否仍可不改变 shape？”

困惑点：卷积输出尺寸还由 kernel 和 padding 决定，不能把 `stride != 1` 误读为在所有参数组合下必然改变尺寸。

澄清：这个判断是**标准 ResNet 的结构约定**，不是对任意卷积超参数的完备数学检测。标准主分支使用：

```text
3×3, padding=1, stride=2
```

对 `32×32` 输入得到 `16×16`；shortcut 使用 `1×1, stride=2` 同步下采样。通过非常规的大 padding，确实可以让某些 `stride=2` 卷积的输出尺寸保持或接近输入尺寸；但标准 ResNet 不用这种方式抵消下采样意图。

因此应记住：

```text
stride != 1 在这里表示“这个 block 被设计为下采样”，
而不是“任何 stride != 1 的卷积在数学上都必然改 shape”。
```

### 6. “相加前后为什么要这样放 ReLU？”

困惑点：第二个卷积后的 BatchNorm 为什么不立刻 ReLU？

澄清：要先计算完整的：

```text
F(x) + shortcut(x)
```

再做最后激活。若提前对 `F(x)` 进行 ReLU，负残差会被截断，残差分支就难以表达“减少输入中的某些特征”。

---

## 九、选做：ResNet 原论文速读

本日按 [[PyTorch 暑期详细学习计划]] 的选做/后置任务，阅读了 ResNet 原论文《Deep Residual Learning for Image Recognition》的摘要、实验性结论与 CIFAR-10 更深网络实验。论文没有单独命名为 `Conclusion` 的章节，因此这里把引言末尾的主张和实验最后的讨论作为“结论”阅读。

原论文：<https://openaccess.thecvf.com/content_cvpr_2016/papers/He_Deep_Residual_Learning_CVPR_2016_paper.pdf>

### 1. 我的四句论文总结

1. ResNet 论文要解决的核心问题是：深层网络的优化/退化问题，即网络加深后可能连训练误差都变高。
2. 它的关键做法是：不直接学习完整映射 `H(x)`，而是相对于输入学习残差函数 `F(x) = H(x) - x`，并使用 `F(x) + x` 得到输出。
3. 论文通过比较普通网络与残差网络，说明残差参数化能显著缓解深层普通网络的优化/退化困难，使模型在一定深度范围内真正从增加深度中获得准确率收益。
4. ResNet-1202 的结果提醒我：有时不是网络层数越深效果越好；即使训练误差很低、优化没有明显困难，测试误差仍可能变高，泛化还受数据规模、模型容量和正则化等因素影响。

### 2. 更深网络实验：作者到底比较了什么？

| 比较 | 主要回答的问题 | 观察到的现象 |
| --- | --- | --- |
| Plain-20 vs Plain-56 | 普通网络加深后是否仍容易优化？ | 更深普通网络训练误差更高，出现退化 |
| ResNet-20/32/44/56/110 | 残差结构能否从加深中获益？ | 在该深度范围内，残差网络的测试结果继续改善 |
| ResNet-110 vs ResNet-1202 | 深度是否可以无限增加？ | 1202 层训练误差很低，但测试误差比 110 层更高 |

论文在 CIFAR-10 上给出的代表性测试误差：

```text
ResNet-56：  6.97%
ResNet-110： 6.43%
ResNet-1202：7.93%
```

因此需要同时看训练误差和测试误差：

```text
训练误差高：优先判断是否存在优化/退化困难
训练误差低、测试误差高：优先判断是否存在过拟合或泛化不足
```

这与本次 Day 2 的 Fashion-MNIST 实验原则一致：模型选择看验证集，测试集只作最终评估；单一指标不能支撑完整结论。

---

## 十、今日掌握清单

- [x] 能区分退化问题与过拟合。
- [x] 能解释 `F(x) = H(x) - x` 与 `y = F(x) + x`。
- [x] 能说出 shortcut 同时服务于特征保留和更直接的梯度路径。
- [x] 能读懂两层卷积主分支、条件 shortcut、相加后 ReLU 的最小残差块。
- [x] 能推导 `64 -> 64, stride=1` 的 `[B,64,32,32] -> [B,64,32,32]`。
- [x] 能推导 `64 -> 128, stride=2` 的 `[B,64,32,32] -> [B,128,16,16]`。
- [x] 能解释 `self.shortcut`、`identity`、`nn.Identity()` 的区别。
- [x] 已在 MPS 上完成最小 shape 验证。
- [ ] 完整 ResNet 训练与更深网络对比：后续专题再做。
