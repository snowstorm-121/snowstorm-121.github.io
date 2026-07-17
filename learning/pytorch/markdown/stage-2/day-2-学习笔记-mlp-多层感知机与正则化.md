学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版，PyTorch 官方文档

本阶段重点：从 [[Day 1 学习笔记：nn.Module 与常用层入门|第 4 周 Day 1]] 的 `nn.Module`、`nn.Linear`、`nn.Sequential`、`CrossEntropyLoss` 和 `torch.optim`，继续过渡到更完整的分类模型训练。今天不是为了“多堆几层 API”，而是理解：Softmax 回归为什么是线性模型，MLP 为什么需要隐藏层和 ReLU，以及正则化在控制什么问题。

今天主线：`MLP 多层感知机 + 正则化`。核心心智模型是：**MLP 不是改变分类任务，也不是改变 loss，而是在 logits 之前多学习一层非线性的中间表示。**

---

## 〇、贯穿全天的六条心智主线

### 1. [[Stage1/Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）|Softmax 回归]]是直接从像素到类别

Fashion-MNIST 图片 shape 通常是：

```plain
X.shape = (batch_size, 1, 28, 28)
```

展平后：

```plain
X_flat.shape = (batch_size, 784)
```

Softmax 回归模型：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 10)
)
```

结构是：

```plain
784 -> 10
```

心智模型：

```plain
原始像素 -> 10 类 logits
```

它对应手写版本：

```plain
logits = X @ W + b
```

也就是每个类别都有一组线性权重，对输入像素做加权求和。

### 2. MLP 是先学习隐藏表示，再输出 logits

基础 MLP：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)
```

结构是：

```plain
784 -> 256 -> 10
```

心智模型：

```plain
原始像素 -> 隐藏特征 -> 10 类 logits
```

这里的 `256` 是隐藏层宽度，也就是模型先学出 256 个中间特征，再用这些中间特征做分类。

### 3. ReLU 让多层 Linear 真正有意义

如果模型只是：

```plain
Linear -> Linear
```

那么整体仍然可以合并成一个 Linear。

因为：

```plain
H = X @ W1 + b1
logits = H @ W2 + b2
```

代入后：

```plain
logits = X @ W1 @ W2 + b1 @ W2 + b2
```

重新记作：

```plain
logits = X @ W_new + b_new
```

本质还是线性模型。

加入 ReLU：

```plain
Linear -> ReLU -> Linear
```

中间出现非线性变换，多层网络才无法被简单合并成一层 Linear。

### 4. 输出层仍然输出 logits

MLP 最后一层：

```python
self.output = nn.Linear(hidden_size, 10)
```

`forward` 里：

```python
x = self.output(x)
return x
```

返回的是 logits，不是概率。

训练时仍然使用：

```python
loss_fn = nn.CrossEntropyLoss()
loss = loss_fn(logits, y)
```

不要提前 softmax，因为 `nn.CrossEntropyLoss` 内部已经包含：

```plain
log_softmax + NLLLoss
```

### 5. 训练骨架没有变

模型从 Softmax 回归换成 MLP 后，训练三步仍然是：

```python
optimizer.zero_grad()
loss.backward()
optimizer.step()
```

含义仍然是：

```plain
清空旧梯度
反向传播计算当前梯度
优化器根据梯度更新参数
```

模型结构变复杂了，但 PyTorch 的训练骨架没有变。

### 6. 正则化不是让训练 acc 一定更高

今天学的正则化包括：

```plain
weight decay
dropout
```

它们的目标不是单纯提高训练集 accuracy，而是控制模型复杂度，减少过拟合风险。

重要理解：

```plain
MLP 提升表达能力
正则化约束表达能力
```

模型更强不等于测试 acc 一定立刻大幅上涨。效果还受数据复杂度、epoch、学习率、hidden_size、optimizer 和正则化强度影响。

---

## 一、从 [[Stage1/Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）|Softmax 回归]]复盘起步

### 1. Softmax 回归的结构

