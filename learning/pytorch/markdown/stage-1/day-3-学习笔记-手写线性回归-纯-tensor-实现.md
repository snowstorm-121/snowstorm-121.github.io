学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版 3.1-3.2 线性回归

本阶段重点：从 [[Day 2 学习笔记：PyTorch Autograd 自动微分基础|Autograd 自动微分]]过渡到真正的训练循环。今天不使用 `nn.Module`、不使用 `torch.optim`，而是用纯 Tensor 手写线性回归，亲手理解：数据如何进入模型、前向计算如何建图、loss 如何衡量误差、`backward()` 如何计算梯度、为什么参数更新要放进 `torch.no_grad()`、为什么每个 batch 后要清空梯度。

今天主线：手写线性回归。核心心智模型是：**模型参数 `w`、`b` 参与前向计算，loss 因参数而变化；`loss.backward()` 只负责把梯度写入 `w.grad` / `b.grad`，真正改变参数的是我们手写的 SGD 更新。**

---

## 〇、贯穿全天的四条心智主线

### 1. 从 [[Day 2 学习笔记：PyTorch Autograd 自动微分基础|Autograd 实验]]走向训练循环

Day 2 里学到的是：

```plain
x = torch.tensor(2.0, requires_grad=True)
y = x ** 2
y.backward()
print(x.grad)
```

这回答的是：

```plain
给定一个计算图，PyTorch 能不能自动求导？
```

今天要解决的是：

```plain
有一组随机初始化的参数，能不能根据 loss 的梯度反复调整，让模型预测越来越准？
```

也就是从：

```plain
前向计算 -> backward() -> 查看梯度
```

走向：

```plain
前向计算 -> 计算 loss -> backward() -> 手动更新参数 -> 清空梯度 -> 重复
```

### 2. Autograd 负责算梯度，不负责更新参数

训练里最容易混的点是：

```plain
loss.backward()
```

不会自动改变 `w` 和 `b`。

它只会计算：

```plain
loss 对 w 的梯度 -> w.grad
loss 对 b 的梯度 -> b.grad
```

真正改变参数的是：

```plain
with torch.no_grad():
    w -= lr * w.grad
    b -= lr * b.grad
```

所以可以把职责分清：

```plain
Autograd：算方向
SGD：按方向改参数
zero_：清掉旧梯度
```

### 3. 每个 batch 都会重新建一张计算图

PyTorch 是动态计算图。每次执行：

```plain
y_hat = linreg(X, w, b)
loss = squared_loss(y_hat, y).mean()
```

都会根据当前 batch、当前参数临时搭一张图：

```plain
w, b -> y_hat -> loss
```

调用：

```plain
loss.backward()
```

后，这张图被用来反向计算当前 batch 的梯度。

下一个 batch 会重新前向、重新建图、重新 backward。

### 4. shape 要统一：要么都用 `(n,)`，要么都用 `(n, 1)`

今天虽然不把 shape 当主菜，但实际调试中遇到过一个很重要的坑：

```plain
(1000,) + (1000, 1) 可能广播成 (1000, 1000)
```

所以标签、预测值、噪声最好统一风格。

可以走一维路线：

```plain
X @ w -> (n,)
noise -> (n,)
y -> (n,)
最后 reshape 成 (n, 1)
```

也可以走列向量路线：

```plain
X @ w.reshape(-1, 1) -> (n, 1)
noise -> (n, 1)
y -> (n, 1)
```

不要混着来。

---

## 一、线性回归的数学模型

### 1. 模型形式

线性回归的模型是：

```plain
y_hat = Xw + b
```

如果有两个特征：

```plain
y_hat = x1 * w1 + x2 * w2 + b
```

其中：

```plain
X：输入特征
w：权重参数
b：偏置参数
y_hat：模型预测值
y：真实标签
```

今天真正要训练的是：

```plain
w 和 b
```

不是 `X`，也不是 `y`。

### 2. 真实参数和可学习参数要分清

造数据时使用：

```plain
true_w = torch.tensor([2.0, -3.4])
true_b = 4.2
```

这两个是隐藏在数据背后的真实规律，可以理解为“标准答案”。

训练时初始化：

```plain
w = torch.normal(0, 0.1, size=(len(true_w),), requires_grad=True)
b = torch.zeros(1, requires_grad=True)
```

这两个是模型当前的“作业答案”，一开始是乱猜的，需要通过训练逐步接近 `true_w` 和 `true_b`。

心智区分：

