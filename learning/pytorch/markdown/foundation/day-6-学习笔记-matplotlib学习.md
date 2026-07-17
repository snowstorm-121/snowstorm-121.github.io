学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版

本阶段重点：框架本身的行为和坑（视图/拷贝、共享状态、API 差异、静默错误），线代纯数学概念不再赘述。环境：MacBook Air M5 ｜ Miniconda 虚拟环境 `pytorch_env`

今天主线：Matplotlib 可视化。五块内容——两套接口（状态机 vs 面向对象）、折线图与 loss 曲线、散点图、直方图、子图布局，最后把 Day 5 手写的线性回归完整可视化（loss 曲线 + 预测散点 + 残差直方图）。下面把主线知识、追问后才弄清的点、以及踩过的坑都记下来。今天的核心心智模型与 Day 5 一脉相承：**全局可变共享状态是坑，要用显式独立对象**——昨天是 `np.random` vs `default_rng`，今天是 `plt.*` vs `fig, ax`。

关联笔记：前置 [[Day 5 学习笔记：统计函数 _ random 模块 _ 手写线性回归|手写线性回归]]；后续在 [[Day 9 学习笔记：Titanic 综合实战 —— 完整数据分析项目|Titanic 综合实战]]中复用数据可视化。

---

## 〇、环境准备：装库的坑
### 1. matplotlib / scipy 都要单独装
跑 `import matplotlib.pyplot as plt` 报 `ModuleNotFoundError: No module named 'matplotlib'`，跑 `from scipy import stats` 报 `No module named 'scipy'`——都是没装库。装法：

```bash
conda install matplotlib
conda install scipy
# 或者用 pip，但务必带 python -m
python -m pip install matplotlib
python -m pip install scipy
```

### 2. ⚠️ 为什么强调 `python -m pip` 而不是裸 `pip`
这是和 Day 5「`python -u Day6.py` 用的是哪个 python」同一根线的坑：系统里常常存在好几个 `pip`（系统自带、其他环境、Homebrew 的），即使提示符显示 `(pytorch_env)` 已激活，裸 `pip`**未必指向当前环境的 Python**。它可能把包装到别的地方，然后你回到 `pytorch_env` 跑代码照样 `ModuleNotFoundError`，**不报任何错，一脸懵**。`python -m pip` 的意思是「用我现在这个 python 去执行它自带的 pip 模块」，从而保证装到的环境和运行代码的环境是同一个。

验证装进了当前环境：

```bash
python -c "import matplotlib; print(matplotlib.__version__)"
```

### 3. M 系列 Mac 的后端坑（先记，迟早遇到）
Matplotlib 在 Mac 上的默认后端（backend）有时是 `MacOSX`，在纯终端跑脚本、SSH、后台线程画图等场景会弹不出窗口或报后端相关错误。应急办法在最开头加：

```python
import matplotlib
matplotlib.use("Agg")   # 无界面后端：只能 savefig 存文件，不能 plt.show() 弹窗
import matplotlib.pyplot as plt
```

今天没撞上，等真遇到「图弹不出来/后端报错」再回来用。

---

## 一、两套接口：状态机 vs 面向对象（今天所有坑的总根源）
### 1. 核心：fig 和 ax 是俩什么东西
先把名词全扔掉，只问「fig 和 ax 是什么」。它们是两个**实体对象**，有上下层级的包含关系，用画画类比：

+ `**fig**`**（Figure）= 整张画纸 / 一个窗口**。最外层容器，管「整张图多大、背景什么色、最后存成文件」这种**整体**的事。它本身**不画任何线**。
+ `**ax**`**（Axes）= 画纸上真正用来画图的那块「绘图区」**。折线、散点、x 轴 y 轴的刻度、网格线——**全都画在 **`**ax**`** 里面**。

一句话：**真正的图画在 **`**ax**`** 里，**`**fig**`** 只是装 **`**ax**`** 的外壳。** 一张 `fig` 上可以摆好几个 `ax`，那就是「子图」。

⚠️ 命名坑：**Axes（绘图区）不是 axis（坐标轴）**。一个 `ax` 内部含两条 axis（x 轴和 y 轴）。

