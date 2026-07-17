学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版 3.4 Softmax 回归

本阶段重点：从 [[Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|手写线性回归]]过渡到手写多分类模型。今天仍然不使用 `nn.Module`、不使用 `torch.optim`，而是用纯 Tensor 实现 Softmax 分类训练流程，理解：分类模型为什么输出 logits、softmax 如何把 logits 转成概率、交叉熵为什么只取正确类别概率、`backward()` 如何把梯度传回 `W` / `b`、手写 SGD 如何更新参数、accuracy 为什么只用于评估。

今天主线：手写 Softmax 分类。核心心智模型是：**模型先为每个类别输出一个原始分数 logits，softmax 把每一行 logits 转成概率分布，交叉熵惩罚“正确类别概率太低”，`loss.backward()` 负责计算 `W.grad` / `b.grad`，手写 SGD 负责真正更新参数。**

---

## 〇、贯穿全天的五条心智主线

### 1. 从回归问题切换到分类问题

[[Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|Day 3 线性回归]]预测的是一个连续值：

```plain
X -> X @ w + b -> y_hat
```

如果一个 batch 有 32 个样本，线性回归通常输出：

```plain
y_hat: (32, 1)
```

今天的分类问题不是预测一个连续值，而是判断样本属于哪一类。

以 Fashion-MNIST 为例，每张图片属于 10 个类别之一：

```plain
0: T-shirt/top
1: Trouser
2: Pullover
3: Dress
4: Coat
5: Sandal
6: Shirt
7: Sneaker
8: Bag
9: Ankle boot
```

所以模型不能只输出一个数，而要对每个类别都输出一个分数：

```plain
logits: (batch_size, 10)
```

### 2. 分类模型不是直接输出类别，而是先输出 logits

Softmax 回归的线性部分是：

```plain
logits = X @ W + b
```

其中：

```plain
X:      (batch_size, 784)
W:      (784, 10)
b:      (10,)
logits: (batch_size, 10)
```

`logits` 是模型对每个类别的原始打分，还不是概率。

可以把 `W` 理解成 10 个线性打分器并排放在一起：

```plain
W 第 0 列：给类别 0 打分
W 第 1 列：给类别 1 打分
...
W 第 9 列：给类别 9 打分
```

所以 Softmax 回归本质上是：

```plain
每个样本输入 784 个像素特征
同时算出 10 个类别分数
```

### 3. softmax 把一行 logits 转成一行概率分布

`logits` 可以是任意实数：

```plain
[2.0, 1.0, -1.0]
```

它们不能直接当概率，因为：

```plain
可能有负数
总和不等于 1
数值本身没有概率含义
```

softmax 做两步：

```plain
第一步：exp，让所有数变成正数
第二步：除以这一行 exp 后的总和，让概率总和为 1
```

公式：

```plain
softmax_i = exp(z_i) / sum(exp(z_j))
```

结果类似：

```plain
[2.0, 1.0, -1.0] -> [0.705, 0.259, 0.035]
```

重点：softmax 是按行做的。每一行对应一个样本，每一列对应一个类别。

### 4. 交叉熵惩罚的是“正确类别概率太低”

分类标签 `y` 不是 one-hot，而是类别索引：

```plain
y: (batch_size,)
```

比如：

```python
y = torch.tensor([0, 2, 1, 1])
```

表示：

```plain
第 1 个样本真实类别是 0
第 2 个样本真实类别是 2
第 3 个样本真实类别是 1
第 4 个样本真实类别是 1
```

如果 `y_hat` 是 softmax 后的概率：

```plain
y_hat: (batch_size, num_classes)
```

那么：

```python
y_hat[range(len(y_hat)), y]
```

表示：

```plain
对 batch 中每个样本，取出它真实类别对应的预测概率
```

交叉熵就是：

```python
-torch.log(correct_probs)
```

直觉：

```plain
正确类别概率越高，loss 越小
正确类别概率越低，loss 越大
```

### 5. loss 用来训练，accuracy 用来看效果

训练优化的是：

```plain
cross entropy loss
```

不是：

