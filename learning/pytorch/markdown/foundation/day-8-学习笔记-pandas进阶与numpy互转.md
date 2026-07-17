学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版

本阶段重点：框架本身的行为和坑（视图/拷贝、共享状态、API 差异、静默错误），数据处理的纯数学/统计概念不再赘述。环境：MacBook Air M5 ｜ Miniconda 虚拟环境 `pytorch_env`

今天主线：Pandas 进阶 + 与 NumPy 互转，这是数据预处理阶段天天会用到的操作。四块内容——`map`/`apply`/`applymap`（按元素/按行处理）、`merge`（按键值匹配的表连接）、`concat`（按位置/索引对齐的堆叠拼接）、DataFrame ↔ NumPy 互转（流水线出口、对接 PyTorch）。今天的核心心智模型与 Day 5、6、7 一脉相承：**视图 vs 拷贝、共享状态、API 差异、静默错误**——并在此基础上新增一条独立主线：**「看起来像循环但其实是循环」vs「真正的向量化」**，这是 `apply`/`map` 系列最容易踩的反模式（能用，但慢到爆炸）。下面把主线知识、追问后才弄清的点、以及踩过的坑都记下来。

关联笔记：前置 [[Day 3 学习笔记：NumPy 数组基础|NumPy 数组基础]] 与 [[Day 7 学习笔记：DataFrame学习|DataFrame 核心操作]]；后续在 [[Day 9 学习笔记：Titanic 综合实战 —— 完整数据分析项目|Titanic 综合实战]]中完成数据流水线，并衔接 [[Stage1/Day 1 学习笔记：Tensor基本操作|Tensor 基本操作]]。

今天有一个非常重要的方法论收获：**关于 **`**category**`** 列转 NumPy 的拉齐规则，我（讲解方）连续两次判断被实测数据纠正**——第一次把规则讲得过于绝对，第二次靠跑代码才定位到真正决定结果的变量。完整记录见第八章，结构仿照 Day 7「取反 NaN 被纠正」那段，留作"听起来合理的推论 ≠ 真相，唯一标准是实测"的案例。

---

## 〇、贯穿全天的三条心智主线（先立住）
### 1. 默认不可变（immutable-by-default）：算出新值再赋回，永不依赖原地修改
延续 Day 7〇.1 那条「只用 `df['列名'] = df['列名'].方法()`」。今天 `map`/`apply` 系列同样适用，**没有例外**：

```python
df['Sex'].map({'male': 0, 'female': 1})          # ❌ 只算出新 Series 然后丢掉，df 原封不动
df['Sex'] = df['Sex'].map({'male': 0, 'female': 1})  # ✅ 显式赋值回去才生效
```

`map`/`apply`/`fillna`/`astype` 这一整族"看起来在处理某一列"的方法，**默认都返回新对象、不改原表**，这是 Pandas 统一的设计哲学。`map` 不像 `list.sort()` 那种会改原对象的方法，它的行为模式更接近 `df['Age'] * 2`——算个新东西返回给你，原数据纹丝不动。要落地必须自己赋值回去。

### 2. 标签 vs 位置（loc/iloc/索引对齐的总根源），今天换了两个新场景重现
Day 7 立的"标签不重排、位置每次重数"这条主线，今天在两个新地方原样复现：

+ `concat(axis=0)` 默认**不重置索引** → 拼接后出现重复标签（两个 `0`、两个 `1`），`loc[0]` 静默返回多行。
+ `concat(axis=1)` 是**按索引对齐**（不是按位置硬拼）→ 两表索引恰好都是 `0,1,2` 时看起来像位置拼接，是巧合；索引一旦经筛选/排序错开，立刻分家、静默填 NaN 或张冠李戴。

### 3. 【新】「看起来像循环但其实是循环」vs「真正的向量化」
`map`/`apply`/`applymap` 写起来很像"对每个值做点什么"的人类思维，但底层是**逐元素/逐行调用 Python 函数**，本质是 Pandas 接口包了一层 `for` 循环，**不是** NumPy 那种底层 C 实现的向量化：

```python
df['Age'] * 2                      # ✅ 真向量化，C 层一次性处理整列，快
df['Age'].apply(lambda x: x * 2)   # ⚠️ 看着差不多，逐元素调 Python 函数，慢几十倍
df['Name'].str.upper()             # ✅ .str 方法族是向量化的，优先用它而非 apply(lambda x: x.upper())
```

**原则：能用纯 Pandas/NumPy 运算（加减乘除、比较、**`**.str**`** 方法族）表达的，永远优先向量化；**`**apply**`** 只留给"逻辑复杂到没法用现成向量化方法表达"的场景。** Titanic 891 行感觉不到差异，处理几十万行时这个选择差出几十倍速度。

