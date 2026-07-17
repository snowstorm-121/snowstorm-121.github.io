学习目标：AI 方向求职

参考书：Pandas、NumPy 与 Matplotlib 官方文档；Titanic 数据分析实践

本阶段重点：把前 8 天的 Python、NumPy、Matplotlib、Pandas 串成真实的数据分析闭环；重点不在新增零散 API，而在理解每个数据与建模决策为什么这样选。

今天主线：数据清洗 → 特征分析 → 可视化 → 特征工程 → 用 NumPy 手写分类预测，完成一个可解释的 Titanic 综合项目。

---

主题：把前 8 天的 Python / NumPy / Matplotlib / Pandas 全流程串起来，走一遍真实数据分析项目： **数据清洗 → 特征分析 → 可视化 → 用 NumPy 手写分类预测**。 重点不在学零散新知识，而在"全流程串联"+"关键决策点为什么这么选"（面试高频追问）。

关联笔记：整合 [[Day 5 学习笔记：统计函数 _ random 模块 _ 手写线性回归|手写线性回归]]、[[Day 6 学习笔记：matplotlib学习|数据可视化]]、[[Day 7 学习笔记：DataFrame学习|DataFrame]] 与 [[Day 8 学习笔记： pandas进阶与numpy互转|数据预处理流水线]]；后续由 [[Day 10 学习笔记 ： 查漏补缺 + PyTorch 预习|PyTorch 预习]]衔接到框架阶段。

---

## 〇、项目全流程框架（先建立整体地图）
<!-- 这是一张图片，ocr 内容为：阶段0明确目标 预测SURVIVED/评估指标/ 切分策略/模型路径 阶段1数据清洗 分层切分防泄露填充 阶段2特征分析 GROUPBY分组存活率 识别混杂与共线 阶段3可视化 验证非线性/共线性/ 样本量 阶段4特征工程 分桶独热编码码一化 拼成数值矩阵 阶段5手写分类预测 规则阈值法(基线)+ 简化逻辑回归(正式模型) 对比/读权重/验证收敛 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874425306-b615b54c-57f6-47c9-98b1-355cfb3ba47c.png)

**关键设计意图（为什么这样分阶段）：**

| 设计 | 原因 |
| --- | --- |
| 阶段0 单独放最前 | "分类预测"有多种实现路径，先定路径才知道后面要准备什么特征、写什么代码 |
| 阶段1 清洗 ≠ Day7 重复 | Day7 目标是"练熟 API"，今天标准是"这样处理对最终预测有没有副作用（泄露）" |
| 阶段4 单列出来 | 这是"探索思维"和"建模思维"的分界线：阶段1产出好看的 DataFrame，阶段4要压成清一色数字矩阵 |
| 可视化与特征分析分两阶段 | 统计数字（groupby+mean）只能看"差异大不大"，**看不出关系的形状**（线性/非线性、被极端值带偏），这是图表独有的价值 |


---

## 一、阶段0：明确目标（动手前先把决策点定死）
### 1.1 决策清单
| 决策点 | 结论 | 理由要点 |
| --- | --- | --- |
| 预测目标 | `Survived`<br/>（二分类 0/1） | — |
| 模型路径 | A 规则阈值法（基线）+ B 简化逻辑回归（正式模型），对比 | 见下 |
| 评估指标 | 准确率 accuracy | Titanic 生死比 ≈ 38:62，不极端失衡，准确率靠得住 |
| 切分比例 | 80% 训练 / 20% 测试，`seed=42`<br/> 固定 | 见 §3.1 |
| 切分方式 | **分层抽样**（按 Survived 分组，组内各自 80/20） | 见 §3.2 |
| 切分时机 | **先切分，再用训练集统计量填充** | 防数据泄露，见 §3.3 |


### 1.2 两条模型路径的取舍（面试："为什么选这个模型"）
<!-- 这是一张图片，ocr 内容为：路径B简化逻辑回归(正式) 优点: 缺点: 复用DAY5梯度框架/引出分 ZWX+B SIGMOID> 新增SIGMOID+交叉熵/需归一 类VS回归本质/是PYTORCH前 交叉熵梯度下降 化/调试更复杂 身 路径A规则阈值法(基线) 缺点: 优点: GROUPBY(SEX,PCLASS)算组内 零新数学/极可解释/是真实B 无训练/无梯度/与DAY5不衔 存活率 查表>0.5判存活 接 ASELINE -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874456260-ad93367e-bfce-4ca3-8bba-48108017f2d0.png)

**结论：两条都做。** 先用 A 拿一个"哪怕最笨也有多准"的基线，再用 B 做正式模型与之对比。

真实数据科学流程的标准动作：**任何模型上线前都要有 baseline 撑底**，否则不知道模型到底学到了东西，还是连瞎猜都不如。