```plain
accuracy
```

accuracy 的计算是：

```python
y_pred = y_hat.argmax(dim=1)
```

然后比较：

```python
y_pred == y
```

accuracy 只关心最终类别有没有选对。

loss 关心正确类别概率有多高。

例如真实类别是 0：

```plain
[0.51, 0.49] -> 预测对了，accuracy 记为对，但 loss 还不小
[0.99, 0.01] -> 预测对了，accuracy 也记为对，但 loss 很小
```

所以：

```plain
loss：连续训练信号
accuracy：离散评估指标
```

---

## 一、Fashion-MNIST 数据加载

### 1. 使用的数据集

今天使用 Fashion-MNIST：

```plain
训练集：60000 张图片
测试集：10000 张图片
图片大小：28 x 28
通道数：1，灰度图
类别数：10
```

每张图片通过 `transforms.ToTensor()` 后变成：

```plain
(1, 28, 28)
```

一个 batch 的输入是：

```plain
X: (256, 1, 28, 28)
y: (256,)
```

### 2. 数据加载代码

```python
batch_size = 256
transform = transforms.ToTensor()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

train_dataset = datasets.FashionMNIST(
    root=DATA_DIR,
    train=True,
    transform=transform,
    download=True
)

test_dataset = datasets.FashionMNIST(
    root=DATA_DIR,
    train=False,
    transform=transform,
    download=True
)

train_iter = DataLoader(
    train_dataset,
    batch_size=batch_size,
    shuffle=True
)

test_iter = DataLoader(
    test_dataset,
    batch_size=batch_size,
    shuffle=False
)
```

### 3. `batch_size = 256`

含义：

```plain
每次从数据集中取 256 张图片组成一个 batch
```

训练时不是一张一张喂模型，而是：

```plain
第 1 个 batch：256 张图片
第 2 个 batch：256 张图片
...
```

如果训练集有 60000 张图片，一个 epoch 大约有：

```plain
60000 / 256 ≈ 235 个 batch
```

### 4. `transforms.ToTensor()`

它主要做两件事：

```plain
1. 把图片对象转成 torch.Tensor
2. 把像素值从 0~255 缩放到 0.0~1.0
```

所以不需要再手动写：

```python
X = X / 255
```

如果重复除以 255，输入会变得太小：

```plain
0.0 ~ 0.0039
```

这会影响训练。

### 5. Dataset 和 DataLoader 的区别

`train_dataset` 是数据集对象，负责：

```plain
我有哪些样本
第 i 个样本是什么
```

可以理解为一本书，每页是一张图片和一个标签：

```python
image, label = train_dataset[0]
```

此时：

```plain
image: (1, 28, 28)
label: 一个 0~9 的整数
```

`train_iter` 是 DataLoader，负责：

```plain
把 Dataset 中的样本打包成 batch
是否打乱顺序
每次循环产出一批 X, y
```

例如：

```python
X, y = next(iter(train_iter))
```

此时：

```plain
X: (256, 1, 28, 28)
y: (256,)
```

### 6. 为什么训练集 `shuffle=True`，测试集 `shuffle=False`

训练集打乱：

```python
shuffle=True
```

原因是 SGD 希望每个 batch 尽量像整体数据的随机小样本。

如果数据按类别排序，不打乱可能导致：

```plain
前几个 batch 全是 T-shirt
后几个 batch 全是鞋子
```

训练会不稳定。

测试集不打乱：

```python
shuffle=False
```

因为测试只统计预测正确数量：

```plain
正确数 / 总数
```

顺序不会影响结果。

---

## 二、关于数据路径的坑：`./data` 是相对于运行目录，不是相对于代码文件

今天遇到的问题：

```plain
Day4.py 在 Stage_1_Tensor_Autograd/Code 里，
但是 data 下载到了项目根目录。
```

原因是：

```python
root="./data"
```

这里的 `./data` 不是相对于 `Day4.py` 文件所在目录，而是相对于当前工作目录，也就是运行 Python 命令时所在的目录。

如果从项目根目录运行：

```bash
python Stage_1_Tensor_Autograd/Code/Day4.py
```

