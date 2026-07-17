学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版，PyTorch 官方文档

本阶段重点：从第 3 周的 [[Stage1/Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|纯 Tensor 手写线性回归]] 与 [[Stage1/Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）|手写 Softmax 分类]]，过渡到 PyTorch 的 `nn.Module`、常用层、官方 loss 和 optimizer。今天不是为了“只会调 API”，而是理解：手写的 `w / b / forward / loss / backward / SGD / zero_grad`，在 `nn` 模块体系里分别被封装成了什么。

今天主线：`nn.Module + 常用层`。核心心智模型是：**`nn.Module` 不是替你跳过底层，而是把你已经手写过的参数、前向计算、梯度计算和参数更新组织成工程上更可维护的结构。**

---

## 〇、贯穿全天的五条心智主线

### 1. `nn.Module` 解决的是模型组织问题

第 3 周 [[Stage1/Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|手写线性回归]]时，模型大概是：

```python
w = torch.normal(0, 0.01, size=(num_inputs, 1), requires_grad=True)
b = torch.zeros(1, requires_grad=True)

def net(X):
    return X @ w + b
```

这里有三个核心部分：

```plain
参数：w, b
前向计算：X @ w + b
训练时要更新的对象：[w, b]
```

模型小时，这样写非常清楚。模型一复杂，比如变成：

```plain
X -> Linear1 -> ReLU -> Linear2 -> output
```

如果继续手写，就要自己维护：

```plain
W1, b1, W2, b2
params = [W1, b1, W2, b2]
```

参数多了以后容易漏，结构也分散。

`nn.Module` 的作用就是把这些东西组织起来：

```plain
nn.Module = 参数容器 + 前向计算规则 + 子层管理系统
```

它不改变训练本质，只是把训练流程工程化。

### 2. `__init__` 定义“有什么层”，`forward` 定义“数据怎么走”

最小模型类：

```python
import torch
from torch import nn


class LinearRegression(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = nn.Linear(2, 1)

    def forward(self, X):
        return self.linear(X)
```

这里的分工是：

```plain
__init__：创建层、参数、模型组件
forward：描述输入数据如何经过这些组件
```

这句话非常重要：

```plain
可学习层应该在 __init__ 里创建一次
forward 里只使用这些层做计算
```

不要在 `forward` 里新建 `nn.Linear`，否则每次前向传播都会重新随机初始化一组参数，训练就失去意义。

### 3. `nn.Linear` 封装的是线性变换

`nn.Linear(in_features, out_features)` 本质上做的是：

```plain
Y = X @ weight.T + bias
```

如果：

```python
linear = nn.Linear(2, 1)
```

那么：

```plain
linear.weight.shape = (1, 2)
linear.bias.shape   = (1,)
```

注意：`nn.Linear` 的 `weight` 形状是：

```plain
(out_features, in_features)
```

而第 3 周手写线性回归时，常写成：

```plain
w.shape = (in_features, out_features)
```

所以官方层内部使用的是：

```plain
X @ linear.weight.T + linear.bias
```

这不是新数学，只是参数保存的方向不同。

### 4. `model.parameters()` 自动收集可学习参数

手写版本：

```python
params = [w, b]
```

`nn.Module` 版本：

```python
model.parameters()
```

原因是：

```python
self.linear = nn.Linear(2, 1)
```

把 `linear` 挂到了 `self` 上。PyTorch 会自动把它登记为模型的子模块，并递归找到里面的：

```plain
linear.weight
linear.bias
```

学习时建议多用：

```python
for name, param in model.named_parameters():
    print(name, param.shape, param.requires_grad)
```

它可以检查：

```plain
哪些参数被注册了
参数 shape 是否正确
requires_grad 是否为 True
有没有层没有被 optimizer 管到
```

### 5. 官方训练循环仍然是原来的训练本质

手写训练循环的核心是：

```plain
前向计算
算 loss
backward 得到 grad
用 no_grad 更新参数
清空 grad
```

官方写法变成：

```python
optimizer.zero_grad()
loss.backward()
optimizer.step()
```

三句话的含义：

```plain
optimizer.zero_grad()  清空旧梯度
loss.backward()        计算当前 batch 的梯度
optimizer.step()       根据 param.grad 更新参数
```

`optimizer` 不负责算梯度，梯度仍然来自 [[Stage1/Day 2 学习笔记：PyTorch Autograd 自动微分基础|Autograd]]。

---

## 一、为什么需要 `nn.Module`

### 1. 手写版本的问题

手写线性回归：

