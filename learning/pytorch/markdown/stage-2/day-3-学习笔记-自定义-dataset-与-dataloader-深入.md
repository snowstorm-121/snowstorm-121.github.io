学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版，PyTorch 官方文档

本阶段重点：在 [[Day 1 学习笔记：nn.Module 与常用层入门]] 和 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中，已经能使用 Fashion-MNIST 自带的 Dataset 和 DataLoader 完成训练。今天继续理解它们内部的数据组织逻辑：当数据不再是现成的 Fashion-MNIST，而是 CSV、图片文件或业务表格时，如何把“原始数据的一行”稳定地送入训练循环。

今天主线：`自定义 Dataset + DataLoader`。核心心智模型是：**Dataset 定义“给定一个索引，怎样得到一条样本”；DataLoader 定义“按什么顺序取索引，以及怎样把多条样本组成一个 batch”。**

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 4 周 Day 3。它承接第 3 周 [[Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）]] 的手写数据批处理，也承接 Day 2 的 Fashion-MNIST 训练循环。

---

## 〇、贯穿全天的八条心智主线

### 1. 一条样本和一个 batch 是两个层次

一条学生成绩样本可以写成：

```plain
feature = [math, english, study_hours]    shape: (3,)
label = 1                                 shape: ()
```

一个 batch（例如包含 64 个学生）是：

```plain
batch_features    shape: (64, 3)
batch_labels      shape: (64,)
```

`Dataset` 面向的是“一条样本”；`DataLoader` 面向的是“一批样本”。不要把两者混在一起。

### 2. Dataset 不负责随机和分 batch

Dataset 的职责很小：给它 `index`，它返回第 `index` 条样本。

```python
feature, label = dataset[7]
```

Dataset 不应该在 `__getitem__` 里自行随机决定拿哪条数据，也不应该自己拼成 batch。否则数据顺序、是否打乱、训练集还是测试集都会分散在 Dataset 内部，难以控制和复现。

### 3. DataLoader 是数据进入训练循环前的调度器

DataLoader 负责：

```plain
决定索引顺序
-> 按 batch_size 分组
-> 对每个索引调用 Dataset
-> 把多条样本合并为 batch
-> 交给训练循环
```

所以，`shuffle=True` 改变的是“本轮取数据的索引顺序”，不是把原始 Dataset 本身打乱。

### 4. Python 的特殊方法必须精确拼写

下面三个名字不是普通函数名，而是 Python 约定的特殊方法：

```python
__init__
__len__
__getitem__
```

两边都必须恰好各有两个下划线。少一个、多一个，Python 都不会把它识别为相应行为。

### 5. 默认 collate_fn 的本质是“保持结构，合并同类位置”

如果每条样本返回：

```python
(feature, label)
```

默认 `collate_fn` 会把一批样本中所有第 0 项合并为 `batch_features`，所有第 1 项合并为 `batch_labels`。它不只支持元组，也支持字典和嵌套结构；关键不是“只能返回元组”，而是同一批样本的结构必须一致。

### 6. 表格处理、数值数组和模型训练是三层工具

```plain
CSV 文件 -> pandas DataFrame -> NumPy array -> torch Tensor -> 模型训练
```

`pandas` 擅长读列名和处理表格，NumPy 擅长普通数值数组，Tensor 才是模型、自动求导和 MPS/CPU 设备计算所使用的数据类型。正常流程通常是单向进入 Tensor，而不是在每个 batch 中反复来回转换。

### 7. 数据接口正确不等于 accuracy 自动更高

自定义 Dataset、DataLoader、更多 worker 是工程上的数据组织和吞吐工具，不是新的模型结构或正则化方法。它们能让真实数据更可靠地进入训练，但不会天然提高准确率。是否提升仍要看数据、模型、loss、优化器和实验结果。

### 8. 训练、验证、测试必须先分 Dataset，再建 DataLoader

```plain
完整 Dataset
-> train_dataset / val_dataset / test_dataset
-> train_loader / val_loader / test_loader
```

不要先把一个 DataLoader 建好再硬拆它。划分的对象是“样本集合”，DataLoader 只是读取这些集合的方式。

---

## 一、先和以前的 Fashion-MNIST 写法对照

在 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中，常见写法类似：