---

## 一、`map` / `apply` / `applymap`：三个名字像、作用域完全不同
这三个**不是同一家族的三个变体，而是作用对象不同**导致语义不同。记混的根源是没分清"我现在操作的是 Series 还是 DataFrame"。命名混乱属于历史遗留（几个方法改过名、有重叠又有区别）。

### 1. 四个方法的作用域对照
```python
df['Age'].map(func)      # Series 方法：逐元素处理
df['Age'].apply(func)    # Series 方法：逐元素处理（看起来和 map 一样！）
df.apply(func)           # DataFrame 方法：默认对每一整列（Series）传入 func
df.map(func)             # DataFrame 方法（新版才有，老版叫 applymap）：逐个单元格处理
```

**关键区分**：`Series.map` 和 `Series.apply` 在「逐元素」上效果几乎一样（历史遗留：`map` 最早专为"逐元素替换/映射"设计、尤其搭配字典查表，`apply` 设计更通用、能访问索引）。但 `df.apply(func)`（DataFrame 上调用）完全是另一回事：**默认把每一整列当参数传进 func，不是每个单元格**。同一个 `apply` 名字，在 Series 上是"逐元素"，在 DataFrame 上默认是"逐列"。

### 2. `Series.map`：最适合"查表替换"
```python
df['Sex'].map({'male': 0, 'female': 1})           # 字典查表
df['Age'].map(lambda x: x * 2)                     # 函数逐元素
df['Pclass'].map(df_lookup['Pclass'].to_dict())   # 另一个 Series 转字典做映射
```

⚠️ **最大的坑：字典/Series 里查不到的 key 静默变 NaN，不报错**：

```python
df['Sex'].map({'male': 0})   # 'female' 查不到 → 变 NaN，无任何警告
```

典型"静默错误"——你以为映射全做完了，结果一半数据悄悄变缺失值，代码层面什么都不抛。

### 3. `DataFrame.apply`：默认逐列（axis=0），axis=1 才是逐行
```python
df[['Age','Fare']].apply(lambda col: col.max() - col.min())        # 默认 axis=0：每列算一个值（极差）
df[['Age','Fare']].apply(lambda row: row['Age'] + row['Fare'], axis=1)  # axis=1：每行算一个值
```

`axis=0`（默认）传进 func 的是**一整列**（Series，长度=行数）；`axis=1` 传进 func 的是**一整行**（Series，长度=列数）。⚠️ 参数名是坑：直觉以为 `axis=1` 是"沿列方向"，实际 Pandas 里 `axis=1` = "操作沿列展开、结果按行收缩" = "逐行处理"。和 NumPy 的 `axis` 语义一致（axis=0 跨行压缩、axis=1 跨列压缩），但初学者易凭直觉读反。

### 4. `DataFrame.map`（新名）/ `applymap`（旧名）：真正的逐元素
```python
df[['Age','Fare']].map(lambda x: round(x, 1))      # 新版：每个单元格都跑一遍
df[['Age','Fare']].applymap(lambda x: round(x, 1)) # 旧版写法，新版已弹 FutureWarning / 逐步弃用
```

唯一"DataFrame 上调用、但真的逐个单元格处理"的方法。要对整表/某几列每一格做同样转换（四舍五入、统一大小写），这才是对的工具——用 `apply(axis=1)` 再手写内部循环逐格处理是常见误用，性能和可读性都更差。

### 陷阱题（已答对，核心已 get）
```python
df['Pclass_str'] = df['Pclass'].astype(str)
mapping = {'1': '一等舱', '2': '二等舱'}
df['Pclass_name'] = df['Pclass_str'].map(mapping)
print(df['Pclass_name'].isna().sum())
```

`Pclass` 有 1/2/3 三种取值，`mapping` 只写了 `'1'`/`'2'`。问：会报错吗？三等舱乘客变成什么？为何实际项目里特别危险？

**我的解答**：不会报错，但会把三等舱变成 NaN，导致数据缺失。

**补充（讲解时延伸的两层）**：

+ **比一般缺失更隐蔽**：Titanic 原始的 Age/Embarked 缺失是采集时就没有、`info()` 能查到源头；这里的 NaN 是**自己的代码在干净数据上凭空制造**的（Pclass 原本一行不缺），不回头检查极易误判成"上游数据问题"去排查错方向。
+ **对模型训练特别危险**：三等舱样本最多，若静默喂出 NaN，下游要么**丢掉大部分训练数据没人察觉**，要么把 NaN 当成无意义的"未知舱位"类别污染特征空间。错误不在这一行报出，而在几步之后模型效果异常时才暴露。
+ **防御写法**：映射前 `set` 对一下两边取值有没有缺口，或映射后立刻 `isna().sum()` 校验「新列缺失数 == 原列缺失数」：