```python
w = torch.normal(0, 0.01, size=(2, 1), requires_grad=True)
b = torch.zeros(1, requires_grad=True)

def linreg(X):
    return X @ w + b
```

这个版本适合学习底层，但参数和计算逻辑是分散的：

```plain
w / b 在函数外面
forward 逻辑在函数里面
训练循环还要手动知道 params = [w, b]
```

如果模型变成多层网络，手动维护会越来越容易出错。

### 2. `nn.Module` 的心智模型

`nn.Module` 可以理解为：

```plain
一个会管理参数和子层的 Python 对象
```

它让模型拥有统一入口：

```plain
model(X)              前向计算
model.parameters()    获取参数
model.train()         切换训练模式
model.eval()          切换评估模式
model.state_dict()    保存参数状态
```

今天重点先掌握：

```plain
model(X)
model.parameters()
```

---

## 二、`nn.Linear` 和手写 `X @ w + b`

### 1. `nn.Linear` 的输入输出

```python
linear = nn.Linear(in_features=2, out_features=1)

X = torch.tensor([
    [1.0, 2.0],
    [3.0, 4.0],
])

y_hat = linear(X)
```

shape 对应：

```plain
X.shape      = (2, 2)
y_hat.shape  = (2, 1)
```

其中：

```plain
第一个维度 2：batch_size
第二个维度 1：每个样本输出 1 个值
```

### 2. 参数 shape

```python
print(linear.weight.shape)
print(linear.bias.shape)
```

结果：

```plain
torch.Size([1, 2])
torch.Size([1])
```

`nn.Linear(784, 10)` 时：

```plain
weight.shape = (10, 784)
bias.shape   = (10,)
```

可以理解成：

```plain
10 个输出神经元
每个输出神经元都有 784 个输入权重
```

### 3. 手写验证

```python
linear = nn.Linear(2, 1)

with torch.no_grad():
    linear.weight[:] = torch.tensor([[2.0, 3.0]])
    linear.bias[:] = torch.tensor([1.0])

X = torch.tensor([
    [10.0, 20.0],
    [30.0, 40.0],
])

y1 = linear(X)
y2 = X @ linear.weight.T + linear.bias
```

`y1` 和 `y2` 一样。

第一行手算：

```plain
10 * 2 + 20 * 3 + 1 = 81
```

说明：

```plain
nn.Linear 只是帮我们保存 weight / bias，并在 forward 时做线性变换
```

---

## 三、最小 `nn.Module` 写法

### 1. 模型类模板

```python
class MyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer = ...

    def forward(self, X):
        return self.layer(X)
```

固定理解：

```plain
__init__ 里定义模型组件
forward 里定义计算流程
```

### 2. `super().__init__()` 的作用

```python
super().__init__()
```

表示先初始化 `nn.Module` 的基础能力。

如果漏写，可能导致：

```plain
子层无法正常注册
model.parameters() 拿不到参数
模型状态管理出问题
```

所以写自定义模型时，先形成习惯：

```python
class Net(nn.Module):
    def __init__(self):
        super().__init__()
```

### 3. 为什么写 `model(X)`，不是 `model.forward(X)`

通常写：

```python
y_hat = model(X)
```

而不是：

```python
y_hat = model.forward(X)
```

因为 `model(X)` 会走 `nn.Module` 的调用流程，再进入 `forward`。这中间 PyTorch 可以处理 hook、训练/推理相关机制等框架能力。

日常训练中遵守：

```plain
调用模型：model(X)
定义逻辑：forward(self, X)
```

---

## 四、`model.parameters()` 与 optimizer

### 1. 查看模型参数

```python
model = LinearRegression()

for name, param in model.named_parameters():
    print(name, param.shape, param.requires_grad)
```

可能输出：

```plain
linear.weight torch.Size([1, 2]) True
linear.bias   torch.Size([1])    True
```

含义：

```plain
linear.weight / linear.bias 是模型参数
requires_grad=True，说明会被 Autograd 计算梯度
```

### 2. optimizer 的角色

```python
optimizer = torch.optim.SGD(model.parameters(), lr=0.03)
```

`optimizer` 保存的是参数引用。

训练时：

```python
loss.backward()
optimizer.step()
```

`loss.backward()` 会把梯度写到：

```plain
model.linear.weight.grad
model.linear.bias.grad
```

`optimizer.step()` 使用这些 `.grad` 更新参数。

### 3. 和手写 SGD 的对应关系

手写版本：

```python
with torch.no_grad():
    for param in params:
        param -= lr * param.grad
        param.grad.zero_()
```

