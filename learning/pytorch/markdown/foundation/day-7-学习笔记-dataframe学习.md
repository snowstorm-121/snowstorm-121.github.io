学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版

本阶段重点：框架本身的行为和坑（视图/拷贝、共享状态、API 差异、静默错误），数据处理的纯数学/统计概念不再赘述。环境：MacBook Air M5 ｜ Miniconda 虚拟环境 `pytorch_env`

今天主线：Pandas DataFrame 核心操作，用 Titanic 数据集练习。七块内容——读取与初探、索引体系（loc/iloc/[]）、筛选与排序、缺失值处理、groupby、数据类型转换、综合实战。今天的核心心智模型与 Day 5、Day 6 一脉相承：**全局可变共享状态 / 视图 vs 拷贝是坑，要用显式、一步到位的写法**——Day 5 是 `np.random` vs `default_rng`，Day 6 是 `plt.*` vs `fig, ax`，今天是 **链式赋值 vs **`**loc**`** 一步定位**，以及新版本 Pandas 引入的 **Copy-on-Write（CoW）机制**。除此之外，今天还多了一条独立的主线：**标签（label）vs 位置（position）**——这是 `loc` 和 `iloc` 一切区别的根源。下面把主线知识、追问后才弄清的点、以及踩过的坑都记下来。

关联笔记：复用 [[Day 5 学习笔记：统计函数 _ random 模块 _ 手写线性回归|随机状态与训练数据]]、[[Day 6 学习笔记：matplotlib学习|可视化]]的思路；后续进入 [[Day 8 学习笔记： pandas进阶与numpy互转|Pandas 进阶与 NumPy 互转]]和 [[Day 9 学习笔记：Titanic 综合实战 —— 完整数据分析项目|Titanic 综合实战]]。

---

## 〇、贯穿全天的两条心智主线（先立住）
### 1. 视图 vs 拷贝 / 链式赋值 → 升级版：Copy-on-Write
跟 Day 6「任何超过随手画的图都用 OO 接口」是同一种思路：**任何要修改 DataFrame 的场合，一律用一步到位的写法，不写链式的两段 **`**[]**`**，不用 **`**inplace=True**`**。** 今天实测的新版本 Pandas 已经启用 CoW，链式 `inplace` 会直接报 `ChainedAssignmentError`（不是 warning，是 error），所以这条不再是「建议」而是「硬要求」。

**唯一要记的赋值规则**（不管版本、CoW 开不开都安全）：

```python
df['列名'] = df['列名'].方法(...)          # ✅ 算出新值，再整列赋值回去
df.loc[条件, '列名'] = 值                   # ✅ 用 loc 一步定位 + 赋值
```

`inplace=True` 这个参数以后当作不存在——它存在的唯一理由是少打几个字，带来的版本兼容问题和隐藏 bug 不值得。

### 2. 标签 vs 位置（loc/iloc 的总根源）
+ `**loc**`** 按「门牌号」找人**：门牌号是行标签（index），是数据自带的「身份证号」，**不会因为筛选/排序而重新编号**。
+ `**iloc**`** 按「排第几个」找人**：完全不管标签写什么，只数「从上往下数这是第几行」，永远从 0 数起，**每次筛选/排序后都重新数**。

一开始感觉不到区别，是因为 Titanic 刚读进来时默认行标签恰好是 `0,1,2,3...`，跟「排第几」数值上长得一样，于是 `df.loc[3]` 和 `df.iloc[3]` 巧合地取到同一行。**一旦做了筛选/排序，门牌号和排队顺序立刻分家**——这是今天最容易反复中招的坑。

---

## 一、读取与初探：`read_csv`、`head/info/describe`、dtype 自动推断
### 1. 最基本用法
```python
import pandas as pd
df = pd.read_csv('titanic.csv')
# 没有本地文件时的两个替代方案：
# df = pd.read_csv('https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv')  # 直接读网络URL
# import seaborn as sns; df = sns.load_dataset('titanic')  # seaborn内置（列名全小写、字段略少）
```

这一行背后做了很多「猜测性」的工作：**Pandas 自动推断每列的 dtype，而推断不总对、不总合你意**。这跟 Day 6「状态机隐藏指针」性质不同——不是「隐藏状态」，而是「自动化背后悄悄做决定」，今天会反复遇到这种模式。

### 2. 三个初探函数，分工不同
```python
df.head()      # 看前5行，确认读对了、列名对不对
df.info()      # 看每列 dtype、非空值数量 —— 今天最重要的命令
df.describe()  # 数值列的统计摘要（均值/标准差/四分位数）
```

`info()` 一次性回答两个关键问题：**①这列是什么类型（int64/float64/object）；②这列有没有缺失值（Non-Null Count 小于总行数即有缺失）**。Titanic 里 `Age` 891 行只有 714 个非空，这是缺失值处理要面对的第一个目标列。

### 3. ⚠️ `object` 不等于「字符串类型」
看到 dtype 是 `object` 就理解成「字符串列」是不准确的。`object` 的真实含义是：**这列存的是 Python 对象的指针，元素可以是字符串、也可以是混合类型（有的格子字符串、有的数字、有的 NaN）**。后果：一列因混杂而被读成 `object`，对它做 `.str` 方法或数值运算可能在某些行报错或给意外结果，而 Pandas 在读取阶段**不会提醒这列是「脏的」**，只会安静标成 `object`。