```python
before = df['Pclass_str'].isna().sum()
df['Pclass_name'] = df['Pclass_str'].map(mapping)
assert df['Pclass_name'].isna().sum() == before, "map 引入了字典没覆盖的取值！"
```

---

## 二、`merge`：SQL 风格的表连接（按键值匹配）
**心智定位**：`merge` 关心"键值匹配"——两表里某字段值相等的行拼一起；它**只认键值、不关心谁前谁后**。（与 `concat` 的本质区别见第三章末对比表。）

### 1. 基本用法和四种 how
```python
pd.merge(df1, df2, on='PassengerId', how='inner')   # 默认 inner：两表都有的键（交集）
pd.merge(df1, df2, on='PassengerId', how='left')    # 保留左表全部行，右表没匹配上的列填 NaN
pd.merge(df1, df2, on='PassengerId', how='right')   # 反过来
pd.merge(df1, df2, on='PassengerId', how='outer')   # 两表所有键都保留（并集），没匹配上一律 NaN
```

`inner` 是**双向过滤**：左表没匹配上的丢、右表没匹配上的也丢。

### 2. ⚠️ 键有重复值 → 行数"爆炸"（笛卡尔积）
```python
# 左表 3 行 cust_id=1，右表 2 行 cust_id=1
pd.merge(df1, df2, on='cust_id', how='inner')   # 不是 3+2=5，是 3×2=6 行！
```

键重复时做的是**笛卡尔积**——左表键为某值的每一行，和右表键为该值的每一行各配对一次。若以为"合并后行数大致等于原表行数"，在键不唯一的真实数据里这个假设彻底失效，且**不报错不警告**，只是数据莫名变多。 **防御**：merge 前查 `df1['key'].is_unique`，或 merge 后对比 `len(merged)` 与 `len(df1)/len(df2)` 是否符合预期。

### 3. ⚠️ 同名非键列 → 自动加 `_x`/`_y` 后缀，静默改名
```python
# df1、df2 都有列 'Age'
merged = pd.merge(df1, df2, on='PassengerId')
merged.columns       # 'Age' 变成 'Age_x'、'Age_y'，原名 'Age' 不存在了
merged['Age']        # ❌ KeyError
```

又一个"自动化背后悄悄做决定"——检测到列名冲突自动加后缀避免覆盖，**逻辑是好心，但完全不报警告**。后续仍用 `merged['Age']` 会直接 KeyError，排查时第一反应常是"这列丢了"而非"被偷偷改名了"。 **防御**：`suffixes=('_old','_new')` 自定义后缀让歧义清楚，或 merge 前手动 `rename`。

### 4. `left_on` / `right_on`：两表键名不同时
```python
pd.merge(df1, df2, left_on='PassengerId', right_on='ID')
```

两表键列名本来就不同（很常见，不同系统导出）时分别指定，而非先改名再用 `on`。⚠️ 合并后**两个键列都保留**（PassengerId 和 ID 都在、值一样），想要干净结果通常要手动 `drop` 掉多余那列。

### 陷阱题（核心答对，"几行"需纠正）
```python
orders = pd.DataFrame({'cust_id': [1, 1, 2], 'amount': [100, 200, 50]})
customers = pd.DataFrame({'cust_id': [1, 2, 3], 'name': ['A', 'B', 'C']})
result = pd.merge(orders, customers, on='cust_id', how='left')
```

问：result 几行？客户 C（cust_id=3）会出现吗？

**我的解答**：~~4 行~~（实测是 **3 行**，下方纠正）；客户 C 不会出现，因为 `how='left'` 以左表为准，左表 orders 里没有 cust_id=3。

**纠正与补充**：

+ **行数 = 3，不是 4**：`left` 决定"骨架"是左表 orders（3 行）；右表 customers 的 cust_id 无重复，每条订单最多匹配右表一行，所以不发生笛卡尔积膨胀，结果行数 = 左表行数 = 3。**踩中"merge 行数直觉"这条线**：别凭感觉猜数字，先确认"骨架表是谁、骨架表本身有没有重复键、被引用的另一表有没有重复键"。
+ **客户 C 不出现的真相**：`how='left'` 这个词容易误解成"两表左半边信息都保留"，实际只保证"**左表的所有行**都保留"，跟左表压根没提到的右表内容（哪怕客观存在）无关。要找"customers 里从没下过单的客户"，得把 customers 放左边做 left，或用 outer 再筛 amount 为 NaN 的行。

---

## 三、`concat`：堆叠拼接（按位置/索引对齐）
**心智定位**：`concat` 完全不看值，只看"位置/索引怎么对齐"，单纯堆叠。一个是"找对象拼"（merge），一个是"摞起来拼"（concat）。

