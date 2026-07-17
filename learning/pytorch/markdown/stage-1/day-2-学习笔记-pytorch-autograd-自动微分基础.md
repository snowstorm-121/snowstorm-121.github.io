学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版 2.5 自动微分

本阶段重点：在 [[Day 1 学习笔记：Tensor基本操作|Tensor 基本操作]] 的基础上理解 PyTorch 的自动求导机制，为后面的 [[Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|手写线性回归]]、手写训练循环和 [[Stage2/Day 1 学习笔记：nn.Module 与常用层入门|nn.Module 训练流程]]打地基。今天不追求背底层实现，而是先把 Autograd 的使用规则、计算图心智模型、梯度累加、`detach()` / `no_grad()`、Python 控制流求导这些高频概念吃透。

今天主线：Autograd 自动微分。核心心智模型是：**你写前向计算，PyTorch 记录实际发生过的 Tensor 运算，最后通过 `backward()` 沿计算图反向计算梯度。** 今天最重要的不是“会调用 `backward()`”，而是知道 `.grad` 里到底存了什么、为什么梯度会累加、什么时候该断开计算图、什么时候该关闭梯度记录。

---

## 〇、贯穿全天的三条心智主线（先立住）

### 1. 前向计算建图，反向传播求梯度

PyTorch 的 Autograd 是动态计算图机制。意思是：

```
代码实际执行了哪些 Tensor 运算，PyTorch 就记录哪些运算。
```

例如：

```
import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x + 1
```

这里不只是算出了 `y` 的数值，PyTorch 还记录了：

```
x -> x ** 2
x -> 2 * x
x ** 2 + 2 * x + 1 -> y
```

后面执行：

```
y.backward()
```

PyTorch 就会沿着这条计算图反向计算：

```
dy/dx
```

结果保存在：

```
x.grad
```

### 2. `.grad` 是“梯度容器”，不是临时返回值

`backward()` 不会直接 `return` 梯度，而是把梯度写进叶子张量的 `.grad` 属性中。

```
x = torch.tensor(3.0, requires_grad=True)

y = x ** 2 + 2 * x + 1
y.backward()

print(x.grad)
```

手算：

```
y = x^2 + 2x + 1
dy/dx = 2x + 2
x = 3
dy/dx = 8
```

输出：

```
tensor(8.)
```

这点和 NumPy/Pandas 很不一样：不是“函数返回结果”，而是“把结果存进对象的属性里”。

### 3. Autograd 是为训练服务的

后面训练模型时，核心流程永远是：

```
前向计算 -> 计算 loss -> backward() 求梯度 -> 更新参数 -> 清空梯度
```

一个最小版本：

```
import torch

x = torch.tensor([1.0, 2.0, 3.0])
y_true = torch.tensor([2.0, 4.0, 6.0])

w = torch.tensor(0.0, requires_grad=True)

y_pred = w * x
loss = ((y_pred - y_true) ** 2).mean()

loss.backward()

with torch.no_grad():
    w -= 0.1 * w.grad
    w.grad.zero_()
```

今天所有概念，最后都会落到这几行代码上。

---

## 一、`requires_grad=True`：告诉 PyTorch “我要对它求梯度”

### 1. 基本用法

```
import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2
```

检查：

```
print(x.requires_grad)  # True
print(y.requires_grad)  # True
```

`x.requires_grad=True` 表示：我希望 PyTorch 追踪 `x` 参与的计算。

`y.requires_grad=True` 是因为：`y` 是由需要梯度的 `x` 算出来的，所以 `y` 也在计算图里。

### 2. 不是所有 Tensor 都需要梯度

普通数据一般不需要梯度：

```
X = torch.tensor([[1.0, 2.0], [3.0, 4.0]])
```

模型参数才需要梯度：

```
w = torch.randn(2, requires_grad=True)
b = torch.zeros(1, requires_grad=True)
```

心智区分：

```
数据：通常不需要 requires_grad
参数：通常需要 requires_grad
loss：由参数算出来，所以自动在计算图里
```