Fashion-MNIST 是 10 分类任务。

输入图片：

```plain
(batch_size, 1, 28, 28)
```

展平：

```plain
(batch_size, 784)
```

输出 logits：

```plain
(batch_size, 10)
```

模型：

```python
softmax_model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 10)
)
```

等价于手写：

```plain
logits = X @ W + b
```

在 PyTorch 的 `nn.Linear(784, 10)` 中：

```plain
weight.shape = (10, 784)
bias.shape   = (10,)
```

内部计算是：

```plain
X @ weight.T + bias
```

### 2. Softmax 回归的能力边界

Softmax 回归可以理解为：

```plain
用 10 个线性打分器，对同一张图片分别打分
```

每个类别的 logit 都是：

```plain
w1*x1 + w2*x2 + ... + w784*x784 + b
```

所以它是线性模型。

它能学到一些粗粒度模式，比如：

```plain
裤子的左右结构
鞋子的下方轮廓
包的大致形状
衣服的整体明暗分布
```

但它很难显式学习更复杂的组合特征。

Softmax 回归是：

```plain
像素 -> 类别
```

MLP 是：

```plain
像素 -> 中间特征 -> 类别
```

---

## 二、MLP 的隐藏层是什么

### 1. 基础 MLP 结构

最简单的单隐藏层 MLP：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)
```

shape 流动：

```plain
X:        (batch_size, 1, 28, 28)
Flatten:  (batch_size, 784)
Hidden:   (batch_size, 256)
ReLU:     (batch_size, 256)
Output:   (batch_size, 10)
```

最后输出仍然是：

```plain
logits: (batch_size, 10)
```

### 2. `nn.Linear(784, 256)` 在做什么

这一层不是最终分类层。

它做的是：

```plain
784 维原始像素 -> 256 维隐藏表示
```

对于一个样本：

```plain
x.shape = (784,)
```

隐藏层输出：

```plain
h.shape = (256,)
```

每个隐藏单元都类似一个线性打分器：

```plain
h1 = w1_1*x1 + w1_2*x2 + ... + w1_784*x784 + b1
h2 = w2_1*x1 + w2_2*x2 + ... + w2_784*x784 + b2
...
h256 = w256_1*x1 + ... + w256_784*x784 + b256
```

矩阵形式：

```plain
H = X @ W1 + b1
```

对应 PyTorch：

```plain
hidden.weight.shape = (256, 784)
hidden.bias.shape   = (256,)
```

内部计算：

```plain
H = X @ hidden.weight.T + hidden.bias
```

### 3. `hidden_size` 是超参数

```python
hidden_size = 256
```

表示隐藏层宽度。

它不是模型训练出来的参数，而是我们提前设计的结构选择。

模型训练会学习的是：

```plain
hidden.weight
hidden.bias
output.weight
output.bias
```

但 `hidden_size=256` 这个数字本身不会被训练自动改变。

### 4. 参数数量对比

Softmax 回归：

```python
nn.Linear(784, 10)
```

参数数：

```plain
weight: 10 * 784 = 7840
bias:   10
total:  7850
```

MLP：

```python
nn.Linear(784, 256)
nn.Linear(256, 10)
```

参数数：

```plain
hidden weight: 256 * 784 = 200704
hidden bias:   256
output weight: 10 * 256 = 2560
output bias:   10
total:         203530
```

所以 MLP 表达能力更强，但也更可能过拟合。

---

## 三、为什么必须有 ReLU

### 1. 只堆 Linear 仍然是线性模型

错误心智模型：

```plain
层数多 = 一定更强
```

如果没有激活函数：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 256),
    nn.Linear(256, 10)
)
```

它看起来有两层，但整体仍然可以合并成：

```python
nn.Linear(784, 10)
```

原因是线性变换的复合仍然是线性变换。

### 2. ReLU 的定义

```plain
ReLU(x) = max(0, x)
```

代码：

```python
relu = nn.ReLU()
```

效果：

```plain
负数变成 0
正数保持不变
```