那么：

```plain
./data -> 项目根目录/data
```

如果进入 `Code` 目录运行：

```bash
cd Stage_1_Tensor_Autograd/Code
python Day4.py
```

那么：

```plain
./data -> Stage_1_Tensor_Autograd/Code/data
```

但我希望数据和 `Code` 同级：

```plain
Stage_1_Tensor_Autograd/
├── Code/
├── Notes/
└── data/
```

所以应使用：

```python
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
```

解释：

```plain
Path(__file__).resolve()
-> 当前 Day4.py 的绝对路径

.parent
-> Code 目录

.parent.parent
-> Stage_1_Tensor_Autograd 目录

/ "data"
-> Stage_1_Tensor_Autograd/data
```

这样无论从项目根目录运行，还是从别的目录运行，数据目录都稳定。

今天得到的结论：

```plain
不需要为了路径问题把运行目录切到 Code 目录。
更推荐保持项目根目录运行，然后在代码里用 Path(__file__) 明确定位数据和输出目录。
```

---

## 三、初始化参数 `W` 和 `b`

### 1. 参数形状

Fashion-MNIST 每张图：

```plain
28 * 28 = 784
```

类别数：

```plain
10
```

所以：

```python
num_inputs = 784
num_outputs = 10
```

参数：

```python
W = torch.normal(0, 0.01, size=(num_inputs, num_outputs), requires_grad=True)
b = torch.zeros(num_outputs, requires_grad=True)
```

形状：

```plain
W: (784, 10)
b: (10,)
```

### 2. 为什么 `W` 是 `(784, 10)`

模型线性部分：

```python
logits = X @ W + b
```

如果：

```plain
X: (256, 784)
W: (784, 10)
```

那么：

```plain
X @ W -> (256, 10)
```

刚好每个样本得到 10 个类别分数。

### 3. 为什么 `requires_grad=True`

`W` 和 `b` 是模型要学习的参数。

训练中：

```python
loss.mean().backward()
```

会把梯度写入：

```plain
W.grad
b.grad
```

如果没有 `requires_grad=True`，PyTorch 不会为它们计算梯度。

---

## 四、手写 softmax

### 1. 基础公式

对一行 logits：

```plain
z = [z1, z2, ..., zk]
```

softmax 第 i 项：

```plain
exp(zi) / sum(exp(zj))
```

作用：

```plain
任意实数分数 -> 概率分布
```

保证：

```plain
每个概率 > 0
每行概率和 = 1
分数越高，概率越大
```

### 2. 稳定版实现

```python
def softmax(X):
    X = X - X.max(dim=1, keepdim=True).values
    X_exp = torch.exp(X)
    partition = X_exp.sum(dim=1, keepdim=True)
    return X_exp / partition
```

### 3. 为什么要减去每行最大值

如果 logits 很大：

```python
torch.exp(torch.tensor(1000.0))
```

会变成：

```plain
inf
```

为了避免指数爆炸，先减每行最大值：

```python
X = X - X.max(dim=1, keepdim=True).values
```

softmax 有平移不变性：

```plain
softmax([2, 1, -1])
和
softmax([0, -1, -3])
结果一样
```

因为所有 logits 同时减去同一个数，不改变相对差距。

### 4. 为什么是 `dim=1`

`X` 的 shape 是：

```plain
(batch_size, num_classes)
```

每一行是一个样本，每一列是一个类别。

softmax 要对每个样本的所有类别做归一化，所以按行处理：

```python
X_exp.sum(dim=1, keepdim=True)
```

如果错写成：

```python
X_exp.sum(dim=0)
```

就会把不同样本混在一起，这是错误的。

### 5. 为什么 `keepdim=True`

如果：

```plain
X_exp: (256, 10)
```

那么：

```python
X_exp.sum(dim=1)
```

形状是：

```plain
(256,)
```

而：

```python
X_exp.sum(dim=1, keepdim=True)
```

形状是：

```plain
(256, 1)
```

这样每一行除以自己的分母时，广播关系更直观：