---

## 二、`backward()` 和 `.grad`：自动求导的核心接口

### 1. 标量输出可以直接 backward

```
x = torch.tensor(3.0, requires_grad=True)

y = x ** 2 + 2 * x + 1
y.backward()

print(x.grad)
```

手算：

```
y = x^2 + 2x + 1
dy/dx = 2x + 2
x = 3
dy/dx = 8
```

所以：

```
x.grad = tensor(8.)
```

### 2. 多元素输入也可以求梯度

```
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)

y = (x ** 2).sum()
y.backward()

print(x.grad)
```

把 `x` 拆开：

```
x = [x1, x2, x3]
```

那么：

```
y = x1^2 + x2^2 + x3^2
```

分别求导：

```
dy/dx1 = 2x1 = 2
dy/dx2 = 2x2 = 4
dy/dx3 = 2x3 = 6
```

输出：

```
tensor([2., 4., 6.])
```

**结论**：

```
x 是什么形状，x.grad 通常也是什么形状。
```

---

## 三、实验 3b：多变量梯度

实验代码：

```
import torch

x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = (x ** 2).sum()

y.backward()

print(x.grad)
```

### 1. 前向过程

```
x = [1, 2, 3]
x ** 2 = [1, 4, 9]
y = 1 + 4 + 9 = 14
```

### 2. 数学形式

```
y = x1^2 + x2^2 + x3^2
```

### 3. 梯度

```
dy/dx = [2x1, 2x2, 2x3]
      = [2, 4, 6]
```

所以：

```
x.grad = tensor([2., 4., 6.])
```

### 4. 这段代码真正想训练的能力

不是让你记住输出 `[2, 4, 6]`，而是让你意识到：

```
向量 x 里的每个元素都可以看成一个独立变量。
PyTorch 会分别计算输出 y 对每个元素的梯度。
```

---

## 四、实验 3c：`mean()` 对梯度的影响

实验代码：

```
import torch

x = torch.randn(3, requires_grad=True)
y = x * 2
z = y.mean()

z.backward()

print(x.grad)
```

### 1. 把 x 拆开

```
x = [x1, x2, x3]
```

那么：

```
y = [2x1, 2x2, 2x3]
```

因为：

```
z = y.mean()
```

所以：

```
z = (2x1 + 2x2 + 2x3) / 3
```

也就是：

```
z = 2/3 * x1 + 2/3 * x2 + 2/3 * x3
```

因此：

```
dz/dx1 = 2/3
dz/dx2 = 2/3
dz/dx3 = 2/3
```

输出大概是：

```
tensor([0.6667, 0.6667, 0.6667])
```

### 2. 为什么不是 2

如果只有：

```
y = x * 2
```

那每个元素的梯度确实是 `2`。

但后面还有：

```
z = y.mean()
```

`mean()` 会除以元素个数 `3`，所以梯度也会被平均分摊：

```
2 -> 2 / 3
```

核心结论：

```
乘以 2 带来梯度 2。
求 mean 带来梯度 1/3。
合起来就是 2/3。
```

---

## 五、梯度为什么会累加

这是今天最重要的坑之一。

### 1. 现象

```
import torch

x = torch.tensor(2.0, requires_grad=True)

y = x ** 2
y.backward()
print(x.grad)  # tensor(4.)

z = x ** 3
z.backward()
print(x.grad)  # tensor(16.)
```

第二次输出不是 `12`，而是 `16`。

### 2. 原因

第一次：

```
y = x^2
dy/dx = 2x = 4
x.grad = 4
```

第二次：

```
z = x^3
dz/dx = 3x^2 = 12
```

但是 PyTorch 默认不是覆盖旧梯度，而是累加：

```
x.grad = 4 + 12 = 16
```

也就是说，`backward()` 的行为更像：

```
x.grad += 新梯度
```

而不是：

```
x.grad = 新梯度
```

### 3. 为什么要这么设计

因为有些训练场景确实需要多次累积梯度，再统一更新参数。

