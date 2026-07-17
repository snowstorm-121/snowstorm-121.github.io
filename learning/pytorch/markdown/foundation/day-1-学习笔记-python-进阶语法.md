学习目标：AI 方向求职

参考书：Python 官方文档（列表、字典、函数与类）

本阶段重点：从“会写基本 Python”过渡到能读懂后续数据处理与 PyTorch 代码中的容器操作、函数定义和对象组织方式。

今天主线：列表/字典推导式、函数进阶与面向对象（OOP）。重点不是堆语法，而是建立可读、可复用代码的基本表达方式。

关联笔记：后续学习 [[Day 2 学习笔记：文件操作 + 异常处理 + 综合小项目|文件操作、异常处理与综合小项目]]，并以 [[Day 3 学习笔记：NumPy 数组基础|NumPy 数组基础]]进入科学计算。

---

## 一、列表与字典高级用法
### 1. 列表推导式
普通 for 循环的简洁替代写法，一行完成列表生成。

```python
# 普通写法
result = []
for i in range(10):
    result.append(i * 2)

# 推导式写法（等价）
result = [i * 2 for i in range(10)]

# 带条件筛选
evens = [i for i in range(20) if i % 2 == 0]

# 双层推导式：压平嵌套列表
nested = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [num for row in nested for num in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

**规律：** 把 for 循环从外到内写进去，要取的值放最前面。

---

### 2. 字典推导式
```python
# 基本用法
squares = {x: x**2 for x in range(5)}
# {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}

# 配合 enumerate 使用
letters = ['a', 'b', 'c', 'd']
result = {x: (i + 1)**2 for i, x in enumerate(letters)}
# {'a': 1, 'b': 4, 'c': 9, 'd': 16}
```

**字典常用方法：**

```python
d = {'lr': 0.01, 'epochs': 100, 'batch': 32}

d.keys()           # 所有键
d.values()         # 所有值
d.items()          # 所有键值对
d.get('lr', 0.001) # 安全取值，不存在时返回默认值
```

---

### 3. 解包操作
```python
# 基本解包
a, b, c = [1, 2, 3]

# * 收集剩余元素
first, *rest = [1, 2, 3, 4, 5]
# first=1, rest=[2, 3, 4, 5]

# 函数返回多个值
def get_range(nums):
    return max(nums), min(nums)

high, low = get_range([3, 1, 7, 2])

# 循环解包（PyTorch DataLoader 就是这样取数据的）
data = [("cat", 0), ("dog", 1), ("bird", 2)]
for name, label in data:
    print(f"类别：{name}，标签：{label}")
```

---

## 二、函数进阶
### 1. *args 和 **kwargs
**原理：**

+ `*` = 收集位置参数，打包成**元组**
+ `**` = 收集关键字参数，打包成**字典**

```python
# *args：接收任意数量的位置参数
def add_all(*args):
    print(type(args))  # <class 'tuple'>
    return sum(args)

add_all(1, 2, 3)       # args = (1, 2, 3)
add_all(1, 2, 3, 4, 5) # args = (1, 2, 3, 4, 5)

# **kwargs：接收任意数量的关键字参数
def print_config(**kwargs):
    print(type(kwargs))  # <class 'dict'>
    for key, value in kwargs.items():
        print(f"{key} = {value}")

print_config(lr=0.01, epochs=100, batch_size=32)
# kwargs = {'lr': 0.01, 'epochs': 100, 'batch_size': 32}
```

---

### 2. lambda 表达式
**原理：** 把普通函数压缩成一行，同时省掉函数名。

```plain
def square ( x ) :  return x ** 2
lambda      ( x ) :         x ** 2
```

```python
# 基本用法
square = lambda x: x ** 2
print(square(5))  # 25

# 多个参数
add = lambda x, y: x + y
print(add(3, 4))  # 7

# 最常见用法：作为 sorted 的 key
students = [("Alice", 88), ("Bob", 72), ("Carol", 95)]
sorted_s = sorted(students, key=lambda s: s[1], reverse=True)

# 多条件排序（返回元组）
# -score 表示分数从高到低，name 表示字母顺序
sorted_s = sorted(students, key=lambda s: (-s[1], s[0]))
```

**lambda 的限制：** 只能写一个表达式，不能写多行逻辑。复杂函数用 `def`。

---

### 3. map 和 filter
**map：对每个元素做同样的操作，数量不变（变形）**

```python
nums = [1, 2, 3, 4, 5]