### 2. 两套接口的对应（直接套用 Day 5 的记忆）
+ **状态机接口（**`**plt.***`**）**：Matplotlib 内部藏着一个隐藏的「当前 figure / 当前 axes」指针。每次调 `plt.plot(...)`，它偷偷去找这个隐藏指针，在它指向的那个 ax 上画。**你完全不知道那个指针现在指向谁。** 这就是 Day 5 笔记里说的「全局共享的 `np.random`」结构——内部藏着唯一一个全局对象，任何一行 `plt.xxx` 都作用在它身上。
+ **面向对象接口（OO）**：`fig, ax = plt.subplots()` 让你拿到实打实的对象，想在哪个 ax 上画就明确告诉它。这正对应 Day 5 的 `rng = np.random.default_rng(0)`——状态封装进独立对象，谁的归谁。

```python
# 状态机：靠隐藏指针，不知道画到哪个 ax 上
plt.plot([1, 2, 3])
plt.title("标题")

# OO：我手里拿着 ax，明确告诉它画在这里
fig, ax = plt.subplots()   # 同时拿到外壳(fig)和画图区(ax)
ax.plot([1, 2, 3])
ax.set_title("标题")
```

| 状态机（隐藏全局） | 面向对象（显式对象） |
| --- | --- |
| `plt.plot(...)` | `ax.plot(...)` |
| `plt.title(...)` | `ax.set_title(...)` |
| `plt.xlabel(...)` | `ax.set_xlabel(...)` |
| `plt.xlim(...)` | `ax.set_xlim(...)` |


⚠️ **命名坑**：状态机是 `plt.xlabel`，OO 却是 `ax.set_xlabel`（多了 `set_` 前缀）。`title/xlabel/ylabel/xlim/ylim/xticks` 切到 `ax.` 时几乎都要加 `set_`。这跟 Day 5「NumPy 的 axis/keepdims 切到 PyTorch 的 dim/keepdim」是同类问题。

揭开隐藏指针：`plt.gca()` = get current axes，`plt.gcf()` = get current figure。`plt.plot(...)` 约等于 `plt.gca().plot(...)`。理解了「`plt.*` = 在 gca() 上操作」就理解了状态机的全部行为。新建 figure、新建 subplots、或 `plt.sca(ax)` 时，「当前」指针会被挪走。

### 3. 实践结论
**任何超过「一条线随手画一下」的图，一律用 OO 接口。** 尤其是：画子图、在函数里画图、在循环里画图——这三种场景下「当前 axes 是谁」几乎一定会坑你。`plt.*` 只适合 Jupyter 里快速瞟一眼单张图。

### 4. ⚠️ 经典陷阱：标题画到了错误的子图（已亲手踩过）
```python
fig, (ax1, ax2) = plt.subplots(1, 2)   # 左右两个子图
ax1.plot([1, 2, 3])                     # 在左图画线
plt.title("左图的标题")                  # 想给左图加标题
plt.show()
```

结果：标题出现在**右图（ax2）**上，不是左图。因为 `plt.subplots(1, 2)` 创建两个 ax 后，**最后一个被创建的 ax2 成了隐藏指针指向的「当前 ax」**，`plt.title` 作用在 gca()=ax2 上。这是个不报错的静默错误。

修复：明确说清楚，用 OO。

```python
ax1.set_title("左图的标题")   # 我就是要画在 ax1 上
```

---

## 二、中文乱码 / 负号方块
### 1. 现象与原因
中文标题、标签显示成方块（□□□），是因为 Matplotlib 默认字体不含中文字符。

### 2. 解法（Mac 自带字体，无需安装）
```python
import matplotlib
matplotlib.rcParams['font.family'] = 'Arial Unicode MS'   # macOS 自带
matplotlib.rcParams['axes.unicode_minus'] = False          # 防止负号也变方块
```

设置之后，**后面所有 title / set_xlabel / 图例文字全自动用这个字体**，不用每次单独指定。第二行专修「设中文字体后负号 `-` 跟着乱码」的连带问题。