例子：

```python
x = torch.tensor([-2.0, -0.5, 0.0, 1.0, 3.0])
print(nn.ReLU()(x))
```

输出：

```plain
tensor([0., 0., 0., 1., 3.])
```

### 3. ReLU 的心智模型

隐藏层先产生一批特征打分：

```plain
h1, h2, h3, ..., h256
```

ReLU 像一个开关：

```plain
如果某个特征打分 <= 0，就关闭
如果某个特征打分 > 0，就保留
```

所以 MLP 可以理解为：

```plain
原始像素 -> 一批特征打分 -> 激活其中一部分 -> 类别打分
```

### 4. ReLU 没有可学习参数

```python
relu = nn.ReLU()
print(list(relu.parameters()))
```

输出：

```plain
[]
```

所以在：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)
```

有参数的是：

```plain
Linear(784, 256)
Linear(256, 10)
```

没有参数的是：

```plain
Flatten
ReLU
```

---

## 四、用 `nn.Sequential` 搭建 MLP

### 1. 模型代码

```python
import torch
from torch import nn


model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)
```

### 2. 喂一批假数据检查接口

```python
X = torch.randn(4, 1, 28, 28)
y = torch.tensor([0, 3, 5, 9])

logits = model(X)

print(logits.shape)
```

输出：

```plain
torch.Size([4, 10])
```

说明每张图片都输出 10 个类别 logits。

### 3. 接 `CrossEntropyLoss`

```python
loss_fn = nn.CrossEntropyLoss()
loss = loss_fn(logits, y)
```

shape 对应：

```plain
logits.shape = (4, 10)
y.shape      = (4,)
```

标签 `y` 是类别索引，不是 one-hot。

### 4. 查看参数

```python
for name, param in model.named_parameters():
    print(name, param.shape)
```

输出类似：

```plain
1.weight torch.Size([256, 784])
1.bias   torch.Size([256])
3.weight torch.Size([10, 256])
3.bias   torch.Size([10])
```

没有 `0.weight`，因为第 0 层是 `Flatten`。

没有 `2.weight`，因为第 2 层是 `ReLU`。

---

## 五、用自定义 `nn.Module` 重写 MLP

### 1. 模型类

```python
import torch
from torch import nn


class MLP(nn.Module):
    def __init__(self, hidden_size=256):
        super().__init__()
        self.flatten = nn.Flatten()
        self.hidden = nn.Linear(784, hidden_size)
        self.relu = nn.ReLU()
        self.output = nn.Linear(hidden_size, 10)

    def forward(self, x):
        x = self.flatten(x)
        x = self.hidden(x)
        x = self.relu(x)
        x = self.output(x)
        return x
```

使用：

```python
model = MLP(hidden_size=256)

X = torch.randn(4, 1, 28, 28)
logits = model(X)

print(logits.shape)
```

输出：

```plain
torch.Size([4, 10])
```

### 2. `__init__` 和 `forward` 的分工

```plain
__init__：创建并注册模型组件
forward：定义数据怎么流过这些组件
```

可学习层应该在 `__init__` 里创建：

```python
self.hidden = nn.Linear(784, hidden_size)
self.output = nn.Linear(hidden_size, 10)
```

`forward` 里只使用这些层：

```python
x = self.hidden(x)
x = self.output(x)
```

### 3. 不要在 `forward` 里新建可学习层

错误写法：

```python
class BadMLP(nn.Module):
    def __init__(self):
        super().__init__()

    def forward(self, x):
        x = nn.Flatten()(x)
        x = nn.Linear(784, 256)(x)
        x = nn.ReLU()(x)
        x = nn.Linear(256, 10)(x)
        return x