```plain
true_w / true_b：用来生成数据，不参与训练
w / b：模型参数，需要 requires_grad=True，需要被更新
```

---

## 二、生成合成数据：`synthetic_data`

### 1. 一维版本

今天自己写的版本是：

```plain
def synthetic_data(w, b, num_examples):
    X = torch.normal(0, 1, size=(num_examples, len(w)))
    noise = torch.normal(0, 0.01, size=(num_examples,))
    y = X @ w + b + noise
    return X, y.reshape((-1, 1))
```

这里：

```plain
X.shape -> (num_examples, 2)
w.shape -> (2,)
X @ w -> (num_examples,)
noise.shape -> (num_examples,)
y.shape -> (num_examples,)
y.reshape(-1, 1) -> (num_examples, 1)
```

这种写法可以运行，关键是 `X @ w` 和 `noise` 都是一维。

### 2. 列向量版本

也可以写成全程列向量：

```plain
def synthetic_data(w, b, num_examples):
    X = torch.normal(0, 1, size=(num_examples, len(w)))
    noise = torch.normal(0, 0.01, size=(num_examples, 1))
    y = X @ w.reshape(-1, 1) + b + noise
    return X, y
```

这里：

```plain
X @ w.reshape(-1, 1) -> (num_examples, 1)
noise -> (num_examples, 1)
y -> (num_examples, 1)
```

这种写法也可以。

### 3. 今天踩到的广播坑

一开始容易写出这种混合版本：

```plain
noise = torch.normal(0, 0.01, size=(num_examples, 1))
y = X @ w + b + noise
```

如果：

```plain
X @ w -> (1000,)
noise -> (1000, 1)
```

那么 PyTorch 广播时可能得到：

```plain
(1000,) + (1000, 1) -> (1000, 1000)
```

于是 `labels` 里会有：

```plain
1000 * 1000 = 1000000
```

个元素。

后面执行：

```plain
y.reshape(y_hat.shape)
```

就会报错：

```plain
RuntimeError: shape '[1000, 1]' is invalid for input of size 1000000
```

这个错误的本质不是 reshape 本身，而是前面广播已经把 `y` 扩成了 `(1000, 1000)`。

### 4. NumPy 和 PyTorch 的 `size` 差异

NumPy 常见写法：

```plain
np.random.normal(0, 0.01, size=1000)
```

PyTorch 更常写成：

```plain
torch.normal(0, 0.01, size=(1000,))
```

一维 tuple 的逗号很重要：

```plain
(1000)  -> int
(1000,) -> tuple
```

学习 PyTorch 时建议养成习惯：

```plain
size=(num_examples,)
size=(num_examples, 1)
size=(len(true_w),)
size=(len(true_w), 1)
```

明确写出 shape。

---

## 三、小批量读取数据：`data_iter`

### 1. 正确写法

```plain
def data_iter(batch_size, features, labels):
    num_examples = features.shape[0]
    indices = torch.randperm(num_examples)

    for i in range(0, num_examples, batch_size):
        batch_indices = indices[i:min(i + batch_size, num_examples)]
        yield features[batch_indices], labels[batch_indices]
```

这里：

```plain
features.shape[0]
```

表示样本数量，也就是有多少行。

如果：

```plain
features.shape == torch.Size([1000, 2])
```

那么：

```plain
features.shape[0] == 1000
len(features) == 1000
```

### 2. `torch.randperm`

```plain
indices = torch.randperm(num_examples)
```

会生成一个随机打乱的索引 Tensor，例如：

```plain
tensor([37, 2, 891, 14, ...])
```

然后每个 batch 用这些随机索引取数据：

```plain
features[batch_indices], labels[batch_indices]
```

这样每个 epoch 的数据顺序都是随机的。

### 3. `yield` 的作用

`yield` 表示：

```plain
吐出一个 batch，然后暂停函数；下一次 for 循环再从暂停处继续。
```

训练循环：

```plain
for X, y in data_iter(batch_size, features, labels):
    ...
```

每次都会从 `data_iter` 里拿到一个 batch。

如果 `num_examples=1000`，`batch_size=10`，那么每个 epoch 应该有：

```plain
100 个 batch
```

可以用下面代码检查：

```plain
count = 0
for X, y in data_iter(batch_size, features, labels):
    count += 1
print(count)
```

正确结果应该是：

```plain
100
```

### 4. 今天踩到的 `yield` 缩进坑

一开始写成了：