```plain
(256, 10) / (256, 1) -> (256, 10)
```

---

## 五、定义模型 `net`

```python
def net(X):
    return softmax(X.reshape((-1, W.shape[0])) @ W + b)
```

拆开理解：

```python
X.reshape((-1, W.shape[0]))
```

把图片展平：

```plain
(256, 1, 28, 28) -> (256, 784)
```

然后：

```python
X @ W + b
```

得到 logits：

```plain
(256, 784) @ (784, 10) + (10,) -> (256, 10)
```

最后：

```python
softmax(logits)
```

得到概率：

```plain
y_hat: (256, 10)
```

注意：今天为了学习底层机制，`net(X)` 返回的是 softmax 后的概率。

以后使用 PyTorch 官方：

```python
torch.nn.CrossEntropyLoss()
```

时，模型通常直接返回 logits，不要先 softmax。

---

## 六、手写交叉熵损失

### 1. 标签是类别索引，不是 one-hot

Fashion-MNIST 标签：

```plain
y: (batch_size,)
```

例如：

```python
y = torch.tensor([0, 2, 1, 1])
```

不是：

```plain
[[1, 0, 0],
 [0, 0, 1],
 [0, 1, 0],
 [0, 1, 0]]
```

### 2. 取出正确类别概率

如果：

```python
y_hat = torch.tensor([
    [0.70, 0.20, 0.10],
    [0.10, 0.30, 0.60],
    [0.25, 0.60, 0.15],
    [0.80, 0.10, 0.10],
])

y = torch.tensor([0, 2, 1, 1])
```

那么：

```python
y_hat[range(len(y_hat)), y]
```

等价于取：

```plain
y_hat[0, 0] -> 0.70
y_hat[1, 2] -> 0.60
y_hat[2, 1] -> 0.60
y_hat[3, 1] -> 0.10
```

得到：

```plain
[0.70, 0.60, 0.60, 0.10]
```

### 3. 交叉熵公式

```python
def cross_entropy(y_hat, y):
    correct_probs = y_hat[range(len(y_hat)), y]
    return -torch.log(correct_probs + 1e-8)
```

如果不加 `1e-8`：

```python
def cross_entropy(y_hat, y):
    return -torch.log(y_hat[range(len(y_hat)), y])
```

学习阶段也可以。

加 `1e-8` 是为了避免极端情况下：

```plain
log(0) -> inf
```

### 4. 为什么表面上只取正确类别，错误类别也会被更新

交叉熵表面上只用了：

```python
y_hat[range(len(y_hat)), y]
```

但是 `y_hat` 来自 softmax：

```plain
exp(z_correct) / sum(exp(z_all_classes))
```

分母包含所有类别。

所以 loss 实际和所有类别的 logits 都有关。

反向传播时：

```plain
正确类别 logit：希望变大
错误类别 logit：希望变小
```

---

## 七、accuracy 准确率

### 1. 从概率分布得到预测类别

```python
def accuracy(y_hat, y):
    y_pred = y_hat.argmax(dim=1)
    cmp = y_pred == y
    return float(cmp.sum())
```

`argmax(dim=1)` 表示：

```plain
对每个样本，在类别维度上找概率最大的类别
```

如果错写成：

```python
argmax(dim=0)
```

含义会变成：

```plain
对每个类别，看哪个样本在这个类别上的概率最大
```

这不是分类预测要做的事情。

### 2. accuracy 返回正确数量，而不是比例

今天实现中：

```python
return float(cmp.sum())
```

返回的是当前 batch 预测正确的样本数。

原因是整个 epoch 要累计：

```plain
总正确数 / 总样本数
```

如果每个 batch 先算比例再平均，最后一个 batch 较小时会让统计略不准确。

更稳的做法：

```python
train_acc_sum += accuracy(y_hat, y)
num_example += y.numel()
train_acc = train_acc_sum / num_example
```

### 3. 评估函数

```python
def evaluate_accuracy(net, data_iter):
    correct = 0.0
    total = 0.0

    with torch.no_grad():
        for X, y in data_iter:
            y_hat = net(X)
            correct += accuracy(y_hat, y)
            total += y.numel()

    return correct / total
```