```python
train_dataset = datasets.FashionMNIST(
    root="data",
    train=True,
    transform=transforms.ToTensor(),
    download=True,
)

train_loader = DataLoader(
    train_dataset,
    batch_size=64,
    shuffle=True,
)
```

当时已经在使用 Dataset 和 DataLoader，只是 `FashionMNIST` 已经替我们写好了“如何根据索引读取一张图片及其标签”。

今天做的事不是换一个更强的训练方式，而是自己实现其中 Dataset 的部分：

```plain
FashionMNIST 内置 Dataset
        ↓
自己写 StudentDataset / CSV 数据集
```

训练循环的主体没有改变：

```python
for features, labels in train_loader:
    features = features.to(device)
    labels = labels.to(device)

    logits = model(features)
    loss = loss_fn(logits, labels)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

变化发生在训练循环的上游：以前由内置 Dataset 读图片；今天由自定义 Dataset 读 CSV。

---

## 二、Dataset 和 DataLoader 分别负责什么

### 1. Dataset：定义单条样本

一个 Dataset 至少需要回答两个问题：

```plain
这个数据集一共有多少条样本？
给定第 index 条时，返回什么？
```

概念上可以理解为：

```python
dataset[index] -> (feature, label)
len(dataset) -> 样本总数
```

例如 CSV 的第 7 行可能对应：

```python
dataset[7]
# 返回：
# (tensor([72.0, 70.0, 4.0]), tensor(1))
```

### 2. DataLoader：定义批量读取规则

```python
loader = DataLoader(
    dataset,
    batch_size=4,
    shuffle=True,
)
```

它要解决的是：

```plain
这轮训练按什么顺序访问样本？
每次取几条？
如何把多条样本拼起来？
```

典型输出：

```python
batch_features, batch_labels = next(iter(loader))
```

```plain
batch_features.shape = (4, 3)
batch_labels.shape = (4,)
```

### 3. 与第 3 周手写 batch 的对应

在 [[Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）]] 中，如果手动训练，常常自己决定：

```plain
本轮取哪些行
-> 用切片或索引拿 X_batch、y_batch
-> 送给模型
```

DataLoader 将这部分重复劳动封装起来：

```plain
手写索引、切片、拼 batch
        ↓
Sampler + Dataset + collate_fn + DataLoader
```

但心智模型没有变：模型始终拿到 `X_batch` 和 `y_batch`，再计算 logits、loss、梯度和参数更新。

---

## 三、三个特殊方法：`__init__`、`__len__`、`__getitem__`

### 1. `__init__`：构造数据集时准备数据

```python
def __init__(self, csv_path):
    dataframe = pd.read_csv(csv_path)
    ...
```

当执行：

```python
dataset = StudentDataset("student_scores.csv")
```

Python 会调用：

```python
StudentDataset.__init__(dataset, "student_scores.csv")
```

这里适合做：

- 读取 CSV 或元数据；
- 保存特征列、标签列；
- 将小型表格数据一次性转换为 Tensor；
- 保存图片路径、变换规则等配置。

这里通常不做“每次取样本时才需要的昂贵读取”。对于图片、音频等大数据，常见做法是 `__init__` 只保存文件路径，实际读文件留给 `__getitem__`。

### 2. `__len__`：报告样本数量

```python
def __len__(self):
    return len(self.labels)
```

调用：

```python
len(dataset)
```

本质上会触发：

```python
dataset.__len__()
```

DataLoader 需要总样本数，才能判断一个 epoch 有多少 batch。

例如数据集有 10 条、`batch_size=4` 且不设置 `drop_last=True`：

```plain
第 1 个 batch：4 条
第 2 个 batch：4 条
第 3 个 batch：2 条
```

所以：

```plain
len(loader) = 3
```

最后一批可能小于 `batch_size`。不要在模型或训练代码里写死：

```python
x = x.reshape(64, -1)  # 不推荐
```

更稳妥的写法是：

```python
x = x.reshape(x.shape[0], -1)
# 或
x = x.flatten(start_dim=1)
```

### 3. `__getitem__`：索引映射到一条样本

```python
def __getitem__(self, index):
    feature = self.features[index]
    label = self.labels[index]
    return feature, label