### 3. ⚠️ 必须写在 import pyplot 之前
这两行 `rcParams` 要写在 `import matplotlib.pyplot as plt`**之前**才稳定生效。如果设了还乱码，先检查是不是写在了 `import pyplot` 之后。（曾经残差直方图的 y 轴「概率密度」显示成竖排乱码，就是顺序问题。）

---

## 三、子图布局 subplots
`plt.subplots(行, 列)` 做一件事：**在一张 fig 上按行列数摆好若干个 ax，把它们全交给你。**

### 1. ⚠️ 三种返回值形状会静默变（最大的坑）
第二个返回值的形状随参数变，这是新手翻车重灾区：

```python
# 情况一：1×1，返回单个 ax 对象
fig, ax = plt.subplots()        # 或 subplots(1, 1)
ax.plot([1, 2, 3])              # 直接用

# 情况二：1行多列 / 多行1列，返回一维数组 (N,)
fig, axes = plt.subplots(1, 3)
axes[0].plot(...); axes[1].plot(...); axes[2].plot(...)

# 情况三：多行多列，返回二维数组 (行, 列)
fig, axes = plt.subplots(2, 3)
axes[0][0].plot(...)   # 要两个下标
axes[1][2].plot(...)
```

快捷写法——解包直接拿每个 ax（等价于 axes[0]、axes[1]，但更直观）：

```python
fig, (ax1, ax2) = plt.subplots(1, 2)
```

### 2. ⚠️ 静默坑：二维数组用一个下标
```python
fig, axes = plt.subplots(2, 3)
axes[0].plot(...)     # ❌ axes[0] 是「第0行整排3个ax」的数组，不是单个 ax
```

在数组上调 `.plot()` 不报语法错，但什么也画不出或报看不懂的错。**一劳永逸的解法是 **`**flatten()**`：

```python
fig, axes = plt.subplots(2, 3, figsize=(12, 6))
axes = axes.flatten()   # 把 (2,3) 压成 (6,) 一维
axes[0].plot(...)       # 不管几行几列，永远一个下标取
axes[5].plot(...)
```

### 3. figsize
```python
fig, axes = plt.subplots(1, 2, figsize=(10, 4))   # (宽, 高)，单位英寸
```

默认 `(6.4, 4.8)`，多子图常太挤。横排一般把宽乘子图数：两列 `(10,4)`，三列 `(14,4)`。

### 4. ⚠️ 陷阱题（已答对）
```python
fig, axes = plt.subplots(2, 2)
for i in range(4):
    axes[i].set_title(f"子图 {i}")   # ❌ axes 是 (2,2)，axes[i] 取的是整行
```

会报错。修法：`axes = axes.flatten()` 后再用单下标。

---

## 四、折线图与 loss 曲线（重点：实际训练才遇到的坑）
### 1. 基本用法
```python
fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(x, y,
    color='steelblue',
    linewidth=2,
    linestyle='--',      # '-' 实线 '--' 虚线 ':' 点线
    label='train loss',  # 图例标签（要配 ax.legend() 才显示）
    marker='o',          # 每个数据点画标记
)
ax.set_xlabel('epoch'); ax.set_ylabel('loss'); ax.set_title('训练 loss 曲线')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()
```

### 2. 横坐标可以省略（追问澄清）
只传 `y` 时，Matplotlib **自动用下标 0,1,2,… 作为横坐标**。

```python
ax.plot(loss_history)   # 1600 个元素，横坐标自动是 0..1599，正好是 batch 编号
```

⚠️ 但 x 有跳跃/间隔/非均匀时**必须显式传**，否则静默画错：

```python
epochs_recorded = [0, 2, 4, 6, 8]
loss_recorded   = [32.1, 5.3, 0.8, 0.12, 0.10]
ax.plot(loss_recorded)                   # ❌ 横坐标变 0,1,2,3,4，看起来间隔1，实际间隔2
ax.plot(epochs_recorded, loss_recorded)  # ✅ 真实 epoch 编号
```

规则：x 是连续整数 0,1,2… 可省；有跳跃/时间戳等非均匀序列必须显式传。

