学习目标：AI 方向求职

参考书：Python 官方文档（文件 I/O、异常处理与 `pathlib`）

本阶段重点：掌握真实项目中最常见的“读文件、写文件、处理路径、处理异常”闭环，为后续数据集读取和训练日志管理打基础。

今天主线：文件读写、`pathlib` 路径处理、异常处理，以及 CSV 数据集管理器这个小型综合项目。

关联笔记：前置 [[Day 1 学习笔记：Python 进阶语法|Python 进阶语法]]；后续 [[Day 3 学习笔记：NumPy 数组基础|NumPy 数组基础]]。

---

## 一、文件操作
### 1.1 基础读写
```python
# 写文件
with open("data.txt", "w", encoding="utf-8") as f:
    f.write("第一行\n")
    f.write("第二行\n")

# 读全部
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()

# 逐行读（推荐，省内存）
with open("data.txt", "r", encoding="utf-8") as f:
    for line in f:
        print(line.strip())
```

**要点：**

+ 永远用 `with open(...)`，会自动关闭文件，不要手动 `f = open(...)`
+ 永远指定 `encoding="utf-8"`，避免中文乱码
+ `.strip()` 去掉字符串两端的空白字符（空格、`\n`、`\t`） 
    - `.lstrip()` 只去左边，`.rstrip()` 只去右边

**文件模式：**

| 模式 | 含义 |
| --- | --- |
| `"r"` | 只读（默认） |
| `"w"` | 覆盖写 |
| `"a"` | 追加写 |
| `"r+"` | 读写 |


### 1.2 给每行加行号
```python
with open("output/notes.txt", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, start=1):
        print(f"{i}. {line.strip()}")
```

`enumerate(f, start=1)` 同时返回索引和值，`start=1` 表示从 1 开始计数。

### 1.3 路径处理（pathlib）
```python
from pathlib import Path

p = Path("datasets") / "mnist" / "train.csv"

print(p.parent)   # datasets/mnist    所在目录
print(p.name)     # train.csv         文件名（含后缀）
print(p.stem)     # train             文件名（不含后缀）
print(p.suffix)   # .csv              后缀

print(p.exists())   # 是否存在
print(p.is_file())  # 是否是文件
print(p.is_dir())   # 是否是目录

# 创建多层目录
Path("output/logs/2024").mkdir(parents=True, exist_ok=True)
#   parents=True  → 中间缺失的目录一起创建
#   exist_ok=True → 已存在时不报错

# 遍历目录下的文件
for f in Path("datasets").glob("*.csv"):     # 当前目录
    print(f)
for f in Path("datasets").glob("**/*.csv"):  # 所有子目录（** 任意层级）
    print(f)
```

**要点：**

+ 用 `Path` 而非字符串拼路径，跨平台安全（Mac/Linux 用 `/`，Windows 用 `\`）
+ `/` 运算符被重载用于拼路径，结果仍是 `Path` 对象
+ `open()` 直接接受 `Path` 对象，无需转字符串
+ `mkdir` 创建的是**目录**，不要用在文件路径上

---

## 二、异常处理
### 2.1 基本结构
```python
try:
    # 可能出错的代码
    result = 10 / 0
except ZeroDivisionError as e:
    # 出错后处理，e 是异常对象
    print(f"捕获到错误：{e}")
else:
    # try 里没出错才执行
    print(f"结果是 {result}")
finally:
    # 无论如何都执行，常用于释放资源
    print("执行完毕")
```

各块职责：

| 块 | 放什么 |
| --- | --- |
| `try` | 可能出错的代码 |
| `except` | 出错后怎么办 |
| `else` | 没出错时的后续逻辑 |
| `finally` | 无论如何都要做的收尾 |


`else` 和 `finally` 可选，最精简写法只需 `try` + `except`。

### 2.2 except 的几种写法
```python
# 捕获具体类型 + 拿到异常对象
try:
    x = int("abc")
except ValueError as e:
    print(e)

# 同时捕获多种异常
except (IndexError, ZeroDivisionError) as e:
    print(f"出错了：{e}")

# 分开捕获，分别处理
try:
    with open("data.txt", "r") as f:
        content = f.read()
    result = int(content)
except FileNotFoundError:
    print("文件不存在")
except ValueError:
    print("文件内容不是数字")
```

### 2.3 异常继承层级
```plain
BaseException
└── Exception              ← 普通异常的根
    ├── ValueError          ← 值不合法
    ├── TypeError           ← 类型不对
    ├── FileNotFoundError   ← 文件不存在
    ├── IndexError          ← 下标越界
    ├── KeyError            ← 字典 key 不存在
    └── ZeroDivisionError   ← 除以零
```

**要点：**

+ 捕获父类会同时捕获所有子类
+ 多个 `except` 时，**子类要写在父类前面**，否则父类先匹配，子类永远轮不到
+ 不要裸写 `except:` 或滥用 `except Exception`，会吞掉真正的 bug

### 2.4 raise 主动抛出
```python
# 主动抛出
def load_data(path):
    if not Path(path).exists():
        raise FileNotFoundError(f"找不到数据文件：{path}")

# 原样重新抛出
try:
    result = 10 / 0
except ZeroDivisionError as e:
    print("记录一下这个错误")
    raise   # 不加参数，原样抛出
```

### 2.5 自定义异常
```python
class DatasetError(Exception):
    """数据集相关错误的基类"""
    pass

class DatasetNotFoundError(DatasetError):
    def __init__(self, name: str):
        self.name = name
        super().__init__(f"数据集 '{name}' 不存在")