```

执行：

```python
feature, label = dataset[0]
```

等价于：

```python
feature, label = dataset.__getitem__(0)
```

这和 Day 1 的：

```python
logits = model(x)
```

会触发 `model.forward(x)` 很像。区别只是：

```plain
model(x)       -> 调用 forward，定义“数据如何经过模型”
dataset[index] -> 调用 __getitem__，定义“索引如何得到样本”
```

---

## 四、`dataset[index]` 背后的实际执行过程

### 1. 手动访问一条样本

```python
image, label = train_dataset[0]
```

这句不会自动创建 batch，也不会自动打乱。它只是要求 Dataset：

```plain
请给我索引为 0 的那一条样本。
```

如果此前没有定义 `train_dataset`，会出现：

```plain
NameError: name 'train_dataset' is not defined
```

这不是 DataLoader 的问题，而是示例代码默认你已经在前面创建了 `train_dataset`。独立运行时，应先定义对象：

```python
dataset = StudentDataset("student_scores.csv")
feature, label = dataset[0]
```

或者先创建 Fashion-MNIST 的 `train_dataset`，再访问它。

### 2. DataLoader 访问一条样本

当执行：

```python
batch_features, batch_labels = next(iter(loader))
```

大致发生：

```plain
1. iter(loader) 创建一次读取器。
2. sampler 产生这一轮要访问的索引顺序。
3. batch sampler 把索引分成一组，例如 [0, 1, 2, 3]。
4. DataLoader 依次调用 dataset[0]、dataset[1]、dataset[2]、dataset[3]。
5. collate_fn 将四条样本合并。
6. 返回 batch_features 和 batch_labels。
```

一个关键边界是：**DataLoader 决定索引，Dataset 只解释索引。**

---

## 五、DataLoader 如何采样、打乱和组成 batch

### 1. `shuffle=False`：按原顺序读取

```python
loader = DataLoader(dataset, batch_size=4, shuffle=False)
```

如果样本索引是：

```plain
0, 1, 2, 3, 4, 5, 6, 7, ...
```

第一批通常是：

```plain
[0, 1, 2, 3]
```

它适合验证集和测试集：评估不依赖梯度更新，固定顺序更便于定位问题和复现输出。

### 2. `shuffle=True`：每个 epoch 重新随机排列索引

```python
train_loader = DataLoader(dataset, batch_size=64, shuffle=True)
```

某一轮可能是：

```plain
8, 2, 0, 5, 1, 7, 3, 6, 4, ...
```

下一轮又会有另一种顺序。原始的 `dataset[0]` 仍然是同一条样本；变化的是 DataLoader 访问它们的顺序。

训练集常用 `shuffle=True`，因为连续 batch 不总是由同一种顺序或相邻样本构成，可以减少顺序带来的偏差。它不是“保证模型更强”的开关，但通常是监督训练的合理默认值。

### 3. `batch_size`：一次送入模型的样本数

```python
train_loader = DataLoader(dataset, batch_size=64, shuffle=True)
```

`batch_size` 同时影响：

- 每次梯度更新前累积多少样本的信息；
- 显存/统一内存占用；
- 一个 epoch 内更新参数的次数；
- 训练速度和优化行为。

它没有固定的“越大越好”答案。大 batch 可能提升吞吐，但会占用更多内存、每个 epoch 更新次数更少，也不一定有更好的泛化表现。应根据实际任务和实验结果选择。

### 4. `drop_last`：如何处理最后不足一批的样本

默认：

```python
DataLoader(dataset, batch_size=64, drop_last=False)
```

会保留最后不足 64 条的一批。训练和评估中通常可以保留它。

```python
DataLoader(dataset, batch_size=64, drop_last=True)
```

则会丢弃最后不足 64 条的一批。只有某些必须固定 batch 大小时才需要，例如部分依赖 batch 统计的场景；不要因为“看起来整齐”就默认丢数据。

### 5. `num_workers`：谁去并行准备样本

```python
loader = DataLoader(
    dataset,
    batch_size=64,
    shuffle=True,
    num_workers=0,
)
```

含义：

```plain
num_workers=0：主进程读取数据，最容易调试。
num_workers>0：额外进程并行调用 __getitem__ 和准备 batch。
```

对小型、已全部放入内存的 CSV，`num_workers=0` 往往足够，甚至多进程的启动和通信成本可能没有收益。

对大量图片、磁盘 I/O、复杂图像变换，适量 worker 可能提高数据供给速度。应先从 `0` 跑通，再实际尝试 `2` 等较小数值并观察速度，不要假设更多 worker 必然更快。

在 Apple Silicon Mac 上，先使用：

```python
num_workers=0
```

当需要多 worker 时，把脚本入口写成：

```python
def main():
    # 创建 Dataset、DataLoader 并训练
    pass