```plain
def data_iter(batch_size, features, labels):
    num_examples = features.shape[0]
    indices = torch.randperm(num_examples)
    for i in range(0, num_examples, batch_size):
        batch_indices = indices[i:min(i + batch_size, num_examples)]
    yield features[batch_indices], labels[batch_indices]
```

这里 `yield` 在 `for` 外面。

结果是：

```plain
for 循环先跑完，只留下最后一个 batch_indices
最后只 yield 一次
```

也就是说每个 epoch 只训练了最后一个 batch，而不是 100 个 batch。

这会导致一个现象：

```plain
模型要训练很多轮，比如 100+ 轮，才能逼近真实值
```

因为每轮只看了 10 条样本。

正确缩进是：

```plain
for i in range(...):
    batch_indices = ...
    yield features[batch_indices], labels[batch_indices]
```

`yield` 必须在 `for` 循环里面。

### 5. 今天遇到的 warning

如果写：

```plain
indices = torch.randperm(num_examples)
batch_indices = torch.tensor(indices[i:min(i + batch_size, num_examples)])
```

会出现 warning：

```plain
UserWarning: To copy construct from a tensor, it is recommended to use sourceTensor.detach().clone()
```

原因是 `indices` 本身已经是 Tensor，不需要再用 `torch.tensor(...)` 包一遍。

直接写：

```plain
batch_indices = indices[i:min(i + batch_size, num_examples)]
```

即可。

---

## 四、模型函数和损失函数

### 1. 线性模型

```plain
def linreg(X, w, b):
    return X @ w + b
```

这就是前向计算。

如果 `w.requires_grad=True`，`b.requires_grad=True`，那么执行：

```plain
y_hat = linreg(X, w, b)
```

时，PyTorch 会记录：

```plain
w, b -> y_hat
```

后面 loss 由 `y_hat` 算出，计算图继续延伸：

```plain
w, b -> y_hat -> loss
```

### 2. 平方损失

```plain
def squared_loss(y_hat, y):
    return (y_hat - y.reshape(y_hat.shape)) ** 2 / 2
```

这里 `/ 2` 是为了让求导形式更干净：

```plain
1/2 * (y_hat - y)^2
```

对 `y_hat` 求导时，前面的 2 会被抵消。

### 3. `mean()` 和 `sum()` 的区别

训练时用：

```plain
loss = squared_loss(y_hat, y).mean()
loss.backward()
```

此时 `param.grad` 已经是 batch 平均 loss 的梯度。

所以 SGD 写：

```plain
param -= lr * param.grad
```

如果用：

```plain
loss = squared_loss(y_hat, y).sum()
loss.backward()
```

那梯度是 batch 总损失的梯度，更新时才常见：

```plain
param -= lr * param.grad / batch_size
```

不要混成：

```plain
loss.mean().backward()
param -= lr * param.grad / batch_size
```

这样会把梯度多除一次，更新步子变小，训练会慢很多。

---

## 五、初始化可学习参数

### 1. 一维参数写法

当前代码使用：

```plain
w = torch.normal(0, 0.1, size=(len(true_w),), requires_grad=True)
b = torch.zeros(1, requires_grad=True)
```

这里：

```plain
w.shape -> (2,)
b.shape -> (1,)
```

配合：

```plain
X @ w -> (batch_size,)
```

是可以训练的。

### 2. 列向量参数写法

也可以写成：

```plain
w = torch.normal(0, 0.01, size=(len(true_w), 1), requires_grad=True)
b = torch.zeros(1, requires_grad=True)
```

此时：

```plain
X @ w -> (batch_size, 1)
labels -> (batch_size, 1)
```

shape 更统一。

### 3. `.grad` 一开始是 `None`

初始化后：

```plain
print(w.grad)
print(b.grad)
```

会看到：

```plain
None
None
```

这是正常的。

只有执行过：

```plain
loss.backward()
```

之后，`w.grad` 和 `b.grad` 才会有值。

---

## 六、手写 SGD：参数更新和清空梯度

### 1. 正确写法

```plain
def sgd(params, lr):
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad
            param.grad.zero_()
```

调用：

```plain
sgd([w, b], lr)
```

这里 `params` 是参数列表：

```plain
[w, b]
```

以后参数更多时，也可以写：

```plain
[w1, b1, w2, b2]
```

### 2. 为什么要 `torch.no_grad()`

参数更新：

```plain
param -= lr * param.grad
```

不是模型前向计算的一部分。

我们希望计算图记录的是：

```plain
w, b -> y_hat -> loss
```

不希望记录：

```plain
用梯度修改参数这个动作
```

所以要写：