# 使用
try:
    raise DatasetNotFoundError("ImageNet")
except DatasetNotFoundError as e:
    print(e)        # 数据集 'ImageNet' 不存在
    print(e.name)   # ImageNet  还能访问自定义属性
```

`super().__init__(...)` 调用父类 `Exception` 的初始化方法传入错误信息，`print(e)` 才能显示文字。

---

## 三、综合项目：CSV 数据集管理器
模拟 AI 项目中管理实验数据的场景：读取 CSV → 统计类别 → 写出报告，全程有异常处理。

```python
import csv
from pathlib import Path
from collections import Counter


# ---------- 自定义异常 ----------
class CSVError(Exception):
    pass


class EmptyDatasetError(CSVError):
    def __init__(self, path):
        super().__init__(f"数据集为空：{path}")


# ---------- 核心函数 ----------
def load_csv(path: str) -> list[dict]:
    """读取 CSV 文件，返回字典列表，每行一个字典，key 为列名。"""
    rows = []
    try:
        with open(path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(dict(row))
    except FileNotFoundError:
        raise FileNotFoundError(f"找不到数据文件：{path}")
    except csv.Error as e:
        raise CSVError(f"CSV 解析失败：{e}")

    if not rows:
        raise EmptyDatasetError(path)
    return rows


def analyze_labels(rows: list[dict], label_col: str = "label") -> dict:
    """统计各类别样本数，返回 {label: count} 字典。"""
    if label_col not in rows[0]:
        raise KeyError(f"找不到列 '{label_col}'，可用列：{list(rows[0].keys())}")

    labels = [row[label_col] for row in rows]
    return dict(Counter(labels))


def save_report(stats: dict, output_path: str) -> None:
    """将统计结果写入报告文件。"""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    total = sum(stats.values())
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("=== 数据集统计报告 ===\n\n")
        f.write(f"总样本数：{total}\n")
        f.write(f"类别数量：{len(stats)}\n\n")
        f.write(f"{'类别':<12} {'数量':>6} {'占比':>8}\n")
        f.write("-" * 30 + "\n")
        for label, count in sorted(stats.items()):
            pct = count / total * 100
            f.write(f"{label:<12} {count:>6} {pct:>7.1f}%\n")

    print(f"报告已保存至：{output_path}")
```

**关键工具：**

| 工具 | 作用 |
| --- | --- |
| `csv.DictReader` | CSV 每行读成字典，key 是列名 |
| `csv.DictWriter` | 字典列表写成 CSV，自动按列名排序 |
| `writeheader()` | 写表头 |
| `Counter` | 列表元素计数，`Counter(["a","a","b"])`<br/> → `{"a":2,"b":1}` |
| `f"{x:<12}"` | 格式化左对齐占 12 位；`>`<br/> 右对齐；`.1f`<br/> 保留 1 位小数 |
| `newline=""` | 写读 CSV 的固定参数，避免 Windows 多空行 |


**注意：** CSV 读出来的值都是**字符串**，CSV 本身没有类型信息。

---

## 四、挑战题：分层切割数据集
把数据按比例分成训练集和测试集，且每个类别比例基本一致（分层采样简化版）。

**核心思路：** 先按类别分组 → 每组单独打乱 → 每组各切 80% → 合并

```python
import csv
import random
from pathlib import Path


def split_dataset(rows: list[dict], train_ratio: float = 0.8):
    # 第一步：按类别分组
    groups = {}
    for row in rows:
        label = row["label"]
        if label not in groups:
            groups[label] = []
        groups[label].append(row)

    # 第二步：每组打乱后按比例切割
    train = []
    test = []
    for label, group in groups.items():
        random.shuffle(group)               # 原地打乱
        cut = int(len(group) * train_ratio) # 切割点（向下取整）
        train += group[:cut]                # 前 cut 条进训练集
        test += group[cut:]                 # 剩余进测试集

    # 第三步：写入 CSV
    fieldnames = list(rows[0].keys())

    with open("output/train.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(train)

    with open("output/test.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(test)

    print("train.csv 和 test.csv 已保存至 output/")
    return train, test
```

**延伸：** 这就是机器学习中常见的分层采样，`sklearn` 的 `train_test_split(stratify=...)` 做的就是这件事，后面会经常用到。

**小注意：** 数据量小时 `int()` 向下取整会有误差（8 条按 0.8 切可能得到 5+3 而非 6+2），数据量大后可忽略。

---

## 五、易错点回顾
1. `**mkdir**`** 用在文件路径上** —— `mkdir` 创建目录，应作用于目录路径（`Path("output")`），不是文件路径（`Path("output/notes.txt")`）。
2. `**FileExistsError**`** vs **`**FileNotFoundError**` —— 名字相近语义相反。前者是"文件已存在"，后者才是"文件找不到"。
3. `**list(line.strip())**`** 把字符串拆成单字符** —— `list("hello")` 得到 `['h','e','l','l','o']`。逐行存储直接 `append(line.strip())` 即可。
4. **读写路径不一致** —— 写到 `output/notes.txt` 就要从 `output/notes.txt` 读，别建了目录却没写进去。
5. **代码结构混乱** —— 写文件的逻辑不要混进生成数据的代码块里，每个功能职责分清。

---

## 标准文件结尾写法
```python
if __name__ == "__main__":
    main()
```

+ 直接运行该文件：`__name__ == "__main__"`，执行 `main()`
+ 被其他文件 `import`：不执行 `main()`

这样文件既能独立运行，又能被安全导入。