if __name__ == "__main__":
    main()
```

这样能避免 macOS 多进程重复执行脚本顶层代码的问题。

---

## 六、默认 `collate_fn`：如何把多条样本合成一个 batch

### 1. 从一批元组到两个 batch Tensor

假设 Dataset 返回：

```python
dataset[0]  # (tensor([90.0, 85.0, 6.0]), tensor(1))
dataset[1]  # (tensor([45.0, 50.0, 1.5]), tensor(0))
dataset[2]  # (tensor([78.0, 80.0, 4.5]), tensor(1))
```

DataLoader 先收集为：

```python
[
    (feature_0, label_0),
    (feature_1, label_1),
    (feature_2, label_2),
]
```

默认 `collate_fn` 按元组的位置分别处理：

```plain
(feature_0, feature_1, feature_2) -> stack -> batch_features
(label_0, label_1, label_2)       -> stack -> batch_labels
```

最终：

```plain
batch_features.shape = (3, 3)
batch_labels.shape = (3,)
```

其中 `torch.stack` 的直觉是“增加一个 batch 维度”：

```plain
3 个 shape 为 (3,) 的 feature
-> 一个 shape 为 (3, 3) 的 batch_features
```

### 2. 它不只支持元组

Dataset 也可以返回一个字典：

```python
def __getitem__(self, index):
    return {
        "feature": self.features[index],
        "label": self.labels[index],
    }
```

默认 `collate_fn` 会保留最外层字典结构：

```python
batch = next(iter(loader))

batch["feature"]  # shape: (batch_size, 3)
batch["label"]    # shape: (batch_size,)
```

可以把它理解为：

```plain
元组：按位置合并
字典：按 key 合并
嵌套结构：递归地按相同规则合并
```

因此重点不是“Dataset 必须返回元组”，而是“同一个 batch 内每条样本的结构、每个待 stack 的 Tensor shape 要能对齐”。

### 3. 什么情况下默认 collate_fn 会失败

例如句子长度不一样：

```plain
sample 1: token_ids.shape = (5,)
sample 2: token_ids.shape = (8,)
```

它们无法直接 `stack` 成一个二维 Tensor。这时才需要自定义 `collate_fn`，例如在一个 batch 内做 padding。

本次学生成绩数据中，每条特征固定都是 3 维，所以默认 collate_fn 正好适用，不需要额外封装。

---

## 七、从 CSV 构造自定义 Dataset

### 1. 假设 CSV 的一行就是一条样本

示例 `student_scores.csv`：

```csv
math,english,study_hours,label
90,85,6.0,1
45,50,1.5,0
78,80,4.5,1
```

设计约定：

```plain
math、english、study_hours -> 输入特征
label                       -> 分类标签
```

一行 CSV 对应：

```plain
一条样本 = (feature, label)
```

### 2. 小型表格数据的推荐实现

```python
import pandas as pd
import torch
from torch.utils.data import Dataset


class StudentDataset(Dataset):

    def __init__(self, csv_path):
        dataframe = pd.read_csv(csv_path)

        feature_columns = ["math", "english", "study_hours"]

        self.features = torch.tensor(
            dataframe[feature_columns].to_numpy(),
            dtype=torch.float32,
        )

        self.labels = torch.tensor(
            dataframe["label"].to_numpy(),
            dtype=torch.long,
        )

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, index):
        feature = self.features[index]
        label = self.labels[index]
        return feature, label
```

这段代码的职责拆分是：

```plain
__init__    读 CSV，选列，准备 features 和 labels
__len__     返回总样本数
__getitem__ 根据 index 返回一条 (feature, label)
```

对于这样的小 CSV，在 `__init__` 中一次性转为 CPU Tensor 很简单，也足够清晰。

### 3. 先验证 Dataset，再接 DataLoader

不要一上来就进入完整训练。先验证一条样本：

```python
dataset = StudentDataset("student_scores.csv")