### 1.3 分类 vs 回归的本质区别（贯穿全程）
| | 回归（Day5） | 分类（今天） |
| --- | --- | --- |
| 预测值 | 连续值（房价/温度） | 离散类别（活/死） |
| 衡量标准 | "差多少"（均方误差） | "对不对"（准确率 + 交叉熵） |
| 特征-标签关系看法 | 相关系数 | 分组存活率差异 |
| 输出处理 | `z`<br/> 直接当预测 | `z`<br/> 要经 sigmoid 压成概率再二值化 |


---

## 二、阶段1：数据清洗
### 2.1 分层抽样切分（采纳"先分组再组内切分"）
<!-- 这是一张图片，ocr 内容为：原始891行 按SURVIVED分组 存活组342人 死亡组549人 独立打乱 独立打乱 RNG.PERMUTATION(549) RNG.PERMUTATION(342) ILOC重排后切80/20 ILOC重排后切80/20 训练273+测试69 训练439+测试110 CONCAT训练组练组2人 CONCAT测试组179人 IGNORE INDEXTRUE 验证:712+179891V 两组存活率都38% -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874496359-e9aa7774-f1a6-4a42-99d1-62d1eeddf292.png)

**核心代码骨架：**

```python
rng = np.random.default_rng(42)
df_survived = df[df['Survived'] == 1]
df_died     = df[df['Survived'] == 0]

# 每组分别独立打乱（关键：不要打乱一次共用同一组索引位置）
perm_survived = rng.permutation(len(df_survived))
perm_died     = rng.permutation(len(df_died))
df_survived = df_survived.iloc[perm_survived]   # 用 iloc（位置），不能用 loc（标签）
df_died     = df_died.iloc[perm_died]

split_s = int(len(df_survived) * 0.8)           # int() 是截断，不是四舍五入
split_d = int(len(df_died) * 0.8)
df_train = pd.concat([df_survived.iloc[:split_s], df_died.iloc[:split_d]], axis=0, ignore_index=True)
df_test  = pd.concat([df_survived.iloc[split_s:], df_died.iloc[split_d:]], axis=0, ignore_index=True)
```

**分层抽样的价值（面试点）：**

+ 普通随机切分在 891 这种规模下，"全是一类"概率极低（≈ 0.62¹⁷⁸，天文数字级小），**真正常见的问题是比例轻微偏移**（38% 切成 32% 或 45%）。
+ 分层抽样不是防极端，而是**让训练/测试集存活比例都锚定在 38% 附近**，减少"评估被抽样运气影响"的噪声。
+ 小成本、稳收益的工程习惯，没理由不用。

### 2.2 防泄露的填充（今天 ≠ Day7 的核心区别）
<!-- 这是一张图片，ocr 内容为：同一统计量填训练集 只在训练集算统计量 先切分 中位数/众数/MEAN/STD 同一统计量填测试集 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874523893-8c3d6963-d69b-4848-a6ba-80f96e6714cb.png)

**Age（按 Pclass 分组填，更精细）：**

```python
age_median_by_pclass = df_train.groupby('Pclass')['Age'].median()   # 只从训练集算的"一张3行小表"
df_train['Age'] = df_train['Age'].fillna(df_train['Pclass'].map(age_median_by_pclass))
df_test['Age']  = df_test['Age'].fillna(df_test['Pclass'].map(age_median_by_pclass))  # 测试集套用同一张表
assert df_train['Age'].isna().sum() == 0   # 填完立刻断言
assert df_test['Age'].isna().sum() == 0
```

**Embarked（缺失才 2 个 → 全局众数即可，不必分组）：**

决策原则：**过度工程 vs 够用就好**。Age 分组的理由是"不同舱位年龄分布明显不同，全局填会失真"；Embarked 缺失率极低，分组的精细化收益极小，不值得多写代码。

**Cabin（缺失 687/891 太多 → 整列丢弃）：**

```python
df_train = df_train.drop(columns=['Cabin'])   # 明确写列名，不用 dropna(axis=1)（见踩坑 §6）
df_test  = df_test.drop(columns=['Cabin'])
print(df_train.columns.equals(df_test.columns))   # 收尾必检：必须 True
```

---

## 三、阶段2：特征分析
### 3.1 核心方法：看"分组存活率的跨度"
判断标准：**组间存活率跨度越大（max组 − min组），该特征对"区分活死"的信息量越大。**