### 3. ⚠️ 最重要的坑：loss 曲线几乎必须用对数纵轴
Day 5 的 loss 从 ~32 降到 ~0.0001，跨近 6 个数量级。线性纵轴下：前几个 epoch 占满整张图高度，后面被压成一条贴 x 轴的平线，**看不出后期是否还在降**。解法一行：

```python
ax.set_yscale('log')   # 纵轴改对数刻度：10⁰,10⁻¹,10⁻²...，每个数量级占同样视觉高度
```

**规律：loss 的最大值与最小值相差超过 2 个数量级，就用对数纵轴。** 变化范围很小（如 0.5→0.3）时反而用线性轴更清楚。

### 4. 训练循环里记录 loss 的正确方式
```python
loss_history = []                 # 循环外初始化
for ep in range(epochs):
    # ...训练...
    loss_history.append(full_loss)  # 每轮（或每 batch）追加

# 训练结束后再画
ax.plot(loss_history)
plt.show()                        # ✅ 在循环外
```

⚠️ 错误写法：在循环里反复 `plt.show()` → 每个 epoch 弹一个新窗口、每次从头重画整条曲线、内存一直涨。`plt.show()` 必须放循环外。

### 5. ⚠️ 按 epoch 记录 vs 按 batch 记录（重要踩坑 + 收获）
调试时发现：`epochs=5`、`scale=10.0` 初始化后，**epoch 0 的 loss 已经是 0.000103**，看不到下降过程。原因不是初始化没生效，而是：**数据 n=10000、batch_size=32，一个 epoch 更新约 312 次，早在第一个 epoch 结束前模型就收敛了**。按 epoch 记录，下降过程全发生在第一个记录点之前，所以看不到。

解法：**按 batch 记录 loss**，横轴改 batch 编号：

```python
for ep in range(epochs):
    perm = train_rng.permutation(n)
    for start in range(0, n, batch_size):
        idx = perm[start:start+batch_size]
        Xb, yb = X[idx], y[idx]
        m = len(idx)
        err = Xb @ w + b - yb
        w -= lr*(2/m)*(Xb.T @ err)
        b -= lr*(2/m)*np.sum(err)
        loss_history.append(np.mean(err**2))   # ← 每个 batch 记一次

ax.plot(loss_history); ax.set_yscale('log')
```

这样画出完整曲线：**前 ~100 个 batch 从 10² 急速跌到 10⁻⁴（跨 6 个数量级），之后在 10⁻⁴ 附近噪声抖动**。抖动是小批量 GD 的正常现象（每 batch 只看 32 条，梯度方向有随机性，在最优解附近随机游走）。对数轴在此完全必要，否则前 100 个 batch 占满全图、后 1500 个被压平。

**结论：按 epoch 记录适合训练慢、epoch 多的情况；按 batch 记录适合想看收敛细节、或轮数少但数据量大的情况。**

### 6. ⚠️ 调试时连环踩的三个 bug（很有代表性）
复现训练时一张抖动剧烈、有竖线扎下去的怪图，病根有三处：

1. **MSE 漏了平方**：`full_loss = np.mean(X@w + b - y)` ❌，正确是 `np.mean((X@w + b - y)**2)`。漏平方算的是「残差均值」，残差有正有负互相抵消接近 0；对数轴上接近 0 的数跑向负无穷 → 看到垂直扎下去的竖线，且某些 epoch 正负恰好抵消多就「坠崖」。
2. **两个随机源用了同一种子**：`train_rng = default_rng(0)` 和 `data_rng = default_rng(0)` 种子相同。种子相同不代表同一对象（仍互相独立），但呼应 Day 5「造数据和打乱要用两个独立生成器」。
3. **权重初始化用错了生成器**：`w = data_rng.normal(...)` ❌，应该用 `train_rng`。用 data_rng 会「偷走」数据生成的随机状态，把数据源和训练源耦合在一起。

修正：种子不同（data 用 0、train 用 1）；`w = train_rng.normal(...)`；loss 补上 `**2`。