print("样本数：", len(dataset))

feature, label = dataset[0]
print("单个特征：", feature)
print("特征 shape：", feature.shape)
print("特征 dtype：", feature.dtype)
print("标签：", label)
print("标签 shape：", label.shape)
print("标签 dtype：", label.dtype)
```

合理的结果是：

```plain
feature.shape  = (3,)
feature.dtype  = torch.float32
label.shape    = ()
label.dtype    = torch.int64
```

`label.shape = ()` 表示它是一个 0 维标量 Tensor。这是正常的；当许多标量标签被 collate 后，才会形成 `(batch_size,)`。

再检查一个 batch：

```python
from torch.utils.data import DataLoader

loader = DataLoader(
    dataset,
    batch_size=2,
    shuffle=False,
)

batch_features, batch_labels = next(iter(loader))

print(batch_features.shape)
print(batch_features.dtype)
print(batch_labels.shape)
print(batch_labels.dtype)
```

此处应看到：

```plain
batch_features.shape = (2, 3)
batch_features.dtype = torch.float32
batch_labels.shape   = (2,)
batch_labels.dtype   = torch.int64
```

这一步跑通，说明：

```plain
CSV -> Dataset 单条样本 -> DataLoader 默认 collate -> batch
```

的接口已经正确。

### 4. 小数据和大数据的不同写法

小型 CSV：

```plain
__init__ 中一次性读入全部内容并保存为 Tensor
```

大量图片、音频或超大文件：

```plain
__init__ 中保存路径和标签
__getitem__ 中根据 index 按需读一个文件
```

两者的 Dataset 接口相同；区别只是数据能否全部放进内存。不要为了一个只有几行的 CSV 过早写复杂的懒加载逻辑。

---

## 八、为什么会在 NumPy 和 Tensor 之间转换

### 1. 三种对象各自擅长什么

```plain
pandas DataFrame：按列名选择表格数据、读 CSV
NumPy ndarray：普通数值数组
torch Tensor：模型计算、自动求导、CPU/MPS/CUDA 设备迁移
```

因此读取 CSV 的自然路径是：

```python
dataframe = pd.read_csv(csv_path)
array = dataframe[feature_columns].to_numpy()
features = torch.tensor(array, dtype=torch.float32)
```

这不是无意义的绕路，而是从“表格语义”过渡到“模型数值计算”的过程。

### 2. 不要在训练循环中反复来回转换

不推荐：

```plain
Tensor -> NumPy -> Tensor -> 模型
```

尤其不要在每个 batch 中这样做。Tensor 进入训练循环后，应尽量保持为 Tensor：

```python
for features, labels in train_loader:
    logits = model(features)
```

只有在画图、导出结果、调用只接受 NumPy 的第三方工具时，才在训练外部使用：

```python
array = tensor.detach().cpu().numpy()
```

其中：

```plain
detach()：脱离计算图
cpu()：确保数据在 CPU 上
numpy()：转成 NumPy 数组
```

### 3. `torch.tensor` 和 `torch.from_numpy` 的区别

```python
torch.tensor(array, dtype=torch.float32)
```

会创建新的 Tensor 数据，写法直观，适合本次小 CSV。

```python
torch.from_numpy(array)
```

通常与 NumPy 数组共享 CPU 内存，少一次拷贝；但 dtype 由 NumPy 数组决定，后续修改任一对象也可能影响另一方。初学和小数据场景优先使用明确的 `torch.tensor(..., dtype=...)`，更容易保证接口正确。

---

## 九、训练集、验证集、测试集：先划 Dataset，再创建 Loader

### 1. 三份数据分别做什么

```plain
训练集 train：计算梯度，更新模型参数。
验证集 val：训练过程中评估、选模型和调超参数。
测试集 test：最后一次评估，用于报告泛化结果。
```

不能反复根据测试集结果改模型。否则测试集逐渐参与了决策，就不再是独立的最终检查。

### 2. 用 `random_split` 划分

```python
from torch.utils.data import random_split

total_size = len(dataset)
train_size = int(total_size * 0.7)
val_size = int(total_size * 0.15)
test_size = total_size - train_size - val_size

generator = torch.Generator().manual_seed(42)