```

问题：

```plain
每次 forward 都新建一套随机参数
参数没有稳定保存到 self 上
model.parameters() 拿不到这些临时参数
optimizer 无法正确训练模型
```

正确做法：

```plain
可学习层在 __init__ 里创建一次，并赋给 self.xxx
forward 里只描述计算流程
```

### 4. 自定义 Module 和 Sequential 的关系

`nn.Sequential` 适合简单顺序模型：

```plain
一层接一层，没有分支，没有复杂逻辑
```

自定义 `nn.Module` 适合：

```plain
需要清晰命名层
需要 debug 中间结果
需要条件分支
需要多个输入或多个输出
模型结构更复杂
```

今天的 MLP 两种写法都可以，但后面 CNN、RNN、Transformer 和复杂项目会更多使用自定义 `nn.Module`。

---

## 六、规范训练与评估函数

### 1. 单个 batch 的训练步骤

```python
logits = model(X)
loss = loss_fn(logits, y)

optimizer.zero_grad()
loss.backward()
optimizer.step()
```

翻译：

```plain
前向传播得到 logits
计算当前 batch 的 loss
清空旧梯度
反向传播计算新梯度
更新参数
```

### 2. `train_one_epoch`

```python
def train_one_epoch(model, data_loader, loss_fn, optimizer, device):
    model.train()

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    for X, y in data_loader:
        X = X.to(device)
        y = y.to(device)

        logits = model(X)
        loss = loss_fn(logits, y)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        batch_size = X.shape[0]
        total_loss += loss.detach().item() * batch_size
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_samples += batch_size

    avg_loss = total_loss / total_samples
    accuracy = total_correct / total_samples

    return avg_loss, accuracy
```

注意：

```plain
nn.CrossEntropyLoss 默认返回 batch 平均 loss
统计 epoch 平均 loss 时，要乘回 batch_size
最后再除以 total_samples
```

### 3. `evaluate`

```python
def evaluate(model, data_loader, loss_fn, device):
    model.eval()

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    with torch.no_grad():
        for X, y in data_loader:
            X = X.to(device)
            y = y.to(device)

            logits = model(X)
            loss = loss_fn(logits, y)

            batch_size = X.shape[0]
            total_loss += loss.item() * batch_size
            total_correct += (logits.argmax(dim=1) == y).sum().item()
            total_samples += batch_size

    avg_loss = total_loss / total_samples
    accuracy = total_correct / total_samples

    return avg_loss, accuracy
```

### 4. `model.train()` 和 `model.eval()`

```python
model.train()
```

表示切换到训练模式。

```python
model.eval()
```

表示切换到评估模式。

它们不会自动开始训练或评估循环，只是改变模型中某些层的行为。

对基础 MLP：

```plain
Flatten -> Linear -> ReLU -> Linear
```

影响不明显。

但对 Dropout / BatchNorm 等层非常重要。

### 5. `torch.no_grad()`

评估时写：

```python
with torch.no_grad():
    logits = model(X)
```

含义：

```plain
不构建计算图
不保存梯度信息
节省内存
计算更轻
```

注意：

```python
with torch.no_grad():
```

不要漏掉括号。

---

## 七、Fashion-MNIST 完整训练骨架

### 1. 设备选择

在 MacBook Air 的 Apple Silicon 上，应该优先考虑 `mps`，不是 `cuda`。

```python
def get_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")
```

使用：

```python
device = get_device()
print("device:", device)
```

在 Apple Silicon 上正常应输出：

```plain
device: mps
```

### 2. 数据加载

```python
from pathlib import Path

from torch.utils.data import DataLoader
from torchvision import datasets, transforms


data_dir = Path(__file__).resolve().parent.parent / "data"

transform = transforms.ToTensor()

train_dataset = datasets.FashionMNIST(
    root=data_dir,
    train=True,
    transform=transform,
    download=True,
)

test_dataset = datasets.FashionMNIST(
    root=data_dir,
    train=False,
    transform=transform,
    download=True,
)

train_loader = DataLoader(
    train_dataset,
    batch_size=256,
    shuffle=True,
)

