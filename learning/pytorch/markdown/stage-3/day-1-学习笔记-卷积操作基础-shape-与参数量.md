学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版 6.1–6.2，PyTorch 官方文档 `torch.nn.functional.conv2d` 与 `torch.nn.Conv2d`

本阶段重点：此前已在 [[Day 1 学习笔记：nn.Module 与常用层入门]] 中使用 `nn.Linear` 与 `model.parameters()`，在 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中完成 MLP 数据流。本日进入 CNN：不再把图像立刻展平，而是在 `[N, C, H, W]` 的空间结构上使用 `F.conv2d` 和 `nn.Conv2d`。

今天主线：`输入/卷积核/权重的 shape 合同 -> F.conv2d 与 nn.Conv2d 的职责 -> Linear 与 Conv2d 的参数量 -> 参数共享`。本日重点不是重新学习卷积数学原理，而是把已有原理准确翻译成 PyTorch 代码对象与 shape。

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 5 周 Day 1。

---

## 〇、今天完成了什么

1. 能根据 `kernel_size`、`stride`、`padding` 推导二维卷积输出高宽。
2. 理解并检查了 `F.conv2d` 输入和 kernel 的 shape 合同。
3. 区分了固定 Sobel 核使用 `F.conv2d` 与训练卷积层使用 `nn.Conv2d` 的场景。
4. 实际运行并验证：`nn.Linear(1024, 16)` 有 16400 个参数；`nn.Conv2d(1, 16, kernel_size=3, padding=1)` 有 160 个参数。
5. 澄清了参数共享：它减少参数量和模型存储，但不表示输入变大时计算量不会增加。
6. 完成选做：比较四组 `stride/padding` 的输出 shape，并理解连续卷积层感受野如何扩大。

---

## 一、CNN 中最重要的 shape 合同

### 1. 图像输入

二维卷积在 PyTorch 中接收：

```text
[N, Cin, H, W]
```

| 维度 | 含义 | 示例 `[8, 1, 28, 28]` |
| --- | --- | --- |
| `N` | batch size | 一次处理 8 张图片 |
| `Cin` | 输入通道数 | 灰度图为 1 |
| `H, W` | 图片高、宽 | 28×28 |

`N` 不写进 `nn.Conv2d`；它只是当前 batch 中并行处理的样本数，会原样保留到输出中。

### 2. `F.conv2d` 的卷积核

函数式卷积的接口为：
 
```python
out = F.conv2d(input, weight, bias=None, stride=1, padding=0)
```

其中：

```text
input.shape  = [N, Cin, H, W]
weight.shape = [Cout, Cin, Kh, Kw]
out.shape    = [N, Cout, Hout, Wout]
```

`weight` 的第二维 `Cin` 必须与 `input` 的第二维 `Cin` 相等。例如一个灰度 Sobel 核：

```text
input:  [1, 1, 5, 5]
kernel: [1, 1, 3, 3]
```

第一个 `1` 表示只有一个输出通道（一个卷积核），第二个 `1` 表示它处理单通道输入。

### 3. 输出高宽

不考虑 dilation 时：

```text
Hout = floor((H + 2P - K) / S) + 1
Wout = floor((W + 2P - K) / S) + 1
```

其中 `K` 是卷积核大小、`S` 是 stride、`P` 是 padding。

```python
nn.Conv2d(1, 16, kernel_size=3, stride=1, padding=1)
```

若输入是 `[8, 1, 28, 28]`，输出为 `[8, 16, 28, 28]`。`3×3`、`stride=1`、`padding=1` 保持空间高宽不变。

另一个检查：

```python
nn.Conv2d(16, 32, kernel_size=3, stride=2, padding=1)
```

将 `[8, 16, 28, 28]` 变为 `[8, 32, 14, 14]`。`out_channels=32` 决定第二维；`stride=2` 将空间高宽减半。

---

## 二、`F.conv2d` 与 `nn.Conv2d`：概念如何变成代码

### 1. `F.conv2d`：手动提供固定卷积核

```python
import torch.nn.functional as F

out = F.conv2d(X, kernel, padding=1)
```