### 1. `axis=0`：纵向堆叠（最常用）
```python
pd.concat([df_jan, df_feb], axis=0)   # 默认 axis=0，上下接起来，列名须大致一致，行数=两表之和
```

最典型场景：分批读取的数据（按月分文件存的日志/订单），读完每月 DataFrame 后纵向拼回完整表。

### 2. ⚠️ 默认不重置索引 → 索引重复，loc 静默返回多行
```python
result = pd.concat([df_jan, df_feb], axis=0)
result.index    # [0,1,0,1]！两表各自原索引原样保留，没重新编号
result.loc[0]   # 返回的不是一行，是两行的 DataFrame（df_jan第0行 + df_feb第0行），且不报错
```

延续 Day 7"筛选/排序后标签不重排"主线——`concat` 拼接后默认连索引都不重排，新表出现两个 `0`、两个 `1`，`loc[0]` 不报错但静默返回多行。 **防御（固定动作，非可选）**：

```python
result = pd.concat([df_jan, df_feb], axis=0, ignore_index=True)   # ✅ 重新从0连续编号
```

### 3. `axis=1`：横向拼接（按索引对齐，不是按位置硬拼）
```python
pd.concat([df_info, df_score], axis=1)
```

"按索引对齐"是关键词——看的是两表**行索引（label）****是否一致，****不是看两表恰好都 3 行就并排贴上****。两表索引都是默认 **`**0,1,2**`** 时结果看着像"按位置对齐"，但这只是****索引恰好长得跟位置一样**的巧合，和 Day 7"Titanic 默认索引和位置数值一样、筛选后才分家"是同一陷阱模式。

### 4. ⚠️ 索引对不齐 → 静默插 NaN（不报错，也不是按位置硬拼）
```python
df_a = pd.DataFrame({'x': [1,2,3]}, index=[0,1,2])
df_b = pd.DataFrame({'y': [10,20,30]}, index=[1,2,3])   # 故意错开一位
pd.concat([df_a, df_b], axis=1)
```

结果不是简单并排粘起来，而是**先取两边索引的并集（0,1,2,3），再按索引对号入座，对不上的位置填 NaN**：

```plain
x     y
0  1.0   NaN     # df_a有索引0，df_b没有 → NaN
1  2.0   10.0    # 对齐成功
2  3.0   20.0
3  NaN   30.0    # df_b有索引3，df_a没有 → NaN
```

和"两表都 3 行就并排成 3 行"的直觉完全不同——**实际变 4 行、多出的全是 NaN，且无警告**。两表若分别处理/排序/筛选过（索引乱了或不连续），直接 `axis=1` 极易在此中招：表面"两表行数都对得上"，实际对齐的是索引、不是行数。 **防御**：横向拼接前确认两表索引是否真对应同一批数据、同一种顺序；必要时先 `reset_index(drop=True)`（前提是确认两表"第几行"本就该对应同一条记录），或改用 `merge`（按共同键字段对齐，不依赖索引）。

### 5. `merge` vs `concat` 本质区别（一句话收尾）
| | 依据 | 典型场景 | 行数变化 |
| --- | --- | --- | --- |
| `merge` | 按某列的**值**匹配 | 两表语义不同（订单表+客户表），靠键字段关联 | 可能膨胀（键重复）、可能减少（inner 丢不匹配的） |
| `concat (axis=0)` | 按**位置**堆叠 | 两表语义相同（同结构、不同批次），单纯接长 | 严格等于两表行数之和 |
| `concat (axis=1)` | 按**索引**对齐 | 两表语义不同但行行对应（同批样本的不同特征来源） | 索引取并集，可能比任一表都长 |


`concat` 从不检查"两表某列值是否相等"，只认索引/位置；`merge` 从不关心"谁前谁后"，只认键值匹配。

### 陷阱题（核心答对，NaN 位置需精确化）
```python
df_features = pd.DataFrame({'Age': [22, 38, 26]})           # index 默认 0,1,2
df_labels = df_features[df_features['Age'] > 25][['Age']].copy()
df_labels['Survived'] = [0, 1]
combined = pd.concat([df_features, df_labels.rename(columns={'Age': 'Age2'})], axis=1)
```

问：combined 几行？哪些位置 NaN？这个序列暴露什么风险？

**我的解答**：df_labels 2 行（筛 Age>25 剩 38、26），索引是 1,2；combined 3 行；NaN 在 ~~Age2 列第一行、Survived 列第一行~~（精确说是**索引为 0 的那一行**，Age2 和 Survived 两列都 NaN）；有些数据被筛掉，拼接后出现 NaN。