| 特征 | 跨度 / 差异 | 判断 | 阶段4倾向 |
| --- | --- | --- | --- |
| **Sex** | female 74.8% vs male 18.6% → **56%** | 强、独立、无混杂嫌疑 | ✅ 进 |
| **Pclass** | 61.8% → 48.7% → 23.9%（单调）→ **38%** | 强、独立、是其他特征的"幕后真因" | ✅ 进 |
| Embarked | C 58.3% / Q 35% / S 33.7% → 24.7% | 混杂明显 | ⚠️ 待定 |
| Fare | 存活组均值 47.4 vs 死亡组 22.0 | 与 Pclass 高度共线 | ⚠️ 待定 |
| Age | 死 29.8 vs 活 28.2（几乎无差） | 怀疑均值掩盖非线性 | ⚠️ 等可视化 |
| FamilySize | 中间高两头低，极端值样本量个位数 | 需分桶 | ✅ 进（分桶） |


### 3.2 三个关键统计概念
**① 混杂效应（confounding）—— Embarked**

+ 一个变量看起来和结果相关，实际是因为它和另一个**真正起作用**的变量相关。
+ 验证：`df_train.groupby('Embarked')['Pclass'].value_counts(normalize=True)`
+ 发现：Q 港 93.3% 是 3 等舱（几乎单一构成），C 港 50.8% 是头等舱 → **Embarked 的表现是借了 Pclass 的光**。
+ 更复杂：C 港三等舱 36.4% vs S 港三等舱 54.8%（方向还反过来）→ 控制 Pclass 后内部仍有差异，但方向不单一，可能混着 Sex/Age 等没分析到的因素。

**② 多重共线性（multicollinearity）—— Fare vs Pclass**

+ 两个特征高度相关、讲同一件事。验证：`df_train.groupby('Pclass')['Fare'].mean()` → 头等舱 81.2 / 二等 20.4 / 三等 14.1（**近 6 倍价差对应 3 个舱位**）。
+ 对线性模型的危害：两个相关特征同时进，**回归系数变得不稳定、难解释**（模型分不清权重该算谁头上）。

**③ 均值掩盖非线性 —— Age**

+ 死活两组 Age 均值只差 1.6 岁，但这是**均值这个汇总统计量太粗糙**：两端效应（幼儿高、青壮年低）互相抵消。
+ 教训：**两组均值接近时要留心 —— 是真没差异，还是差异藏在分布形状里，均值量不出来。**

---

## 四、阶段3：可视化（验证统计数字看不出的"形状"）
<!-- 这是一张图片，ocr 内容为：阶段2留下3个待定 AGE直方图 FARE箱线图 FAMILYSIZE 柱状图 (左右子图,DENSITYTRUE, (3个PCLASS并排) (柱高存活率,标注样本量N) 统一X/Y轴) 发现:N85人,N1116人 发现:幼儿小凸起+ 发现:3箱体几乎不重叠+ 0%存活率是小样本噪声, 头等舱长尾异常值(510) 20-25岁死亡尖峰 非线性坐实,AGE该分桶 共线性坐实 不可信 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874549796-6fc8c2b2-fa16-4d07-9d96-060794a31090.png)

### 4.1 三张图各自验证了什么
| 图 | 验证问题 | 结论 |
| --- | --- | --- |
| Age 直方图（左右子图） | 均值无差是否掩盖非线性 | **是**：幼儿存活率高、20-25 岁死亡尖峰，均值看不出 |
| Fare 箱线图（三舱并排） | Fare 是否与 Pclass 共线 | **是**：三箱体几乎不重叠，Fare 是 Pclass 的数值化身 |
| FamilySize 柱状图 | "中间高两头低"是否可靠 | 中段（n=25~418）可信；两端（n=5~12）的 0% 是噪声 |


### 4.2 可视化笔记要点
+ **直方图对比两组形状** → 用左右子图（不被遮挡、不被人数多的一组压制），加 `density=True`（人数不等时按密度比形状才公平），**手动统一 x/y 轴范围**（`range` 参数 + `set_ylim`）。
+ **更严谨**：两边共用同一组 bin 边界 `np.linspace(...)`，而非 `bins='auto'`（auto 会让两边柱宽不一致）。
+ **箱线图读法**：箱子 = Q1~Q3（中间 50% 数据），中间线 = 中位数，须线延伸到非异常值边界，散点 = 异常值。能并排比"中位数高低 + 离散程度"。
+ **柱状图标注 n**：`ax.text(bar.get_x()+bar.get_width()/2, height, f'n={count}', ha='center', va='bottom')` —— 柱中心 = 左边缘 + 半宽。

---

## 五、阶段4：特征工程到数值矩阵
### 5.1 特征拍板汇总
| 特征 | 决定 | 处理方式 |
| --- | --- | --- |
| Sex | 进 | 独热（→ `Sex_male`<br/> 一列） |
| Pclass | 进 | **直接用数值 1/2/3**（见 §5.4） |
| Embarked | **不进** | 混杂、信号不纯净 |
| Fare | **不进** | 与 Pclass 共线 |
| Age | 进，**分桶** | `child/teen/young_adult/middle_age/senior` |
| FamilySize | 进，**分桶** | `alone(1) / small(2-4) / large(5+)` |