### 7. ⚠️ 想看到经典下降曲线的两个办法（要同时用）
收敛后只能看到底部 2% 的小幅震荡，看不到下降。想看「从高 loss 急速下降」要**同时**：

```python
w = train_rng.normal(scale=10.0, size=d)   # 故意把初始权重设差（scale 默认1，改大）
# 且 按 batch 记录（见 5），否则一个 epoch 内就降完了
```

只改其一无效——曾经只改 epochs=5 没改 scale，结果初始 loss 仍很小，没有下降过程可看。

---

## 五、散点图 scatter
线性回归里两大用途：看**预测值 vs 真实值**的吻合、看**残差分布**。

### 1. 基本用法
```python
ax.scatter(x, y,
    s=10,               # 点大小（面积），默认36，数据多时调小
    alpha=0.3,          # 透明度，数据密集时必须加，否则点全叠在一起
    color='steelblue',
    edgecolors='none',  # 去掉点边框，数据多时边框糊成一片
)
```

### 2. 最重要用途：预测值 vs 真实值
```python
y_pred = X @ w + b
fig, ax = plt.subplots(figsize=(6, 6))
ax.scatter(y, y_pred, s=5, alpha=0.2, color='steelblue', edgecolors='none')

y_min, y_max = y.min(), y.max()
ax.plot([y_min, y_max], [y_min, y_max], color='red', linestyle='--', label='完美预测线')
ax.set_xlabel('真实值'); ax.set_ylabel('预测值'); ax.legend()
```

读图：点越贴红色对角线 y=x，拟合越好；系统偏上/偏下说明有偏差；扇形散开说明某值域误差更大。

### 3. ⚠️ scatter vs plot('o') 的关键区别
```python
ax.plot(x, y, 'o')   # 本质是折线图，会按 x 顺序处理；只想要点要加 linestyle='none'
ax.scatter(x, y)      # 天生散点，不连线
```

`scatter` 独有价值：**每个点可有独立颜色和大小**，`plot('o')` 做不到。

```python
residuals = np.abs(y_pred - y)
ax.scatter(y, y_pred, s=5, c=residuals, cmap='Reds', alpha=0.5)   # 颜色映射残差大小
plt.colorbar(ax.collections[0], ax=ax, label='残差绝对值')
```

### 4. ⚠️ 陷阱题（已答对）：对角线用固定坐标看不见
```python
ax.plot([0, 1], [0, 1], color='red', linestyle='--')   # ❌
```

`[0,1]` 是固定坐标，而 y 值域可能是几到几十，对角线画在 0~1 范围根本不在散点区，看不见。必须动态取范围：`y_min, y_max = y.min(), y.max()`，画 `[y_min,y_max],[y_min,y_max]`。

---

## 六、直方图 hist（看残差分布是否近似正态）
### 1. 基本用法
```python
residuals = y_pred - y
ax.hist(residuals, bins=50, color='steelblue', edgecolor='none', alpha=0.7)
ax.set_xlabel('残差'); ax.set_ylabel('频数')
```

### 2. ⚠️ bins 的坑
`bins` 控制分成多少区间。太少（如 5）→ 全压进几个大格，看不出形状；太多（如 1000）→ 每格几个点，噪声淹没形状。

**实践规则**：几千到一万数据 `bins=50` 通常合适；十万以上可用 `bins=100`。或让 numpy 自动算：`ax.hist(residuals, bins='auto')`。

### 3. ⚠️ density=True 的真正含义（面试常考）
很多人以为 `density=True` 是「纵轴改成百分比」——**不是**。它把纵轴改成**概率密度**：柱高 = 频数 /（总数 × 组距）。

含义：**所有柱子的面积加起来 = 1**，于是能和概率密度函数（PDF）叠在同一张图比较。**纵轴值可以大于 1**，因为它是密度不是概率。

⚠️ 由此推出陷阱题答案：`density=True` 时 `ylabel` 写「概率」**错**，应写「**概率密度**」。记牢：**密度 × 组距 = 概率，密度本身不是概率**。只想看「每区间多少点」用默认 `density=False`（频数）即可。