```plain
Age   Age2  Survived
0   22    NaN     NaN     ← df_labels 没有索引0，两列都 NaN
1   38   38.0     0.0
2   26   26.0     1.0
```

**补充（这道题真正想暴露的、比"会有 NaN"更危险的点）**：

+ **真正的风险是数据错位，不只是缺失**。设想更隐蔽版本：若 df_labels 在筛选后又被 `sort_values` 排序、或中间又做过别的筛选/拼接导致索引不连续/不按原顺序，`axis=1` 拼出来的结果里**每行的 Age 和 Survived 可能根本不是同一个样本的**，但因为索引"恰好都存在、能对上号"，Pandas 不报任何错。你拿到一张行数对、没有 NaN 的"完整"表，内容却张冠李戴——比出现 NaN 危险得多（NaN 至少 `isna().sum()` 能看到；索引错位但凑巧对齐是**完全无声的数据污染**）。在 ML 场景下相当于喂了系统性错配的特征-标签对，模型照样收敛但毫无意义、查不出原因。
+ **根因**：`concat axis=1` 隐含假设"两表索引代表同一意义体系下的同一批对象"，一旦其中一表索引经过独立的筛选/重排，假设悄悄失效而代码毫无察觉。
+ **安全做法**：合并不同来源的特征/标签时优先 `merge` + 明确主键（如 PassengerId），别依赖索引隐式对齐；或 concat 前显式检查 `df_features.index.equals(df_labels.index)`。

---

## 四、DataFrame ↔ NumPy 互转（流水线出口、对接 PyTorch）
离 PyTorch 最近的一块——Day 7 末尾预告的"清洗好的 DataFrame 转成纯数值 Tensor"，这一节就是那条流水线的最后一段。

### 1. `.values` vs `.to_numpy()`：新旧 API
```python
df[['Age','Fare']].values        # 老写法，能用，官方建议逐步淘汰
df[['Age','Fare']].to_numpy()    # 新写法，官方推荐
df[['Age','Fare']].to_numpy(dtype='float32')   # 可直接指定输出类型，PyTorch 常用 float32
```

`to_numpy()` 是后加的更明确接口，解决 `.values` 在带时区时间/稀疏数组等特殊类型上行为模糊、版本不一致的历史包袱。**新代码优先 **`**.to_numpy()**`，读老代码要认得 `.values` 是同一回事。`dtype='float32'` 提前打预防针：PyTorch Tensor 默认 float32，而 Pandas/NumPy 默认推断常是 float64，下面专门讲这个落差。

### 2. ⚠️ 混合 dtype 一起转 → 拉齐成"能装下所有列取值的最窄类型"
**核心规则（被我两次讲错后、靠实测定下的最终版，见第八章）**：

Pandas 找"能装下所有列**实际取值**的最窄类型；判断标准是**取值的本质**，不是类型标签的名字**。**只要有一列取值本质上不是数字（不管标签叫 object 还是 category），就退到 object；只要所有列取值本质上都是数字（即使某列标签是 category），就能拉齐成数值类型。**

按"宽容程度"从严格到宽松：

1. 全部列同一数值类型（全 int64 / 全 float64）→ 保持该类型
2. int64 + float64 → 拉齐成 **float64**（float 能表示 int 的所有值，反之不行）
3. 数值列 + category（底层类别本身是数字，如 Pclass=1/2/3）→ 拉齐成对应**数值类型（int64）**【实测确认】
4. 数值列 + category（底层类别是字符串，如 Sex='male'/'female'）→ 退化成 **object**【实测确认】
5. 数值列 + 普通字符串列（非 category）→ 退化成 **object**

⚠️ 第 5 种最常见也最狠：只要有一列字符串，**整个数组退化成 object**，原本是数字的列在新数组里也变 Python 对象（看着是数字、已不是真正数值数组），后续做矩阵运算或喂 PyTorch 直接类型报错，而**转换这一步本身不报错不警告**，错误推迟到下游毫不相干处才爆。**这就是"类型转换/分类编码"必须排在"转 NumPy/Tensor"之前的原因**——喂模型前所有列必须先变统一数值类型，字符串/分类列先编码成数字。

⚠️ **额外关键点**：`category` 列直接 `to_numpy()` 拿到的是**显示值（原始类别）**，不是 `.cat.codes`（真正的整数编号）。数字型 category（Pclass）显示值就是 3/1/2，看着正常但语义是"舱位等级本身"而非"字典序编码 0/1/2"；要真正的整数编码必须显式：

```python
df['Pclass'].cat.codes.to_numpy()   # 得到 [2,0,1]（按类别字典序编号），而非 [3,1,2]
```