官方版本：

```python
optimizer.zero_grad()
loss.backward()
optimizer.step()
```

对应关系：

```plain
params = [w, b]       -> model.parameters()
param.grad.zero_()    -> optimizer.zero_grad()
param -= lr * grad    -> optimizer.step()
```

---

## 五、用官方封装跑线性回归闭环

### 1. 数据与模型

```python
from torch.utils.data import DataLoader, TensorDataset


def synthetic_data(w, b, num_examples):
    X = torch.normal(0, 1, size=(num_examples, len(w)))
    y = X @ w + b
    y += torch.normal(0, 0.01, y.shape)
    return X, y.reshape(-1, 1)


true_w = torch.tensor([2.0, -3.4])
true_b = 4.2

features, labels = synthetic_data(true_w, true_b, 1000)

dataset = TensorDataset(features, labels)
data_iter = DataLoader(dataset, batch_size=10, shuffle=True)
```

模型：

```python
class LinearRegression(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = nn.Linear(2, 1)

    def forward(self, X):
        return self.linear(X)


model = LinearRegression()
```

### 2. loss 和 optimizer

```python
loss_fn = nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.03)
```

注意：

```plain
nn.MSELoss() 默认 reduction="mean"
```

所以 `loss` 本身已经是标量平均损失，通常直接：

```python
loss.backward()
```

不需要再写：

```python
loss.sum().backward()
```

### 3. 训练循环

```python
for epoch in range(num_epochs):
    for X, y in data_iter:
        y_hat = model(X)
        loss = loss_fn(y_hat, y)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

翻译：

```plain
拿一个 batch
前向预测
计算损失
清空旧梯度
反向传播得到新梯度
更新参数
```

训练后：

```python
print(model.linear.weight.detach())
print(model.linear.bias.detach())
```

应接近：

```plain
weight ≈ [[2.0, -3.4]]
bias   ≈ [4.2]
```

---

## 六、`nn.Sequential` 与 `nn.ReLU`

### 1. `Sequential` 的作用

如果模型只是简单地一层接一层，可以写：

```python
model = nn.Sequential(
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)
```

它表示：

```plain
X -> Linear(784, 256) -> ReLU -> Linear(256, 10) -> output
```

`nn.Sequential` 本身也是 `nn.Module`，所以支持：

```plain
model(X)
model.parameters()
model.named_parameters()
model.train()
model.eval()
```

### 2. 哪些层有参数

```python
for name, param in model.named_parameters():
    print(name, param.shape)
```

可能输出：

```plain
0.weight torch.Size([256, 784])
0.bias   torch.Size([256])
2.weight torch.Size([10, 256])
2.bias   torch.Size([10])
```

没有 `1.weight`，因为第 1 层是：

```python
nn.ReLU()
```

`ReLU` 没有可学习参数。

### 3. ReLU 的意义

`ReLU` 定义：

```plain
ReLU(x) = max(0, x)
```

负数变 0，正数保持不变。

如果只堆：

```plain
Linear -> Linear -> Linear
```

整体仍然等价于一个线性层。

加入 `ReLU` 后：

```plain
Linear -> ReLU -> Linear
```

模型才有能力拟合更复杂的非线性关系。

---

## 七、分类任务中的 `CrossEntropyLoss`

### 1. 官方 loss 接收 logits

分类模型最后一层通常输出：

```plain
logits.shape = (batch_size, num_classes)
```

例如 Fashion-MNIST：

```plain
logits.shape = (batch_size, 10)
y.shape      = (batch_size,)
```

训练时：

```python
loss_fn = nn.CrossEntropyLoss()
loss = loss_fn(logits, y)
```

不要先写：

```python
probs = torch.softmax(logits, dim=1)
loss = loss_fn(probs, y)
```

因为 `nn.CrossEntropyLoss` 内部已经包含：

```plain
log_softmax + NLLLoss
```

也就是把 softmax 和交叉熵相关步骤合在一起了。

### 2. 标签是类别索引，不是 one-hot

正确：

```python
y = torch.tensor([0, 2, 1, 9])
```

表示：

```plain
第 1 个样本类别 0
第 2 个样本类别 2
第 3 个样本类别 1
第 4 个样本类别 9
```

常见输入：

```plain
logits: (batch_size, num_classes)
y:      (batch_size,)
```

### 3. accuracy 不需要 softmax

预测类别：

```python
pred = logits.argmax(dim=1)
```

准确率：

```python
acc = (pred == y).float().mean()
```

不需要先 softmax，因为 softmax 不改变每行最大值所在的位置。

注意：

```plain
argmax(dim=1)：对每个样本，在类别维度上找最大分数
argmax(dim=0)：跨 batch 比较，不是分类预测想要的语义
```

---

## 八、分类训练骨架

### 1. Fashion-MNIST MLP 模型骨架

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
X:              (batch_size, 1, 28, 28)
Flatten:        (batch_size, 784)
Linear 1:       (batch_size, 256)
ReLU:           (batch_size, 256)
Linear 2:       (batch_size, 10)
```