但普通训练中，我们通常希望每一轮只用当前 batch 的梯度，所以必须清空旧梯度。

常见写法：

```
optimizer.zero_grad()
loss.backward()
optimizer.step()
```

手写版本：

```
loss.backward()

with torch.no_grad():
    w -= lr * w.grad
    b -= lr * b.grad
    w.grad.zero_()
    b.grad.zero_()
```

### 4. 心智模型

```
.grad 像一个桶。
每次 backward() 都往桶里倒梯度。
如果不清空，下一次梯度会和旧梯度混在一起。
```

---

## 六、`torch.no_grad()`：让一段代码不进入计算图

### 1. 基本用法

```
x = torch.tensor(3.0, requires_grad=True)

with torch.no_grad():
    y = x * 2

print(y.requires_grad)  # False
```

虽然 `x.requires_grad=True`，但是在 `no_grad()` 代码块里产生的新结果不会被 PyTorch 记录进计算图。

### 2. 常见用途

```
1. 手动更新参数
2. 模型推理
3. 验证集评估
4. 节省显存和计算开销
```

### 3. 为什么参数更新要放在 `no_grad()` 里

```
with torch.no_grad():
    w -= lr * w.grad
```

原因：

```
参数更新不是模型的前向计算，不应该被 Autograd 继续追踪。
```

如果不关闭梯度记录，PyTorch 可能把“更新参数”这件事也加入计算图，导致后续计算图越来越复杂，也不符合训练逻辑。

---

## 七、`detach()`：保留数值，但切断梯度路径

### 1. 基本用法

```
x = torch.tensor(2.0, requires_grad=True)

y = x ** 2
u = y.detach()
z = u * x

z.backward()

print(x.grad)
```

### 2. 分析

前向数值：

```
x = 2
y = x^2 = 4
u = y.detach() = 4
z = u * x = 4x
```

关键点：

```
u 的数值和 y 一样。
但 u 已经从计算图中分离出来，不再记录自己来自 x。
```

所以反向传播时：

```
z = 4x
dz/dx = 4
```

输出：

```
tensor(4.)
```

### 3. 如果不 detach

```
x = torch.tensor(2.0, requires_grad=True)

y = x ** 2
z = y * x

z.backward()

print(x.grad)
```

这时：

```
z = x^2 * x = x^3
dz/dx = 3x^2 = 12
```

输出：

```
tensor(12.)
```

### 4. 核心结论

```
detach() 保留当前数值，但切断这个张量之前的梯度路径。
```

换句话说：

```
我想用这个值继续算，但不想让梯度通过它往前传。
```

---

## 八、`detach()` 和 `no_grad()` 的区别

这两个都和“不追踪梯度”有关，但作用范围不同。

### 1. `detach()` 是对一个张量生效

```
x = torch.tensor(2.0, requires_grad=True)

y = x ** 2
u = y.detach()
```

含义：

```
先正常计算 y。
再把 y 这个结果从已有计算图里拿出来。
```

它像是在已经接好的计算图里，把某个张量和历史断开。

### 2. `no_grad()` 是对一段代码生效

```
x = torch.tensor(2.0, requires_grad=True)

with torch.no_grad():
    y = x ** 2
```

含义：

```
这段代码里的新计算从一开始就不建立计算图。
```

### 3. 对比表

|工具|作用对象|发生时机|核心含义|
|---|---|---|---|
|`detach()`|某个 Tensor|已经算出来之后|保留数值，切断历史|
|`torch.no_grad()`|一段代码|计算发生之前|这段计算不建图|

一句话记忆：

```
detach()：剪断已经存在的计算图连接。
no_grad()：从一开始就不建立计算图。
```

---

## 九、非标量输出的 backward

### 1. 标量输出可以直接 backward

```
x = torch.tensor(2.0, requires_grad=True)
y = x ** 2

y.backward()
```

因为 `y` 是一个标量。

### 2. 非标量输出不能直接 backward

```
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = x * 2

y.backward()  # 会报错
```