### 3. ⚠️ 转出来是拷贝还是视图？——今天最后一个"视图 vs 拷贝"考点
```python
df = pd.DataFrame({'Age': [22, 38, 26]})
arr = df.to_numpy()
arr[0] = 999
df['Age']   # 有没有被改？—— 不一定！
```

**不保证**：有时拷贝（改 arr 不影响 df），有时视图（改 arr 连带改 df），官方说法是"尽量返回视图但不保证"。单一 dtype、内存连续的简单情况常返回视图（共享内存省一次拷贝）；一旦涉及"类型拉齐"（如 int64+float64→float64）必然发生类型转换计算，这种情况**几乎一定是拷贝**（原始数据从未以统一类型连续存在过，必须重新生成）。 **不能靠猜，唯一安全做法是显式控制**：

```python
arr_safe = df.to_numpy(copy=True)   # ✅ 显式要求拷贝，明确不共享内存
```

这正是 Day 7〇.1 主线的最终落点——"任何要修改的场合，一律用一步到位、不依赖默认行为的写法"，今天搬到"转 NumPy 后还要不要继续改这个数组"的新场景。

### 4. 与 PyTorch 的直接衔接（提前打预防针）
```python
import torch
arr = df[['Age','Fare']].to_numpy(dtype='float32', copy=True)
tensor = torch.from_numpy(arr)    # NumPy → Tensor，⚠️ from_numpy 默认共享内存（视图）！
```

`torch.from_numpy()`**默认共享内存**（文档明确，不是不确定行为），改 tensor 连带改 arr。想要独立 Tensor（PyTorch 那边操作不意外影响 NumPy 这边）用 `torch.tensor(arr)`（拷贝）而非 `from_numpy`。和今天 `to_numpy(copy=...)` 是同一条"视图 vs 拷贝"主线一路贯穿到底，Day 9/10 正式展开。

### 陷阱题（关键纠正：连续两次被实测纠正，详见第八章）
```python
df = pd.DataFrame({'Age': [22, 38, 26], 'Pclass': [3, 1, 2]})
df['Pclass'] = df['Pclass'].astype('category')
arr = df.to_numpy()
print(arr.dtype)   # 我先说 object，实测是 int64
print(arr)         # [[22 3] [38 1] [26 2]]
```

问：arr.dtype 是什么？Pclass 列存的值长得像编码（0/1/2）还是原始值（3/1/2）？对"先 category 编码、再转 NumPy 喂模型"意味什么风险？

**最终正确答案（实测确认）**：dtype 是 **int64**（不是 object）；Pclass 列存的是**原始值 3/1/2**（显示值，不是 cat.codes 的 0/1/2）。因为 Pclass 的底层类别本身就是整数 3/1/2，能安全装进 int64，所以没被迫退到 object。 **风险**：风险不在"category 永远拖累成 object"，而在**你以为 category 列里存的是编码（如以为 male/female 已变 0/1），但 **`**to_numpy()**`** 默认拿到的是显示值（原始类别）**。数字型 category（Pclass）这个误解不会立刻暴露（显示值看着就是数字），反而最危险——表面相安无事，需自己确认拿到的是"原始类别值（1/2/3 表等级本身）"还是期望的"整数编码索引（0/1/2 表字典序）"，两者语义不同，用错喂模型导致特征语义和你以为的不一致。字符串型 category（Sex）反而安全，因为退化成 object 会在转换那刻直接暴露、报错链路清晰。

---

## 五、四块串起来的完整流水线骨架（清洗探索 → 模型输入）
今天四块的实际位置，在"原始杂乱表格 → 模型能吃的纯数字矩阵"这条流水线上：

```python
import pandas as pd, numpy as np, torch

# 0. 读取（Day 7）
df = pd.read_csv('titanic.csv')

# 1. 多表整合（今天）：merge 按键关联不同来源 / concat 堆叠分批数据
#    df = pd.merge(df_main, df_extra, on='PassengerId', how='left')
#    df = pd.concat([df_2023, df_2024], axis=0, ignore_index=True)

# 2. 缺失处理（Day 7）+ 派生特征（今天的 map/apply）
df['Age'] = df.groupby('Pclass')['Age'].transform(lambda x: x.fillna(x.median()))
df['FareLevel'] = df['Fare'].apply(lambda x: 'high' if x > 50 else 'low')   # 复杂逻辑用 apply
df['Title'] = df['Name'].str.extract(r',\s*([^\.]+)\.')                      # 能向量化的用 .str

# 3. 分类编码（Day 7 category / 今天 map 查表）→ 必须先变数字，否则第4步退化成 object
df['Sex'] = df['Sex'].map({'male': 0, 'female': 1})       # 字典查表（先确认覆盖全部取值！）
df['Embarked'] = df['Embarked'].astype('category').cat.codes  # category 取真正的整数编码

# 4. 出口到 NumPy/Tensor（今天）：全数值后才能转，显式 dtype + copy
features = df[['Age', 'Fare', 'Sex', 'Embarked']].to_numpy(dtype='float32', copy=True)
X = torch.tensor(features)   # 独立 Tensor（不共享内存）
```