评估时使用：

```python
with torch.no_grad():
```

因为测试集只用来看模型表现，不用反向传播，也不用更新参数。

---

## 八、手写 SGD

### 1. 更新公式

SGD 的核心：

```plain
参数 = 参数 - 学习率 * 梯度
```

代码：

```python
def sgd(params, lr):
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad
            param.grad.zero_()
```

### 2. 为什么要 `torch.no_grad()`

参数更新不是模型前向计算的一部分。

如果不加：

```python
with torch.no_grad():
```

PyTorch 可能会尝试追踪参数更新，甚至报叶子张量原地修改相关错误。

固定写法：

```python
with torch.no_grad():
    param -= lr * param.grad
```

### 3. 为什么要 `param.grad.zero_()`

PyTorch 的梯度默认累加。

如果不清空，训练会变成：

```plain
第 1 个 batch 的梯度
第 1 + 第 2 个 batch 的梯度
第 1 + 第 2 + 第 3 个 batch 的梯度
...
```

这不是普通 SGD 想要的。

所以每次更新完参数后立刻清空：

```python
param.grad.zero_()
```

### 4. 关于 `loss.mean().backward()` 和 `batch_size`

今天训练时使用：

```python
loss.mean().backward()
```

这表示对当前 batch 的平均 loss 求梯度。

因此 `sgd` 里不需要再除以 `batch_size`。

如果写：

```python
loss.sum().backward()
```

那么 `sgd` 里才需要：

```python
param -= lr * param.grad / batch_size
```

今天选择的配套写法是：

```python
loss.mean().backward()
sgd([W, b], lr)
```

所以最终建议：

```python
def sgd(params, lr):
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad
            param.grad.zero_()
```

---

## 九、训练循环

### 1. 每个 batch 的固定顺序

```python
y_hat = net(X)
loss = cross_entropy(y_hat, y)
loss.mean().backward()
sgd([W, b], lr)
```

心智路线：

```plain
X
-> net(X)
-> y_hat
-> cross_entropy
-> loss
-> loss.mean().backward()
-> W.grad / b.grad
-> sgd 更新 W / b
-> zero_ 清空梯度
```

### 2. 完整训练函数

```python
def train(net, train_iter, test_iter, epochs, lr):
    for ep in range(epochs):
        train_loss_sum = 0.0
        train_acc_sum = 0.0
        num_example = 0

        for X, y in train_iter:
            y_hat = net(X)
            loss = cross_entropy(y_hat, y)

            loss.mean().backward()
            sgd([W, b], lr)

            train_loss_sum += loss.sum().detach().item()
            train_acc_sum += accuracy(y_hat, y)
            num_example += y.numel()

        train_loss = train_loss_sum / num_example
        train_acc = train_acc_sum / num_example
        test_acc = evaluate_accuracy(net, test_iter)

        loss_history.append(train_loss)
        train_acc_history.append(train_acc)
        test_acc_history.append(test_acc)

        print(
            f"epoch {ep + 1}, "
            f"loss {train_loss:.4f}, "
            f"train acc {train_acc:.4f}, "
            f"test acc {test_acc:.4f}"
        )
```

### 3. 为什么 `train` 要传入 `net`、`train_iter`、`test_iter`

今天问过一个重要问题：

```plain
为什么要在 train 函数中传入 net、train_iter、test_iter？
```

原因是把依赖显式写出来。

如果写死在函数里面：

```python
def train(num_epochs, lr):
    for X, y in train_iter:
        y_hat = net(X)
```

那么 `train` 函数偷偷依赖外部变量：

```plain
net
train_iter
test_iter
W
b
cross_entropy
```

读代码时不够清楚。

如果写成：

```python
def train(net, train_iter, test_iter, epochs, lr):
```

就明确告诉自己：

```plain
这个训练函数需要一个模型
需要一个训练数据迭代器
需要一个测试数据迭代器
需要训练轮数
需要学习率
```

这样以后可以复用：