```plain
with torch.no_grad():
```

### 3. 今天踩到的 `torch.no_grad` 少括号坑

错误写法：

```plain
with torch.no_grad:
```

报错：

```plain
TypeError: 'type' object does not support the context manager protocol
```

正确写法：

```plain
with torch.no_grad():
```

`torch.no_grad()` 要调用，返回一个上下文管理器对象。

### 4. 为什么更新后要清空梯度

PyTorch 默认梯度累加。

如果连续两次：

```plain
loss1.backward()
loss2.backward()
```

中间没有清空梯度，那么：

```plain
w.grad = loss1 的梯度 + loss2 的梯度
```

普通小批量训练时，每个 batch 更新一次，所以更新后要：

```plain
param.grad.zero_()
```

训练节奏是：

```plain
当前 batch 算梯度
用梯度更新参数
清空梯度
下一个 batch 重新算
```

---

## 七、完整训练循环

### 1. 当前可运行版本

```plain
import torch
import matplotlib.pyplot as plt


def synthetic_data(w, b, num_examples):
    X = torch.normal(0, 1, size=(num_examples, len(w)))
    noise = torch.normal(0, 0.01, size=(num_examples,))
    y = X @ w + b + noise
    return X, y.reshape((-1, 1))


def data_iter(batch_size, features, labels):
    num_examples = features.shape[0]
    indices = torch.randperm(num_examples)

    for i in range(0, num_examples, batch_size):
        batch_indices = indices[i:min(i + batch_size, num_examples)]
        yield features[batch_indices], labels[batch_indices]


def linreg(X, w, b):
    return X @ w + b


def squared_loss(y_hat, y):
    return (y_hat - y.reshape(y_hat.shape)) ** 2 / 2


def sgd(params, lr):
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad
            param.grad.zero_()


true_w = torch.tensor([2.0, -3.4])
true_b = 4.2

lr = 0.03
num_epochs = 5
batch_size = 10
num_examples = 1000
loss_history = []

features, labels = synthetic_data(true_w, true_b, num_examples)

w = torch.normal(0, 0.1, size=(len(true_w),), requires_grad=True)
b = torch.zeros(1, requires_grad=True)

for epoch in range(num_epochs):
    for X, y in data_iter(batch_size, features, labels):
        y_hat = linreg(X, w, b)
        loss = squared_loss(y_hat, y).mean()
        loss_history.append(loss.item())

        loss.backward()
        sgd([w, b], lr)

    with torch.no_grad():
        train_loss = squared_loss(linreg(features, w, b), labels).mean()

    print(f"epoch {epoch + 1}, loss {float(train_loss):f}")

print(f"w={w}, w 的估计误差: {true_w.reshape(w.shape) - w}")
print(f"b={b}, b 的估计误差: {true_b - b}")
```

### 2. 训练循环的顺序

每个 batch 内部：

```plain
y_hat = linreg(X, w, b)
loss = squared_loss(y_hat, y).mean()
loss.backward()
sgd([w, b], lr)
```

展开后是：

```plain
前向预测
计算平均 loss
backward 计算梯度
no_grad 中更新参数
清空梯度
```

这个顺序不能乱。

### 3. `loss.item()` 的作用

记录每个 batch 的 loss：

```plain
loss_history.append(loss.item())
```

`loss` 是一个 Tensor，而且带着计算图。

如果直接保存：

```plain
loss_history.append(loss)
```

可能会把计算图也保留下来，浪费内存。

所以用：

```plain
loss.item()
```

把标量 Tensor 转成 Python 数字。

---

## 八、训练过程可视化

### 1. 记录每个 batch 的 loss

在训练循环前：

```plain
loss_history = []
```

在每个 batch 中：

```plain
loss_history.append(loss.item())
```

这样 `loss_history` 的长度等于：

```plain
num_epochs * 每个 epoch 的 batch 数
```

如果：

```plain
num_epochs = 5
num_examples = 1000
batch_size = 10
```

那么应该有：

```plain
5 * 100 = 500
```

个 batch loss。

### 2. loss 曲线

```plain
fig, axes = plt.subplots(1, 2, figsize=(10, 4))

ax = axes[0]
ax.plot(loss_history)
ax.set_yscale('log')
ax.set_xlabel('batch')
ax.set_ylabel('loss log scale')
ax.set_title('训练 loss 曲线')
ax.grid(True, alpha=0.3)
```

使用 log scale 是因为训练初期 loss 可能比较大，后期很小，用对数坐标更容易看清下降趋势。

