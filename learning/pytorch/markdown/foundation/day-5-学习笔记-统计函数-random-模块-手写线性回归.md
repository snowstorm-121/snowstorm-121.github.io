学习目标：AI 方向求职  

参考书：《动手学深度学习》PyTorch 版 

本阶段重点：框架本身的行为和坑（视图/拷贝、共享状态、API 差异、静默错误），线代纯数学概念不再赘述。 环境：MacBook Air M5 ｜ Miniconda 虚拟环境 `pytorch_env`

今天三块主线：统计函数（axis/dim/keepdim）、random 模块（随机状态管理）、用 NumPy 手写线性回归（含梯度推导与小批量改造）。下面把主线知识、追问后才弄清楚的点、以及踩过的坑都记下来。

关联笔记：前置 [[Day 3 学习笔记：NumPy 数组基础|NumPy 数组基础]] 与 [[Day 4 学习笔记：数组运算 · 矩阵乘法 · 转置 · 广播|数组运算、矩阵乘法与广播]]；后续用 [[Day 6 学习笔记：matplotlib学习|Matplotlib]] 可视化，并在 [[Stage1/Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|纯 Tensor 手写线性回归]]中复现训练流程。

---

## 一、统计函数与 axis / dim / keepdim
### 1. 核心心智模型：被点名的轴会"消失"
对一个 `(2, 3)` 数组：

+ `axis=0`：把第 0 轴压掉，3 列各被压成一个数，结果形状 `(3,)`。
+ `axis=1`：把第 1 轴压掉，2 行各被压成一个数，结果形状 `(2,)`。

记忆口诀：**你指定的那个轴就是消失的轴**。不要记成"axis=0 跟行有关"，那是反的。

```python
import numpy as np
a = np.arange(6).reshape(2, 3).astype(float)   # [[0,1,2],[3,4,5]]
a.sum(axis=0)   # [3. 5. 7.]  形状 (3,)
a.sum(axis=1)   # [3. 12.]    形状 (2,)
a.sum()         # 15.0        不给 axis 全压成标量
```

### 2. keepdim / keepdims 的唯一意义：让结果能广播回去
被压掉的那一维不删除、保留为长度 1，于是结果能和原数组对齐相减。这就是它存在的全部理由。

```python
row_mean = a.mean(axis=1, keepdims=True)   # 形状 (2, 1)
a - row_mean                               # (2,3) - (2,1) 正确广播,按行减均值
```

### 3. ⚠️ 重点更正（我第一次讲错了，这里是正确版）
关于"忘了 keepdims 会怎样"，要分形状讨论，结论和我最初说的不同：

+ **非方阵**（如 `(2,3)`）：`a.mean(axis=1)` 是 `(2,)`，`(2,3) - (2,)` 按广播从右对齐，`3` 与 `2` 不匹配且都不是 1 → **直接抛 ValueError**：`operands could not be broadcast together with shapes (2,3) (2,)`。这种情况会**响亮报错**，你一眼能发现，反而不危险。
+ **方阵**（如 `(3,3)`）：`s.mean(axis=1)` 是 `(3,)`，`(3,3) - (3,)` 能广播成功，但减的是**列方向**，不是你想要的行方向 → **静默算错，不报错**。这才是真正的隐患。

```python
s = np.arange(9).reshape(3, 3).astype(float)
s - s.mean(axis=1)                 # 不报错,但减错方向(危险)
s - s.mean(axis=1, keepdims=True)  # 正确:每行减自己的均值
```

一句话结论：**非方阵忘了 keepdims 会报错（能发现）；方阵会静默错（发现不了）。keepdims 的价值就是无论方不方都强制得到 **`**(行数, 1)**`**，永远正确广播。**

### 4. NumPy vs PyTorch 的四个关键差异
| 点 | NumPy | PyTorch | 后果 |
| --- | --- | --- | --- |
| 参数名 | `axis`<br/> / `keepdims` | `dim`<br/> / `keepdim` | 来回切容易写错（计划表里"axis 参数和 keepdim"本身就混用了两边的词） |
| `mean`<br/> 遇整数 | 自动升 float64 返回 | **直接 RuntimeError**，要求浮点/复数 | torch 要先 `.float()` |
| `std`<br/> 默认 | `ddof=0`<br/>（除以 N，总体） | `correction=1`<br/>（除以 N−1，无偏） | **同一组数默认给出不同标准差，都不报错** |
| `argmax`<br/> 并列 | 确定返回第一个 | 不保证返回哪一个 | 别依赖 torch 在并列时的落点 |