### 5.2 分桶（binning）—— 处理非线性 + 合并稀疏极端值
**Age（固定常识边界）：**

```python
bins = [0, 12, 18, 35, 60, 100]
labels = ['child', 'teen', 'young_adult', 'middle_age', 'senior']
df_train['AgeGroup'] = pd.cut(df_train['Age'], bins=bins, labels=labels)
df_test['AgeGroup']  = pd.cut(df_test['Age'], bins=bins, labels=labels)   # 两边用同一套固定边界
```

**FamilySize（按图的转折点切，我自己定的分法）：**

+ `1人 → alone`，`2-4人 → small`，`5+人 → large`
+ 理由：① 转折点踩准（峰值在 4 人，5 人后断崖）；② 5+ 合并后 n=53，比单看 8 人的 5 个样本可靠得多。
+ 价值：**精度 vs 可靠性的权衡** —— 不是说 5 人和 11 人风险一样，而是样本太少时合并换一个更可信的整体估计。

### 5.3 ⚠️ 分桶边界会不会造成数据泄露？（我问的关键问题）
<!-- 这是一张图片，ocr 内容为：分桶边界数字从哪来? 是从训练集数据 算出来的吗? 否:人类常识 是:QUANTILE分位数 0,12,18,35,60,100 依赖这批数据的分布 换任何数据集都成立 有泄露风险 不泄露 (只要还偷看测试集去调边界 从没'看'过任何具体数据 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874577908-26b5002c-ddbe-4ab6-8fc6-a8e83fa0b18c.png)

**核心判断标准：泄露的关键不在"数字是不是固定的"，而在"这个数字的来源有没有偷看了不该看的数据"。**

+ 固定常识/行业惯例边界 → 不依赖具体数据 → 天然不泄露。
+ "Age 中位数必须只从训练集算" vs "分桶边界可用常识固定" —— **是两类不同层次的决定**：前者是"算这个值时能不能偷看测试集"，后者是"要不要用数据算出一个值"。

### 5.4 独热编码（one-hot encoding）
<!-- 这是一张图片，ocr 内容为：分类变量/数值特征 取值与目标 是无序类别吗? 是单调关系吗? AGEGROUP(幼儿高/青壮年尖 是:SEX(MALE/FEMALE无大小) 是:PCLASS(等级越低越危险) 可直接用数值 必须独热编码 模型学一个斜率即可 每类一个独立权重 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874598402-630d402b-564d-4461-9f2b-54f4b79c1b71.png)

**为什么不能简单编号（child=0,...,senior=4）？**

+ 线性模型会把编号当成**有大小、有距离意义**的真实数值：以为 senior 比 child"大 4 倍"，且"child→teen"和"middle_age→senior"的"+1"变化等量级 —— 全是人为编号造成的假象。
+ 这跟 Day7 的 `.cat.codes`（只为省内存/提速，不参与数值运算）语境不同：这里编号要**直接乘权重参与计算**，大小会被误读成信息。

**独热编码做法 + 防对齐坑（4 步法）：**

```python
# ① 固定完整类别清单（基于业务/数据了解，不从数据现算）
sex_categories = ['female', 'male']
df_train['Sex'] = pd.Categorical(df_train['Sex'], categories=sex_categories)
df_test['Sex']  = pd.Categorical(df_test['Sex'],  categories=sex_categories)
# ② 分别独热（drop_first=True 去冗余列，防完全共线）
sex_dummies_train = pd.get_dummies(df_train['Sex'], prefix='Sex', drop_first=True)
sex_dummies_test  = pd.get_dummies(df_test['Sex'],  prefix='Sex', drop_first=True)
# ③ 检查列名一致（永远不能省）
assert sex_dummies_train.columns.equals(sex_dummies_test.columns)
```

+ **冗余列**：5 个独热列只需看 4 个就能确定第 5 个 → 任意列可被其他列精确算出（完全共线）→ `drop_first=True` 丢一列当基准。
+ **对齐坑**：若训练集凑巧没某个取值，`get_dummies` 只按"训练集出现过的类别"生成列 → 测试集多一列 → 列数不一致没法用同一组权重预测。解法：先用 `pd.Categorical(..., categories=完整清单)` 锁死两边类别字典。

### 5.5 拼接特征矩阵（axis=1）
```python
X_train = pd.concat([df_train[['Pclass']], sex_dummies_train, Age_dummy_train, familysize_dummy_train], axis=1)
X_test  = pd.concat([df_test[['Pclass']],  sex_dummies_test,  Age_dummy_test,  familysize_dummy_test],  axis=1)
y_train, y_test = df_train['Survived'], df_test['Survived']

# 拼完三必检
print(X_train.shape, len(y_train))            # 行数相等
print(X_train.isna().sum())                    # 不应有 NaN（有 → 索引没对齐）
print(X_train.columns.equals(X_test.columns))  # 训练/测试列必须一致
```