最后输出：

```plain
logits: (batch_size, 10)
```

### 2. 单个 batch 训练步骤

```python
logits = model(X)
loss = loss_fn(logits, y)

optimizer.zero_grad()
loss.backward()
optimizer.step()
```

### 3. 一个 epoch 的训练骨架

```python
for epoch in range(num_epochs):
    model.train()

    for X, y in train_iter:
        logits = model(X)
        loss = loss_fn(logits, y)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

### 4. 评估骨架

```python
model.eval()

correct = 0
total = 0

with torch.no_grad():
    for X, y in test_iter:
        logits = model(X)
        pred = logits.argmax(dim=1)

        correct += (pred == y).sum().item()
        total += y.numel()

test_acc = correct / total
```

注意：

```plain
model.eval()：切换评估模式，影响 Dropout / BatchNorm 等层
torch.no_grad()：关闭梯度记录，节省内存和计算
```

二者不是一回事，正式评估时通常一起使用。

---

## 九、今天容易踩的坑

### 1. 忘记 `super().__init__()`

自定义 `nn.Module` 时要写：

```python
super().__init__()
```

否则子层和参数注册可能出问题。

### 2. 在 `forward` 里新建层

错误写法：

```python
def forward(self, X):
    linear = nn.Linear(2, 1)
    return linear(X)
```

问题：

```plain
每次 forward 都创建新参数
optimizer 管不到稳定的一组参数
训练无法正常收敛
```

正确做法：

```python
def __init__(self):
    super().__init__()
    self.linear = nn.Linear(2, 1)

def forward(self, X):
    return self.linear(X)
```

### 3. 层没有挂到 `self` 上

错误：

```python
linear = nn.Linear(2, 1)
```

如果没有 `self.linear`，PyTorch 不会把它登记为模型子层。

### 4. 给 `CrossEntropyLoss` 提前 softmax

错误：

```python
probs = torch.softmax(logits, dim=1)
loss = nn.CrossEntropyLoss()(probs, y)
```

正确：

```python
loss = nn.CrossEntropyLoss()(logits, y)
```

### 5. 标签 shape 写错

`CrossEntropyLoss` 常见输入：

```plain
logits: (batch_size, num_classes)
y:      (batch_size,)
```

标签通常是类别索引，不是 one-hot。

### 6. `argmax` 维度写错

分类预测：

```python
pred = logits.argmax(dim=1)
```

不是：

```python
pred = logits.argmax(dim=0)
```

### 7. 混淆 `model.eval()` 和 `torch.no_grad()`

```plain
model.eval() 改变模型中某些层的行为
torch.no_grad() 关闭梯度记录
```

它们解决的问题不同。

---

## 十、今天的核心对应关系

```plain
手写 w / b
-> nn.Linear 内部的 weight / bias
```

```plain
手写 net(X, w, b)
-> forward / model(X)
```

```plain
手写 params = [w, b]
-> model.parameters()
```

```plain
手写 squared_loss
-> nn.MSELoss()
```

```plain
手写 softmax + cross entropy
-> nn.CrossEntropyLoss()
```

```plain
手写 SGD
-> torch.optim.SGD
```

```plain
手写 param.grad.zero_()
-> optimizer.zero_grad()
```

---

## 十一、Day 1 结束时应掌握

今天结束后，应该能回答：

```plain
nn.Module 到底封装了什么？
__init__ 和 forward 分别负责什么？
nn.Linear 和手写 X @ w + b 是什么关系？
为什么 nn.Linear.weight 是 (out_features, in_features)？
model.parameters() 为什么能自动拿到参数？
optimizer.step() 对应手写训练里的哪一步？
nn.Sequential 适合什么场景？
ReLU 为什么能让 MLP 不只是线性模型？
CrossEntropyLoss 为什么接收 logits，而不是 softmax 后的概率？
```

今天最重要的结论：

```plain
PyTorch 的 nn 模块不是让人忘掉底层，而是把底层训练流程封装成更适合真实项目的结构。
```