`std` 默认值差异的具体例子（已验证）：`[1,2,3,4]` 在 NumPy 默认得 `1.118`（ddof=0），在 PyTorch 默认得 `1.291`（相当于 ddof=1）。做特征标准化时若一半用 np、一半用 torch，方差会悄悄偏掉，比值是 √(N/(N−1))。要一致：`np.std(..., ddof=1)` 或 `torch.std(..., correction=0)`。

PyTorch 写法对照：

```python
import torch
t = torch.arange(6).reshape(2, 3)          # int64
# torch.mean(t)                            # RuntimeError!
t = t.float()
t.sum(dim=0)                               # 用 dim,不是 axis
t.mean(dim=1, keepdim=True)                # 用 keepdim,不是 keepdims
```

---

## 二、random 模块与随机状态管理
### 1. 底层本质（理解这个，后面都顺）
计算机的"随机"是**伪随机**：内部存着一团叫**状态(state)****的数据，每要一个数就「根据当前状态算出输出 → 把状态更新到下一个」。所以从某个状态出发，后面整串数字是****完全确定**的。

**种子(seed)就是用来指定这团状态的初始值。** 同样的种子 → 同样的起点 → 后面整串数字一模一样。

### 2. 旧 API（全局共享，不推荐写新代码用）
numpy 内部藏着**唯一一个全局生成器**，`np.random.seed` 设它，所有 `np.random.*` 共用并推进它。

```python
np.random.seed(0)
np.random.rand(2, 3)      # 维度是分开的位置参数
np.random.randn(2, 3)     # 接着同一个全局状态往下走
np.random.randint(0, 10, size=5)   # high 开区间,取不到 10
```

问题：全局、可变、共享。任何第三方库调一次 `np.random.*` 都会偷偷推进它，难以推理，也不适合多线程。d2l 书里还在用这套，看懂即可。

### 3. 新 API（推荐：状态封装进独立对象）
```python
rng = np.random.default_rng(0)     # 一个独立生成器,自带状态
rng.random((2, 3))                 # 维度是一个元组(和旧的 rand 不同!)
rng.standard_normal((2, 3))
rng.integers(0, 10, size=5)
```

独立性验证（已跑）：

```python
g1 = np.random.default_rng(0)
g2 = np.random.default_rng(0)
g1.random()   # 0.6369616873214543
g2.random()   # 0.6369616873214543  <- 同种子同起点,彼此独立、互不干扰
```

好处：状态封装、谁的归谁、底层算法（PCG64）也更好。**自己写新代码优先用 **`**default_rng**`**。**

### 4. ⚠️ 形状坑：`random(2,3)` vs `random((2,3))`
```python
np.random.default_rng(0).random(2, 3)     # TypeError: Cannot interpret '3' as a data type
np.random.default_rng(0).random((2, 3))   # 正确:位置传元组
np.random.default_rng(0).random(size=(2, 3))  # 正确:关键字 size 传元组
```

原因很阴：`Generator.random` 签名是 `random(size, dtype, ...)`，`random(2,3)` 把 `2` 当 size、把 `3` 当 **dtype**，3 不是合法 dtype 才报错——它没在"形状"上报错，而在你完全没想到的 dtype 上炸。

旧 API 的相关不一致：`np.random.rand(2, 3)` 维度是**分开的参数**，而 `np.random.random((2,3))` / `rng.random((2,3))` 维度是**元组**。

### 5. ⚠️ 最容易绕晕的点：种子是"起点"不是"锁定"，状态会前进
我最初的困惑：「我每次运行代码生成的随机数都一样，为什么说状态会往前走？」——把**两个时间尺度**混了：

+ **同一次运行之内**：seed 一次后连抽两个数是**不同**的，因为每抽一次状态前进一步。
+ **重新运行整个脚本**：脚本顶部的 `seed(...)` 会**重新执行**，把状态硬拨回起点，于是后面整串又从同一个数开始 → 所以"每次运行结果都一样"。