因为 `y` 是一个向量：

```
y = [2, 4, 6]
```

PyTorch 不知道你想对哪个方向求导，或者想怎么把这个向量变成标量。

### 3. 需要传入同形状的外部梯度

```
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = x * 2

y.backward(torch.ones_like(y))

print(x.grad)
```

这相当于对：

```
y1 + y2 + y3
```

求梯度。

因为：

```
y1 + y2 + y3 = 2x1 + 2x2 + 2x3
```

所以：

```
dy/dx = [2, 2, 2]
```

输出：

```
tensor([2., 2., 2.])
```

先记住简化版：

```
标量输出可以直接 backward。
非标量输出需要传入同形状的 gradient 参数。
```

---

## 十、叶子张量和非叶子张量

### 1. 什么是叶子张量

手动创建，并且设置了 `requires_grad=True` 的张量，一般是叶子张量。

```
x = torch.tensor(2.0, requires_grad=True)
y = x * 3

print(x.is_leaf)  # True
print(y.is_leaf)  # False
```

`x` 是叶子张量，因为它是我们直接创建的。

`y` 不是叶子张量，因为它是由 `x` 计算出来的中间结果。

### 2. 默认只有叶子张量保存 `.grad`

```
x = torch.tensor(2.0, requires_grad=True)
y = x * 3
z = y ** 2

z.backward()

print(x.grad)  # 有值
print(y.grad)  # 通常是 None
```

这是 PyTorch 的默认行为：为了节省内存，中间变量的梯度默认不保存。

### 3. 如果想看中间变量梯度，用 `retain_grad()`

```
x = torch.tensor(2.0, requires_grad=True)

y = x * 3
y.retain_grad()

z = y ** 2
z.backward()

print(x.grad)
print(y.grad)
```

平时训练模型时，大多数情况下只关心参数的梯度，也就是叶子张量的 `.grad`。

---

## 十一、Python 控制流中的梯度计算

PyTorch 是动态计算图，所以 `if`、`for`、`while` 不会天然妨碍求梯度。

### 1. 示例

```
import torch

def f(x):
    if x.item() > 1:
        y = x ** 2
    else:
        y = 3 * x
    return y

x = torch.tensor(2.0, requires_grad=True)

z = f(x)
z.backward()

print(x.grad)
```

因为这次：

```
x = 2 > 1
```

所以实际执行：

```
y = x^2
```

梯度：

```
dy/dx = 2x = 4
```

输出：

```
tensor(4.)
```

如果换成：

```
x = torch.tensor(0.5, requires_grad=True)
```

实际执行：

```
y = 3x
```

梯度就是：

```
3
```

### 2. 关键点

PyTorch 不是对所有可能分支求导，而是：

```
只对当前这次实际执行过的路径求导。
```

没执行到的分支，不在本次计算图里。

---

## 十二、今天踩过 / 容易踩的坑（速查表）

|#|坑|真相|防御|
|---|---|---|---|
|1|以为 `backward()` 返回梯度|`backward()` 不返回梯度，而是写入 `.grad`|调用后看 `x.grad`|
|2|以为 `.grad` 会自动覆盖|`.grad` 默认累加|每轮训练前后清零|
|3|忘记清空梯度|新旧梯度混在一起，参数更新错误|`optimizer.zero_grad()` 或 `.grad.zero_()`|
|4|以为 `mean()` 不影响梯度|`mean()` 会除以元素个数，梯度也会被平均|手写展开公式|
|5|以为 `detach()` 会改变数值|`detach()` 不改数值，只断梯度路径|对比有无 detach 的梯度|
|6|混淆 `detach()` 和 `no_grad()`|前者作用于张量，后者作用于代码块|`detach` 是剪断，`no_grad` 是不建图|
|7|参数更新不加 `no_grad()`|更新过程可能被记录进计算图|手写更新固定放进 `with torch.no_grad()`|
|8|以为非标量能直接 backward|非标量输出需要传入同形状 gradient|`y.backward(torch.ones_like(y))`|
|9|以为中间变量默认有 `.grad`|默认只保存叶子张量的 `.grad`|中间变量要 `retain_grad()`|
|10|以为 `if/while` 不能求导|PyTorch 是动态图，只记录实际路径|关注当前输入走了哪条分支|