`F` 是 `torch.nn.functional` 的常用别名。这里的 `kernel` 由代码显式传入；例如 Sobel 核是固定的边缘检测规则，不会自动成为可训练参数。

本日用于理解 shape 的 Sobel 实验：

```python
X = torch.arange(25, dtype=torch.float32).reshape(1, 1, 5, 5)
kernel = torch.tensor([[[[1., 0., -1.],
                         [2., 0., -2.],
                         [1., 0., -1.]]]])

out = F.conv2d(X, kernel, padding=1)
```

此处未显式写 `stride`，所以使用默认 `stride=1`。`padding=1` 使 `5×5` 输入在 `3×3` 核下保持输出空间大小为 `5×5`。

### 2. `nn.Conv2d`：创建可训练卷积层

```python
conv = nn.Conv2d(in_channels, out_channels, kernel_size, stride=1, padding=0)
```

它与此前 `nn.Linear` 的关系：两者都会在内部创建可训练 `weight` 与可选 `bias`；区别是卷积权重保留输入通道和局部空间维度。

```python
conv = nn.Conv2d(1, 16, kernel_size=3, padding=1)

print(conv.weight.shape)  # torch.Size([16, 1, 3, 3])
print(conv.bias.shape)    # torch.Size([16])
```

对应规则：

```text
nn.Conv2d(Cin, Cout, kernel_size=K)
-> conv.weight.shape = [Cout, Cin, K, K]
-> conv.bias.shape   = [Cout]
```

例如：

```text
nn.Conv2d(16, 32, kernel_size=3)
-> weight.shape = [32, 16, 3, 3]
```

连续卷积层必须满足：

```text
上一层的 out_channels = 下一层的 in_channels
```

---

## 三、参数量：直接从 `weight` 与 `bias` 读出来

本日使用之前已掌握的 `parameters()` 与 `numel()` 验证：

```python
sum(p.numel() for p in layer.parameters())
```

### 1. Linear

```python
linear = nn.Linear(1024, 16)

print(linear.weight.shape)  # torch.Size([16, 1024])
print(linear.bias.shape)    # torch.Size([16])
```

```text
参数量 = 16 × 1024 + 16 = 16400
```

### 2. Conv2d

```python
conv = nn.Conv2d(1, 16, kernel_size=3, padding=1)

print(conv.weight.shape)  # torch.Size([16, 1, 3, 3])
print(conv.bias.shape)    # torch.Size([16])
```

```text
参数量 = 16 × 1 × 3 × 3 + 16 = 160
```

`padding` 和 `stride` 改变的是卷积核滑动后得到的输出 shape，不改变 `weight`、`bias` 的 shape，因此不改变参数量。

---

## 四、参数共享在代码里的真实含义

`conv.weight` 只有一份：

```text
conv.weight.shape = [16, 1, 3, 3]
```

前向计算时，同一份 `conv.weight` 会被应用到输入图像的左上、中央、右下等所有局部位置。图像从 `32×32` 变成 `64×64` 时，卷积输出的位置更多、卷积计算次数更多，但权重仍只有这一份，参数量不增加。

因此必须区分：

| 说法                 | 是否正确           |
| ------------------ | -------------- |
| 参数共享减少参数量与模型存储     | 是              |
| 参数共享使输入变大时计算量不增加   | 否；位置变多，计算量仍会增加 |
| 同一个核可检测任意位置的相同局部模式 | 是              |

这正适合图像：同一类边缘、纹理或角点可能出现在任意位置。卷积核不需要为“左上角的竖直边缘”和“右下角的竖直边缘”分别学习两套参数。

与 [[Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）|纯 Tensor 手写 Softmax 分类]] 和 MLP 的差别是：MLP 在 `Flatten` 后为每个像素位置建立独立的全连接权重；CNN 在保留空间结构的前提下，用局部窗口和共享卷积核提取特征。

---

## 五、选做：不同 stride / padding 与感受野

### 1. 四组 shape 实验

以 `[1, 1, 28, 28]` 输入、`3×3` 卷积核为例，实际运行：