已验证：

```python
np.random.seed(0)
np.random.rand()   # 0.5488135
np.random.rand()   # 0.7151894   <- 同一次运行内,第二个和第一个不同(状态前进了)

np.random.seed(0)
np.random.rand()   # 0.5488135   <- 重新 seed 拨回起点,又是第一个数
```

**字典类比**：`seed(0)` = 翻到第 0 页；每读一个数书签就往后挪一格。同一次运行连读两次 → 相邻两格 → 不同；下次重跑又执行 `seed(0)` → 书签拨回第 0 页 → 重新从头读 → 和上次相同。

什么时候能亲眼看到状态在前进？在 Jupyter 里第一个 cell 写 `seed(0)`，第二个 cell 写 `rand()`，**只反复运行第二个 cell**（不重跑第一个），每次输出都不同——因为没重新拨书签。这个现象坑过无数人。

想让"第二次抽取"等于"第一次抽取"，必须在第二次之前**重新 seed**：

```python
np.random.seed(0); np.random.rand()   # 0.5488135
np.random.seed(0); np.random.rand()   # 0.5488135  再次相同
```

### 6. ⚠️ np 和 torch 是两套完全独立的随机状态
`np.random.seed` 管不到 `torch.randn`，反之亦然。混用却只 seed 一个 → 实验不可复现。

```python
# 错误指望:用 numpy 种子让 torch 复现
np.random.seed(123); a = torch.randn(3)
np.random.seed(123); b = torch.randn(3)
torch.equal(a, b)   # False! torch 用自己的状态在持续前进

# 正确:seed torch 自己的
torch.manual_seed(0); torch.randn(5)
torch.manual_seed(0); torch.randn(5)   # 这两串才相同
```

`torch.randn` 标准用法是位置参数 `torch.randn(5)`；写 `torch.randn(size=(5,))` 若你的版本跑通了就没问题，但本质接收的是位置形状参数，换环境若报 TypeError 记得改回位置参数。M5 上还有一层：`manual_seed` 管 CPU；用到 MPS（苹果 GPU 后端）时设备随机性另算，今天先记"np 和 torch 各管各的种子"。

### 7. ⚠️ permutation vs shuffle（小批量里会用到）
```python
rng = np.random.default_rng(1)
a = np.arange(5)
rng.permutation(a)   # 返回打乱的新数组, 原 a 不变
rng.shuffle(a)       # 原地打乱 a, 返回 None!
```

手滑写成 `perm = rng.shuffle(arr)` 会得到 `perm=None`，后面 `perm[...]` 报"None 不能索引"。要可切片的编号清单用 `permutation`；只想就地洗乱、不要返回值才用 `shuffle`。

---

## 三、用 NumPy 手写线性回归（不用任何 ML 库）
### 1. 完整代码（已验证收敛）
用 d2l 经典合成数据：真实 `w=[2,-3.4]`，`b=4.2`。

```python
import numpy as np

rng = np.random.default_rng(42)
n, d = 1000, 2
true_w = np.array([2.0, -3.4]); true_b = 4.2

X = rng.normal(0, 1, size=(n, d))        # (n, d)
y = X @ true_w + true_b + rng.normal(0, 0.01, size=n)   # (n,) 一维

w = rng.normal(0, 0.01, size=d)          # (d,)
b = 0.0
lr = 0.05; epochs = 1000

for ep in range(epochs):
    y_hat = X @ w + b                    # (n,)
    err = y_hat - y                      # (n,)
    loss = np.mean(err ** 2)             # 标量 MSE
    dw = (2 / n) * (X.T @ err)           # (d,)
    db = (2 / n) * np.sum(err)           # 标量
    w -= lr * dw
    b -= lr * db
```

结果：loss 从 ~32 降到 ~0.0001，`w≈[2.0000, -3.4002]`，`b≈4.2003`。