test_loader = DataLoader(
    test_dataset,
    batch_size=256,
    shuffle=False,
)
```

这里继续使用固定数据目录：

```plain
Path(__file__).resolve().parent.parent / "data"
```

避免 `./data` 随运行目录变化。

### 3. 模型、loss、optimizer

```python
model = MLP(hidden_size=256).to(device)

loss_fn = nn.CrossEntropyLoss()

optimizer = torch.optim.SGD(
    model.parameters(),
    lr=0.1,
)
```

训练循环：

```python
num_epochs = 10

for epoch in range(num_epochs):
    train_loss, train_acc = train_one_epoch(
        model, train_loader, loss_fn, optimizer, device
    )

    test_loss, test_acc = evaluate(
        model, test_loader, loss_fn, device
    )

    print(
        f"epoch {epoch + 1:02d}, "
        f"train loss {train_loss:.4f}, train acc {train_acc:.4f}, "
        f"test loss {test_loss:.4f}, test acc {test_acc:.4f}"
    )
```

---

## 八、正则化一：Weight Decay

### 1. 正则化要解决什么

MLP 参数比 Softmax 回归多很多。

参数越多，模型表达能力越强，但也更可能：

```plain
训练集表现很好
测试集表现一般
```

这就是过拟合风险。

正则化的核心思想：

```plain
不要只让训练 loss 小，也要限制模型别过度复杂
```

### 2. Weight decay 的直觉

普通训练只关心：

```plain
分类 loss 小不小
```

Weight decay 额外关心：

```plain
参数是不是太大
```

它会鼓励权重保持小一点。

心智模型：

```plain
如果模型必须依赖很大的权重才能记住训练集，
它可能是在死记硬背，而不是学习稳定规律。
```

### 3. 数学形式

普通目标：

```plain
min loss
```

加入 weight decay：

```plain
min loss + λ * ||w||²
```

其中：

```plain
loss   = 分类损失
||w||² = 权重平方和
λ      = 正则化强度
```

### 4. 和手写 SGD 的关系

普通 SGD：

```plain
w = w - lr * grad
```

加入 weight decay 后，可以理解成：

```plain
w = w - lr * (grad + λ * w)
```

展开：

```plain
w = (1 - lr * λ) * w - lr * grad
```

这一项：

```plain
(1 - lr * λ) * w
```

会让权重每次更新时稍微往小的方向衰减。

### 5. PyTorch 写法

不加 weight decay：

```python
optimizer = torch.optim.SGD(
    model.parameters(),
    lr=0.1,
)
```

加 weight decay：

```python
optimizer = torch.optim.SGD(
    model.parameters(),
    lr=0.1,
    weight_decay=1e-4,
)
```

它不改变模型结构，不改变 `forward`，不改变 loss 写法。

它影响的是：

```python
optimizer.step()
```

里面的参数更新。

---

## 九、正则化二：Dropout

### 1. Dropout 的思想

Dropout 解决的问题是：

```plain
模型可能过度依赖少数隐藏单元
```

它的做法：

```plain
训练时随机关掉一部分隐藏单元
```

让模型不要把所有希望押在少数特征上。

### 2. Dropout 的行为

```python
dropout = nn.Dropout(p=0.5)
```

这里的 `p` 是：

```plain
被置为 0 的概率
```

不是保留概率。

```plain
p=0.2：随机丢掉 20%
p=0.5：随机丢掉 50%
```

PyTorch 使用 inverted dropout：

```plain
训练时随机置零，并把保留下来的值按比例放大
评估时不随机置零，也不需要额外缩放
```

如果 `p=0.5`，保留概率是 `0.5`，保留下来的值会乘以：

```plain
1 / (1 - p) = 2
```

### 3. Dropout 放在哪里

基础 MLP：

```plain
Flatten -> Linear -> ReLU -> Linear
```

加 Dropout：

```plain
Flatten -> Linear -> ReLU -> Dropout -> Linear
```

代码：

```python
class MLPWithDropout(nn.Module):
    def __init__(self, hidden_size=256, dropout_p=0.5):
        super().__init__()
        self.flatten = nn.Flatten()
        self.hidden = nn.Linear(784, hidden_size)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(p=dropout_p)
        self.output = nn.Linear(hidden_size, 10)

    def forward(self, x):
        x = self.flatten(x)
        x = self.hidden(x)
        x = self.relu(x)
        x = self.dropout(x)
        x = self.output(x)
        return x