**串联记忆**：merge/concat 解决"多个表合一张"；map/apply 解决"按需派生/转换列"；类型转换+编码解决"字符串变数字"；to_numpy 解决"DataFrame 变矩阵"。前三步任何一步留下非数值列或意外 NaN，第 4 步都不会报错，问题一路带到训练阶段。

---

## 六、今天踩过 / 纠正过的坑（速查表）
| # | 坑 | 真相 | 防御 |
| --- | --- | --- | --- |
| 1 | `df['col'].map({...})`<br/> 不生效 | map 默认返回新对象、不改原表，没赋值就丢了 | `df['col'] = df['col'].map({...})` |
| 2 | `map`<br/> 字典没覆盖全 → 静默 NaN | 查不到的 key 静默变 NaN，不报错 | 映射后 `isna().sum()`<br/> 校验缺失数不变；或先 `set`<br/> 对取值 |
| 3 | `df.apply`<br/> 以为逐元素 | DataFrame 上 apply 默认逐**列**（传整列 Series），不是逐格 | 逐格用 `df.map()`<br/>(原 applymap)；逐行用 `apply(axis=1)` |
| 4 | `axis=1`<br/> 方向读反 | axis=1 = 逐**行**处理（结果按行收缩），不是"沿列" | 记死：axis=0 逐列、axis=1 逐行；和 NumPy 一致 |
| 5 | 用 `apply(lambda)`<br/> 做能向量化的事 | apply 是隐藏 Python 循环，比向量化慢几十倍 | 加减乘除/比较/`.str`<br/> 方法族优先向量化，apply 留给复杂逻辑 |
| 6 | merge 行数"爆炸" | 键重复时做笛卡尔积（左m×右n），不报错 | merge 前查 `key.is_unique`<br/>；后对比 len 是否符合预期 |
| 7 | merge 后 `df['Age']`<br/> KeyError | 同名非键列被自动加 `_x`<br/>/`_y`<br/> 后缀，静默改名 | `suffixes=(...)`<br/> 自定义；或 merge 前手动 rename |
| 8 | `left_on/right_on`<br/> 后多一列 | 两个键列都保留（值一样） | 手动 `drop`<br/> 多余的那列 |
| 9 | 猜 merge 行数（如猜 4 实为 3） | 行数由"骨架表 + 双方键是否重复"共同决定，非凭感觉 | 先确认骨架是谁、骨架/对方表有无重复键 |
| 10 | 以为 `how='left'`<br/> 保留两表左半 | left 只保证"左表全部行"在，与左表没提到的右表内容无关 | 找"右表中无匹配"的，把右表放左做 left 或用 outer |
| 11 | concat 后索引重复 | `axis=0`<br/> 默认不重置索引，出现两个 0、两个 1 | `ignore_index=True`<br/> 重新从 0 连续编号 |
| 12 | concat 后 `loc[0]`<br/> 返回多行 | 标签 0 重复 → loc 静默返回 DataFrame 而非一行 | 同上，拼接即加 `ignore_index=True` |
| 13 | `concat(axis=1)`<br/> 索引错开静默 NaN | 按索引取并集对齐，对不上填 NaN；不是按位置硬拼 | 拼前确认索引一致；不一致先 reset_index 或改用 merge |
| 14 | `concat(axis=1)`<br/> 数据张冠李戴 | 索引"凑巧都存在"会对齐成错配的行，完全无声 | 用 merge+主键；或 `df1.index.equals(df2.index)`<br/> 检查 |
| 15 | `category`<br/> 转 NumPy 拉齐成什么 | 看底层类别取值本质：数字→数值类型(int64)，字符串→object（**我连两次讲错，见八章**） | 别看类型标签名，看类别实际是数字还是字符串；实测确认 |
| 16 | `category`<br/> 转 NumPy 拿到原始值非编码 | to_numpy 取显示值（3/1/2），不是 cat.codes（0/1/2） | 要整数编码显式 `.cat.codes.to_numpy()` |
| 17 | 字符串列混入转 NumPy → object | NumPy 全员同类型，有一列非数值整体退 object，不报错 | 喂模型前所有列先转数值（astype/map/cat.codes） |
| 18 | `to_numpy()`<br/> 是视图还是拷贝 | 不保证；类型拉齐时几乎是拷贝，单一 dtype 连续时常是视图 | 永远显式 `to_numpy(copy=True)`<br/>，不靠猜 |
| 19 | `to_numpy(dtype='int')`<br/> 遇 NaN | 整数类型不支持 NaN → 报错保护（同 Day7 astype(int)） | 先 fillna 再转 int；含 NaN 的列默认已是 float64 |
| 20 | `torch.from_numpy`<br/> 改一个连带改另一个 | from_numpy 默认共享内存（视图），文档明确 | 要独立用 `torch.tensor(arr)`<br/>（拷贝） |