# map 写法
squared = list(map(lambda n: n**2, nums))
# [1, 4, 9, 16, 25]

# 等价的推导式写法
squared = [n**2 for n in nums]
```

**filter：按条件筛选元素，数量变少（筛选）**

```python
nums = [1, 2, 3, 4, 5, 6]

# filter 写法
evens = list(filter(lambda n: n % 2 == 0, nums))
# [2, 4, 6]

# 等价的推导式写法
evens = [n for n in nums if n % 2 == 0]
```

**注意：**`map` 和 `filter` 返回的是惰性对象，需要套 `list()` 才能看到结果。

| | map | filter |
| --- | --- | --- |
| 作用 | 变形 | 筛选 |
| 结果数量 | 和原列表一样 | 小于等于原列表 |
| 函数返回值 | 任意 | True / False |


---

## 三、面向对象（OOP）
### 核心概念
+ **类（class）**：模板，描述一类事物有哪些属性和方法
+ **对象**：根据模板创建出来的具体实例
+ **属性**：对象自身存储的数据（用 `self.xxx` 存储）
+ **方法**：对象能做的动作（类里面定义的函数）

---

### 1. class 基础
```python
class Dog:
    def __init__(self, name, age):  # 初始化方法，创建时自动调用
        self.name = name            # self.xxx 把数据存到对象自身
        self.age  = age

    def bark(self):
        print(f"{self.name} 说：汪汪！")

# 创建对象（实例化）
dog1 = Dog("旺财", 3)
dog2 = Dog("小白", 5)

dog1.bark()       # 旺财 说：汪汪！
print(dog2.name)  # 小白
```

**self 的作用：** 让方法知道是哪个对象在调用它，从而访问该对象自己的属性。

---

### 2. 继承
**作用：** 把多个类的共同部分提取到父类，子类只写自己特有的，避免重复代码。

```python
# 父类：放共同的东西
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        print(f"{self.name} 在吃东西")

# 子类：继承父类，只写自己特有的
class Dog(Animal):
    def bark(self):
        print(f"{self.name} 说：汪汪！")

class Cat(Animal):
    def bark(self):
        print(f"{self.name} 说：喵~")

dog = Dog("旺财")
cat = Cat("咪咪")

dog.eat()   # 旺财 在吃东西（从父类继承）
dog.bark()  # 旺财 说：汪汪！（子类自己的）
cat.bark()  # 咪咪 说：喵~（子类自己的）
```

---

### 3. super()
**作用：** 子类有自己的 `__init__` 时，用 `super()` 先执行父类的 `__init__`，否则父类定义的属性会丢失。

```python
class Animal:
    def __init__(self, name):
        self.name = name          # 父类负责存 name

class Cat(Animal):
    def __init__(self, name, color):
        super().__init__(name)    # 先让父类存好 name
        self.color = color        # 再存子类特有的 color

cat = Cat("咪咪", "橘")
print(cat.name)   # 咪咪（父类存的）
print(cat.color)  # 橘（子类存的）
```

---

### 4. 对应到 PyTorch
PyTorch 的模型就是一个继承了 `nn.Module` 的类，结构和上面完全一样：

```python
import torch.nn as nn

class MyModel(nn.Module):      # 继承 nn.Module（父类）
    def __init__(self):
        super().__init__()     # 先执行父类初始化
        self.layer = nn.Linear(10, 1)  # 存自己的属性

    def forward(self, x):      # 覆盖父类的 forward 方法
        return self.layer(x)
```

对应关系：

| PyTorch | 普通 OOP |
| --- | --- |
| `nn.Module` | Animal（父类） |
| `MyModel` | Cat（子类） |
| `super().__init__()` | 调用父类初始化 |
| `forward()` | 子类覆盖的方法 |


---

## 今日总结
| 知识点 | 核心用途 | 在 PyTorch 中的体现 |
| --- | --- | --- |
| 列表推导式 | 简洁生成/筛选列表 | 批量处理数据 |
| 字典推导式 | 简洁生成字典 | 存储模型配置参数 |
| 解包 | 同时取出多个值 | DataLoader 取 (images, labels) |
| *args / **kwargs | 接收不定数量参数 | 模型函数参数传递 |
| lambda | 简洁的一次性函数 | 排序、数据预处理 |
| map / filter | 批量变形 / 筛选 | 数据集处理 |
| class / 继承 / super() | 面向对象编程 | 定义 PyTorch 模型 |