```

### 4. Dropout 和 `train` / `eval`

训练模式：

```python
model.train()
```

Dropout 会随机丢弃隐藏单元。

评估模式：

```python
model.eval()
```

Dropout 不再随机丢弃。

如果评估时忘了 `model.eval()`，测试结果可能：

```plain
不稳定
偏低
每次 evaluate 都有波动
```

### 5. Dropout 没有可学习参数

```python
dropout = nn.Dropout(p=0.5)
print(list(dropout.parameters()))
```

输出：

```plain
[]
```

它和 ReLU 类似：

```plain
是一个层
但没有 weight / bias
```

---

## 十、Weight Decay 和 Dropout 对比

```plain
Weight decay:
写在 optimizer 里
限制权重不要太大
影响 optimizer.step()
不改变模型结构
```

```plain
Dropout:
写在 model 里
训练时随机丢隐藏单元
影响 forward()
依赖 model.train() / model.eval()
```

可以一起使用：

```python
model = MLPWithDropout(hidden_size=256, dropout_p=0.5).to(device)

optimizer = torch.optim.SGD(
    model.parameters(),
    lr=0.1,
    weight_decay=1e-4,
)
```

训练三步仍然不变：

```python
optimizer.zero_grad()
loss.backward()
optimizer.step()
```

---

## 十一、为什么今天 acc 可能提升不明显

### 1. Fashion-MNIST 对线性模型相对友好

Fashion-MNIST 的图片有这些特点：

```plain
灰度图
居中
背景干净
尺寸小
类别数少
```

Softmax 回归已经可以学到不少粗粒度模式。

所以 MLP 的提升不一定是：

```plain
60% -> 90%
```

更可能是：

```plain
82% -> 85%
84% -> 87%
```

如果训练参数没有调好，也可能差别更小。

### 2. MLP 增加的是表达能力，不是保证指标上涨

MLP 的意义是：

```plain
它有能力表达更复杂的非线性函数
```

但最终 accuracy 还受这些因素影响：

```plain
学习率
epoch 数量
batch size
hidden_size
初始化
optimizer
是否归一化
正则化强度
是否已经过拟合
```

所以：

```plain
模型更强
```

不等于：

```plain
测试 acc 一定大幅提升
```

### 3. 正则化可能让训练 acc 降低

Weight decay 和 Dropout 的目标不是让训练集 acc 更高。

它们可能会：

```plain
让训练 loss 稍微高一点
让训练 acc 稍微低一点
但测试集表现更稳
```

正则化的目标是泛化，不是单纯追求训练集拟合。

### 4. 更应该看哪些指标

不要只看最终 test acc。

更应该对比：

```plain
Softmax train acc vs test acc
MLP train acc vs test acc
MLP + weight_decay train acc vs test acc
MLP + dropout train acc vs test acc
```

重点观察：

```plain
MLP 的 train acc 是否高于 Softmax
MLP 的 train loss 是否更低
MLP 的 test acc 是否也提升
train acc 和 test acc 的差距是否变大
正则化是否缩小了这个差距
```

如果：

```plain
MLP train acc 明显更高，但 test acc 没提升
```

说明模型表达能力增强了，但泛化没有跟上。

如果：

```plain
MLP train acc 和 test acc 都没明显提高
```

可能是训练设置不合适，也可能是这个任务上 Softmax 已经吃掉了大部分简单收益。

### 5. MLP 仍然不是图像任务最合适的结构

Softmax 回归和 MLP 都把图片展平成向量：

```plain
(1, 28, 28) -> (784,)
```

展平后会丢掉二维空间结构。

图像任务中更适合的是 CNN，因为 CNN 会利用：

```plain
局部感受野
权重共享
空间结构
```

所以 MLP 相比 Softmax 回归提升不大，是一个正常且有教育意义的现象。

---

## 十二、今天容易踩的坑

### 1. 最后一层加 softmax

错误：

```python
probs = torch.softmax(logits, dim=1)
loss = nn.CrossEntropyLoss()(probs, y)
```

正确：

```python
loss = nn.CrossEntropyLoss()(logits, y)
```

模型最后返回 logits 即可。

### 2. 标签写成 one-hot

常见正确输入：

```plain
logits.shape = (batch_size, 10)
y.shape      = (batch_size,)
```

`y` 是类别索引：

```python
y = torch.tensor([0, 3, 5, 9])
```

不是：

```plain
(batch_size, 10)
```

的 one-hot。

### 3. `argmax` 维度写错

分类预测：

```python
pred = logits.argmax(dim=1)
```

因为：

```plain
dim=1 是类别维度
```

不要写成：

```python
pred = logits.argmax(dim=0)
```

### 4. 忘记 `model.eval()`

评估时：

```python
model.eval()
```

尤其加入 Dropout 后很重要。

### 5. 忘记 `torch.no_grad()`

评估时：

```python
with torch.no_grad():
```

不需要计算梯度。

注意括号不能漏。

### 6. 在 `forward` 里创建层

错误：

```python
def forward(self, x):
    x = nn.Linear(784, 256)(x)
    return x