train_dataset, val_dataset, test_dataset = random_split(
    dataset,
    [train_size, val_size, test_size],
    generator=generator,
)
```

固定随机种子意味着：相同数据和相同代码下，划分结果可复现。`random_split` 返回的是带索引映射的 `Subset`，通常不会复制三份完整数据。

对于只有 10 条记录的玩具 CSV，70% / 15% / 15% 会得到 `7 / 1 / 2` 或依照取整规则相近的大小。它的用途是理解流程，不适合用来得出可靠的模型性能结论。

### 3. 划分后再创建三个 DataLoader

```python
from torch.utils.data import DataLoader

train_loader = DataLoader(
    train_dataset,
    batch_size=64,
    shuffle=True,
)

val_loader = DataLoader(
    val_dataset,
    batch_size=64,
    shuffle=False,
)

test_loader = DataLoader(
    test_dataset,
    batch_size=64,
    shuffle=False,
)
```

理由：

```plain
train：需要反复更新参数，通常打乱。
val/test：只评估，通常保持顺序，不需要打乱。
```

以后若要做标准化、缺失值填充、类别编码等有“拟合参数”的预处理，应只用训练集计算这些统计量，再应用到验证集和测试集。否则会让验证/测试信息泄漏到训练阶段。

---

## 十、特征 dtype、标签 dtype 和 shape 的接口合同

训练前始终先问：

```plain
batch_features 能否作为模型输入？
batch_labels 能否作为 loss 的目标？
```

### 1. 本次二分类表格模型的接口

模型：

```python
model = nn.Sequential(
    nn.Linear(3, 8),
    nn.ReLU(),
    nn.Linear(8, 2),
)
```

其中：

```plain
3：每位学生有 3 个输入特征。
2：标签类别是 0 和 1，因此需要输出 2 个 logits。
```

接口应是：

```plain
features       shape: (batch_size, 3)   dtype: torch.float32
logits         shape: (batch_size, 2)   dtype: torch.float32
labels         shape: (batch_size,)     dtype: torch.long
```

这与 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中 Fashion-MNIST 的接口相同，只是输入从：

```plain
(batch_size, 1, 28, 28) -> Flatten -> (batch_size, 784)
```

变成了已经是二维表格特征的：

```plain
(batch_size, 3)
```

### 2. `CrossEntropyLoss` 的标签要求

```python
loss_fn = nn.CrossEntropyLoss()
loss = loss_fn(logits, labels)
```

对类别数为 `C` 的单标签分类：

```plain
logits.shape = (batch_size, C)
labels.shape = (batch_size,)
labels.dtype = torch.long
```

标签是类别编号：

```plain
0, 1, 2, ..., C - 1
```

不是 one-hot：

```plain
不需要 [1, 0]
不需要 [0, 1]
```

也不要在模型末尾先加 softmax；`nn.CrossEntropyLoss` 接收 logits，并在内部完成所需的稳定计算。这一点与 Day 1、Day 2 的分类训练保持一致。

### 3. 常见接口错误

| 现象 | 常见原因 | 应如何理解或修正 |
| --- | --- | --- |
| `expected scalar type Long but found Float` | 分类标签被转成了 `float32` | CSV 的 `label` 用 `dtype=torch.long`。 |
| target shape 是 `(batch_size, 1)` | 每条标签返回了长度为 1 的向量 | 应让单条标签是标量，batch 后自然得到 `(batch_size,)`。 |
| 特征是 `float64` | pandas/NumPy 默认浮点类型通常是 float64 | 明确写 `dtype=torch.float32`。 |
| `mat1 and mat2 shapes cannot be multiplied` | 输入特征数与 `nn.Linear(in_features, ...)` 不一致 | 本例每条样本 3 个特征，对应 `nn.Linear(3, ...)`。 |
| 最后一批报 shape 错误 | 代码把 batch size 写死为 64 | 用 `x.shape[0]` 或 `flatten(start_dim=1)`。 |

---

## 十一、设备迁移：Dataset 留在 CPU，batch 在训练循环迁移

设备选择继续沿用 Day 1、Day 2 的 MPS 优先策略：

```python
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")
```

模型移动：

```python
model = model.to(device)
```

batch 在训练或评估循环中移动：

```python
for features, labels in train_loader:
    features = features.to(device)
    labels = labels.to(device)

    logits = model(features)