### 4. 叠加理论正态曲线（逐句拆解）
```python
from scipy import stats
import numpy as np

ax.hist(residuals, bins=50, density=True, alpha=0.6, color='steelblue')

x_range = np.linspace(residuals.min(), residuals.max(), 200)  # 在残差范围内均匀取200个点（为画平滑曲线）
mu, sigma = residuals.mean(), residuals.std()                  # 正态由均值(中心)和标准差(胖瘦)完全决定
ax.plot(x_range, stats.norm.pdf(x_range, mu, sigma),           # 算每个x点上的正态密度值，连成钟形曲线
        color='red', linewidth=2, label=f'正态分布 μ={mu:.4f} σ={sigma:.4f}')
ax.legend()
```

逻辑：直方图画「实际残差分布」，红线画「理论上正态应有的样子」。**两者越接近 → 残差越符合正态 → 模型越健康。** 实测残差 μ≈0.0002（接近0）、σ≈0.0102，和造数据时加的噪声 0.01 完全吻合——模型把能学的都学到了，剩下的残差就是当初的噪声。

---

## 七、综合实战：1×3 完整可视化 + 收尾细节
### 1. legend 是什么（追问澄清）
`legend` = 图例，图上那个标注「线/点代表什么」的小框。**两步缺一不可**：

```python
ax.plot(x, y, label='训练 loss')   # 第一步：画线时加 label
ax.legend()                         # 第二步：调用 legend() 让标签显示
```

只写 label 不调 legend() → 不显示；只调 legend() 无 label → 空框。常用参数：`loc='best'`（默认，自动找空白处）、`fontsize`、`framealpha`（背景透明度）。

### 2. suptitle 与 tight_layout（追问澄清）
+ `plt.suptitle('总标题')` = super title，给**整张 fig** 加总标题（高于 `ax.set_title` 的单子图标题）。
+ `plt.tight_layout()` 自动调整子图间距防止标签/标题互相遮挡。但它不知道顶部有 suptitle，子图会排到最顶把总标题盖住。
+ `rect=[left, bottom, right, top]`（0~1 比例）告诉它子图只能排在这个矩形内：

```python
plt.suptitle('线性回归训练可视化', fontsize=14)
plt.tight_layout(rect=[0, 0, 1, 0.95])   # 顶部留 5% 给 suptitle
plt.show()
```

⚠️ **坑**：`tight_layout` 不要调用两次。第二次不带 rect 会把第一次留的空间撤销，总标题又被遮。只在 suptitle 之后调一次、带 rect。

### 3. 完整代码骨架（1×3）
```python
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
from scipy import stats

matplotlib.rcParams['font.family'] = 'Arial Unicode MS'
matplotlib.rcParams['axes.unicode_minus'] = False

data_rng  = np.random.default_rng(0)   # 只造数据
train_rng = np.random.default_rng(1)   # 只管初始化 + 打乱

n, d = 10000, 3
true_w = np.array([1.1, -3.3, 6.6]); true_b = 8.8
X = data_rng.normal(size=(n, d))
y = X @ true_w + true_b + data_rng.normal(0, 0.01, n)

w = train_rng.normal(scale=10.0, size=d); b = 0.0
lr, epochs, batch_size = 0.05, 5, 32
loss_history = []
for ep in range(epochs):
    perm = train_rng.permutation(n)
    for start in range(0, n, batch_size):
        idx = perm[start:start+batch_size]
        Xb, yb = X[idx], y[idx]; m = len(idx)
        err = Xb @ w + b - yb
        w -= lr*(2/m)*(Xb.T @ err)
        b -= lr*(2/m)*np.sum(err)
        loss_history.append(np.mean(err**2))   # 按 batch 记

y_pred = X @ w + b
residuals = y_pred - y

fig, axes = plt.subplots(1, 3, figsize=(15, 4))
axes = axes.flatten()

# 子图1：loss 曲线（对数轴）
ax = axes[0]
ax.plot(loss_history, color='steelblue', linewidth=0.8)
ax.set_yscale('log')
ax.set_xlabel('batch'); ax.set_ylabel('loss（log scale）')
ax.set_title('训练 loss 曲线'); ax.grid(True, alpha=0.3)

# 子图2：预测 vs 真实
ax = axes[1]
ax.scatter(y, y_pred, s=3, alpha=0.15, color='steelblue', edgecolors='none')
ymin, ymax = y.min(), y.max()
ax.plot([ymin, ymax], [ymin, ymax], color='red', linestyle='--', label='完美预测线')
ax.set_xlabel('真实值'); ax.set_ylabel('预测值')
ax.set_title('预测值 vs 真实值'); ax.legend()

# 子图3：残差直方图 + 正态曲线
ax = axes[2]
ax.hist(residuals, bins=50, density=True, alpha=0.6, color='steelblue', edgecolor='none')
xr = np.linspace(residuals.min(), residuals.max(), 200)
mu, sigma = residuals.mean(), residuals.std()
ax.plot(xr, stats.norm.pdf(xr, mu, sigma), color='red', linewidth=2,
        label=f'正态分布 μ={mu:.4f} σ={sigma:.4f}')
ax.set_xlabel('残差'); ax.set_ylabel('概率密度')
ax.set_title('残差分布'); ax.legend()

plt.suptitle('线性回归训练可视化', fontsize=14)
plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.show()
```