```

正确：

```python
def __init__(self):
    super().__init__()
    self.hidden = nn.Linear(784, 256)

def forward(self, x):
    x = self.hidden(x)
    return x
```

### 7. Mac 上只检查 CUDA

不推荐只写：

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
```

Apple Silicon 应优先：

```python
if torch.backends.mps.is_available():
    device = torch.device("mps")
```

---

## 十三、今天的核心对应关系

```plain
Softmax 回归
-> Flatten + Linear(784, 10)
```

```plain
MLP
-> Flatten + Linear(784, hidden) + ReLU + Linear(hidden, 10)
```

```plain
隐藏层
-> 从原始像素学习中间表示
```

```plain
ReLU
-> 引入非线性，让多层 Linear 无法合并成一层 Linear
```

```plain
logits
-> CrossEntropyLoss 的直接输入
```

```plain
类别索引 y
-> CrossEntropyLoss 的常见标签格式
```

```plain
model.train()
-> 训练模式，Dropout 生效
```

```plain
model.eval()
-> 评估模式，Dropout 关闭随机丢弃
```

```plain
torch.no_grad()
-> 关闭梯度记录，节省内存和计算
```

```plain
weight_decay
-> optimizer 层面的正则化
```

```plain
dropout
-> model 结构里的正则化层
```

---

## 十四、Day 2 结束时应掌握

今天结束后，应该能回答：

```plain
Softmax 回归为什么是线性模型？
MLP 的隐藏层在做什么？
hidden_size 为什么是超参数？
为什么 Linear 后面要加 ReLU？
为什么只堆 Linear 没有意义？
为什么最后一层仍然输出 logits？
CrossEntropyLoss 为什么不要提前 softmax？
分类标签为什么通常是 (batch_size,) 的类别索引？
如何写 train_one_epoch 和 evaluate？
model.train() / model.eval() 和 torch.no_grad() 分别控制什么？
weight decay 在优化器里做了什么？
dropout 为什么只在训练模式下随机生效？
为什么 MLP 的 acc 不一定比 Softmax 回归大幅提升？
```

今天最重要的结论：

```plain
MLP 的意义不是换掉分类训练流程，而是在 logits 之前学习非线性的隐藏表示；正则化的意义不是保证训练 acc 更高，而是约束模型复杂度、帮助泛化。
```

下一步学习 CNN 时，要重点观察：

```plain
为什么 MLP 展平图片后仍然不够适合图像任务？
CNN 如何利用图像的二维空间结构？
局部感受野和权重共享为什么能提升图像分类效果？
```