```

不要在 Dataset 的 `__getitem__` 里写：

```python
return feature.to(device), label.to(device)  # 不推荐
```

原因是 Dataset 的职责是读取和组织 CPU 样本；DataLoader 可能有多个 worker，而模型设备由训练阶段统一决定。把设备迁移放在训练循环中，数据流更清楚，也更容易在 CPU、MPS、CUDA 之间切换。

---

## 十二、从 CSV 到训练的一条完整数据流

```plain
student_scores.csv
        |
        v
pandas.read_csv
        |
        v
StudentDataset.__init__
保存 features: float32，labels: long
        |
        v
random_split
train / val / test 三个样本子集
        |
        v
DataLoader
sampler 选索引 -> Dataset.__getitem__ -> default collate_fn
        |
        v
batch_features: (B, 3)     batch_labels: (B,)
        |
        v
移动到 device
        |
        v
nn.Linear(3, 8) -> ReLU -> nn.Linear(8, 2)
        |
        v
logits: (B, 2)
        |
        v
CrossEntropyLoss(logits, labels)
        |
        v
backward() -> optimizer.step()
```

其中模型和训练三步：

```python
model = nn.Sequential(
    nn.Linear(3, 8),
    nn.ReLU(),
    nn.Linear(8, 2),
).to(device)

loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
```

一个训练 batch：

```python
model.train()

for features, labels in train_loader:
    features = features.to(device)
    labels = labels.to(device)

    logits = model(features)
    loss = loss_fn(logits, labels)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

这部分训练骨架没有因为引入自定义 Dataset 而改变。变化只是 `features` 和 `labels` 的来源更加通用、可控。

---

## 十三、今天实际遇到的问题与排错复盘

### 1. 问题：`train_dataset` 没有定义

报错：

```plain
NameError: name 'train_dataset' is not defined
```

出现场景：

```python
image, label = train_dataset[0]
```

根因：代码片段假定 `train_dataset` 已在上文创建，但单独运行片段时这个变量不存在。

排查顺序：

```plain
先看报错变量是谁
-> 检查该变量是否在前面赋值
-> 检查运行顺序和变量名是否一致
```

修正不是“改 DataLoader 参数”，而是先创建 Dataset：

```python
dataset = StudentDataset("student_scores.csv")
feature, label = dataset[0]
```

### 2. 问题：`StudentDataset() takes no arguments`

报错：

```plain
TypeError: StudentDataset() takes no arguments
```

错误写法的关键部分：

```python
def ___init__(self, csv_path):
    ...

def **len**(self):
    ...

def **getitem**(self, index):
    ...
```

根因不是 CSV 路径或 pandas，而是特殊方法名称拼写错误：

```plain
___init__   前面有三个下划线，Python 不认识它是构造方法。
**len**     这是 Markdown 加粗符号，不是 Python 的 __len__。
**getitem** 同理，不是 __getitem__。
```

由于 Python 没有找到自定义的 `__init__`，它只能使用父类/默认的无参初始化方式。因此调用：

```python
StudentDataset("student_scores.csv")
```

就会被拒绝，并报“takes no arguments”。

正确写法：

```python
def __init__(self, csv_path):
    ...

def __len__(self):
    ...

def __getitem__(self, index):
    ...
```

这个问题提醒我：看到构造对象时报“参数不对”，不要立刻怀疑传参；也要检查类中 `__init__` 是否真的被 Python 识别。特殊方法的下划线数量是语法接口的一部分。

### 3. 问题：单条标签为什么是标量，而 batch 标签是一维

单条样本：

```plain
label.shape = ()
```

一个 batch：

```plain
batch_labels.shape = (batch_size,)
```

这是默认 collate_fn 将多个标量标签 stack 起来的结果，不是 shape 不一致。对于 `CrossEntropyLoss`，batch 标签正好应该是一维类别编号。

### 4. 问题：默认 collate_fn 为什么不只支持元组

答案是：它处理的是“样本的结构”。

```plain
如果样本是 Tensor：直接组合 Tensor。
如果样本是 tuple：按位置分别组合。
如果样本是 dict：按 key 分别组合。
如果样本嵌套：递归处理。
```

元组只是最常见、最适合 `(feature, label)` 的返回形式，不是唯一形式。

---

## 十四、今天容易踩的坑