### 4. ⚠️ 整数列因缺失值被静默提升为 float64
`Age` 本应是整数，`info()` 里却显示 `float64`。原因：**NumPy 的整数类型不支持 NaN，只有浮点类型才有 NaN 这个值**，所以一列里只要有一个 NaN，整列自动被提升为 `float64`。这是静默转换，不报错不警告。后果：后面若用 `Age == 22` 精确匹配，一旦这列经历过浮点运算（如填充），可能因浮点精度（`22.0000001`）匹配失效。

### 陷阱题（已答对）
为什么 `Age` 是 float64、`PassengerId` 是 int64，两列在 CSV 里看起来都是整数样的数字？ **答**：`PassengerId` 每行都有值、无缺失，能放心读成 int64；`Age` 有 177 行缺失，只要出现一个 NaN，整列只能存成 float64。**有没有缺失值才是决定 dtype 的关键，不是数字本身长什么样。**

---

## 二、索引体系：`loc` / `iloc` / `[]` 的边界与视图坑（今天坑最密集）
### 1. 三种方式的本质
```python
df['Age']           # [] 取列：按列名
df.loc[0, 'Age']     # loc：按标签（label）
df.iloc[0, 5]        # iloc：按位置（position）
```

### 2. 两个参数：逗号前管行，逗号后管列
**追问澄清**：为什么 `loc`/`iloc` 中间有两个参数？

```python
df.loc[行的标签, 列的标签]
df.iloc[行的位置, 列的位置]
```

**第一个位置永远管行，第二个永远管列**，不管用 loc 还是 iloc，这个「行,列」顺序约定一致，只是「怎么指定」（标签 vs 位置）不同。只给一个参数 = 只定位行、拿到整行：

```python
df.loc[0]        # 标签为0的那一整行（所有列）
df.loc[0, 'Age'] # 标签为0的行里、只要 Age 这一列的值
```

实务中 `**loc**`**+「行标签+列名」最常用**（列名比列号好记）；`iloc[行位置,列位置]` 用得少，主要在纯位置场景，如 `df.iloc[:5, :3]`（前5行前3列，不管列名）。

### 3. ⚠️ 一步到位 vs 链式（读取通常没事，赋值会坑）
```python
df.iloc[0, 5]          # 一步：第0行第5列
df.iloc[0]['Name']     # 两步链式：先拿整行(Series)再取列
df.iloc[0]['Age'] = 100             # ⚠️ 可能不生效 / 报警告
df.loc[0, 'Age'] = 100              # ✅ 一步到位，安全
```

### 4. ⚠️ `[]` 的行为依赖你传什么（不对称的静默重载）
```python
df['Age']            # 单个列名 → 取列，返回 Series
df[['Age', 'Fare']]   # 列表 → 取多列，返回 DataFrame
df[0:5]               # 切片 → 取「行」，不是列！
df[df['Age'] > 30]    # 布尔 Series → 行筛选
```

坑点：**单个列名取列，但切片 **`**[0:5]**`** 却取行**。Pandas 为兼容 NumPy 切片习惯做了「看你传什么、行为不同」的特殊处理，传错类型不报错，只给你不想要的东西。

### 5. ⚠️ 链式索引引发 `SettingWithCopyWarning` / `ChainedAssignmentError`
```python
df[df['Age'] > 30]['Age'] = 100   # ⚠️ 旧版本：警告且很可能不生效；CoW版本：可能直接报错
```

这一行是两步链式：先 `df[df['Age']>30]` 生成**中间对象**（视图还是拷贝 Pandas 自己也不保证），再在中间对象上赋值——而这个中间对象下一秒就被回收，原 `df` 可能根本没改到。正确写法见〇.1 的 `loc` 一步到位。

### 陷阱题（已答对）
```python
df_young = df[df['Age'] < 18]
print(df_young.iloc[0]['Name'])   # 不报错
print(df_young.loc[0]['Name'])    # 报 KeyError
```

原始第0行是22岁成年人（不满足 <18），筛掉了。`loc[0]` 问「门牌号0的人」——已不存在 → KeyError。`iloc[0]` 问「筛完排第一的人」——只要表里还有数据就存在，拿到的是某个未成年乘客（原标签可能是7/12/33），跟数字「0」无关。**两行长得几乎一样，一个报错一个不报错，根源就是 loc/iloc 在筛选后读取完全不同的东西。**

---

## 三、筛选：多条件组合 + 排序
### 1. ⚠️ 多条件不能用 `and`/`or`，必须用 `&`/`|`
```python
df[df['Age'] > 30 and df['Sex'] == 'female']        # ❌ ValueError: truth value of a Series is ambiguous
df[(df['Age'] > 30) & (df['Sex'] == 'female')]       # ✅ 且
df[(df['Pclass'] == 1) | (df['Pclass'] == 2)]        # ✅ 或
```

原因：`and`/`or` 设计给单个布尔值，而 `df['Age']>30` 是**一整列布尔值（Series）**。Python 想把每个 Series 转成单个 True/False 来判断，但一列891个值不知道整体算真还是假，直接报「真值有歧义」。`&`/`|` 是按位运算符，**逐元素**对两个布尔 Series 做与/或，刚好契合「每行单独判断」。

