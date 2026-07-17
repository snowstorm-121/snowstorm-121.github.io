学习目标：AI 方向求职

参考书：NumPy 官方文档，PyTorch 官方文档（Tensor 与 autograd）

本阶段重点：这是从 NumPy 手写实现到 PyTorch 框架自动化的过渡日；补齐数学直觉、工程直觉和框架机制三层理解，为 Stage1 的 Tensor 与 Autograd 学习做准备。

今天主线：维度记账法、矩阵求导最低限度认知、NumPy 的 view/copy 与 dtype、Day 9 现象复盘，以及 Tensor/autograd 预习。

---

从「手推梯度」到「框架自动化」的分界线。NumPy 手写实现期的收尾，与 PyTorch Tensor / autograd 的第一次正式预习。把数学直觉、工程直觉、框架机制三层补齐，让 Day 11 不陌生。

**标签**：维度记账法 · view/copy · dtype 默认值 · 内存共享 · autograd · 计算图 · 实战调试×6坑

关联笔记：前置 [[Day 9 学习笔记：Titanic 综合实战 —— 完整数据分析项目|Titanic 综合实战]]；衔接 [[Stage1/Day 1 学习笔记：Tensor基本操作|Tensor 基本操作]] 和 [[Stage1/Day 2 学习笔记：PyTorch Autograd 自动微分基础|Autograd 自动微分]]。

---