### 2. 形状管理是灵魂（线代帮不上的部分）
+ **全程保持一维 **`**(n,)**` 是刻意的：`X@w` 是 `(n,d)@(d,)=(n,)`，`y` 也是 `(n,)`，相减干净对齐。
+ 梯度 `X.T @ err` 是 `(d,n)@(n,)=(d,)`，正好和 `w` 同形状才能 `w -= lr*dw`。
+ `w -= lr*dw` 是**原地修改**，要求 dtype 兼容：若把 `w` 初始化成整数会报错或被截断 → **初始化务必是 float**。
+ loss 用 `mean` 还是 `sum` 改变梯度尺度，进而改变需要的学习率（用 sum 梯度大 n 倍，同 lr 会发散）。

### 3. 梯度推导（从链式法则到矩阵形式）
符号：`X` 是 `(n,d)`，元素 `Xᵢⱼ`；预测 `ŷᵢ = Σⱼ Xᵢⱼ wⱼ + b`；残差 `eᵢ = ŷᵢ − yᵢ`；损失 `L = (1/n) Σᵢ eᵢ²`。

wⱼ 影响 L 是一条复合链：`改 wⱼ → 改每个 ŷᵢ → 改每个 eᵢ → 改每个 eᵢ² → 加和成 L`。

**对 wⱼ 求导：**

```plain
∂L/∂wⱼ = (1/n) Σᵢ ∂(eᵢ²)/∂wⱼ
       = (1/n) Σᵢ 2eᵢ · (∂eᵢ/∂wⱼ)        # 平方的链式
```

`eᵢ = (Xᵢ₁w₁ + … + Xᵢⱼwⱼ + … ) + b − yᵢ`，对 wⱼ 求导只剩含 wⱼ 的那项，系数是 `Xᵢⱼ`，即 `∂eᵢ/∂wⱼ = Xᵢⱼ`。代回：

```plain
∂L/∂wⱼ = (2/n) Σᵢ Xᵢⱼ eᵢ
```

**为什么这就是 **`**X.T @ err**`**：** 由转置定义 `(Xᵀ)ⱼᵢ = Xᵢⱼ`，所以 `(Xᵀ e)ⱼ = Σᵢ (Xᵀ)ⱼᵢ eᵢ = Σᵢ Xᵢⱼ eᵢ`，正是上式。全部 j 合起来：

```plain
∂L/∂w = (2/n) · Xᵀ e          # dw = (2/n)*(X.T @ err)
```

转置不是修饰，是形状逼出来的：要 `(d,)` 才能减 `w`，`X.T` 是 `(d,n)`，`(d,n)@(n,)=(d,)`。写成 `X @ err` 会形状不匹配报错。

**对 b 求导：**`∂eᵢ/∂b = 1`，所以

```plain
∂L/∂b = (2/n) Σᵢ eᵢ          # db = (2/n)*np.sum(err)
```

**直觉：**`dw` 是"每个特征与残差的相关性"（特征 j 偏大处恰好预测也偏高，就把 wⱼ 调小）；`db` 是"平均残差"（整体预测偏高就把 b 调小）。

**那个 2：** 来自平方求导。实践中常把它吸进学习率，或把损失定义成 `(1/2n)Σeᵢ²` 让 2 抵消，梯度变干净的 `(1/n)Xᵀe`。不影响方向，只改等效步长。

### 4. 数值梯度检验（验证推导 + 实用调试技能）
中心差分：`(f(w+ε) − f(w−ε)) / (2ε)` 应约等于解析梯度。已验证解析梯度与数值梯度在 1e-10 量级吻合。

```python
eps = 1e-6
# 对参数某分量加减 eps,看 loss 变化率,与解析 dw 对比
# 误差 < 1e-7 基本就稳;差很多说明推导或代码错了
```

以后学 `autograd` 时要明白：它替你做的就是"自动、精确地算出我们手推的这个梯度"。手推过一遍，就不会把它当黑盒。

---

## 四、小批量梯度下降（mini-batch GD）
### 1. 全批量 vs 小批量
+ **全批量**：一个 epoch = **1 次更新**（用全部 n 个样本算一个梯度）。
+ **小批量**：一个 epoch = **很多次更新**（把 n 个样本切成 batch_size 一批，每批更新一次）。1000/32 ≈ 31 次更新/epoch，所以用更少 epoch 就到位。