### 3. 预测值 vs 真实值

今天可视化时踩到一个坑：

```plain
y_pred = linreg(X, w, b)
ax.scatter(y, y_pred)
```

这里的 `X, y` 是训练循环结束后遗留下来的最后一个 batch，不是完整训练集。

所以这只画了最后 10 条样本。

应该改成：

```plain
with torch.no_grad():
    y_pred = linreg(features, w, b)
```

用完整训练集 `features` 预测。

同时，因为这是评估和画图，不需要建计算图，所以放进 `torch.no_grad()`。

### 4. 可视化推荐代码

```plain
fig, axes = plt.subplots(1, 2, figsize=(10, 4))

ax = axes[0]
ax.plot(loss_history)
ax.set_yscale('log')
ax.set_xlabel('batch')
ax.set_ylabel('loss log scale')
ax.set_title('训练 loss 曲线')
ax.grid(True, alpha=0.3)

ax = axes[1]

with torch.no_grad():
    y_pred = linreg(features, w, b)

y_true_plot = labels.reshape(-1)
y_pred_plot = y_pred.reshape(-1)

ax.scatter(
    y_true_plot,
    y_pred_plot,
    s=3,
    alpha=0.15,
    color='steelblue',
    edgecolors='none'
)

y_min = min(y_true_plot.min().item(), y_pred_plot.min().item())
y_max = max(y_true_plot.max().item(), y_pred_plot.max().item())

ax.plot(
    [y_min, y_max],
    [y_min, y_max],
    color='red',
    linewidth=1.5,
    linestyle='--',
    label='完美预测线'
)

ax.set_xlabel('真实值')
ax.set_ylabel('预测值')
ax.set_title('预测值 vs 真实值')
ax.legend()

plt.suptitle('线性回归训练可视化', fontsize=14)
plt.tight_layout(rect=[0, 0, 1, 0.92])
plt.show()
```

### 5. Matplotlib 和 Tensor

画图时如果 Tensor 带梯度，可能报错：

```plain
Can't call numpy() on Tensor that requires grad
```

处理方式：

```plain
with torch.no_grad():
    y_pred = linreg(features, w, b)
```

或者：

```plain
y_pred.detach()
```

今天这里更推荐 `no_grad()`，因为整段预测都是评估，不需要计算图。

---

## 九、今天完整踩坑清单

### 1. `torch.normal` 的 `size` 写法

PyTorch 推荐显式写 tuple：

```plain
size=(num_examples,)
size=(num_examples, 1)
```

不要把 NumPy 的 `size=n` 习惯直接套过来。

### 2. `(n,)` 和 `(n, 1)` 混用导致广播爆炸

危险组合：

```plain
X @ w -> (n,)
noise -> (n, 1)
```

相加可能得到：

```plain
(n, n)
```

安全原则：

```plain
要么都一维，要么都列向量
```

### 3. `yield` 缩进错导致每个 epoch 只训练一个 batch

错误：

```plain
for ...:
    batch_indices = ...
yield ...
```

正确：

```plain
for ...:
    batch_indices = ...
    yield ...
```

这个坑会让训练明显变慢，因为模型每轮只看最后一个 batch。

### 4. `torch.tensor(indices_slice)` 多余

如果 `indices` 已经是 Tensor，不要再包：

```plain
torch.tensor(indices[...])
```

直接：

```plain
indices[...]
```

### 5. `with torch.no_grad` 少括号

错误：

```plain
with torch.no_grad:
```

正确：

```plain
with torch.no_grad():
```

### 6. `loss.mean()` 后不要在 SGD 中再除 batch size

如果：

```plain
loss = squared_loss(...).mean()
```

那么：

```plain
param -= lr * param.grad
```

如果又写：

```plain
param -= lr * param.grad / batch_size
```

就会让更新幅度缩小，训练变慢。

### 7. 可视化时不要用最后一个 batch 的 `X, y`

训练循环结束后，变量 `X, y` 还存在，但它们只是最后一个 batch。

画完整训练集预测效果时，要用：

```plain
linreg(features, w, b)
labels
```

### 8. 画图预测时用 `torch.no_grad()`

评估和可视化不需要计算图：

```plain
with torch.no_grad():
    y_pred = linreg(features, w, b)
```

---
## 十. 最终展示