```python
train(net1, train_iter, test_iter, epochs, lr)
train(net2, train_iter, test_iter, epochs, lr)
```

或者换数据：

```python
train(net, another_train_iter, another_test_iter, epochs, lr)
```

今天的版本还不是完全通用，因为内部还写了：

```python
sgd([W, b], lr)
```

更通用的版本会把 `loss` 和 `updater` 也传进去。

但对当前学习阶段，先保留这个半通用版本更容易理解。

---

## 十、今天遇到的 warning：把带计算图的 Tensor 转成 float

### 1. warning 内容

运行时出现过类似警告：

```plain
UserWarning: Converting a tensor with requires_grad=True to a scalar may lead to unexpected behavior.
Consider using tensor.detach() first.
```

触发行：

```python
train_loss_sum += float(loss.sum())
```

### 2. 原因

`loss` 来自模型前向计算：

```plain
W, b -> logits -> softmax -> y_hat -> loss
```

所以：

```python
loss.sum()
```

仍然连着计算图。

如果直接：

```python
float(loss.sum())
```

就是把一个带梯度历史的 Tensor 转成 Python 标量。

PyTorch 提醒：如果只是记录数值，最好先断开计算图。

### 3. 正确写法

```python
train_loss_sum += loss.sum().detach().item()
```

含义：

```plain
loss.sum()
-> 当前 batch 的 loss 总和

.detach()
-> 从计算图中摘出来，只记录数值，不参与梯度计算

.item()
-> 把单元素 Tensor 转成 Python 数字
```

今天得到的固定写法：

```plain
训练用：loss.mean().backward()
统计用：loss.sum().detach().item()
```

---

## 十一、训练曲线可视化

今天记录了三个历史列表：

```python
loss_history = []
train_acc_history = []
test_acc_history = []
```

每个 epoch 后追加：

```python
loss_history.append(train_loss)
train_acc_history.append(train_acc)
test_acc_history.append(test_acc)
```

可视化：

```python
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
axes = axes.flatten()

ax = axes[0]
ax.plot(loss_history)
ax.set_xlabel("epoch")
ax.set_ylabel("loss")
ax.set_title("train loss")
ax.grid(True, alpha=0.3)

ax = axes[1]
ax.plot(train_acc_history)
ax.set_xlabel("epoch")
ax.set_ylabel("train_acc")
ax.set_title("train accuracy")
ax.grid(True, alpha=0.3)

ax = axes[2]
ax.plot(test_acc_history)
ax.set_xlabel("epoch")
ax.set_ylabel("test_acc")
ax.set_title("test accuracy")
ax.grid(True, alpha=0.3)

plt.suptitle("softmax训练可视化", fontsize=14)
plt.tight_layout(rect=[0, 0, 1, 0.92])
plt.show()
```

macOS 中文字体设置：

```python
matplotlib.rcParams["font.family"] = "Arial Unicode MS"
matplotlib.rcParams["axes.unicode_minus"] = False
```

作用：

```plain
防止中文标题显示成方块
防止负号显示异常
```

建议以后保存图片：

```python
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
plt.savefig(OUTPUT_DIR / "softmax_training_curve.png", dpi=150)
```

---

## 十二、最终代码整理版
### 1.  完整代码