### 2. perm 是什么 / permutation 的作用
`perm = train_rng.permutation(n)` 做一件事：**把编号 **`**[0,1,…,n−1]**`** 随机打乱，返回一个新数组**（传整数 n 时对 `arange(n)` 打乱；传数组时返回其打乱副本）。它是"接下来按什么顺序访问样本"的**编号清单**，不是数据本身。

**为什么要打乱**：小批量是一小撮一小撮喂数据。固定顺序分批会让每个 epoch 的批次组合完全相同；若数据本身带顺序（前半猫后半狗），梯度方向来回拉扯不稳。每轮重新打乱 → 批次成为对全体的随机采样 → 梯度更无偏、训练更稳。

### 3. 内层 for 循环在干什么
```python
for start in range(0, n, batch_size):    # start = 0, batch_size, 2*bs, ... 是每批起点
    idx = perm[start:start+batch_size]   # 从打乱清单切出这一批的编号
    Xb, yb = X[idx], y[idx]              # 花式索引,取出这一批样本
    m = len(idx)                         # 这一批实际大小
    err = (Xb @ w + b) - yb
    w -= lr * (2/m) * (Xb.T @ err)       # 每批更新一次
    b -= lr * (2/m) * np.sum(err)
```

具体跟踪（n=10, batch_size=3, `perm=[8 0 7 1 3 6 2 4 5 9]`）：

```plain
start=0: idx=perm[0:3]=[8 0 7]   (3 个)
start=3: idx=perm[3:6]=[1 3 6]   (3 个)
start=6: idx=perm[6:9]=[2 4 5]   (3 个)
start=9: idx=perm[9:12]=[9]      (1 个,最后一批不满!)
```

内层跑完一圈 = 一个 epoch = 把全部样本各用一次（不重不漏）。

### 4. 两层循环的角色
+ **内层**`for start`：走完打乱清单一遍，每批更新一次。
+ **外层**`for ep`：决定整体扫描重复多少遍，且每轮开头重新 `permutation` 打乱一次。

### 5. 每轮 perm 是否不同？（呼应"状态前进 vs 重跑复现"）
+ **同一次运行内**：每个 epoch 的 perm **都不同**，因为 `train_rng` 每被调用一次状态就前进一步。这正是我们要的——每轮重新洗牌。
+ **跨运行（重跑脚本）**：只要 `train_rng` 用同一种子起步，**整串洗牌序列原样复现**（第 0 轮永远是同一个排列，第 1 轮永远是另一个……）。

所以"把打乱用的随机源纳入 seed 管理"= 管住种子就管住了从第 0 轮到最后一轮的全部洗牌 → 训练可复现。**这就是第 4 题真正的考点。**

### 6. 完整代码（已验证收敛）
```python
import numpy as np

# 两个独立随机源:数据生成 与 训练打乱 分开,互不污染
data_rng  = np.random.default_rng(0)   # 只造数据
train_rng = np.random.default_rng(1)   # 只管初始化 + 每轮打乱

n, d = 1000, 5
true_w = np.array([1.1, -2.2, 3.3, -4.4, 5.5]); true_b = 8.8
X = data_rng.normal(0, 1, (n, d))
y = X @ true_w + true_b + data_rng.normal(0, 0.01, n)

w = train_rng.normal(0, 0.01, d); b = 0.0   # 权重初始化也消耗 train_rng
lr = 0.05; epochs = 30; batch_size = 32

for ep in range(epochs):
    perm = train_rng.permutation(n)          # 每个 epoch 重新打乱
    for start in range(0, n, batch_size):
        idx = perm[start:start + batch_size]
        Xb, yb = X[idx], y[idx]
        m = len(idx)
        err = (Xb @ w + b) - yb
        w -= lr * (2 / m) * (Xb.T @ err)
        b -= lr * (2 / m) * np.sum(err)
    if ep % 5 == 0:
        full_loss = np.mean(((X @ w + b) - y) ** 2)
        print(f"epoch {ep:3d}  full_loss={full_loss:.6f}")
```