## 目录
1. [今日总览（五阶段路径）](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#0-%E4%BB%8A%E6%97%A5%E6%80%BB%E8%A7%88)
2. [维度记账法：标量推导 → 矩阵形式](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#1-%E7%BB%B4%E5%BA%A6%E8%AE%B0%E8%B4%A6%E6%B3%95)
3. [矩阵求导最低限度认知](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#2-%E7%9F%A9%E9%98%B5%E6%B1%82%E5%AF%BC%E6%9C%80%E4%BD%8E%E9%99%90%E5%BA%A6%E8%AE%A4%E7%9F%A5)
4. [NumPy view / copy 系统梳理](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#3-numpy-viewcopy-%E7%B3%BB%E7%BB%9F%E6%A2%B3%E7%90%86)
5. [Day9 现象复盘：权重收敛 ≠ 预测稳定](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#4-day9-%E7%8E%B0%E8%B1%A1%E5%A4%8D%E7%9B%98)
6. [PyTorch Tensor vs NumPy](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#5-pytorch-tensor-vs-numpy)
7. [autograd 完整运行机制](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#6-autograd-%E5%AE%8C%E6%95%B4%E8%BF%90%E8%A1%8C%E6%9C%BA%E5%88%B6)
8. [练习3 调试历程：六个坑](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#7-%E7%BB%83%E4%B9%A03-%E8%B0%83%E8%AF%95%E5%8E%86%E7%A8%8B%E5%85%AD%E4%B8%AA%E5%9D%91)
9. [附录：踩坑表 · 问题清单 · 速查卡](https://claude.ai/chat/e248426a-2b6e-4f09-bbb7-6d1114e9da83#8-%E9%99%84%E5%BD%95)

---

## 0. 今日总览
今天难度低于 Day9，定位是"过渡 / 查漏补缺"，但因为要承接下周正式进 PyTorch，重点落在 Tensor vs NumPy 与 autograd 上。整条路径是层层递进的：

```plain
┌─────────────────────┐
                              │       Day 10         │
                              │   过渡 / 查漏补缺      │
                              └──────────┬───────────┘
                ┌─────────────────────────┼─────────────────────────┐
                │                         │                         │
        ① 维度记账法                ③ view / copy            ⑤ Tensor vs NumPy ★
        标量推导→矩阵形式            stride机制/静默坑          dtype/内存/autograd
        数学翻译能力                 工程直觉                  下周铺垫核心
                │                         │                         │
        ② 矩阵求导认知              ④ Day9现象复盘             练习3 · 串联五阶段
        布局约定/常用公式            收敛≠预测稳定              手动梯度 vs autograd
        知识缺口·低优先              应用到旧项目               allclose交叉验证
```

<!-- 这是一张图片，ocr 内容为：@DAY9现象复盘 维度记账法 收敛预测稳定 标量推导矩阵形式 应用到旧项目 数学翻译能力 矩阵求导认知 TENSOR VS NUMPY 布局约定/常用公式 DTYPE/内存/AUTOGRAD 知识缺口低优先 DAY 10 下周铺垫核心 过渡/查漏补缺 VIEW/COPY 练习3串联五阶段 STRIDE机制/静默坑 手动梯度VS AUTOGRAD 工程直觉 ALLCLOSE交叉验证 递进逻辑:补数学(D@)+补工程直觉(@),应用到已有项目(@),过渡新工具(G),练习收尾 关键发现:数学一直是对的,所有BUG都出在"框架机制/代码翻译"这一层 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781955902034-af81b68a-7dad-4163-85dd-b8152a39a4fc.png)

**递进逻辑**：补数学（①②） → 补工程直觉（③） → 应用到已有项目（④） → 过渡新工具（⑤） → 练习收尾

**关键发现**：数学一直是对的，所有 bug 都出在"框架机制 / 代码翻译"这一层。

---

## 1. 维度记账法
Stage 1 · 数学翻译能力

### 问题定位
**数学能力 ≠ 翻译能力。** 考研数学练的是"链式法则怎么展开"（纯符号推导），但代码里 `X` 的 shape 是 `(n,d)` 还是 `(d,n)` 会直接决定程序对不对。数学好的人到写代码时卡住，往往不是不会推，而是推导中"维度记账"这一步在纸面上被跳过了，到代码里跳不过去。

### 核心规则：只有一条硬规则
维度记账法不靠背"矩阵求导公式表"，只靠一条事实：

**在分母布局约定下，对标量损失 L 求关于参数的导数，梯度的 shape 必然等于参数本身的 shape。** 即 `∂L/∂w` 的形状 = `w` 的形状。

有了这条，转置该放左边还是右边、要不要转置，全部能被"维度必须对得上"反推出来，不需要查公式。

### 三步打包法（通用流程）
```plain
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ① 标量层面推完     │ --> │ ② 识别求和=矩阵乘  │ --> │ ③ 维度反推转置     │
│ 单样本用链式法则   │     │ 看到Σ(标量ᵢ·向量ᵢ) │     │ 目标shape=参数shape│
│ 推到化简干净       │     │ 就是一次矩阵乘法   │     │ 唯一能凑出的组合   │
│ → 你的强项(考研)  │     │ → 关键模式识别     │     │ → 转置自动确定     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

<!-- 这是一张图片，ocr 内容为：2 标量层面推完 识别求和矩阵乘 维度反推转置 1 3 单样本用链式法则 看到(标量向量) 目标SHAPE参数SHAPE 推到化简干净 唯一能凑出的组合 就是一次矩阵乘法 你的强项(考研) 关键模式识别 转置自动确定 这套流程对任意新模型通用:SOFTMAX回归,全连接层,卷积层都是同一套 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781955924311-b9fb8d4d-046e-4e63-9154-c732f4d68941.png)

这套流程对任意新模型通用：softmax 回归、全连接层、卷积层都是同一套。

### 实例：线性回归
设 `X:(n,d)`，`w:(d,1)`，`y:(n,1)`，预测 `ŷ=Xw:(n,1)`，误差 `error=ŷ-y:(n,1)`。求 `∂L/∂w`，已知结果必须是 `(d,1)`。

候选组合里：`X @ error` 是 `(n,d)·(n,1)` 维度不匹配；`X.T @ error` 是 `(d,n)·(n,1)=(d,1)` ✓。**答案被维度唯一确定，不需查表。**

```plain
∂L/∂w = (1/n) · Xᵗ(ŷ − y)
```

### 实例：逻辑回归（结果几乎一样）
单样本交叉熵对 ŷ 求导，乘上 sigmoid 的导数 σ'=σ(1−σ)，大量项消掉后化简为：

```plain
∂ℓᵢ/∂w = (ŷᵢ − yᵢ) · xᵢ   ⟹   ∂L/∂w = (1/n) · Xᵗ(ŷ − y)
```

**面试常考点**：逻辑回归"误差×输入"这种干净形式**不是巧合**，是 sigmoid + 交叉熵这个组合刻意设计的结果。_为什么逻辑回归用交叉熵而不用均方误差？_ 一部分原因正是交叉熵能让梯度化简成这种形式，而均方误差配 sigmoid 会产生梯度饱和（梯度消失）问题。

**面试话术（重要）**：被追问"为什么这里要转置"，**标准答案不是"公式就是这样写的"**，而是："因为 `∂L/∂w` 的 shape 必须和 `w` 一致是 `(d,1)`，而 error 是 `(n,1)`，只有 `X.T @ error` 才能凑出 `(d,1)`，所以转置位置是被维度反推出来的，不是记下来的。"——这个回答体现的是理解，不是背诵。

---

## 2. 矩阵求导最低限度认知
Stage 2 · 知识缺口（低优先）

**Q：维度记账法是不是"矩阵求导的替代品"？****A：** 不是。维度记账法是**验证 / 反推工具**，用在"已会标量推导、只想知道矩阵形式怎么写"的场景。真正的矩阵求导是一套独立体系（矩阵对矩阵求导的定义、矩阵微分/trace 技巧、布局约定）。结论：**完整体系先记为"已知的知识缺口"，优先级放低**——因为深度学习里绝大多数手推梯度场景（线性/逻辑/softmax 回归）维度记账法就够用，而更复杂的推导有 autograd 兜底。未来论文/面试真需要时再针对性补（基础好的话半天到一天）。

### 布局约定：为什么会有"转置方向"的争议
对标量 L 求关于 d 维向量 w 的导数，结果是列向量还是行向量，**纯粹是约定**，没有对错：

| 布局 | 规则 | 备注 |
| --- | --- | --- |
| **分母布局**（denominator） | 结果 shape 跟着分母 `w`<br/> 走，`w`<br/>是`(d,1)`<br/> → `∂L/∂w`<br/>也是`(d,1)` | ★ 机器学习几乎统一用这套，`w = w − lr·grad`<br/> 天然对齐 |
| **分子布局**（numerator） | 结果 shape 跟着分子走 | 常见于纯数学/统计教材，与分母布局差一个转置 |


**一句话记住**：深度学习默认用**分母布局**，所以结果 shape 永远跟参数 shape 一致——这正是维度记账法好用的原因：这个领域恰好统一选了让维度记账最方便的约定。不同资料公式偶有转置差异，多半是布局不同，不是谁错了。

### 几个会反复遇到的公式（知道长什么样即可）
设 x 是 `(d,1)`，A 是 `(d,d)`，a 是常向量：

| 表达式 | 对 x 的导数 | 直觉（标量类比） |
| --- | --- | --- |
| aᵗx | a | 类似 d(ax)/dx = a |
| xᵗAx（二次型） | (A+Aᵗ)x；A对称则 2Ax | 类似 d(ax²)/dx = 2ax ★最常用 |
| ‖x‖² = xᵗx | 2x | 上式 A=I 的特例 |


**活用验证**：L2 正则化项 λ‖w‖² 对 w 求导 = **2λw**。这不是"背公式"，是套用 ‖x‖²→2x 这条规则替换变量名。**建立少量核心规则，剩下靠替换组合**——这才是矩阵求导该用的方式，而不是每种损失背一条。

trace 技巧（tr(AᵗB)=ΣᵢⱼAᵢⱼBᵢⱼ）用于对矩阵本身求导的复杂场景，目前用不到，知道关键词以后能查到即可。

---

## 3. NumPy view/copy 系统梳理
Stage 3 · 工程直觉

### 为什么这个状态危险
"知道有区别但不确定哪些操作触发"——这很危险，因为**view/copy 出错不会报错，它会静默产生错误结果**。比如你以为切片后修改不影响原数组，结果原数组被悄悄改了，调试极痛苦（没有异常堆栈可追）。

### 根本原理：stride 描述符
NumPy 数组对象只是"指向一块连续内存的描述符"：包含**数据指针、shape、dtype、stride**（每个维度跨一步要走多少字节）。

**唯一的判断原理**：某操作能否**仅通过修改 stride/shape 描述符**完成、而不需要重排底层数据？**能 → view**（共享内存，新建描述符）；**不能 → copy**（开新内存，搬数据）。遇到没见过的操作，反过来问这一句即可。

### 判断决策树
```plain
┌───────────────────────┐
                    │     一个数组操作         │
                    │  能只改 stride 完成吗？   │
                    └───────────┬───────────┘
                  能 ↙                       ↘ 不能
       ┌──────────────────────┐    ┌──────────────────────┐
       │   VIEW · 共享内存      │    │   COPY · 独立内存      │
       └──────────────────────┘    └──────────────────────┘
       必然/通常是 VIEW：              必然是 COPY：
       · 基本切片 a[2:7]               · 花式索引 a[[1,3,5]]
       · 转置 a.T（永远 view）          · 布尔索引 a[mask]
       · reshape（连续数组上）          · 运算符 a+1, a*2
       · 整数索引取整行/列 a[1,:]        · concatenate/stack/where
       · 链式切片（view 的 view）       · reshape 在不连续数组上 ⚠
```

<!-- 这是一张图片，ocr 内容为：一个数组操作 能只改STRIDE完成吗? 不能 VIEW.共享内存 COPY独立内存 必然/通常是VIEW 必然是COPY .花式索引A[[1,3,51] 基本切片 A[2:7] 转置AT(永远VIEW) 布尔索引A[MASK] 运算符A+1,A*2 RESHAPE连续数组上 整数索引取整行/列A[1,:] CONCATENATE/STACK/WHERE 链式切片(VIEW的VIEW) RESHAPE在不连续数组上 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781955971086-61d869b5-503f-4231-9935-44536ef5794e.png)

### stride 图解：转置为什么永远是 view
实测 `a=np.arange(12).reshape(3,4)` 的 `strides=(32,8)`，转置后 `a.T` 的 `strides=(8,32)`——**底层内存一个字节都没动，只是把 stride 两个数字顺序换了一下**。

```plain
底层内存（一维连续，从头到尾不变）：
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ 9  │ 10 │ 11 │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  每格 8 字节 (int64)

a 用 strides=(32,8) 读 → shape(3,4)：
  行0: 0 1 2 3    行1: 4 5 6 7    行2: 8 9 10 11
  沿行跳32字节(=4个数=一整行)，沿列跳8字节(=1个数)

a.T 用 strides=(8,32) 读 → shape(4,3) · 同一块内存：
  行0: 0 4 8    行1: 1 5 9    行2: 2 6 10    行3: 3 7 11
  只是把两个 stride 数字对调 → 必然 view · C_CONTIGUOUS 变 False
```

<!-- 这是一张图片，ocr 内容为：底层内存(一维连续,从头到尾不变) 7 9 3 5 6 10 11 8 4 地址每格8字节(INT64) A用STRIDES(32,8)读 > SHAPE(3,4) 行0:0123 行1:4567 行2:891011 沿行跳32字节(4个数一整行),沿列跳8字节(1个数) A.T用STRIDES(8,32)读>SHAPE(4,3).同一块内存 行0:048行1:159行2:2610行3:3711 只是把两个 STRIDE数字对调>必然VIEW.C.C.CONTIGUOUS 变FALSE -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781955986404-fce13b5f-ba17-45bd-99c2-0f2a3b6b6771.png)

### stride 图解：reshape 为什么分裂成两种行为（最阴险的坑）
```plain
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ 情况A · a.reshape(12)         │      │ 情况B · a.T.reshape(12)       │
│ a本身连续(C_CONTIGUOUS=True)   │      │ a.T 不连续（转置过）            │
│                               │      │                               │
│ 底层顺序: 0 1 2 ... 11        │      │ 底层顺序: 0 1 2 ... 11         │
│ 期望顺序: 0 1 2 ... 11        │      │ 期望顺序: 0 4 8 1 5 9 ...      │
│                               │      │                               │
│ 两者一致 → 只改stride → VIEW ✓│      │ 对不上 → 必须搬数据 → COPY ⚠  │
│ 不挪数据                      │      │ NumPy 不报错、不警告！          │
└─────────────────────────────┘      └─────────────────────────────┘
```

<!-- 这是一张图片，ocr 内容为：情况A.RESHAPE(12) 情况B.A.T.RESHAPE(12) A.T不连续(转置过) A本身连续(C_CONTIGUOUSTRUE) 底层顺序:012...11 底层顺序:012...11 期望顺序:048159... 期望顺序:012..11 两者一致一只改STRIDEW COPY 公 对不上必须搬数据 NUMPY不报错,不警告! 不挪数据 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956001298-df1407db-14df-495f-aa5c-ca91e698f085.png)

**静默坑·务必记住**：`X.T.reshape(...)` 之后期望"修改 reshape 结果能影响原数组 X"——**程序不报任何错，只是悄悄没有按你以为的方式工作**。预判技巧：reshape 前先查 `arr.flags['C_CONTIGUOUS']`，能提前知道这次会不会 copy。

### 坑：.base 属性已不可靠（实测结论）
**写进笔记的结论**：实测发现：转置、整数索引取行等操作，`np.shares_memory(a,b)` 为 **True**（确实共享），但 `b.base is a` 却是 **False**（NumPy 内部经过中间对象包装，`.base` 链条不直接指向原数组）。**判断是否 view/copy 只能用 np.shares_memory()，不要用 .base is 来判断**。`.base` 更适合追溯"谁是最初所有者"，但不是 view 判断的可靠依据。

### 该养成的判断习惯（比复查代码更重要）
任何时候写下"就地修改"操作（`+=``-=``arr[mask]=x``arr[:]=x`），花半秒问自己：**"arr 是不是某个更早数组的切片/转置/reshape 出来的？这次修改会不会波及我没想动的原始数据？"** 反之，纯用运算符（`+ - * where concatenate`）产生新数组赋给新变量名，基本不用担心，因为这些本身就是 copy。

---

## 4. Day9 现象复盘
Stage 4 · 应用到旧项目：权重收敛 ≠ 预测稳定

### 现象（看似矛盾，实则不矛盾）
训练逻辑回归（种子固定、确定性训练）：1000 轮时 loss 看起来平稳就停了，权重和库函数差很大；加到 5000 轮，权重才和库函数接近。**但 1000 轮和 5000 轮的测试准确率完全一样。**

### loss 长尾曲线（第一层原因）
实测记录：`epoch0: 0.6929 → 1000: 0.4324 → 2000: 0.4250 → 3000: 0.4205 → 4000: 0.4174`。第一个 1000 轮暴降 0.26，之后每 1000 轮只降 0.003~0.007。

```plain
loss
0.69 ●
      ╲
       ╲___ 陡降区 (−0.26)
0.43       ●━━╮ ←停在这
              ╰━━╮___________ 长尾平台期
0.41                ●────●────●
                    2000  3000 4000          epoch →

长尾平台期原理：越接近最优点，梯度(=error)越小，
步长越小，权重移动越慢但仍在漂移
```

<!-- 这是一张图片，ocr 内容为：LOSS 0.69 0.69 长尾平台期 越接近最优点,梯度(ERROR)越小, 陡降 步长越小,权重移动越慢但仍在漂移 -0.26 0.43 停在这 0.43 041 EPOCH -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956028108-b1fd1b90-cb88-4c6f-97a3-d8816bd705b8.png)

**"变化不大"是相对绝对数值看起来不大，不代表权重已到最优点附近。** loss 从 0.43 降到 0.42 看着只差 0.01，给人快收敛的错觉，但后面还要走很长平台期才能逼近最优权重。

### 决策边界 vs 概率校准（第二层 · 核心）
```plain
┌───────────────────────────────┐    ┌───────────────────────────────┐
│ 准确率只关心：边界方向            │    │ 后4000轮在调：置信度             │
│ sigmoid(z)>0.5 两侧分对多少      │    │                               │
│                               │    │ 概率值 0.7 → 慢慢推向 0.95       │
│   ●  ●         ┆    ○  ○      │    │ = "我对这个判断有多自信"          │
│      ●  边界 ┄┄┄┆  ○    ○     │    │ 而不是"调整判断本身"             │
│                               │    │                               │
│ 只要落对一侧                   │    │ 准确率对置信度不敏感 ⟹           │
│ 准确率不变                     │    │ 权重数值差异大，准确率纹丝不动    │
└───────────────────────────────┘    └───────────────────────────────┘
```

<!-- 这是一张图片，ocr 内容为：后4000轮在调:置信度 准确率只关心:边界方向 概率值0.7慢慢推向0.95 SIGMOID(Z)>0.5两侧分对多少 三"我对这个判断有多自信" 而不是"调整判断本身" 只要落对一侧 准确率对置信度不敏感 准确率不变 权重数值差异大,准确率纹丝不动 边界 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956042946-e98b04a8-f01a-46a0-9e57-88c1d6777900.png)

**精确化的面试说法（重要）**：别说"权重收敛但预测不稳定"（听起来像模型有问题）。该说：_分类准确率这个指标对权重是否真正收敛到最优点不敏感——只要决策边界方向正确，准确率就会提前饱和；但若后续要做概率校准（如风控看具体违约概率数值），或要部署后继续微调，没充分收敛的权重就会暴露问题。_

**实践启示·早停判断标准**：判断"是否该停止训练"**别只看 loss 绝对数值的变化幅度**。可以看 loss 下降的相对比例，或直接监控权重变化量 `np.linalg.norm(w_new - w_old)` 是否小于阈值——这比单看 loss 曲线更能反映权重是否真稳定。下周 PyTorch 的 early stopping 背后逻辑类似。

---

## 5. PyTorch Tensor vs NumPy
Stage 5 · 下周铺垫核心 ★

### 创建方式：表面镜像，暗藏 dtype 陷阱
PyTorch 创建 API 几乎是 NumPy 的镜像（刻意设计以降低迁移成本），看似可无脑把 `np.` 换 `torch.`，但默认 dtype 不一致。

| NumPy | PyTorch | 备注 |
| --- | --- | --- |
| `np.array([1,2,3])` | `torch.tensor([1,2,3])` | 都从 list 创建 |
| `np.zeros((3,4))` | `torch.zeros((3,4))` | 同名同参 |
| `np.random.randn(3,4)` | `torch.randn(3,4)` | torch 不需 `.random.`<br/> 前缀 |


### dtype 默认值差异：两套独立规则（最易踩）
实测验证，必须分清这是**两套不同的规则**，不能混为一谈：

```plain
┌────────────────────────────┐    ┌────────────────────────────┐
│ 规则A · 从头创建               │    │ 规则B · 从已有 NumPy 转       │
│ 用PyTorch自己的偏好→float32   │    │ 尊重原数据dtype(保留,不转换)  │
│                            │    │                            │
│ torch.tensor([1.0,2.0])    │    │ from_numpy(f64数组)         │
│   → float32                │    │   → float64                │
│ torch.zeros((2,2))         │    │ tensor(f64数组)             │
│   → float32                │    │   → float64                │
└────────────────────────────┘    └────────────────────────────┘

对比哲学：NumPy 默认 float64（科学计算追求精度）
        PyTorch 默认 float32（深度学习省一半内存/显存，精度够用）

∴ "PyTorch默认float32"只在规则A成立；数据来自外部转换时按规则B，必须显式检查
```

<!-- 这是一张图片，ocr 内容为：规则B从已有NUMPY转 规则A?从头创建 尊重原数据DTYPE(保留,不转换) 用PYTORCH自己的偏好 FLOAT32 TORCH.TENSOR([1.0,2.0]) + FLOAT32 FROM_NUMPY(F64数组) - FLOAT64 TORCH.ZEROS((2,2)) > FLOAT32 FLOAT64 TENSOR(F64数组) 对比哲学:NUMPY默认FLOAT64(科学计算追求精度).PYTORCH影认FLOAT32(深度学习省一半内存(显存,精度够用) :."PYTORCH默认FLOAT32"只在规则A成立;数据来自外部转换时按规则B,必须显式检查 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956064269-db9bc0e9-c650-4bde-ae50-2644904e73e4.png)

**Q：为什么 **`**torch.tensor(a)**`**（a 是 numpy float64）打印出来是 float64，不是默认的 float32？****A：** 因为这是**从已有的 numpy 数组创建**（规则B），数据类型直接用 numpy 原来的 dtype。只有"直接从 Python list 创建"（规则A）才用 PyTorch 自己的 float32 偏好。**创建来源决定默认行为**——这条规则吃透了，就不会被表面的"PyTorch 默认 float32"误导。

**实践准则·下周直接用**：任何时候用 `torch.from_numpy()` / `torch.tensor(numpy_array)` 把数据从 NumPy 喂进 PyTorch（写数据加载、特征处理时几乎必然发生，因 pandas/sklearn 全基于 NumPy），**写完这行紧接着显式 **`**.float()**`** 或创建时指定 **`**dtype=torch.float32**`。低成本高回报，别依赖"应该是对的"。

### 内存共享：from_numpy vs tensor 的两套契约（教程常漏）
```plain
torch.from_numpy() / .numpy() → 零拷贝·共享内存
┌──────────────┐      ┌──────────────┐
│  numpy 数组   │ ←──→ │    Tensor     │   改一边，另一边跟着变
│   (外壳1)     │ 同一块内存│   (外壳2)     │   from_X 命名 = 零拷贝信号
└──────────────┘      └──────────────┘

torch.tensor(numpy_array) → copy·独立内存
┌──────────────┐          ┌──────────────┐
│  numpy 数组   │  复制数据  │    Tensor     │   互不影响
│   [内存A]     │ ─ ─ ─ ─→ │   [内存B]     │
└──────────────┘          └──────────────┘
```

<!-- 这是一张图片，ocr 内容为：TORCH.FROM_NUMPY()/.NUMPY()零拷贝.共享内存 改一边,另一边跟着变 NUMPY 数组 TENSOR 同一块内存 FROM_X命名零拷贝信号 外壳1 外壳2 TORCH.TENSOR(NUMPY_ARRAY)>COPY_独立内存 NUMPY 数组 TENSOR 复制数据 互不影响 内存A 内存B -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956087362-e4df545e-f7ea-49ff-9abd-dbcf62d22756.png)

| 转换方式 | dtype（源 float64） | 是否共享内存 | 语义契约 |
| --- | --- | --- | --- |
| `torch.from_numpy(a)` | float64（保留） | ✅ 共享 view | 零拷贝 |
| `torch.tensor(a)` | float64（保留） | ❌ copy 独立 | 创建新对象 |
| `torch.tensor(a, dtype=float32)` | float32（强制转） | ❌ copy 独立 | 创建+转换 |


**读 API 文档的习惯**：看到 `from_X` 命名模式 → 通常暗示"零拷贝转换"（共享）；看到直接用类型名作构造函数（`tensor()``Tensor()`）→ 通常暗示"创建新对象"（copy）。**真实影响**：用 `from_numpy(df.values)` 喂模型，Tensor 可能和原 DataFrame 底层数据连着同一块内存，后续对 DataFrame 就地修改可能意外污染已喂入的数据。

### device 概念（NumPy 没有）
PyTorch Tensor 有 CPU / GPU 两种存放位置。在 M5 芯片上对应 `cpu` 和 `mps`（Metal Performance Shaders，Apple GPU 加速后端）。NumPy 数组永远只在 CPU 内存。细节等下周真正训练、感受速度差异时展开。

---

## 6. autograd 完整运行机制
Stage 6 · 核心新概念

### autograd 解决什么问题
Day9 你手推整条链：sigmoid → 交叉熵 → 手推 `X.T@error/n` → 手动更新。NumPy 完全不懂"梯度"，算完就忘了结果怎么来的。**autograd 让 Tensor 从"一堆数字"变成"数字 + 一张记录了它怎么算出来的计算图"**，把阶段一那种"维度记账、链式展开"的脑力劳动彻底交给框架。

### 动态计算图 + backward 反向传播
```plain
前向 forward （代码执行到哪，图就长到哪）：

  w,b ────┐
(requires_grad=True)  ┌──────────┐    ┌──────────┐    ┌────────┐
          ├──────────→│ z = Xw+b │───→│  ŷ=σ(z)  │───→│  loss  │
  X,y ────┘           │ grad_fn  │    │ grad_fn  │    │ (标量) │
                       └──────────┘    └──────────┘    └────────┘

反向 loss.backward() （沿图自动应用链式法则）：

  loss ─────────────────────────────────────────→ w,b
       ←┄┄┄┄┄┄┄┄┄┄┄ ∂L/∂ŷ · ∂ŷ/∂z · ∂z/∂w ┄┄┄┄┄┄┄┄┄
       从 loss 出发

  ┌──────────────────────────────┐  ┌──────────────────────────┐
  │ 只对 requires_grad=True 的源头 │  │ X,y 在图里但requires_grad= │
  │ 梯度写入 w.grad/b.grad（累加!) │  │ False，不生成.grad,不浪费算力│
  └──────────────────────────────┘  └──────────────────────────┘
```

<!-- 这是一张图片，ocr 内容为：(代码执行到哪,图就长到哪) 前向 FORWARD W,B REQUIRES_GRAD-TRUE YO(Z) LOSS Z 三 XW+B 标量(0维) GRAD_FN GRAD_FN X,Y 反向 LOSS.BACKWARD() (沿图自动应用链式法则) ME/ZE ZE/LE TE/7E 从LOSS出发 只对REQUIRES_GRADTRUE的源头 X,Y 在图里但REQUIRES_GRADFALSE 不生成.GRAD,不浪费算力 梯度写入W.GRAD (累加!) / B.GRAD "动态":不预定义整图,执行到哪建到哪(区别于 TF 早期静态图) GRAD_FN 从 NONE(叶子W)>MULBACKWARD-POWBACKWARD,就是图被搭起来的实时证据 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956105091-52ee2101-04a3-40f7-b8d7-48b4e8c0f7ac.png)

"动态" = 不预定义整图，执行到哪建到哪（区别于 TF 早期静态图） `grad_fn` 从 None(叶子w) → MulBackward → PowBackward，就是图被搭起来的实时证据

**Q：既然是"手动实现"逻辑回归，为什么还要用 autograd？不该手动算梯度吗？****A：** 关键区分不是"手动 vs 自动"，而是**用不用高层模块（nn.Module / nn.Linear / optim）**。今天练的是中间过渡形态：**前向计算（z、sigmoid、loss）依然全手写（和 Day9 一样），只有梯度这步改用 loss.backward() 让 autograd 自动算**，参数更新仍手写。目的是直观对比"我用矩阵公式推的梯度"和"autograd 自动算的梯度"是否数值一致，交叉验证 Day9 的数学。三个层次：① Day9 全手动（不用 autograd）→ ② 今天（手写前向 + autograd + 手动更新）→ ③ 下周 nn.Module 全自动。

### requires_grad 默认值设计权衡（面试加分）
```plain
┌────────────────────────────────┐    ┌────────────────────────────────┐
│ PyTorch requires_grad            │    │ NumPy view/copy（方向相反）       │
│ 默认 False（不追踪梯度）          │    │ 默认尽量 view（共享内存）          │
│ 只对要优化的参数(w,b)手动/自动开  │    │ 只有必须重排数据时才copy          │
│ 因追踪图开销大(存图+存中间结果)   │    │ 因拷贝开销大，默认偏"省着来"      │
│                                  │    │                                  │
│ 你会问"∂L/∂w"，不会问"∂L/∂X"      │    │ 统一哲学：让"开销大的行为"成为     │
│ ∴ w要开，数据X不开                │    │ 显式选择，而非默认行为             │
└────────────────────────────────┘    └────────────────────────────────┘
```

<!-- 这是一张图片，ocr 内容为：NUMPYVIEW/COPY(方向相反) PYTORCH REQUIRES_GRAD 默认FALSE(不追踪梯度) 默认尽量VIEW(共享内存) 只对要优化的参数(W.B)手动/自动开 只有必须重排数据时才 COPY 因追踪图开销大(存图+存中间结果) 因拷贝开销大,默认偏"省着来" 你会问"AL/AW",不会问"AL/AX" 统一哲学:让"开销大的行为"成为 显式选择,而非默认行为 .W要开,数据X不开 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956137768-376f2a10-602c-4452-99d1-7db458346a3d.png)

**我答错过的点（记录）**：被问"自己实现 PyTorch 逻辑回归，w、b 该怎么写才能让 autograd 自动算梯度"时，**我答了 **`**requires_grad=False**`**，正好答反了**。正解：需要被优化、需要 autograd 算梯度的对象（w、b）**必须 requires_grad=True**；数据 X、y 保持默认 False。**记忆钩子：requires_grad=True 翻译成人话 = "请帮我记住它怎么参与运算，因为我之后要问它的梯度"。**

### 五个必知机制细节（都是踩过的坑）
1. `**.grad**`** 是累加不是覆盖**。每次 `backward()` 新梯度_加到_已有 .grad 上。∴ 训练循环每轮开始前必须 `w.grad.zero_()`（或优化器的 `zero_grad()`）。不清零 → 梯度越滚越大且不报错（又一静默错误）。
2. **图在 backward() 后默认释放**（省内存）。∴ 同一张图默认不能 backward 两次（除非 `retain_graph=True`）。
3. **参数更新必须在 **`**torch.no_grad()**`** 里**。更新动作（w=w−lr·grad）不该被记进图，否则图无限累积、第二轮报错。
4. **只有标量能直接 .backward() 不带参数**。loss 必须是单一数值（0维 Tensor），反向传播起点定义为"从这一个数往回传"。
5. **no_grad() vs detach()**。`no_grad()` 是上下文管理器，让整块代码都不记图；`.detach()` 针对单个 Tensor，摘下来给一份"数值同但不追踪"的新 Tensor。一个"这片别记"，一个"这个变量别连图"。

**Q：为什么"参数更新"要排除在计算图之外？****A：** 若不排除（直接 `w = w - w.grad*lr`），这个减法会被记成图的新节点，PyTorch 会认为"新 w 由旧 w 和 grad 通过减法得来，将来还要往回追溯旧 w"。**但这不是想要的语义**——梯度下降更新是"用当前数值覆盖参数"的纯赋值，不该被当成模型计算的一部分被未来反向传播追溯。不加 no_grad，图会一轮轮无限累积（每轮新 w 都挂着上一轮历史），浪费内存且第二次 backward 报错（默认每次 backward 后释放图，而图已跨多轮越滚越大）。

---

## 7. 练习3 调试历程：六个坑
Stage 7 · 精华 · 串联五阶段

### 任务
用 PyTorch 实现 Day9 逻辑回归的梯度计算，**用两种方式各算一遍并对比**：① 手动按公式 `X.T@(ŷ-y)/n` 用 Tensor 运算；② `requires_grad=True` + `loss.backward()` 让 autograd 自动算。最后用 `torch.allclose()` 验证两者数值一致——这能交叉验证 Day9 数学推导是否正确。

### 六个坑的调试时间线
```plain
①┄┄ sigmoid 加错负号 sigmoid(-z)
     应是 sigmoid(z)，多个负号让模型学反方向 · 纯笔误但杀伤大

②┄┄ 循环没更新参数
     跑1000次但 w_auto 原地不动 = 同一件事重复1000遍

③┄┄ 参数更新没用 torch.no_grad()
     计算图无限累积 → 第二轮 backward 报错
     (RuntimeError: backward through the graph a second time)

④┄┄ .grad 没清零 zero_grad()
     默认累加非覆盖 → 梯度值错误，且不报错（静默）

⑤┄┄ 对比对象搞错
     变量名叫 grad_w_manual 实际存的是"更新后的权重"
     拿"权重"和"梯度"比，永不相等

⑥┄┄ 手动循环误用 w_auto 而非 w_manual
     两组训练变成同一组数据在跑，对比毫无意义

✓┄┄ 全部修复 → torch.allclose 输出 True / True
     （autograd 与手推梯度一致）
```

<!-- 这是一张图片，ocr 内容为：SIGMOID 加错负号 SIGMOID(-Z) 应是SIGMOID(Z),多个负号让模型学反方向.纯笔误但杀伤大 循环没更新参数 跑1000次但W_AUTO原地不动不动不动不动000遍 参数更新没用TORCH.NO_GRAD() 计算图无限累积>第二轮BACKWARD TIME) .GRAD 没清零 ZERO_GRAD() 默认累加非覆盖梯度值错误,且不报错(静默) 对比对象搞错 变量名叫GRAD_WLMANUAL实际存的是"更新后的权重",拿"权重"和"梯度"比,永不相等. 手动循环误用W_AUTO而非W_MANUAL 两组训练变成同一组数据在跑,对比毫无意义 全部修复> TORCH.ALLCLOSE TRUE/TRUE(AUTOGRAD与手推梯度一致) -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956160121-275e7c36-76bd-4876-8082-c7fc8ee5deeb.png)

### 最终正确代码骨架
```python
# 数据：requires_grad 默认 False
X = torch.tensor(X_np, dtype=torch.float32)
y = torch.tensor(y_np, dtype=torch.float32)

# 参数：两套用同一初始值，autograd组开梯度追踪
w_auto   = torch.tensor(w_init, dtype=torch.float32, requires_grad=True)
b_auto   = torch.tensor(b_init, dtype=torch.float32, requires_grad=True)
w_manual = torch.tensor(w_init, dtype=torch.float32, requires_grad=False)
b_manual = torch.tensor(b_init, dtype=torch.float32, requires_grad=False)

# ① autograd 组
for ep in range(epochs):
    if w_auto.grad is not None: w_auto.grad.zero_()   # 坑4:清零
    if b_auto.grad is not None: b_auto.grad.zero_()
    z = X @ w_auto + b_auto
    y_pred = torch.clip(torch.sigmoid(z), eps, 1-eps)   # 坑1:无负号
    loss = -torch.mean(y*torch.log(y_pred) + (1-y)*torch.log(1-y_pred))
    loss.backward()
    with torch.no_grad():                              # 坑2+3:更新且no_grad
        w_auto -= w_auto.grad * lr
        b_auto -= b_auto.grad * lr

# ② 手动组（注意用 w_manual！坑6）
for ep in range(epochs):
    z = X @ w_manual + b_manual
    y_pred = torch.clip(torch.sigmoid(z), eps, 1-eps)
    grad_w = X.T @ (y_pred - y) / n_samples            # 阶段一推的公式
    grad_b = torch.mean(y_pred - y)
    w_manual = w_manual - grad_w * lr                  # 坑5:这是更新,变量名别叫grad
    b_manual = b_manual - grad_b * lr

print(torch.allclose(w_auto, w_manual, atol=1e-5))   # True
```

### 核心洞察（今日最重要的一句）
这六个坑，**没有一个是数学公式本身错了**。阶段一推出来的梯度公式从第一次写代码到最后都没改过，一直是对的。**全部坑都出在"框架机制"层面**：计算图何时断开、梯度何时累加、变量名指代是否一致。这印证了今天开篇的定位——数学没问题，缺的是"翻译成代码、并在框架运行机制里正确落地"这层功夫，而这道练习把它扎实走了一遍。

---

## 8. 附录
### A · 全部踩坑总结表
| # | 坑 | 表现 | 是否报错 | 正解 |
| --- | --- | --- | --- | --- |
| 1 | `C_CONTIGUOUS=='True'`<br/> 字符串比较 | flags 返回 bool 非字符串，永远走 else | 静默 | 直接 `if x.flags['C_CONTIGUOUS']:` |
| 2 | 测试只用连续数组 | 没覆盖转置不连续的真正坑 | 遗漏 | 补 `check(x.T)`<br/> 对比 |
| 3 | 打印 b 却用 d.dtype | 表格里 b 的 dtype 信息是错的 | 笔误 | 打印 `b.dtype` |
| 4 | sigmoid(-z) 多负号 | 模型学反方向，不收敛 | 静默 | `sigmoid(z)` |
| 5 | 循环没更新参数 | w 原地不动，重复1000遍 | 静默 | 循环内更新 w |
| 6 | 更新没用 no_grad | 图无限累积 | **报错** | `with torch.no_grad():` |
| 7 | .grad 没清零 | 梯度累加，数值错 | 静默 | 每轮 `grad.zero_()` |
| 8 | 对比对象搞错 | 拿"权重"比"梯度"，永不等 | 静默 | 分清梯度 vs 更新后权重 |
| 9 | 手动循环误用 w_auto | 两组变同一组，对比无意义 | 静默 | 用 w_manual |
| 10 | .base is a 判断 view | 共享内存但 .base 为 False | 误判 | 只用 `np.shares_memory()` |
| 11 | 转置后 reshape 期望共享 | 静默 copy，修改不影响原数组 | 静默 | 先查 C_CONTIGUOUS 预判 |


<!-- 这是一张图片，ocr 内容为：正解 表现 是否报错 直接 IF 静默 字符 FLAGS返回BOOL 非字符 C_CONTIGUOUS-'TRUE' 串比较 串,永远走ELSE X.FLAGS['C_CONTIGUOUS']: 补 没覆盖转置不连续的真正 测试只用连续数组 遗漏 对比 CHECK(X.T) 坑 表格里B的DTYPE信息是 打印B却用D.DTYPE 笔误 打印B.DTYPE 错的 模型学反方向,不收敛 静默 SIGMOID(-Z)多负号 SIGMOID(Z) 静默 循环没更新参数 循环内更新W 原地不动,重复1000遍 W原 报错 更新没用NO_GRAD 图无限累积 WITH TORCH.NO_GRAD(): 9 静默 每轮 梯度累加,数值错 GRAD没清零 GRAD.ZERO_() 对比对象搞错 静默 分清梯度VS更新后权重 拿"权重"比"梯度",永不等 手动循环误用W_AUTO 两组变同一组,对比无意 用W_MANUAL 静默 9 误判 BASE IS A判断VIEW 共享内存但.BASE为FALSE 10 只用 NP.SHARES_MEMORY() 先查C.CONTIGUOUS预判 静默COPY,修改不影响原 转置后RESHAPE期望共享 静默 11 数组 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781956204841-6563aaa1-5161-4e9a-8ddc-493729d73275.png)

注：11 个坑里 **10 个是静默错误**（不报错），只有 1 个会报错。这正是为什么"先猜再验证"和"判断习惯"比事后查代码更重要。

### B · 我问的值得记录的问题
| 问题 | 结论要点 |
| --- | --- |
| 维度记账法是矩阵求导的替代品吗？ | 不是，是验证/反推工具；完整体系记为知识缺口、低优先 |
| 为什么 torch.tensor(numpy) 是 float64 不是 float32？ | 从已有 numpy 创建按"规则B"保留原 dtype；只有从 list 创建才用 float32 |
| 既然手动实现，为什么还用 autograd？ | "手动"指不用 nn.Module；今天是手写前向+autograd+手动更新的过渡形态 |
| w、b 该设 requires_grad True 还是 False？ | 要优化的(w,b)设 True，数据(X,y)设 False（我一开始答反了） |
| 为什么参数更新要排除在计算图外？ | 更新是纯赋值非模型计算，否则图无限累积+第二次 backward 报错 |
| 权重收敛≠预测稳定 到底什么含义？ | 准确率对权重是否到最优不敏感，决策边界对了就提前饱和 |


### C · 知识速查卡
| 速记 | 内容 |
| --- | --- |
| 梯度 shape | 分母布局下 `∂L/∂w`<br/> 的 shape = `w`<br/> 的 shape（转置靠此反推） |
| 逻辑回归梯度 | `X.T @ (ŷ - y) / n`<br/>，与线性回归同形（交叉熵设计使然） |
| view/copy 判据 | 能只改 stride？能→view，不能→copy。转置永远 view，reshape 看连续性 |
| 判 view 工具 | 只用 `np.shares_memory()`<br/>，别用 `.base is` |
| dtype 两规则 | 从 list 创建→float32；从 numpy 转→保留原 dtype |
| 内存共享两契约 | `from_numpy()`<br/>=共享；`tensor()`<br/>=copy |
| autograd 三件套 | ① 要优化的开 requires_grad=True ② 每轮 zero_grad() ③ 更新放 no_grad() |
| backward 限制 | 只有标量能直接 backward；图默认 backward 一次后释放 |
| no_grad vs detach | no_grad=整块代码不记图；detach=单个 Tensor 摘离图 |
| device | M5 上 GPU = `mps`<br/>（不是 cuda）；NumPy 无 device 概念 |


---

_Day 10 完 · 手写实现期 → 框架期的分界线已跨过数学（①②）→ 工程直觉（③）→ 旧项目应用（④）→ 新工具（⑤⑥）→ 练习串联_