---

## 七、可以自己再做的小实验
1. 同一个"转大写"任务，分别用 `df['Name'].apply(lambda x: x.upper())` 和 `df['Name'].str.upper()`，确认结果一样；再用 `%timeit` 对比一个放大到几万行的列上两者耗时差几十倍。
2. `df.apply(func)` 不加 axis（逐列）、加 `axis=1`（逐行），各打印一次结果和 `type()`，亲眼看"逐列结果索引是列名 / 逐行结果索引是行号"。
3. 造两个键有重复的小表跑 `merge`，手算笛卡尔积行数（左m×右n）再和 `len(merged)` 对，验证"爆炸"。
4. 两表都有同名列做 merge，打印 `merged.columns` 看 `_x`/`_y`，再用 `suffixes` 换成有意义的后缀。
5. `concat(axis=0)` 不加/加 `ignore_index=True` 各跑一次，打印 `.index`，再试 `loc[0]` 看返回一行还是多行。
6. 造两个索引故意错开（`index=[0,1,2]` vs `index=[1,2,3]`）的表做 `concat(axis=1)`，验证结果变 4 行且对角填 NaN。
7. 同一列 `astype('category')` 后，分别用 `to_numpy()` 和 `.cat.codes.to_numpy()`，对比拿到"原始值"还是"整数编码"；再把类别换成字符串（如 Sex）重测 `to_numpy().dtype` 看变 object。
8. `df.to_numpy()` 后改第一个元素，回头打印原 df 看有没有连带变（视图/拷贝）；再加 `copy=True` 重测，确认独立。

---

## 八、本日重要纠错记录：`category` 转 NumPy 的拉齐规则（连续两次被实测纠正）
仿照 Day 7「取反 NaN 被实测纠正」的格式，单独存档——这是今天最有价值的方法论案例。

**背景**：陷阱题问 `Age(int64) + Pclass(category，类别是数字3/1/2)` 一起 `to_numpy()` 的 dtype。

**第一次讲错**：我断言"混合 int64 和 category 会被拉齐成 **object**"。 → 用户实测截图：dtype 是 **int64**，值是 `[[22 3] [38 1] [26 2]]`。我的判断被当场推翻。

**第一次纠错时我的反思**：错误在于把"category 类型本身不是数值类型"这个事实，**过度泛化**成"所以混入数值列必然变成 object"——这步推导跳得太快。真正决定拉齐结果的，不是 category 这个**类型标签**，而是它**底层类别的实际取值**能不能被数值类型安全表示。这里类别恰好是整数 1/2/3，能装进 int64，所以没退到 object。

**修正后我提出的假设**：若 category 包的是字符串（如 Sex='male'/'female'），才会退到 object。并请用户实测情况 B 验证。 → 用户第二次实测截图：情况 A（数字型 category）输出 `int64`，情况 B（字符串型 category）输出 `object`。**修正后的判断被实测完全验证。**

**最终定论（经两次实测确认）**：

`to_numpy()` 始终找"能装下所有列**实际取值**的最窄类型；判断标准是**取值的本质**，不是类型标签的名字**。**只要有一列取值本质上不是数字（不管标签叫 object 还是 category），就退到 object；只要所有列取值本质上都是数字（即使某列标签是 category），就能拉齐成数值类型。**

**方法论收获**（这才是这条记录的真正价值）：

+ 和 Day 7「取反 NaN」的纠错**结构完全一样**：都是"听起来很合理的推论，实际跳过了一个关键变量没考虑"——上次漏了"NaN 比较返回 False"，这次漏了"决定因素是底层取值不是类型标签"。
+ 唯一能确认真相的方式是**跑代码实测**，不是靠"听起来对不对"判断。我作为讲解方也会犯这种"过度泛化"的错，**对任何"静默行为"类的结论，最终都要以你自己环境的实测为准**。
+ 引申出一条更通用的分类习惯：**要分清"哪些操作是报错保护你、哪些是悄悄给你错误结果"**——今天 `to_numpy(dtype='int')` 遇 NaN 报错是前者（同 Day 7 的 astype(int)），而 map/merge/concat/to_numpy 一堆静默坑是后者，两类要分开记、分开防。