### 7. 小批量四个坑
1. **梯度除以 **`**m**`** 不是 **`**n**`：算的是这一批 m 个样本的平均梯度，照抄 `2/n` 等于把步长缩小 n/m 倍，几乎不动。
2. **最后一批通常不满**：1000÷32 余 8，用 `m = len(idx)` 动态取大小才稳；硬写 `/batch_size` 最后一批会偏。
3. **打乱随机源属于复现性版图**：洗牌消耗随机数，想可复现就必须 seed 它。
4. **用两个独立生成器**：造数据和打乱若共用一个全局源会耦合——改一行数据生成会让后面所有 epoch 的洗牌全变。分开后各自独立可控。

---

## 五、今天踩过 / 纠正过的坑（速查表）
| # | 坑 | 真相 | 防御 |
| --- | --- | --- | --- |
| 1 | `a.mean(axis=1)`<br/> 的形状 | `(2,3)`<br/> 的它是 `(2,)`<br/>,不是 `(3,)`<br/>(我一开始说错) | 记"被点名的轴消失" |
| 2 | 忘 keepdims 的后果 | 非方阵**报错**(能发现);方阵**静默错**(发现不了) | 一律加 `keepdims=True`<br/> 得 `(行数,1)` |
| 3 | np 和 torch 的 `std`<br/> 默认 | np 除以 N,torch 除以 N−1,**默认就不一样且不报错** | 显式写 `ddof`<br/> / `correction` |
| 4 | `torch.mean`<br/> 遇整数 | 直接 RuntimeError | 先 `.float()` |
| 5 | `argmax`<br/> 并列 | np 确定取第一个,torch 不保证 | 别依赖 torch 并列落点 |
| 6 | 种子的含义 | 是"起点"不是"锁定";run 内状态前进,重跑才重置 | 想复现某次抽取就在抽之前重新 seed |
| 7 | np vs torch 随机状态 | 两套完全独立,互不影响 | 各 seed 各的(`np.random.seed`<br/> / `torch.manual_seed`<br/>) |
| 8 | `rng.random(2,3)` | TypeError(3 被当 dtype) | 用 `random((2,3))`<br/> 或 `random(size=(2,3))` |
| 9 | `rand(2,3)`<br/> vs `random((2,3))` | 旧 rand 分开参数,新 random 用元组 | 看清是不是元组 |
| 10 | 线性回归 `(n,1)`<br/> vs `(n,)` | 相减静默广播成 `(n,n)`<br/>,loss 错;报错却在更新 w 那行(离病根四行远) | 全程统一 `(n,)`<br/>,每个张量心里标形状 |
| 11 | `.shape(-1,1)`<br/> 笔误 | `.shape`<br/> 是属性(元组)不是方法,调用它报"tuple not callable" | 是 `.reshape(-1,1)` |
| 12 | `w -= lr*dw`<br/> 原地更新 | w 是整数会报错/截断 | 初始化成 float |
| 13 | `X @ err`<br/> 写反转置 | 形状不匹配报错(d≠n 时) | 梯度对 w 是 `X.T @ err`<br/> → `(d,)` |
| 14 | `permutation`<br/> vs `shuffle` | 前者返回新数组,后者原地改返回 None | 要清单用 permutation |
| 15 | 小批量梯度分母 | 是 `/m`<br/> 不是 `/n`<br/>;最后一批不满用 `len(idx)` | 动态取 m |
| 16 | `torch.randn(size=(5,))` | 标准是位置参数 `torch.randn(5)` | 换环境报错就改位置参数 |


---

## 六、可以自己再做的小实验
1. 把第一个 keepdims 例子换成方阵 `(3,3)`，亲眼看"静默减错方向"。
2. Jupyter 里 seed 放一个 cell、`rand()` 放另一个 cell，只反复跑 `rand()` 那个 cell，看数字每次变。
3. 小批量里把 `train_rng` 种子换个数再跑：中间 loss 不同但最终都收敛到同一组 w（凸问题路径不同、终点相同）；再设回相同种子，确认中间 loss 逐一致 → 验证"打乱随机源 ∈ 复现性"。
4. 把 `perm = train_rng.permutation(n)` 移到外层循环之外（只洗一次牌），观察和每轮重洗的差别。
5. 给手写线性回归加一遍数值梯度检验，确认解析梯度误差 < 1e-7。