```python
x = torch.randn(1, 1, 28, 28)

configs = [
    {"stride": 1, "padding": 0},
    {"stride": 1, "padding": 1},
    {"stride": 2, "padding": 0},
    {"stride": 2, "padding": 1},
]

for config in configs:
    conv = nn.Conv2d(1, 1, kernel_size=3, bias=False, **config)
    print(config, "->", conv(x).shape)
```

实际输出：

```text
{'stride': 1, 'padding': 0} -> torch.Size([1, 1, 26, 26])
{'stride': 1, 'padding': 1} -> torch.Size([1, 1, 28, 28])
{'stride': 2, 'padding': 0} -> torch.Size([1, 1, 13, 13])
{'stride': 2, 'padding': 1} -> torch.Size([1, 1, 14, 14])
```

代码中的 `**config` 会把字典中的 `stride`、`padding` 作为命名参数传入 `nn.Conv2d`。`bias=False` 只是不为这个 shape 实验创建 bias，不影响输出 shape。

实践结论：

```text
3×3, stride=1, padding=1
-> 保持空间高宽，适合先提取特征

3×3, stride=2, padding=1
-> 空间高宽约减半，适合在提取特征的同时下采样
```

### 2. 感受野：一个特征位置最终能看到原图多大区域

感受野不是卷积核本身的大小，而是某层输出中一个位置所依赖的原始输入区域。

连续堆叠 `3×3, stride=1` 卷积时：

```text
输入单个像素：感受野 1×1
第 1 层输出一个位置：3×3
第 2 层输出一个位置：5×5
第 3 层输出一个位置：7×7
```

每增加一层 `3×3, stride=1` 卷积，感受野边长增加 2，而不是直接加 3；原因是前一层相邻卷积窗口在原图上会重叠。

`padding=1` 让 `3×3, stride=1` 卷积保持输出高宽，但不会阻止感受野扩大。边缘位置的窗口会包含补进去的 0，因此它实际看到的原图信息会少于中心位置。

当某层使用 `stride=2` 时，后续层在原图上的相邻位置间隔更大，感受野扩张会更快。简化递推为：

```text
新感受野 = 旧感受野 + (kernel_size - 1) × 旧步距
新步距   = 旧步距 × stride
```

本次检查：连续三层 `3×3, stride=1, padding=1` 卷积，输出空间高宽保持不变，最后一层一个位置的感受野为 `7×7`。

---

## 六、今天最容易混淆的点

1. `Cin` 与 `Cout`：输入的第二维必须匹配 `in_channels`；输出的第二维由 `out_channels` 决定。
2. `F.conv2d` 与 `nn.Conv2d`：前者接收手动给定的 `weight`；后者内部创建并训练 `weight`。
3. `stride`：`F.conv2d` 未显式传入时默认是 `1`。
4. `padding`：影响输出高宽，不增加可训练参数。
5. 参数量与计算量：卷积参数共享显著减少参数量；输入空间变大仍会让卷积位置和计算量增加。

---

## 七、掌握检查

- [x] 能写出输入 `[N, Cin, H, W]`、卷积核 `[Cout, Cin, Kh, Kw]`、输出 `[N, Cout, Hout, Wout]`。
- [x] 能从 `nn.Conv2d(16, 32, kernel_size=3)` 推出 `weight.shape = [32, 16, 3, 3]`。
- [x] 能解释 `F.conv2d` 用于固定 Sobel 核，`nn.Conv2d` 用于可训练卷积层。
- [x] 已实际验证：`Linear(1024, 16)` 为 16400 个参数，`Conv2d(1, 16, 3, padding=1)` 为 160 个参数。
- [x] 能准确说明参数共享和图像局部模式之间的关系。
- [x] 已实际验证四组 `stride/padding` 对输出 shape 的影响。
- [x] 能说明连续三层 `3×3, stride=1, padding=1` 卷积保持高宽、感受野扩大到 `7×7`。

## 下一步

第 5 周 Day 2 将进入 LeNet，重点阅读“卷积/池化 -> 展平 -> 分类器”的完整数据流，并把本日的 `Conv2d` shape 合同接到真实 CNN 模型中。