```python
import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
from pathlib import Path
import matplotlib
import matplotlib.pyplot as plt

matplotlib.rcParams["font.family"] = "Arial Unicode MS"
matplotlib.rcParams["axes.unicode_minus"] = False

torch.manual_seed(42)


# =====================
# 1. 加载 Fashion-MNIST
# =====================

batch_size = 256
transform = transforms.ToTensor()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "outputs"

DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

train_dataset = datasets.FashionMNIST(
    root=DATA_DIR,
    train=True,
    transform=transform,
    download=True
)

test_dataset = datasets.FashionMNIST(
    root=DATA_DIR,
    train=False,
    transform=transform,
    download=True
)

train_iter = DataLoader(
    train_dataset,
    batch_size=batch_size,
    shuffle=True
)

test_iter = DataLoader(
    test_dataset,
    batch_size=batch_size,
    shuffle=False
)


# =====================
# 2. 初始化参数
# =====================

num_inputs = 784
num_outputs = 10
epochs = 30
lr = 0.05

loss_history = []
train_acc_history = []
test_acc_history = []

W = torch.normal(0, 0.01, size=(num_inputs, num_outputs), requires_grad=True)
b = torch.zeros(num_outputs, requires_grad=True)


# =====================
# 3. 定义 softmax
# =====================

def softmax(X):
    X = X - X.max(dim=1, keepdim=True).values
    X_exp = torch.exp(X)
    partition = X_exp.sum(dim=1, keepdim=True)
    return X_exp / partition


# =====================
# 4. 定义模型 net
# =====================

def net(X):
    return softmax(X.reshape((-1, W.shape[0])) @ W + b)


# =====================
# 5. 定义交叉熵损失
# =====================

def cross_entropy(y_hat, y):
    correct_probs = y_hat[range(len(y_hat)), y]
    return -torch.log(correct_probs + 1e-8)


# =====================
# 6. 定义准确率
# =====================

def accuracy(y_hat, y):
    y_pred = y_hat.argmax(dim=1)
    cmp = y_pred == y
    return float(cmp.sum())


def evaluate_accuracy(net, data_iter):
    correct = 0.0
    total = 0.0

    with torch.no_grad():
        for X, y in data_iter:
            y_hat = net(X)
            correct += accuracy(y_hat, y)
            total += y.numel()

    return correct / total


# =====================
# 7. 手写 SGD
# =====================

def sgd(params, lr):
    with torch.no_grad():
        for param in params:
            param -= lr * param.grad
            param.grad.zero_()


# =====================
# 8. 训练函数
# =====================

def train(net, train_iter, test_iter, epochs, lr):
    for ep in range(epochs):
        train_loss_sum = 0.0
        train_acc_sum = 0.0
        num_example = 0

        for X, y in train_iter:
            y_hat = net(X)
            loss = cross_entropy(y_hat, y)

            loss.mean().backward()
            sgd([W, b], lr)

            train_loss_sum += loss.sum().detach().item()
            train_acc_sum += accuracy(y_hat, y)
            num_example += y.numel()

        train_loss = train_loss_sum / num_example
        train_acc = train_acc_sum / num_example
        test_acc = evaluate_accuracy(net, test_iter)

        loss_history.append(train_loss)
        train_acc_history.append(train_acc)
        test_acc_history.append(test_acc)

        print(
            f"epoch {ep + 1}, "
            f"loss {train_loss:.4f}, "
            f"train acc {train_acc:.4f}, "
            f"test acc {test_acc:.4f}"
        )


# =====================
# 9. 开始训练
# =====================

train(net, train_iter, test_iter, epochs, lr)


# =====================
# 10. 可视化
# =====================

fig, axes = plt.subplots(1, 3, figsize=(15, 4))
axes = axes.flatten()

ax = axes[0]
ax.plot(loss_history)
ax.set_xlabel("epoch")
ax.set_ylabel("loss")
ax.set_title("train loss")
ax.grid(True, alpha=0.3)

ax = axes[1]
ax.plot(train_acc_history)
ax.set_xlabel("epoch")
ax.set_ylabel("train_acc")
ax.set_title("train accuracy")
ax.grid(True, alpha=0.3)

ax = axes[2]
ax.plot(test_acc_history)
ax.set_xlabel("epoch")
ax.set_ylabel("test_acc")
ax.set_title("test accuracy")
ax.grid(True, alpha=0.3)

plt.suptitle("softmax训练可视化", fontsize=14)
plt.tight_layout(rect=[0, 0, 1, 0.92])
plt.savefig(OUTPUT_DIR / "softmax_training_curve.png", dpi=150)
plt.show()
```
### 2.  结果展示
![[Pasted image 20260630155424.png|697]]
![[Pasted image 20260630155530.png]]
---
## 十三、今天踩到和重点避开的坑

### 1. `./data` 路径位置不符合预期

原因：

```plain
./data 相对于当前工作目录，不相对于 .py 文件
```