+ **axis=1 拼接的新坑**：Pandas 按**索引对齐**配对行，索引不一致会出 NaN（不是简单按物理位置拼）。本次没事是因为独热表都从 df_train 直接派生、索引一致 —— 但这建立在"前面没打乱过索引、没筛丢过行"的前提上，所以必须验证。

---

## 六、阶段5：手写分类预测
### 6.1 第一部分：规则阈值法（基线）
```python
group_survival_rate = df_train.groupby(['Sex', 'Pclass'])['Survived'].mean()   # 这张表=从训练集学出的"参数"
df_test['pred_proba'] = df_test.set_index(['Sex','Pclass']).index.map(group_survival_rate)  # 多级索引查表
df_test['pred_baseline'] = (df_test['pred_proba'] > 0.5).astype(int)
accuracy_baseline = (df_test['pred_baseline'] == df_test['Survived']).mean()    # ==后.mean()=准确率速算
```

**6 组存活率表（关键发现）：**

| | Pclass 1 | Pclass 2 | Pclass 3 |
| --- | --- | --- | --- |
| female | 98.6% | 92.2% | **50.4%** |
| male | **36.3%** | 16.3% | 12.8% |


+ **三等舱女性(50.4%) > 头等舱男性(36.3%)** → Sex 的影响比 Pclass 更剧烈。
+ 6 组交叉后跨度 = 98.6% − 12.8% = **85.8%**，远超任何单一特征 → **特征交互的价值**。
+ **基线准确率 = 77.1%**（地板线 61.5% = 全猜死亡 = 1 − 测试集存活率 38.5%）。

### 6.2 第二部分：简化逻辑回归 —— 三个新概念
<!-- 这是一张图片，ocr 内容为：P0.5?判存活 SIGMOID(Z) 压到(0,1)当概率 ZWX+B 特征X (任意实数) 交叉熵损失 衡量判断离谱程度 梯度下降更新W,B -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874625276-87274ac5-0ad6-4492-b23b-f0a3662cbef8.png)

**① sigmoid：为什么需要它**

+ 线性回归的 `z` 取值是整个实数轴；但概率必须在 [0,1]。
+ `sigmoid(z) = 1/(1+e^(-z))` 把任意实数**单调地**压到 (0,1)：`z=0→0.5`，`z=+10→≈1`，`z=-10→≈0`。
+ S 形曲线：中间陡（不确定区，特征稍变判断就翻）、两端平（已很确信）。
+ ⚠️ 副作用：两端梯度趋近 0（埋点，见交叉熵如何化解）。

**② 交叉熵损失 vs 均方误差：为什么分类用交叉熵**

<!-- 这是一张图片，ocr 内容为：预测任务 输出是连续值 还是概率/类别? 连续值房价/温度 概率/分类 交叉熵 均方误差MSE 衡量'判断离谱程度'(自信犯 衡量'差多少'(对称,有上限) 错>惩罚飙向无穷 配合SIGMOID:梯度公式简洁 且不在犯大错时梯度消失 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874646888-e6c81923-9bb5-4ab0-96fb-f39a2da66c5a.png)

+ `loss = -[y·log(y_pred) + (1-y)·log(1-y_pred)]`
+ `y=1` 时损失 = `-log(y_pred)`：猜对(→1)损失≈0；自信猜错(→0)损失**飙向无穷**（MSE 此时被天花板封在 1）。
+ 真正决定"不用 MSE"的原因：MSE + sigmoid 求梯度，**犯最严重错误时梯度反而趋 0、学不动**（反直觉的糟糕组合）。交叉熵 + sigmoid 恰好化解。

**③ 特征归一化：为什么要做**

<!-- 这是一张图片，ocr 内容为：特征量级不一致 PCLASS(1,2,3)VS独热(0,1) GRADWEAN(ERROR.X) X大梯度天然大 所有权重共用同一个 LEARNING_RATE 大尺度特征步子大可能震 小尺度特征步子小学得慢 矛盾: 两个特征'理想步长'不同 却被迫用同一学习率 归一化(Z-SCORE)拉齐尺度 可共用学习率,步伐公平 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874675910-df073785-34bc-4fe3-a5df-91a7892d69c3.png)

+ 一句话总结（我的复述，老师确认对）：**不归一化导致每次更新步伐不一致，再叠加"共用同一个学习率"，就可能不收敛/收敛慢。**
+ 比喻：一只手用同样力度调两个灵敏度不同的水龙头，大龙头喷出去、小龙头没动。归一化 = 事先把两个龙头换成同样灵敏度。
+ 本次做法：**只标准化 Pclass，独热列(0/1)保持不变**（折中：真正有量级差的只有 Pclass，保住独热列的可解释性）。
+ ⚠️ `mean/std` 只从训练集算，套用到测试集（防泄露同款规则）。