---

## 十三、Autograd 在训练中的最小模板

下面这段是今天内容最终要服务的训练骨架：

```
import torch

# 1. 准备数据
X = torch.tensor([[1.0, 2.0],
                  [2.0, 3.0],
                  [3.0, 4.0]])
y = torch.tensor([5.0, 8.0, 11.0])

# 2. 初始化参数
w = torch.randn(2, requires_grad=True)
b = torch.zeros(1, requires_grad=True)

# 3. 前向计算
y_hat = X @ w + b

# 4. 计算 loss
loss = ((y_hat - y) ** 2).mean()

# 5. 反向传播
loss.backward()

# 6. 手动更新参数，并清空梯度
lr = 0.01
with torch.no_grad():
    w -= lr * w.grad
    b -= lr * b.grad
    w.grad.zero_()
    b.grad.zero_()
```

对应心智模型：

```
X @ w + b：前向预测
loss：衡量预测错多少
loss.backward()：算 w 和 b 应该往哪个方向改
w -= lr * w.grad：沿着降低 loss 的方向更新参数
zero_()：清空旧梯度，准备下一轮
```

---

## 十四、今日自测题

### 题 1：梯度累加

```
x = torch.tensor(2.0, requires_grad=True)

y = x ** 2
y.backward()

z = x ** 3
z.backward()

print(x.grad)
```

答案：

```
16
```

原因：

```
第一次梯度 4。
第二次梯度 12。
PyTorch 默认累加，所以 4 + 12 = 16。
```

### 题 2：mean 的梯度

```
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)

y = x * 2
z = y.mean()

z.backward()

print(x.grad)
```

答案：

```
[2/3, 2/3, 2/3]
```

原因：

```
z = (2x1 + 2x2 + 2x3) / 3
所以每个元素梯度都是 2/3。
```

### 题 3：detach

```
x = torch.tensor(2.0, requires_grad=True)

y = x ** 2
z = y.detach() * x

z.backward()

print(x.grad)
```

答案：

```
4
```

原因：

```
y.detach() 数值是 4，但被当成常数。
z = 4x
dz/dx = 4
```

### 题 4：Python 控制流

```
def f(x):
    if x.item() > 1:
        return x ** 2
    else:
        return 3 * x

x = torch.tensor(0.5, requires_grad=True)
y = f(x)
y.backward()

print(x.grad)
```

答案：

```
3
```

原因：

```
x = 0.5，不满足 x > 1。
实际执行 y = 3x。
梯度是 3。
```

---

## 十五、今日总结

今天 Autograd 的核心知识点：

1. `requires_grad=True`：让 PyTorch 追踪这个张量参与的计算。
2. `backward()`：沿计算图反向传播，计算梯度。
3. `.grad`：保存梯度的位置。
4. 梯度默认累加，不会自动覆盖。
5. 每轮训练都要清空梯度。
6. `torch.no_grad()`：让一段代码不建立计算图。
7. `detach()`：保留数值，但切断某个张量的历史计算图。
8. 标量输出可以直接 `backward()`，非标量输出需要传入同形状 gradient。
9. 叶子张量默认保存 `.grad`，中间张量默认不保存。
10. Python 控制流不妨碍求导，PyTorch 只对当前实际执行路径求梯度。

最重要的一句话：

```
Autograd 的本质是：你写前向计算，PyTorch 记录计算图；你调用 backward()，PyTorch 沿计算图反向计算梯度。
```

今天真正要过关的不是 API 背诵，而是看到下面这段代码时能完全知道每一步在干什么：

```
loss.backward()

with torch.no_grad():
    w -= lr * w.grad
    b -= lr * b.grad
    w.grad.zero_()
    b.grad.zero_()
```