读图：左图 loss 干净收敛；中图散点与对角线几乎重合（拟合极好）；右图残差标准钟形、μ≈0、σ≈0.01（=噪声水平）。

---

## 八、练习收获：学习率对比实验
用**同一份数据**（X、y 只造一份），**两份 w 分开初始化**，分别用 lr=0.05 与 lr=0.5 训练，两条 loss 曲线画在同一个 ax。关键写法：

```python
data_rng = np.random.default_rng(0); train_rng = np.random.default_rng(1)
X = data_rng.normal(size=(n, d))
y = X @ true_w + true_b + data_rng.normal(0, 0.01, n)
w_small = train_rng.normal(scale=10.0, size=d)   # 两份 w 各初始化一次
w_big   = train_rng.normal(scale=10.0, size=d)
# 两个训练循环都读同一个 X[idx], y[idx]
```

### ⚠️ 观察结论（修正后的准确版）
最初以为「学习率大只是下降更快」，不准确。准确结论：

+ **学习率过大不一定发散**（线性回归是凸问题，需要 lr 大到一定程度才真正发散，可试 lr=5.0 看 loss 飙到 inf）。
+ 但 lr 过大会导致**收敛后震荡幅度更大、底部 loss 更高、无法精细收敛**——步子太大，每次更新越过最优点跳到对面再跳回，在最优解附近来回震荡。lr 小步子小，能稳稳停在底部。
+ 两条线起点高度不同（lr=0.5 起点更高）是因为两份 w 初始化消耗了 train_rng 的不同状态、初始权重不同，属正常现象，与学习率无关。

---