### 6.3 梯度推导（链式法则 + "奇迹抵消"）
<!-- 这是一张图片，ocr 内容为：LOSS交叉熵 D LOSS/D_YPRED Y_PRED SIGMOID(Z) 三段相乘 WJ Z-WX+B D_YPRED/D_Z 复杂项全约掉 YPRED(1-YPRED) (Y_PRED-Y.TRUE).X_J D_Z/DWJXJ -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874699080-ac42fdc9-5cd8-4b77-92c0-419a458e17e6.png)

**三段链式法则：**

```plain
∂loss/∂w_j = (∂loss/∂y_pred) × (∂y_pred/∂z) × (∂z/∂w_j)
```

+ 第一段 `∂loss/∂y_pred = -[y/y_pred - (1-y)/(1-y_pred)]`
+ 第二段（sigmoid 导数，用自身输出表示）`∂y_pred/∂z = y_pred·(1-y_pred)`
+ 第三段 `∂z/∂w_j = x_j`
+ 前两段相乘，逐项展开化简：

```plain
-y(1-y_pred) + (1-y)y_pred = -y + y·y_pred + y_pred - y·y_pred = y_pred - y
```

+ **复杂的分式、sigmoid 导数全部约掉，只剩 **`**(y_pred - y_true)**` → 对应代码 `error = y_pred - y_train_np`。
+ 向量化：`grad_w = X.T @ error / n_samples`。
+ **为什么会"奇迹抵消"**：交叉熵的形式本就是为配合 sigmoid、让梯度化简成这个干净形式而选用的（统计上叫"指数族的自然搭配"），不是凑巧。

### 6.4 训练循环骨架
```python
def sigmoid(z): return 1 / (1 + np.exp(-z))

w = rng.normal(0, 0.01, size=n_features); b = 0.0
learning_rate, n_epochs = 0.1, 5000

for epoch in range(n_epochs):
    z = X_train_np @ w + b
    y_pred = sigmoid(z)
    y_pred_c = np.clip(y_pred, 1e-15, 1 - 1e-15)          # ⚠️ 防 log(0)=-inf，见 §6.5
    loss = -np.mean(y_train_np*np.log(y_pred_c) + (1-y_train_np)*np.log(1-y_pred_c))
    error = y_pred - y_train_np
    grad_w = X_train_np.T @ error / n_samples
    grad_b = np.mean(error)
    w -= learning_rate * grad_w
    b -= learning_rate * grad_b
```

+ **健全性检查**：`epoch 0` 的 loss ≈ 0.693 = `-log(0.5)`（权重≈0 时 sigmoid 输出≈0.5）→ 说明初始化和 loss 计算逻辑正确。
+ **收敛判断**：看最后几百轮降幅是否 < 0.001~0.005 量级（前 100 轮降 0.19，后 800 轮才降 0.068 = 典型收敛形状，不是"下降不明显"）。

### 6.5 ⚠️ 数值稳定性：log(0) = -inf 的 nan 雪崩
<!-- 这是一张图片，ocr 内容为：Z很负SIGMOID(Z) 浮点下溢成0.0 NP.LOG(0)-INF(不报错!) 含INF LOSS NP.MEAN INF/NAN GRAD_W被污染成NAN W-LR*GRAD_W变NAN NAN传染:任何运算含NAN 结果必NAN 后续所有W/B/LOSS永久NAN 但程序不崩, 面无表情跑完所有轮 解法:NP.CLIP(Y_PRED,1E-15, 1-1E-15) -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874739163-c01cac98-96f7-4bbf-b873-baee45bccde9.png)

+ 这是"静默错误"在数值计算领域的典型表现：不报错、看似运行、实际早已失效。
+ `epsilon=1e-15` 小到不影响 loss 实际意义，但保证 log 永不算出 -inf。

### 6.6 模型对比 + 读权重
| 模型 | 准确率 | 特点 |
| --- | --- | --- |
| 地板线（全猜死亡） | 61.5% | 什么都没学到的参照 |
| 规则阈值法（基线） | 77.1% | 能捕捉 Sex×Pclass 交互，但只用 2 特征 |
| 简化逻辑回归 | **79.3%** | 用 8 特征，但纯线性、**无交互项** |
| sklearn LogisticRegression | 79.3% | 同份数据收敛到的解（凸优化，有唯一最优） |


**逻辑回归权重（5000 轮，已收敛）：**

```plain
Pclass: -0.96   Sex_male: -2.81   (绝对值最大=最强特征, 与Sex 56%跨度吻合)
Agegroup_teen: -0.89   young_adult: -0.81   middle_age: -1.63   senior: -1.26
FamilyGroup_small: +0.38 (比alone安全)   large: -1.70 (比alone危险)
b: +2.12  (基准: female+child+alone, 倾向预测存活, 符合直觉)
```