### 2. ⚠️ 括号是必需的，不是可选的
`&` 优先级**高于**`>` 和 `==`。省略括号会先算 `30 & df['Sex']`（数字与字符串列按位与，通常类型错）。**铁律：用 **`**&**`**/**`**|**`** 组合条件时，每个比较表达式必须用括号单独包起来，无例外。**

### 3. `isin()` 简化多个「或」；`~` 取反
```python
df[df['Pclass'].isin([1, 2, 3])]   # 等价多个 |，更清晰不易在括号上出错
df[~(df['Age'] > 30)]               # 取反
```

### 4. ⚠️⚠️ 重要纠正：`~` 取反会把 NaN 行选进来！（讲解时我先讲错、被实测纠正）
我最初口误说「NaN 比较 False，取反后还是不进来」——**这是错的，搞反了**。正确逻辑：

```python
df['Age'] > 30          # NaN 那一行结果是 False（NaN 和任何数比较都返回 False）
~(df['Age'] > 30)        # ~False = True → NaN 那一行【会被选中】！
```

所以「年龄不大于30」这个筛选，字面上 NaN 应是「未知不该判断」，**实际跑出来 NaN 行被当成满足条件混进来了**。根源：**NaN 和任何值比较（**`**>**``**<**``**==**`**）都返回 False，不返回 NaN 也不报错**。不想要 NaN 混进来必须显式排除：

```python
df[~(df['Age'] > 30) & df['Age'].notna()]   # 显式要求 Age 不缺失
```

（这是今天我被实测数据当场纠正的一处，记牢：取反时 NaN 行反而进来。）

### 5. 排序 `sort_values`
```python
df.sort_values('Age')                    # 升序
df.sort_values('Age', ascending=False)   # 降序
df.sort_values(['Pclass', 'Age'])        # 多列：先Pclass，相同的再按Age
```

### 6. ⚠️ 排序后行标签不重排（和筛选同一个坑）
```python
df_sorted = df.sort_values('Age')
df_sorted.loc[0]    # 拿到的不是「年龄最小的人」，是「标签为0的人」（可能在表任意位置）
df_sorted.iloc[0]   # ✅ 这才是排序后排第一 = 年龄最小的乘客
```

还是那句：经过筛选/排序，想要「第几个」用 `iloc`，要重新编号用 `reset_index(drop=True)`。

### 7. ⚠️ 追问澄清：NaN 在排序里永远垫底
```python
df.sort_values('Age')                    # 升序：NaN 排最后
df.sort_values('Age', ascending=False)   # 降序：NaN 还是排最后
```

这是专门设计的规则，不是巧合：**NaN 不参与正常大小比较，被单独抽出来固定丢到末尾**。因为 `NaN > 5`、`NaN < 5`、`NaN == NaN` 全是 False，正常比较排序逻辑在 NaN 上自相矛盾、推不出确定位置，Pandas 干脆绕开。**连带陷阱**：降序后 `.tail()` 拿到的是 NaN 行，不是「最小值」。想控制 NaN 位置：

```python
df.sort_values('Age', na_position='first')   # 放最前（默认 'last'）
```

`na_position` 只有 `'first'`/`'last'`，没法让 NaN「参与正常排序」——逻辑上走不通。

### 陷阱题（关键纠正：实际报错，不是「跑通出错误结果」）
```python
result = df[df['Age'] > 60 & df['Survived'] == 1]
```

我最初推理「会先算 `60 & df['Survived']` 得到位运算结果，能跑通但结果错」——**这个推理漏了一环，被实测纠正**。真相是这是个**三元链式比较**`A > B == C`，Python 展开为 `(A > B) and (B == C)`（中间的 B 被复用）：

1. 先算 `&`（优先级最高）：`60 & df['Survived']` 得到 Series（记作 B）
2. 链式比较展开：`(df['Age'] > B) and (B == 1)`——这个 `and` 两边都是 Series → 触发 `ValueError: truth value of a Series is ambiguous`

**根本原因和最开始 **`**... and ...**`** 报错完全一样，只是这次的 **`**and**`** 不是显式写的，而是 Python 把 **`**> ... == ...**`** 链式比较语法自动展开出来的，藏得更深。** 实测确认：报 ValueError，不是「悄悄给错误结果」。

---

## 四、缺失值处理：`isna` / `notna` / `fillna` / `dropna`
### 1. 怎么「看见」缺失值
```python
df.isna()          # 每个格子 → True/False
df['Age'].isna()   # 单列布尔 Series
df.isna().sum()    # ⚠️ 最常用：每列分别统计缺失个数
```

`df.isna().sum()` 为什么成立：`isna()` 把格子变 True(1)/False(0)，`.sum()` 按列把 0/1 加起来，自然就是每列缺失个数。这是**「布尔值当数字用」**的通用技巧，groupby 部分还会再用。`notna()` 是反面，逻辑对称。

### 2. ⚠️ `== np.nan` 永远 False，不能用 `==` 判断缺失
```python
df[df['Age'] == np.nan]   # ❌ 永远空结果，但不报错（静默错误）
df[df['Age'].isna()]      # ✅ 选出 Age 缺失的行
df[df['Age'].notna()]     # ✅ 选出 Age 不缺失的行
```

因为没有任何值「等于」NaN，连 NaN 自己都不等于自己。新手很容易误以为「数据里没缺失」，其实只是判断方式错了。

### 3. `dropna()`：删含缺失的行/列
```python
df.dropna()                  # 任意一列缺失就删整行
df.dropna(subset=['Age'])    # 只看 Age，Age缺失才删（其他列缺失不管）
df.dropna(axis=1)            # 删列：任意一个缺失就删整列
```

### 4. ⚠️ 最大的坑：裸 `dropna()` 在 Titanic 上几乎删光
`Cabin` 缺失约 687/891（缺失率近 77%）。裸调用 `df.dropna()` 会因「几乎每行 Cabin 都缺失」删掉绝大部分数据，**不报错不警告**，行数从891骤降到几十行，后续「样本严重不足」却毫无察觉。**实践原则：永远先 **`**df.isna().sum()**`** 看每列缺失率，再决定哪些删、哪些填、哪些缺失太严重整列丢弃。**

### 5. `fillna()`：填什么是建模决策，不是纯技术
```python
df['Age'] = df['Age'].fillna(df['Age'].median())        # 中位数
df['Age'] = df['Age'].fillna(df['Age'].mean())          # 均值
df['Embarked'] = df['Embarked'].fillna(df['Embarked'].mode()[0])  # 众数（分类变量常用）
```

⚠️ `mode()` 返回 Series（理论上可能多个并列众数），要加 `[0]` 取第一个；直接 `fillna(mode())` 不报错但填不进想要的单一值。

### 6. ⚠️⚠️ 实际踩坑：`fillna(inplace=True)` → ChainedAssignmentError（Copy-on-Write）
实测报错：

```plain
ChainedAssignmentError: A value is being set on a copy ... through chained assignment using an inplace method.
Such inplace method never works to update the original DataFrame...
```

`df['Age'].fillna(..., inplace=True)` 拆成两步：①`df['Age']` 摘出这一列；②`.fillna(inplace=True)` 原地改。**在 CoW 模式下，第①步摘出来的永远是独立拷贝，不再是指向原表的视图**，所以第②步改的是临时拷贝，改完被丢弃，原 `df` 没动。新版 Pandas（2.0+ 引入 CoW，未来默认开启）检测到这种「改了注定被扔的东西」直接报 error，而非旧版的 warning。

**CoW 核心规则**：任何「摘取子集」（切片、按列取、布尔筛选）默认返回逻辑上独立的数据，不和原表共享内存——这其实是 Pandas 在主动修复历史上「视图/拷贝分不清」的问题。**好处**：链式赋值「看似改了实际没改也不报错」的模糊地带消失了，要么报错提醒、要么干脆安全只读。**坏处**：依赖「链式 inplace 能改原表」的旧代码、旧教程在新版上全失效。

**结论 → 定死一条规则：只用 **`**df['列名'] = df['列名'].方法()**`** 形式，永远不用 **`**inplace=True**`**。** 见〇.1。

### 陷阱题（已答对，核心已 get）
全局均值填 `Age` 缺失，技术正确能跑通，但对训练模型的潜在问题？ **答**：丢失特征之间的相关性。具体：头等舱乘客平均年龄明显比三等舱大（头等舱多中老年富人，三等舱多年轻劳工移民）。用全局均值（约29.7）一刀切填，会把「三等舱+缺失年龄」的乘客强行填成更接近头等舱分布的29.7，**抹平 Age 与 Pclass/Sex/SibSp 的关联，人为注入不符合该群体真实分布的值**，模型在 Age 特征上的判断力变弱。更合理：**按组填**（见下方 transform）。

```python
df['Age'] = df.groupby('Pclass')['Age'].transform(lambda x: x.fillna(x.mean()))
```

---

## 五、groupby：拆分-应用-合并三段式
### 1. 核心心智模型 split → apply → combine
1. **拆分（split）**：按某列把表切成几堆（按 Pclass 切成1/2/3等舱三堆）
2. **应用（apply）**：对每堆分别算点什么（平均年龄、人数）
3. **合并（combine）**：把每堆结果拼成新表

```python
df.groupby('Pclass')['Age'].mean()   # 按Pclass拆 → 每堆取Age算mean → 自动合并成小表
```

### 2. ⚠️ `groupby()` 本身不返回看得懂的结果
```python
df.groupby('Pclass')   # 打印是 <...DataFrameGroupBy object at 0x...>，看不到数据
```

因为 `groupby()`**只完成「拆分」，没做「应用」**——只是按组标记好、准备好，没决定每组算什么，所以无结果可展示。必须接具体统计方法（`.mean()`/`.sum()`/`.count()`）才触发完整三段式。

### 3. 选哪列做「应用」决定结果形状
```python
df.groupby('Pclass')['Age'].mean()          # 单列 → 返回 Series（索引是Pclass）
df.groupby('Pclass')[['Age','Fare']].mean() # 多列 → 返回 DataFrame
df.groupby('Pclass').mean(numeric_only=True)# 所有数值列 → DataFrame
```

⚠️ 最后一行不加 `numeric_only=True`，新版 Pandas 会报错/警告（Name/Sex/Ticket 是字符串没法求均值，老版静默跳过，新版要求显式声明）——又一个「行为随版本变」的坑。

### 4. ⚠️ 分组列变成「索引」，不是普通列
```python
result = df.groupby('Pclass')['Age'].mean()
# 输出里 Pclass 看着像列，其实是 index（索引）
result['Pclass']     # ❌ KeyError，Pclass 是索引不是列名
result.loc[1]        # ✅ 按索引标签取，拿 Pclass=1 的均值
result.reset_index() # ✅ 把索引变回普通列
```

### 5. ⚠️ 实际踩坑：`reset_index()` 没赋值回去 → 仍 KeyError
```python
result.reset_index()        # ⚠️ 只生成新DataFrame并返回，没改 result 本身！
result['Pclass']            # 仍报 KeyError
result = result.reset_index()   # ✅ 必须重新赋值
# 或一步：result = df.groupby('Pclass')['Age'].mean().reset_index()
```

和 fillna/sort_values 同一规律：**非 inplace 方法默认返回新对象，不改原变量**。今天这条规律在 reset_index 上又中招了一次。

### 6. `agg()`：一次多个统计量 / 每列不同统计量
```python
df.groupby('Pclass')['Age'].agg(['mean','min','max','count'])         # 同列多统计量
df.groupby('Pclass').agg({'Age':'mean','Fare':'max','Survived':'sum'}) # 字典：每列各算各的
```

字典写法：key 是列名，value 是要对这列做的统计——一行算出「各舱位平均年龄/最高票价/存活人数」的综合报表。

### 7. ⚠️ `size()` vs `count()`
```python
df.groupby('Pclass').size()          # 每组多少行（不管缺失）
df.groupby('Pclass')['Age'].count()  # 每组里 Age 非缺失的个数
```

Age 有缺失时两者不一样。算缺失率要用 `size() - count()` 再除 `size()`，别拿 `count()` 当总人数。

### 陷阱题（已答对）
```python
df.groupby('Sex')['Survived'].mean()
```

`Survived` 是 0/1，求 `.mean()` 算出来是什么？为什么对「看起来是分类标签」的列求均值有意义？ **答**：算出来是**存活率**。`sum(Survived)` 本质是「数有多少个1」（0加了等于没加），`mean` = 1的个数 / 总数 = 1的比例。所以「0/1列求均值」= 「这类里百分之多少存活」，数学上完全等价，不是凑巧。**这是〇章「布尔/0-1 当数字用」的同一逻辑的另一面：求和=数True个数，求均值=算True比例。** 凡看到「对 0/1 或 True/False 列求 mean」，直接翻译成「在算占比」。

+ 实测著名发现：女性存活率约 0.742、男性约 0.189——「女士优先」在数据上极明显。
+ 多维度：`df.groupby(['Sex','Pclass'])['Survived'].mean()` 传列表 → 多重分组，结果是 MultiIndex（多层索引）；`.unstack()` 可把第二层索引展开成列，变成「行Sex×列Pclass」的交叉表。

---

## 六、数据类型转换：`astype`、分类变量 `Categorical`
### 1. `astype()` 基本转换
```python
df['Pclass'] = df['Pclass'].astype(str)   # 数字转字符串
df['Age'] = df['Age'].astype(int)          # 浮点转整数
```

### 2. ⚠️ `Age` 直接 `astype(int)` 会报错（报错保护）
```python
df['Age'].astype(int)   # ❌ Cannot convert non-finite values (NA or inf) to integer
```

回到一章——Age 因缺失被存成 float64。**整数类型完全不支持 NaN**，只要还有一个 NaN，强转 int 直接报错，而不是把 NaN 静默转成奇怪的值。这是「报错保护你」的好例子，跟「静默错误」相反，Pandas 主动拦住、不让你在不知情下丢失缺失信息。 **正确顺序：先处理缺失，再转类型**（这也解释了为什么「缺失值处理」排在「类型转换」前面讲——实际清洗流程本身就有先后依赖）：

```python
df['Age'] = df['Age'].fillna(df['Age'].median())
df['Age'] = df['Age'].astype(int)
```

### 3. ⚠️ 字符串「看起来像数字」不代表能直接转
```python
df['Ticket'].astype(int)   # ❌ ValueError
```

`Ticket` 混杂纯数字（`"349909"`）和带字母前缀（`"A/5 21171"`、`"STON/O2. 3101282"`）。转换前先抽样看实际内容（`df['Ticket'].head(20)`），别想当然。

### 4. 重点：`Categorical`（分类变量）
```python
df['Sex'] = df['Sex'].astype('category')
df['Embarked'] = df['Embarked'].astype('category')
```

普通 `object` 把每行字符串当独立 Python 对象存，891行里大量重复的 `'male'` 内存里不共享。`category` 的做法：**只存一份「取值字典」（male=0, female=1），每行实际存数字编号而非完整字符串**。好处：①**省内存**（取值种类少、行数多时显著）；②**加速分组/排序**（底层比数字编号，不逐字符比字符串）。

### 5. ⚠️ `category` 是「封闭」的：加新值报错/变 NaN
```python
df['Sex'] = df['Sex'].astype('category')
df.loc[0, 'Sex'] = 'unknown'   # ⚠️ 'unknown' 不在原分类列表 → 旧版报错 / 某些场景静默变NaN
# 正确：先显式声明新类别
df['Sex'] = df['Sex'].cat.add_categories(['unknown'])
df.loc[0, 'Sex'] = 'unknown'
```

`category` 的取值范围在转换那一刻就固定，事后加新类别要显式 `add_categories`。「以前能随便赋字符串，转 category 后突然赋值不生效/报错」的根源就在这。

### 6. 与 NumPy/PyTorch 的衔接
`category` 做的「把字符串类别映射成整数编号」，在学 PyTorch 处理分类特征（`nn.Embedding`）时会再次出现——Embedding 输入也要求整数索引，不能直接喂字符串。现在用 Pandas 把这步做熟，后面顺理成章。

### 陷阱题（用户答「更快」，是真优势但非核心考点）
```python
df['Pclass'] = df['Pclass'].astype('category')
df.groupby('Pclass')['Survived'].mean()
```

转 category 后 groupby 数值结果**不变**（category 只改底层存储，不改值）。**真正的坑在分组数量**：若之前筛过数据、某个 Pclass 取值筛得一行不剩——

+ 普通 int：groupby 只显示实际存在的分组（不出现没数据的值）
+ category：**仍会把那个「理论存在但实际没数据」的类别列出来，统计值填 NaN**（因为 category「记得」当初定义的全部类别清单）

后果：结果可能比预期「多出几行 NaN」，若代码假设「结果无 NaN / 行数=实际类别数」会被绊。解决：

```python
df.groupby('Pclass', observed=True)['Survived'].mean()   # 只统计实际出现过的类别
```

（注：`observed` 默认值在新版变化中，未来可能默认 True；结果对不上先 `pd.__version__` 确认——又一个版本坑。）

---

## 七、综合实战：Titanic 完整流程（读取→清洗→分组统计）
```python
import pandas as pd
import numpy as np

# 一、读取与初探
df = pd.read_csv('https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv')
print(df.info()); print(df.isna().sum())

# 二、缺失值处理（不同列不同策略！）
df['Age'] = df.groupby('Pclass')['Age'].transform(lambda x: x.fillna(x.median()))  # Age按组填中位数
df['Embarked'] = df['Embarked'].fillna(df['Embarked'].mode()[0])                    # Embarked缺得少，众数填
df = df.drop(columns=['Cabin'])                                                      # Cabin缺77%，整列丢弃
print(df.isna().sum())   # 确认 Age/Embarked 已无缺失

# 三、筛选 + 排序
first_class_survivors = df[(df['Pclass'] == 1) & (df['Survived'] == 1)]
print(len(first_class_survivors))
print(df.sort_values('Fare', ascending=False).head())

# 四、类型转换
df['Sex'] = df['Sex'].astype('category')
df['Embarked'] = df['Embarked'].astype('category')
df['Survived'] = df['Survived'].astype(bool)   # 0/1转bool，语义更清晰

# 五、groupby 综合统计
print(df.groupby('Pclass')['Survived'].mean())
print(df.groupby('Sex')['Survived'].mean())
survival_cross = df.groupby(['Sex', 'Pclass'])['Survived'].mean()
print(survival_cross)
print(survival_cross.unstack())   # 展成 行Sex×列Pclass 的交叉表
summary = df.groupby('Pclass').agg({'Age':'mean', 'Fare':'mean', 'Survived':'sum'})
print(summary)   # Survived已是bool，sum仍能数True个数
```

设计要点：**缺失值处理「分列分策略」**（Age按组填 / Embarked众数填 / Cabin整列丢）正是「不是所有缺失都用同一策略，先看缺失率和重要性」的体现。`**Survived**`** 转 bool 后 **`**sum**`** 仍可用**——bool 求和=数True个数，又一次「布尔当数字」。

---

## 八、追问后才真正弄清的三个点（很有价值，单独存档）
### 1. `loc`/`iloc` 为什么有两个参数
逗号前管行、逗号后管列；只给一个参数=只定位行、拿整行。详见二.2。

### 2. DataFrame 到底是什么数据结构、为什么要用它
+ **是什么**：可理解为**一组 Series（带标签的一维数组）打包在一起，共享同一套行标签**。每一列（Series）骨子里就是一个 NumPy 数组 + 一层「每个元素对应一个行标签」的壳——所以 `df['Age']` 的 dtype 是 float64（底层就是 NumPy float64 数组）。不同列之间类型可完全不同（Age float64 / Name object），因为**每列各自是独立一维数组**，DataFrame 只是横向拼起来共用行标签，不要求所有列同一种 dtype。
+ **行列地位不对等**：**列有名字（column 靠名字访问，第一公民），行有标签（index，可数字可任意，如日期）**。这正是 `loc`/`iloc` 存在的根本原因——**正因为给每行贴了「标签」（不一定是连续整数），才需要区分「按标签找」(loc) 和「按物理位置找」(iloc)**；若只能用连续整数当标签，二者根本没必要分。这也解释了「筛选后 loc/iloc 分道扬镳」：标签是自带身份证号不重排，位置只描述现在排第几、每次操作后重数。
+ **为什么用它**（对比 NumPy 数组）：①**按名字而非位置访问**（`df['Age']` vs `arr[:,5]`，可读性好，数据加列/换序不错位）；②**异构类型共存**（数字/字符串/日期/分类混存，这是关系型数据天然形态，NumPy「全员同类型」无法表达）；③**整套表格操作 API**（groupby、布尔筛选、merge/join、缺失值处理——语义都针对「有名字的列、有意义的行」设计，NumPy 得手写循环模拟）。
+ **与 PyTorch 的关系**（提前打预防针）：**Tensor 又回到「全员同类型、只能按位置访问」的世界**（像 NumPy 数组）。典型工作流：**用 Pandas 做清洗/筛选/探索（这些事 DataFrame 方便），训练前把清洗好的 DataFrame 转成纯数值的 NumPy 数组/Tensor**（要求所有列先变统一数字类型——这也是「类型转换/分类编码」要专门学的原因，字符串列没法直接喂模型）。今天所学都在为「原始杂乱表格 → 模型能吃的纯数字矩阵」这条流水线的「清洗探索阶段」做准备，DataFrame 不是终点。

### 3. `transform` 详解：聚合 vs 转换
我们用过 `df.groupby('Pclass')['Age'].transform(lambda x: x.fillna(x.mean()))`。

+ `**mean()**`** 等 = 聚合（aggregation），多对一**：每组多行压缩成一个数，合并后只剩组数那么多行（3个Pclass→3行）。
+ `**transform()**`** = 转换，多对多但形状不变**：输出行数和原列完全一样（891行），每组内部多行经处理后还是同样多行返回，只是值变了。
+ **内部三步**：①按 Pclass 把 Age 拆成3小段；②对**每小段分别**跑函数——这里 `x` 是**每组各自那一小段**，`x.mean()` 算的是该组自己的均值、填的也是该组缺失位置，各组独立互不影响；③把每小段结果**按原位置**拼回去，得到和原列行数/顺序对齐的新 Series。
+ **关键**：transform 自动把分组结果放回每行原本所在位置，所以能直接 `df['Age'] = ...` 赋值回去；而 `mean()` 得到的3行结果形状不匹配891行，没法直接赋值回去。
+ **一句话**：聚合=多行变一行（每组留一个汇总数）；转换=多行还是多行（每行值被替换成「它所在组」的统计量），行数始终对齐原表，故能直接赋回原列。
+ **小例子**（6行2组）：`mean()` → 只2行（头等舱30、三等舱20）没法套回6行；`transform(fillna(x.mean()))` → 6行对齐，头等舱缺的填30、三等舱缺的填20。

---

## 九、今天踩过 / 纠正过的坑（速查表）
| # | 坑 | 真相 | 防御 |
| --- | --- | --- | --- |
| 1 | `fillna(inplace=True)`<br/> 报 ChainedAssignmentError | CoW 下 `df['col']`<br/> 摘出的是拷贝，inplace 改的是注定被扔的临时对象，原表没动 | 只用 `df['col']=df['col'].method()`<br/>，永不用 inplace |
| 2 | 链式赋值 `df[cond]['col']=v` | 中间对象是视图还是拷贝不保证，可能不生效；CoW 版直接报错 | `df.loc[cond,'col']=v`<br/> 一步到位 |
| 3 | loc/iloc 混用 | loc 按标签(门牌号不重排)，iloc 按位置(排第几、每次重数) | 筛选/排序后想要「第几个」用 iloc；要重编号 `reset_index(drop=True)` |
| 4 | 筛选后 `loc[0]`<br/> KeyError | 标签0那行被筛掉了，门牌号0不存在 | 用 iloc[0]，或先 reset_index(drop=True) |
| 5 | `reset_index()`<br/> 没赋值回去 | 默认返回新对象不改原变量，原表仍是旧索引 | `df=df.reset_index(...)`<br/> 重新赋值 |
| 6 | `[]`<br/> 切片 `df[0:5]`<br/> 当取列 | 单列名取列、但切片取行，不对称的静默重载 | 取行用 loc/iloc；取列明确写列名/列表 |
| 7 | 多条件用 `and`<br/>/`or` | Series 没法转单个布尔值 → ValueError 真值有歧义 | 用 `&`<br/>/`|`<br/>，逐元素 |
| 8 | `&`<br/>/`|`<br/> 不加括号 | `&`<br/> 优先级高于 `>`<br/>/`==`<br/>，先算 `30 & Series` | 每个比较表达式单独用括号包 |
| 9 | `A > B == C`<br/> 链式比较 | 展开成 `(A>B) and (B==C)`<br/>，隐藏的 and 两边是 Series → ValueError | 别写链式比较；条件分开加括号 |
| 10 | `~(Age>30)`<br/> 把 NaN 行选进来 | NaN>30=False，~False=True，NaN 反而满足条件（我先讲错被纠正） | 不要 NaN 就 `& df['col'].notna()` |
| 11 | `==np.nan`<br/> 判断缺失 | NaN 不等于任何值（含自己），永远 False，静默给空结果 | 用 `isna()`<br/>/`notna()` |
| 12 | NaN 排序行为 | 不参与比较，升序降序都垫底；降序后 tail 拿到的是 NaN | 需要控制位置用 `na_position='first'` |
| 13 | 裸 `dropna()`<br/> 删光数据 | Cabin 缺77%，几乎每行都中招，不报错 | 先 `isna().sum()`<br/> 看缺失率，分列定策略 |
| 14 | groupby 后取分组列 | 分组列变成 index 不是普通列 | `reset_index()`<br/>（并赋值回）后再当列用 |
| 15 | `groupby()`<br/> 打印看不懂 | 只拆分没应用，无结果可展示 | 接 `.mean()/.sum()/.agg()`<br/> 才触发 |
| 16 | `groupby().mean()`<br/> 报错/警告 | 新版含字符串列要显式声明 | 加 `numeric_only=True` |
| 17 | `size()`<br/> vs `count()`<br/> 混用 | size 数总行、count 数非缺失个数，有缺失时不等 | 算缺失率用 `size()-count()`<br/>，别拿 count 当总数 |
| 18 | `Age.astype(int)`<br/> 报错 | 整数类型不支持 NaN，报错保护 | 先 fillna 再 astype(int) |
| 19 | `Ticket.astype(int)`<br/> 报错 | object 列混杂字母前缀，格式不统一 | 转前 head() 抽样看；混杂的别强转数字 |
| 20 | category 加新值失败 | category 封闭，取值范围转换时固定 | 先 `cat.add_categories([...])`<br/> 再赋值 |
| 21 | category 后 groupby 多出 NaN 行 | category 记得全部类别清单，没数据的类别也列出 | 不想要补 NaN 用 `observed=True` |
| 22 | 全局均值填 Age | 抹平 Age 与 Pclass/Sex 相关性，注入失真值 | 按组填 `groupby().transform(lambda x: x.fillna(x.mean()))` |
| 23 | `df1=df; df2=df`<br/> 做对比实验 | 指向同一对象，改一个连带改另一个 | 用 `df.copy()`<br/> 拷贝独立两份 |
| 24 | transform 写成 `x.mean` | 漏括号拿到方法对象，不是计算结果 | `x.mean()`<br/>；且结果要赋回 `df['col']=...` |
| 25 | `df_a = df.groupby(...)['Age'].transform(...)` | 把 Series 赋给了 df_a 变量本身，其他列全丢 | `df_a['Age'] = ...`<br/>，只替换那一列 |
| 26 | `df.fillna(数字)`<br/> 只想填一列 | 会用同一个数字填所有列（类型不匹配出问题） | `df['col']=df['col'].fillna(...)`<br/> 精确到列 |


---

## 十、可以自己再做的小实验
1. 手敲一个迷你 DataFrame（指定 `index=[10,20,30,40]`），分别用 `loc[20]` 和 `iloc[1]` 取数，亲眼看「标签 vs 位置」；再筛掉一行后看 `loc[10]` 报错、`iloc[0]` 正常。
2. 验证「Series 骨子里是 NumPy 数组」：`type(df['Age'].values)`、`df['Age'].dtype`，对比 NumPy 数组的同名属性。
3. 故意写 `df[df['Age']>30 & df['Sex']=='female']`（不加括号），看报 ValueError；再加括号跑通。
4. `df.isna().sum()` 后，把每列缺失数 / `len(df)` ×100 拼成 DataFrame 并 `sort_values` 降序——做一份缺失诊断报告。
5. 同一份数据，分别用全局均值、按 Pclass 分组均值填 Age（先 `df.copy()` 两份），对比头等舱填充值（≈38）和全局值（≈29.7）差近9岁、三等舱（≈25）差不到5岁——头等舱失真更大。
6. 把 Age 用 `pd.cut(df['Age'], bins=[0,12,18,35,60,100])` 分桶成 AgeGroup，再 `groupby('AgeGroup')['Survived'].mean()`，和 Sex、Pclass 的存活率对比，看哪个维度组间差值最大（性别约55个百分点最大，舱位次之，年龄最小）。
7. 转 `category` 后筛掉某个 Pclass 的全部数据，对比 `groupby` 加不加 `observed=True` 的结果行数差异。

---

## 衔接 Day 8
明天进入 PyTorch 基础，会把 Day 5 手写的线性回归用 PyTorch 重写，`autograd` 会自动算出 Day 5 手推的那个梯度——手推过一遍就不会当黑盒。届时数据预处理会用到今天的 Pandas 功夫：**清洗好的 DataFrame 要转成纯数值的 Tensor**（Tensor 像 NumPy 数组一样「全员同类型、只按位置访问」），所有字符串/分类列必须先经 `category` 或数字编码——今天「类型转换」那一节正是为此铺垫。Day 6 的 loss 曲线 / 预测散点 / 残差直方图三件套，到时可直接复用来可视化 PyTorch 版训练过程。今天的核心收获浓缩成两句：**①任何修改一律 **`**df['col']=df['col'].method()**`** 或 **`**df.loc[cond,col]=v**`**，永不用 inplace（CoW 时代的硬要求）；②loc 按标签、iloc 按位置，筛选/排序后二者必然分家。**