### 1. 完整代码
```
import torch
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt

matplotlib.rcParams['font.family'] = 'Arial Unicode MS'  # macOS 自带
matplotlib.rcParams['axes.unicode_minus'] = False  # 防止负号也变方块

# 数据准备
def synthetic_data(w, b, num_examples):
    # 根据真实参数 w, b 生成特征 X 和标签 y
    X = torch.normal(0, 1, size=(num_examples, len(w)))
    noise = torch.normal(0, 0.01, size=(num_examples,))
    y = X @ w + b + noise
    return X, y.reshape((-1, 1))


def data_iter(batch_size, features, labels):
    # 每次随机取出一个小批量数据
    num_examples = features.shape[0]
    indices = torch.randperm(num_examples)
    for i in range(0, num_examples, batch_size):
        batch_indices = indices[i:min(i + batch_size, num_examples)]
        yield features[batch_indices], labels[batch_indices]


# 模型定义
def linreg(X, w, b):
    return X @ w + b


def squared_loss(y_hat, y):
    return (y_hat - y.reshape(y_hat.shape)) ** 2 / 2


# 梯度更新
def sgd(params, lr):
    # 根据 param.grad 手动更新参数，并在更新后清空梯度
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad
            param.grad.zero_()


true_w = torch.tensor([2.0, -3.4])
true_b = 4.2
lr = 0.03
num_epochs = 5
batch_size = 10
num_examples = 1000
loss_history = []

features, labels = synthetic_data(true_w, true_b, num_examples)
print("features.shape:", features.shape)
print("labels.shape:", labels.shape)
print("labels.numel():", labels.numel())

w = torch.normal(0, 0.1, size=(len(true_w),), requires_grad=True)
b = torch.zeros(1, requires_grad=True)

for epoch in range(num_epochs):
    for X, y in data_iter(batch_size, features, labels):
        y_hat = linreg(X, w, b)
        loss = squared_loss(y_hat, y).mean()
        loss_history.append(loss.item())
        loss.backward()
        sgd([w, b], lr)

    with torch.no_grad():
        train_loss = squared_loss(linreg(features, w, b), labels).mean()
    print(f"epoch {epoch + 1}, loss {float(train_loss):f}")
    print(f"w={w}, w 的估计误差: {true_w.reshape(w.shape) - w}")
    print(f"b={b}, b 的估计误差: {true_b - b}")


# 可视化
fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes.flatten()

ax = axes[0]
ax.plot(loss_history)
ax.set_yscale('log')
ax.set_xlabel('batch')
ax.set_ylabel('loss（log scale）')
ax.set_title('训练 loss 曲线')
ax.grid(True, alpha=0.3)

ax = axes[1]
with torch.no_grad():
    y_pred = linreg(features, w, b)

y_true_plot = labels.reshape(-1)
y_pred_plot = y_pred.reshape(-1)
ax.scatter(
    y_true_plot,
    y_pred_plot,
    s=3,
    alpha=0.15,
    color='steelblue',
    edgecolors='none',
)

y_min = min(y_true_plot.min().item(), y_pred_plot.min().item())
y_max = max(y_true_plot.max().item(), y_pred_plot.max().item())
ax.plot(
    [y_min, y_max],
    [y_min, y_max],
    color='red',
    linewidth=1.5,
    linestyle='--',
    label='完美预测线',
)
ax.set_xlabel('真实值')
ax.set_ylabel('预测值')
ax.set_title('预测值 vs 真实值')
ax.legend()

plt.suptitle('线性回归训练可视化', fontsize=14)
plt.tight_layout(rect=[0, 0, 1, 0.92])
plt.show()
```
### 2. 效果展示

![[Pasted image 20260629213515.png]]
![[Pasted image 20260629213537.png]]
---

## 十一、今天的最终心智模型

手写线性回归训练循环的核心是：

```plain
数据 batch
  ↓
用当前 w, b 前向预测
  ↓
计算平均 loss
  ↓
loss.backward() 算出 w.grad, b.grad
  ↓
with torch.no_grad() 手动更新参数
  ↓
param.grad.zero_() 清空旧梯度
  ↓
下一个 batch 重新建图、重新计算
```

最重要的分工：

```plain
linreg：定义模型怎么预测
squared_loss：定义预测错多少
backward：计算 loss 对参数的梯度
sgd：用梯度更新参数
zero_：清空梯度，避免累加
```

今天写的纯 Tensor 版本，就是以后 PyTorch 标准训练流程的底层原型：

```plain
loss = loss_fn(net(X), y)
loss.backward()
optimizer.step()
optimizer.zero_grad()
```

只不过今天我们没有用 `nn.Module` 和 `optimizer`，而是亲手写出了它们背后的核心机制。