+ 权重符号方向几乎全部符合阶段2/3 的分析发现 → "可解释性优先"的收获：**能对每个权重讲出"为什么是这个符号、这个大小"**。

### 6.7 为什么逻辑回归只比基线高 2.2%（面试有力回答）
+ 逻辑回归是**纯线性组合**，只能学"Pclass 越大越危险"+"是男性越危险"两条独立趋势，**学不到基线天生具备的 Sex×Pclass 交互**（如"三等舱里性别影响幅度 ≠ 一等舱里"）。
+ 没败给基线（远高于地板线 61.5%）→ 确实学到了东西；没显著超越 → 缺交互信息。
+ **不是模型没调好，是模型结构（无交互项）有信息天花板，恰好离基线不远。**
+ 第二原因：AgeGroup/FamilyGroup 这些非线性局部效应，分桶后给线性模型的增益本来就有限（边际贡献小）。

---

## 七、值得记录的关键问题（我主动追问的）
| 我的问题 | 关键答案（精确表述） |
| --- | --- |
| 随机切分会不会切出全是某一类？ | 891 规模下概率极低；真正常见的是**比例轻微偏移** → 引出**分层抽样**（不是防极端，是锚定 38%） |
| 为什么同一 rng 连续调用两次 permutation 是独立的？ | **不是"无关"，是"确定但统计独立"**：内部状态确定性推进，但 PCG64 保证输出在统计上不可预测/不相关 |
| 固定常识边界分桶会不会数据泄露？ | **不会**。泄露关键不在"数字固不固定"，而在"来源有没有偷看不该看的数据"；常识边界从没看过任何数据 |
| 为什么要特征归一化？ | 量级不一致 → 梯度天然不等 → 共用同一学习率 → 步伐不公平 → 不收敛/慢。归一化拉齐尺度 |
| 梯度公式怎么来的（不要直接给公式）？ | 链式法则三段相乘，交叉熵导数 × sigmoid 导数复杂项**全约掉**，只剩 `(y_pred - y_true)·x_j` |
| 80/20 还是 70/30？ | 数据量小 → 保训练集优先；数据量大 → 可多分给测试集。Titanic 小 → 80/20 |


---

## 八、踩坑记录（静默错误为主）
| # | 坑 | 现象 | 正确做法 |
| --- | --- | --- | --- |
| 1 | `df[:n]`<br/> 切片当成按标签切 | 实际是**按位置**切（Day7 坑的延伸，`[]`<br/> 行为不对称） | 显式写 `df.iloc[:n]`<br/>，意图明确永不错 |
| 2 | `(int)(x)`<br/> C 风格写法 | 能跑但是多余括号 | Python 用 `int(x)` |
| 3 | `dropna(axis=1)`<br/> 各自丢列 | 训练/测试若某列缺失情况不同 → **列对不齐**（本次侥幸一致） | 明确 `drop(columns=['Cabin'])` |
| 4 | `pd.Categorical`<br/> 变量名写错（`FamilySize`<br/> 写成本该是 `FamilyGroup`<br/>） | categories 是字符串、列是数字 → 全部**静默变 NaN**，警告但不报错；原始列还被覆盖污染 | 操作 `FamilyGroup`<br/>；被污染列需 `SibSp+Parch+1`<br/> 复原 |
| 5 | 712 vs 713 | 以为丢了 1 人 | `int()`<br/> 是**截断**非四舍五入；712+179=891 完全正确，是我的预估数不精确 |
| 6 | `map`<br/> 查表查不到 key | 训练/测试分布不对齐时**静默变 NaN**，`fillna(NaN)`<br/> 等于没填 | 填后 `assert isna().sum()==0` |
| 7 | 独热编码训练/测试列对不齐 | 某取值只在一边出现 → 列数不同 | 先 `pd.Categorical(..., categories=完整清单)`<br/> 锁死 |
| 8 | `log(0) = -inf`<br/> 的 nan 雪崩 | loss/grad/w 全部静默变 nan，程序不崩跑完所有轮 | `np.clip(y_pred, 1e-15, 1-1e-15)` |
| 9 | `conda install sklearn`<br/> 失败 | 包名不对（PyPI/conda 名 ≠ import 名） | `conda install scikit-learn`<br/> / `pip install scikit-learn` |
| 10 | "准确率完全相同"假象 | 手写权重 ≠ sklearn 权重，但准确率小数点后 16 位相同 | 测试集仅 179 人，**权重不同但决策边界在这些人身上偶然给出相同 0/1** |
| 11 | 1000 轮没收敛 | AgeGroup 权重还是接近 0 的小正数，**符号都是错的**（看着像"teen 更安全"） | 加到 5000 轮，权重朝 sklearn 方向移动、符号反转、与阶段3发现接轨 |