## 九、今天踩过 / 纠正过的坑（速查表）
| # | 坑 | 真相 | 防御 |
| --- | --- | --- | --- |
| 1 | `pip install`<br/> 装了没用 | 裸 pip 未必指向当前环境的 python，静默装到别处 | 用 `python -m pip install`<br/>；装完 `python -c "import x"`<br/> 验证 |
| 2 | `plt.*`<br/> 画到了错的地方 | 状态机靠隐藏「当前 ax」指针，subplots 后当前=最后创建的 ax | 非简单图一律用 OO（`fig, ax`<br/>），明确 `ax.xxx` |
| 3 | `plt.title`<br/> 加到右图 | gca() 是 ax2（最后创建） | 用 `ax1.set_title(...)` |
| 4 | OO 方法名 | 状态机 `plt.xlabel`<br/>，OO 要 `ax.set_xlabel`<br/>（加 set_） | title/xlabel/xlim/xticks 切 ax 都加 set_ |
| 5 | 中文显示成方块 | 默认字体无中文 | 设 `font.family='Arial Unicode MS'`<br/>，**写在 import pyplot 之前** |
| 6 | 负号变方块 | 设中文字体的连带问题 | `axes.unicode_minus=False` |
| 7 | subplots 返回值形状 | 1×1单对象 / 1行N列一维 / M×N二维，静默变 | 一律 `axes = axes.flatten()`<br/> 后用单下标 |
| 8 | `axes[i]`<br/> 取二维 | 取的是整行数组不是单个 ax，调 .plot 不报错也不画 | flatten 后再索引 |
| 9 | loss 曲线压成平线 | 跨多个数量级时线性轴看不出后期 | 差 >2 个数量级就 `ax.set_yscale('log')` |
| 10 | 循环里 plt.show() | 每轮弹新窗口、重画、内存涨 | show() 放循环外，先 append 再统一画 |
| 11 | 按 epoch 记看不到下降 | 一个 epoch 312 次更新，第一个记录点前已收敛 | 想看细节按 batch 记录 |
| 12 | MSE 漏平方 | `mean(err)`<br/> 残差正负抵消≈0，对数轴扎向负无穷成竖线 | 必须 `mean(err**2)` |
| 13 | 两随机源同种子 | 仍互相独立，但耦合隐患 | data 用 0、train 用 1，分开 |
| 14 | w 用 data_rng 初始化 | 偷走数据生成状态，数据源与训练源耦合 | 初始化用 train_rng |
| 15 | 只改 epochs 没改 scale | 初始 loss 仍很小，无下降过程 | 看下降要 scale=10 + 按 batch 记，两者同时 |
| 16 | `plot('o')`<br/> 当散点 | 本质折线图会按序处理；不能逐点上色 | 真散点 + 逐点颜色用 `scatter`<br/>(c=, cmap=) |
| 17 | 对角线 `[0,1],[0,1]` | 固定坐标不在散点值域，看不见 | 用 `y.min(), y.max()`<br/> 动态取 |
| 18 | bins 太少/太多 | 太少看不出形状，太多噪声淹没 | 几千~万用 50；或 `bins='auto'` |
| 19 | density 的纵轴写「概率」 | 是概率密度（可>1），面积和=1才是概率 | ylabel 写「概率密度」；密度×组距=概率 |
| 20 | x 整数轴出现小数刻度 | 点少时自动插刻度 | `ax.xaxis.set_major_locator(plt.MaxNLocator(integer=True))` |
| 21 | suptitle 被子图遮 | tight_layout 不知顶部有总标题 | suptitle 后调一次 `tight_layout(rect=[0,0,1,0.95])` |
| 22 | tight_layout 调两次 | 第二次无 rect 撤销了留白 | 只调一次、带 rect、放 suptitle 之后 |
| 23 | plot 省略横坐标 | 自动用 0,1,2… 下标 | x 非均匀（有跳跃/时间戳）必须显式传 |
| 24 | 学习率大=下降快？ | 凸问题未必发散，但震荡更大、底部更高、收敛更粗 | 区分「更快」与「更稳」；试 lr=5.0 看发散 |


---

## 十、可以自己再做的小实验
1. 把同一张图分别用 `set_yscale('log')` 和线性轴各画一次，直观感受对数轴对跨数量级数据的必要性。
2. 故意写 `fig, axes = plt.subplots(2, 2)` 后用 `axes[3]`，亲眼看报错；再 `flatten()` 后跑通。
3. 把 lr 调到 5.0 重跑，观察 loss 一路飙到 inf（真正发散），和 lr=0.5 的「震荡但不发散」对比。
4. 残差直方图分别用 `bins=5`、`bins=50`、`bins=1000`，看 bin 数对分布形状的影响。
5. 把 `scatter` 换成 `plot(y, y_pred, 'o')` 不加 `linestyle='none'`，观察被按序连线的怪图，理解 scatter 与 plot 的本质区别。
6. 残差直方图加 `density=True` 后读纵轴最大值，确认它大于 1（密度不是概率）。

---

## 衔接 Day 7
明天 Day 7（PyTorch 基础）会把今天手写的线性回归用 PyTorch 重写，届时 `autograd` 会自动算出 Day 5 手推的那个梯度——手推过一遍，就不会把它当黑盒。今天的 loss 曲线 / 预测散点 / 残差直方图三件套，到时候可以直接复用来可视化 PyTorch 版的训练过程。