解决：

```python
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
```

### 2. 统计 loss 时触发 warning

错误或不推荐写法：

```python
train_loss_sum += float(loss.sum())
```

更稳写法：

```python
train_loss_sum += loss.sum().detach().item()
```

### 3. `sgd` 参数里传了 `batch_size` 但没有使用

如果使用：

```python
loss.mean().backward()
```

则 `sgd` 不需要 `batch_size`：

```python
def sgd(params, lr):
    ...
```

### 4. `evaluate_accracy` 拼写问题

原来写成：

```python
evaluate_accracy
```

建议改成：

```python
evaluate_accuracy
```

虽然不影响运行，但影响代码可读性。

### 5. `argmax(dim=1)` 不能写错

正确：

```python
y_hat.argmax(dim=1)
```

含义：

```plain
每个样本在 10 个类别中选概率最大的类别
```

错误：

```python
y_hat.argmax(dim=0)
```

含义会变成：

```plain
每个类别在 batch 中找概率最大的样本
```

### 6. softmax 要按类别维度归一化

正确：

```python
X_exp.sum(dim=1, keepdim=True)
```

错误：

```python
X_exp.sum(dim=0)
```

因为 `dim=0` 会把不同样本混在一起。

### 7. 官方 `CrossEntropyLoss` 的输入和今天手写版本不同

今天手写：

```plain
net -> softmax 概率
cross_entropy -> 对概率取 log
```

以后官方写法：

```plain
net -> logits
nn.CrossEntropyLoss -> 内部处理 log_softmax
```

使用官方 `CrossEntropyLoss` 时不要先 softmax。

---

## 十四、一次 batch 的生命周期

一个 batch 进入训练循环后：

```plain
X: (256, 1, 28, 28)
y: (256,)
```

进入模型：

```plain
X.reshape((-1, 784)) -> (256, 784)
```

线性打分：

```plain
(256, 784) @ (784, 10) + (10,) -> (256, 10)
```

softmax：

```plain
logits -> y_hat: (256, 10)
每一行概率和为 1
```

交叉熵：

```plain
y_hat[range(len(y_hat)), y] -> (256,)
-log(...) -> loss: (256,)
```

反向传播：

```plain
loss.mean().backward()
```

得到：

```plain
W.grad: (784, 10)
b.grad: (10,)
```

手写更新：

```plain
W -= lr * W.grad
b -= lr * b.grad
```

清空梯度：

```plain
W.grad.zero_()
b.grad.zero_()
```

下一个 batch 重新前向、重新建图、重新计算梯度。

---

## 十五、今日总结

今天完成了从线性回归到 Softmax 分类的关键迁移。

线性回归：

```plain
输入 X
-> 输出一个连续值 y_hat
-> 用平方损失
```

Softmax 分类：

```plain
输入图片 X
-> 输出每个类别的 logits
-> softmax 转成概率
-> 交叉熵惩罚正确类别概率太低
-> backward 计算 W / b 梯度
-> 手写 SGD 更新参数
```

今天最重要的代码链条：

```python
y_hat = net(X)
loss = cross_entropy(y_hat, y)
loss.mean().backward()
sgd([W, b], lr)
```

今天最重要的 shape 链条：

```plain
X:      (256, 1, 28, 28)
X_flat: (256, 784)
W:      (784, 10)
b:      (10,)
logits: (256, 10)
y_hat:  (256, 10)
y:      (256,)
loss:   (256,)
```

今天最重要的心智模型：

```plain
logits 是原始分数
softmax 把分数变成概率
cross entropy 看正确类别概率
accuracy 看最终类别是否选对
backward 只算梯度
sgd 才真正更新参数
zero_ 防止梯度跨 batch 累加
```

到这里，纯 Tensor 版本的 Softmax 回归训练流程已经跑通。

下一步可以进入：

```plain
1. 用 nn.Module 简化模型定义
2. 用 torch.optim.SGD 替代手写 SGD
3. 用 nn.CrossEntropyLoss 替代手写 softmax + cross_entropy
4. 理解官方实现为什么更稳定
```