### 1. 把 Dataset 和 DataLoader 的职责混在一起

```plain
Dataset：一条样本是什么。
DataLoader：怎么抽样和组 batch。
```

不要在 `__getitem__` 中自己随机抽行，也不要让 Dataset 直接返回整个 batch。

### 2. 类方法名的下划线数量错误

必须是：

```python
__init__
__len__
__getitem__
```

不要把 Markdown 的 `**` 复制进 Python 代码，也不要误写成三个下划线。

### 3. 忘记先定义 Dataset 对象

代码片段中的 `train_dataset`、`dataset`、`loader` 都是变量，不是 PyTorch 自动提供的关键字。单独运行前，要明确它们在哪里创建。

### 4. 分类标签是浮点型或 one-hot

本次使用 `CrossEntropyLoss`：

```python
labels = torch.tensor(..., dtype=torch.long)
```

不要写为 float，也不需要转 one-hot。

### 5. 特征保留成 float64

CSV 经 pandas/NumPy 读取后，浮点列常为 float64。模型参数通常是 float32，因此要明确：

```python
dtype=torch.float32
```

### 6. 将数据放到 MPS 的位置错误

不要在 Dataset 内迁移设备；在训练/评估循环中，对一个完整 batch 执行 `.to(device)`。

### 7. 把 `num_workers` 当成性能万能开关

先 `num_workers=0` 跑通，再测量是否需要增大。对于小 CSV，多 worker 未必更快。

### 8. 以为 DataLoader 封装后效果一定更好

DataLoader 的价值是正确、可重复、可扩展地供给数据。准确率是否变化需要真实实验比较；不要把工程封装与模型表达能力混为一谈。

---

## 十五、今天的核心对应关系

| 以前的手写/内置写法 | 今天理解到的底层职责 |
| --- | --- |
| `train_dataset[0]` | 调用 `train_dataset.__getitem__(0)`，得到一条样本。 |
| `len(train_dataset)` | 调用 `train_dataset.__len__()`，得到样本数。 |
| FashionMNIST | PyTorch 已实现的 Dataset；今天自己写的是同类接口。 |
| 手写切片取 `X_batch, y_batch` | DataLoader 用索引、采样和 collate 自动完成。 |
| `for X, y in train_loader` | 每次得到 DataLoader 组合好的一整个 batch。 |
| `X.to(device), y.to(device)` | 在训练循环中统一迁移 batch 到 MPS/CPU/CUDA。 |
| `nn.Linear(3, 2)` | 接收 `(B, 3)` 特征，输出 `(B, 2)` logits。 |
| `CrossEntropyLoss(logits, y)` | `y` 必须是 `(B,)` 的 `torch.long` 类别编号。 |

---

## 十六、Day 3 结束时应掌握

- [ ] 能用自己的话区分 Dataset 和 DataLoader 的职责。
- [ ] 知道 `dataset[index]` 调用 `__getitem__(index)`，`len(dataset)` 调用 `__len__()`。
- [ ] 能说清 DataLoader 从索引到 batch 的链路：采样 -> 取样本 -> collate。
- [ ] 知道训练集通常 `shuffle=True`，验证/测试集通常 `shuffle=False`。
- [ ] 知道 `batch_size` 不是越大越好，最后一个 batch 可能更小。
- [ ] 能解释默认 collate_fn 对 tuple、dict 的处理原则。
- [ ] 能从 CSV 写出一个最小可用的自定义 Dataset。
- [ ] 知道 Pandas -> NumPy -> Tensor 的原因，不会在训练循环里反复转换。
- [ ] 能先划分 Dataset，再创建 train/val/test 的 DataLoader。
- [ ] 能检查 `features: float32, (B, feature_dim)` 与 `labels: long, (B,)`。
- [ ] 遇到 `StudentDataset() takes no arguments` 时，能检查 `__init__` 的拼写和双下划线。
- [ ] 知道将 batch 移到 MPS 的位置是在训练循环，而不是 Dataset 内部。

如果这些都能结合自己的 `StudentDataset` 代码解释清楚，那么 Day 3 的核心目标已经完成。下一步再遇到真实图像、文本或更复杂数据时，仍然沿用同一条主线：先定义一条样本，再让 DataLoader 按训练需求把它们组织成 batch。