---

## 九、本次最大认知升级：权重收敛 ≠ 预测稳定
<!-- 这是一张图片，ocr 内容为：1000轮 VS 5000轮 权重大幅变化 (AGEGROUP符号都反了) 为什么? 权重变化只有让样本(跨过0. 5 才改变最终0/1判断 AGEGROUP权重的调整被SEX /PCLASS主导力压过 准确率完全不变 概率0.62-0.58, 0.7932960893854749 没人跨过0.5 结论:权重是否收敛与 预测准确率是否变 可完全脱钩 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874768122-b3ae60c5-2af4-47b8-8a21-b51f32995c0f.png)

**实战指导意义：**

+ **只关心分类准确率** → 不必练到权重完全收敛（1000 轮的"准确率"已可用）。
+ **要拿权重做解释**（特征重要性、写报告）→ **必须练到权重真正稳定**，否则会得出"teen 更安全"这种被训练不充分误导的错误结论。
+ **判断"训练够没够"**：光看"loss 不再下降"不够全面 —— loss 平缓只说明强特征主导的部分收敛了，**还要看权重本身是否还在显著变化**。

---

## 十、练习
### 练习1：Embarked / Fare 对比实验
加 Embarked（独热）、Fare（标准化）、两者都加，各跑 5000 轮，对比准确率与权重符号。

关注点不是"准确率涨没涨"，而是**验证理论预判**：加了边际收益有限（混杂/共线）。若 Fare 权重大但准确率几乎不变 → 共线性导致权重不稳的直接证据。

### 练习2：sklearn 验证（已完成）
`LogisticRegression().fit(X_train_np, y_train_np).score(...)` → 与手写 79.3% 对比；`model.coef_` 与手写 `w` 对比（5000 轮后已很接近，凸优化收敛到同一最优）。

### 练习3：学习率敏感性
`lr ∈ {0.01, 1, 10}` 各跑 1000 轮看 loss：

+ `0.01` 收敛极慢；`1` 仍收敛（归一化后容错大）；`10` 很可能震荡甚至 nan。
+ 进阶：注释掉归一化再跑一遍，对比"归一化前后对学习率的敏感度"。

### 练习4：让线性模型捕捉交互效应（思路题）
**手动构造交叉特征列**：

```python
X_train['Sex_male_x_Pclass'] = X_train['Sex_male'] * X_train['Pclass']
```

+ 原理：线性模型只能学"各特征独立贡献"；提前算好两特征**乘积**当新列喂进去，模型给这列一个权重 = 间接学到交互效应。模型仍线性，但因一列是非线性（乘法）构造的，变相获得捕捉交互的能力。
+ 与基线查表法趋同：查表是交互的"完全版"（6 组各自独立），乘积列是"简化版"（只能表达乘法型交互）。
+ **伏笔**：决策树/随机森林通过"先按 Sex 分支、再按 Pclass 分支"**自动捕捉任意交互**，无需手动构造交叉列 —— 这是树模型相对线性模型的核心优势（后面学到时回看）。

---

## 十一、全知识点思维导图
<!-- 这是一张图片，ocr 内容为：CATEGORICAL锁死类别防对齐 坑 不能简单编号 只标准化PCLASS DROP_FIRST去冗余 独热编码 处理非线性 归一化 基线77VS 模型79 常识边界不泄露 准确率速算 分桶BINNING 无交互项有天花板 特征工程 评估与认知 合并稀疏极喘值 步伐一致性 先切分后填充 读权重要练到收敛 SIGMOID压到0到1 测试集套用同一统计量 权重收敛不等于预测稳定 梯度链式法则奇迹抵消 交叉熵指数级惩罚 防数据泄露 统计量只从训练集算 逻辑回归正式 DAY9 TITANIC实战 LOGO负无穷 CLIP截断 按标签分组 数据准备 模型 ILOC按位置重排 规则阈值法基线 地板线61.5 分层抽样 可视化 GROUPBY查表 多亚共线性FARE VS PCLASS 混杂效应EMBARKED 组内独立打乱PERMUTATION 箱线图比中位数与离散 特征分析 柱状图标注样本量N CONCAT合并IGNORE INDEX 直方图比形状 GROUPBY分组存活率看跨度 子图加DENSITY 均值掩盖非线性AGE两端 -->
![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781874795717-9968f736-1354-4051-a619-762860ea89d0.png)

---

**Day 9 小结**：今天最大的收获不是某个新 API，而是把"先想为什么、再看数据、用代码验证"这条链路在一个真实项目里完整走了一遍 —— 从分层抽样防泄露，到识别混杂/共线，到可视化验证非线性，到手推梯度，再到亲手挖出"权重收敛 ≠ 预测稳定"的洞察。这些"对比出来的判断"和"踩出来的坑"，比准确率数字本身更值得带进面试。
