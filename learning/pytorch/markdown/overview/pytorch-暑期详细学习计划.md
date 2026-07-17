**适用背景**：人工智能硕士新生，Python 有基础，NumPy/Pandas 接触过，目标进入头部大厂算法/开发岗  
**学习节奏**：每周5天学习日（上午 9:00–11:30 主攻 PyTorch），2天轻松休息日，中间保留旅游留白  
**核心资料**：《动手学深度学习》PyTorch版（zh.d2l.ai）+ PyTorch 官方文档

---

## 10天Python基础强化学习计划

目标：为第三周正式学习 PyTorch 打好基础 每天学习时长：2-3小时

![](https://cdn.nlark.com/yuque/0/2026/png/40434945/1781157623066-cb5785bd-6712-4847-8ae6-6220854c594a.png)

---

### 第一阶段：Python 进阶语法（第1-2天）

#### Day 1 — 推导式 + 函数进阶 + 面向对象

**学习内容**

- 列表推导式、字典推导式（含条件筛选）
- 函数进阶：`*args` / `**kwargs`、`lambda`、`map` / `filter`
- 面向对象：`class`、`__init__`、继承

**为什么重要** PyTorch 里每个模型都是一个类，不懂 `class` 和继承就看不懂任何模型代码。

**预计时长**：~3小时

---

#### Day 2 — 文件操作 + 异常处理 + 综合小项目

**学习内容**

- 文件读写：CSV、JSON
- 异常处理：`try` / `except`
- 综合项目：用 Day 1 + Day 2 的知识写一个「学生成绩管理」小程序

**为什么重要** 处理数据集时天天需要读写文件和处理异常。

**预计时长**：~3小时

---

### 第二阶段：NumPy（第3-6天）

#### Day 3 — 数组创建 + 索引切片 + reshape

**学习内容**

- `ndarray` 的各种创建方式（`zeros`、`ones`、`arange`、`linspace`）
- 多维索引、花式索引、布尔索引
- `reshape` / `flatten` / `squeeze` / `expand_dims`

**为什么重要** NumPy 的数组操作和 PyTorch Tensor 几乎一一对应，学好这里等于提前学了一半 Tensor。

**预计时长**：~3小时

---

#### Day 4 — 广播机制 + 矩阵运算

**学习内容**

- broadcasting 规则彻底搞懂
- 点积、矩阵乘法（`np.dot` / `np.matmul` / `@`）
- 转置（`.T`）、逆矩阵

**为什么重要** 广播机制是理解 PyTorch 张量运算的核心前置知识，不懂这个后面会一直绊脚。

**预计时长**：~3小时

---

#### Day 5 — 统计函数 + 随机模块 + 手写线性回归

**学习内容**

- 统计函数：`mean` / `std` / `sum` / `argmax` / `argmin`
- 随机模块：`np.random`
- 实战：用纯 NumPy 手写线性回归（不用任何 ML 库）

**为什么重要** 手写线性回归是本阶段最重要的练习，做完之后学 PyTorch 会有「原来只是换了写法」的感觉。

**预计时长**：~3小时

---

#### Day 6 — Matplotlib 可视化

**学习内容**

- 折线图、散点图、直方图
- 子图布局（`subplot`）
- 把 Day 5 的线性回归训练过程（loss 曲线）画出来

**为什么重要** 训练模型时需要实时观察 loss 曲线，可视化是必备技能。

**预计时长**：~2.5小时

---

### 第三阶段：Pandas（第7-8天）

#### Day 7 — DataFrame 核心操作

**学习内容**

- 读取 CSV（`read_csv`）
- 筛选、排序、`groupby`
- 缺失值处理、数据类型转换
- 练习数据集：Titanic

**为什么重要** 真实项目中数据几乎都以表格形式存储，Pandas 是处理这类数据的标准工具。

**预计时长**：~3小时

---

#### Day 8 — Pandas 进阶 + 与 NumPy 互转

**学习内容**

- `apply` / `map`
- `merge` / `concat`
- DataFrame 转 NumPy array（`.values` / `.to_numpy()`）

**为什么重要** 数据预处理的最后一步通常是把 DataFrame 转成 NumPy array，再送进 PyTorch。

**预计时长**：~3小时

---

### 第四阶段：综合实战（第9-10天）

#### Day 9 — 完整数据分析项目

**学习内容** 用 Titanic 数据集完整走一遍以下流程：

1. 数据读取与清洗
2. 特征分析与统计
3. 可视化
4. 用 NumPy 手写一个最简单的分类预测

**为什么重要** 把前8天的知识串联起来，模拟真实项目流程。

**预计时长**：~3小时

---

#### Day 10 — 查漏补缺 + PyTorch 预习

**学习内容**

- 回顾前9天最薄弱的环节
- 提前了解 PyTorch Tensor 与 NumPy 的对比和异同
- 熟悉 `torch.tensor`、`torch.zeros`、`.shape` 等基础操作

**为什么重要** 让第三周第一天学 PyTorch 时不陌生，平滑过渡。

**预计时长**：~2.5小时

---

### 重点提示

- **Day 3-4 的 NumPy 广播机制**是整个基础阶段最难的知识点，要多跑例子感受规律
- **Day 5 手写线性回归** 和 **Day 9 完整项目** 是两个重头戏，难度会明显上升
- 每天写完代码后发给老师检查，有问题及时纠正
- 遇到卡点不要硬扛超过10分钟，直接来问

---

## 总体结构

|   |   |   |   |
|---|---|---|---|
|阶段|周次|主题|核心产出|
|一|第3周|Tensor + Autograd|手写线性回归，不用任何 nn 模块|
|二|第4周|nn 模块 + 完整训练流程|MLP 在 MNIST 跑到 95%+|
|三|第5周|CNN + ResNet|ResNet 迁移学习做图像分类|
|四|第6周|Transformer + BERT|HuggingFace 文本分类微调|
|五|第7–9周|方向实战 + 论文复现|GitHub 上的完整复现项目|

**第1–2周**（Python进阶 + 计网 + NumPy）见暑期总计划，PyTorch 从第3周正式开始。

---

## 阶段一：Tensor + Autograd（第3周）

### 目标

理解 PyTorch 的基本数据结构和自动微分机制，这是后续所有内容的地基。

### 第3周每日安排

#### Day 1｜Tensor 基础操作

**课程**：《动手学深度学习》2.1–2.3节  
**阅读**：PyTorch 官方文档 `torch.Tensor`

**上午任务（9:00–11:30）**：

- 阅读教材 2.1 数据操作
- 跟着敲一遍所有代码示例，不要复制粘贴

**实验 1：Tensor 操作练习**

```
import torch

# 练习1：创建各种 Tensor
a = torch.zeros(3, 4)
b = torch.randn(3, 4)
c = torch.arange(12).reshape(3, 4)

# 练习2：形状操作——掌握这几个函数
x = torch.randn(2, 3, 4)
print(x.shape)
print(x.reshape(2, 12).shape)
print(x.squeeze().shape)          # 去掉大小为1的维度
print(x.permute(0, 2, 1).shape)   # 转置指定维度

# 练习3：广播机制——理解为什么能这样计算
a = torch.ones(3, 1)
b = torch.ones(1, 4)
print((a + b).shape)   # 输出应该是 (3, 4)，想清楚为什么

# 练习4：GPU 操作（有显卡的话）
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x = torch.randn(3, 3).to(device)
print(x.device)
```

**下午自查**：不看代码，默写出从 NumPy 数组转 Tensor、再转回去的完整写法。

---

#### Day 2｜Tensor 进阶 + 索引切片

**课程**：《动手学深度学习》2.1节后半 + 官方文档索引操作

**上午任务**：

- 掌握高级索引（布尔索引、花式索引）
- 理解 `view` vs `reshape` 的区别（内存连续性）
- 掌握 `cat` / `stack` / `split` / `chunk`

**实验 2：数据预处理模拟**

```
import torch
import numpy as np

# 模拟一个真实场景：处理一批图像数据
# 假设有 32 张 3通道 224x224 的图像
batch = torch.randn(32, 3, 224, 224)

# 任务1：计算每张图像每个通道的均值
# 提示：对 dim=(2,3) 求均值
channel_mean = batch.mean(dim=(2, 3))   # shape: (32, 3)
print("每张图像每个通道的均值 shape:", channel_mean.shape)

# 任务2：归一化（减均值除标准差）
mean = batch.mean(dim=(0, 2, 3), keepdim=True)   # shape: (1, 3, 1, 1)
std  = batch.std(dim=(0, 2, 3), keepdim=True)
normalized = (batch - mean) / std
print("归一化后均值（应接近0）:", normalized.mean().item())

# 任务3：切出前8张图像的红色通道
red_channel = batch[:8, 0, :, :]
print("红色通道 shape:", red_channel.shape)   # (8, 224, 224)

# 任务4：用布尔索引找出批次中均值大于0的图像
img_means = batch.mean(dim=(1, 2, 3))
mask = img_means > 0
print("均值大于0的图像数量:", mask.sum().item())
```

---

#### Day 3｜Autograd 自动微分

**课程**：《动手学深度学习》2.4–2.5节  
**阅读**：PyTorch 官方文档 `torch.autograd`

**上午任务**：

- 理解 `requires_grad`、计算图、`.backward()`
- 理解为什么每次迭代要 `optimizer.zero_grad()`
- 理解 `torch.no_grad()` 和 `detach()` 的用途

**实验 3：手动实现梯度计算**

```
import torch

# ---- 实验 3a：验证自动微分 ----
# 手动算：y = x^2 + 2x + 1，dy/dx = 2x + 2
x = torch.tensor(3.0, requires_grad=True)
y = x**2 + 2*x + 1
y.backward()
print(f"x=3 时 dy/dx = {x.grad.item()}")   # 应该是 8.0
print(f"手动验证：2*3+2 = {2*3+2}")          # 也是 8

# ---- 实验 3b：多变量梯度 ----
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = (x ** 2).sum()   # y = x1^2 + x2^2 + x3^2
y.backward()
print(f"梯度应为 [2,4,6]，实际为: {x.grad}")

# ---- 实验 3c：理解计算图 ----
x = torch.randn(3, requires_grad=True)
y = x * 2
z = y.mean()
z.backward()
print(f"z 对 x 的梯度: {x.grad}")   # 每个元素应该是 2/3

# ---- 实验 3d：no_grad 的使用场景 ----
x = torch.randn(3, requires_grad=True)
with torch.no_grad():
    y = x * 2
print(f"no_grad 下 y.requires_grad: {y.requires_grad}")   # False
```

---

#### Day 4｜手写线性回归（纯 Tensor 实现）

**课程**：《动手学深度学习》3.1–3.2节

这是阶段一最重要的实验，**不借助任何 nn 模块**，纯手写，真正理解训练过程。

**实验 4：从零手写线性回归**

```
import torch
import matplotlib.pyplot as plt

# ---- 1. 生成数据 ----
torch.manual_seed(42)
true_w = torch.tensor([2.0, -3.4])
true_b = torch.tensor(4.2)

n = 1000
X = torch.randn(n, 2)
noise = torch.randn(n) * 0.01
y = X @ true_w + true_b + noise   # 真实标签

# ---- 2. 初始化参数 ----
w = torch.randn(2, requires_grad=True)
b = torch.zeros(1, requires_grad=True)

# ---- 3. 定义模型和损失函数（手写） ----
def linreg(X, w, b):
    return X @ w + b

def mse_loss(y_hat, y):
    return ((y_hat - y) ** 2).mean()

# ---- 4. 训练循环（手写梯度下降） ----
lr = 0.03
batch_size = 10
num_epochs = 5
losses = []

for epoch in range(num_epochs):
    # 随机打乱索引
    idx = torch.randperm(n)
    for i in range(0, n, batch_size):
        batch_idx = idx[i:i+batch_size]
        X_batch = X[batch_idx]
        y_batch = y[batch_idx]

        # 前向传播
        y_hat = linreg(X_batch, w, b)
        loss = mse_loss(y_hat, y_batch)

        # 反向传播
        loss.backward()

        # 手动更新参数（不用 optimizer）
        with torch.no_grad():
            w -= lr * w.grad
            b -= lr * b.grad
            w.grad.zero_()   # 手动清零梯度
            b.grad.zero_()

    # 记录每个 epoch 的 loss
    with torch.no_grad():
        epoch_loss = mse_loss(linreg(X, w, b), y)
        losses.append(epoch_loss.item())
        print(f"Epoch {epoch+1}, Loss: {epoch_loss.item():.6f}")

print(f"\n真实 w: {true_w.tolist()}, 学到的 w: {w.tolist()}")
print(f"真实 b: {true_b.item():.2f}, 学到的 b: {b.item():.2f}")

# ---- 5. 画 loss 曲线 ----
plt.plot(range(1, num_epochs+1), losses, marker='o')
plt.xlabel("Epoch"); plt.ylabel("MSE Loss")
plt.title("训练 Loss 曲线"); plt.grid(True)
plt.savefig("linear_regression_loss.png", dpi=150)
plt.show()
```

**验收**：w 和 b 应该非常接近真实值，loss 应该趋向于接近0。

---

#### Day 5｜手写 Softmax 分类（纯 Tensor）

**课程**：《动手学深度学习》3.4–3.5节

**实验 5：从零手写 Softmax 分类器**

```
import torch
import torchvision
import torchvision.transforms as transforms

# ---- 1. 加载 Fashion-MNIST ----
transform = transforms.ToTensor()
train_set = torchvision.datasets.FashionMNIST(
    root='./data', train=True, download=True, transform=transform)
test_set  = torchvision.datasets.FashionMNIST(
    root='./data', train=False, download=True, transform=transform)

train_loader = torch.utils.data.DataLoader(train_set, batch_size=256, shuffle=True)
test_loader  = torch.utils.data.DataLoader(test_set,  batch_size=256, shuffle=False)

# ---- 2. 手写 Softmax ----
def softmax(X):
    X_exp = torch.exp(X - X.max(dim=1, keepdim=True).values)  # 数值稳定
    return X_exp / X_exp.sum(dim=1, keepdim=True)

# ---- 3. 初始化参数 ----
num_inputs, num_outputs = 784, 10
W = torch.normal(0, 0.01, size=(num_inputs, num_outputs), requires_grad=True)
b = torch.zeros(num_outputs, requires_grad=True)

def net(X):
    return softmax(X.reshape(-1, num_inputs) @ W + b)

def cross_entropy(y_hat, y):
    return -torch.log(y_hat[range(len(y_hat)), y]).mean()

def accuracy(y_hat, y):
    return (y_hat.argmax(dim=1) == y).float().mean().item()

# ---- 4. 训练 ----
lr = 0.1
for epoch in range(10):
    total_loss, total_acc = 0, 0
    for X, y in train_loader:
        y_hat = net(X)
        loss = cross_entropy(y_hat, y)
        loss.backward()
        with torch.no_grad():
            W -= lr * W.grad;  W.grad.zero_()
            b -= lr * b.grad;  b.grad.zero_()
        total_loss += loss.item()
        total_acc  += accuracy(y_hat, y)

    # 测试集评估
    test_acc = sum(accuracy(net(X), y) for X, y in test_loader) / len(test_loader)
    print(f"Epoch {epoch+1:2d} | Loss: {total_loss/len(train_loader):.3f} | "
          f"Train Acc: {total_acc/len(train_loader):.3f} | Test Acc: {test_acc:.3f}")
```

**验收**：10 个 epoch 后 Test Acc 应能达到约 83%。

---

#### 周末（休息日）

LeetCode 1–2道（选做），其余完全放松。  
可以回顾一下这周最不确定的知识点，不超过30分钟。

---

## 阶段二：nn 模块 + 完整训练流程（第4周）

### 目标

用 PyTorch 的高层 API 重写阶段一的手写代码，理解封装背后发生了什么，掌握完整的工程化训练流程。

### 第4周每日安排

#### Day 1｜nn.Module + 常用层

**课程**：《动手学深度学习》3.3节、4.1–4.2节

**上午任务**：

- 理解 `nn.Module` 的 `__init__` 和 `forward`
- 掌握：`nn.Linear` / `nn.ReLU` / `nn.Sequential`
- 理解 `model.parameters()` 返回什么

**实验 6：用 nn 重写线性回归和 Softmax**

```
import torch
import torch.nn as nn

# ---- 用 nn 重写线性回归 ----
class LinearRegression(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = nn.Linear(2, 1)   # 输入2维，输出1维

    def forward(self, x):
        return self.linear(x).squeeze()

model = LinearRegression()

# 打印模型结构和参数数量
print(model)
total_params = sum(p.numel() for p in model.parameters())
print(f"参数总量：{total_params}")

# 使用 optimizer
optimizer = torch.optim.SGD(model.parameters(), lr=0.03)
criterion = nn.MSELoss()

# 对比阶段一：代码简洁了多少？逻辑没变。
```

---

#### Day 2｜MLP 多层感知机 + 正则化

**课程**：《动手学深度学习》4.1–4.6节

**实验 7：MLP 在 Fashion-MNIST 上的完整训练**

```
import torch
import torch.nn as nn
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader

# ---- 1. 数据加载 ----
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])
train_set = torchvision.datasets.FashionMNIST('./data', train=True,  download=True, transform=transform)
test_set  = torchvision.datasets.FashionMNIST('./data', train=False, download=True, transform=transform)
train_loader = DataLoader(train_set, batch_size=256, shuffle=True,  num_workers=2)
test_loader  = DataLoader(test_set,  batch_size=256, shuffle=False, num_workers=2)

# ---- 2. 定义 MLP ----
class MLP(nn.Module):
    def __init__(self, dropout=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(784, 512), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(512, 256), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(256, 128), nn.ReLU(),
            nn.Linear(128, 10)
        )

    def forward(self, x):
        return self.net(x)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = MLP(dropout=0.3).to(device)
print(model)
print(f"参数量：{sum(p.numel() for p in model.parameters()):,}")

# ---- 3. 训练配置 ----
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
criterion = nn.CrossEntropyLoss()
scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)

# ---- 4. 训练函数 ----
def train_epoch(model, loader, optimizer, criterion):
    model.train()
    total_loss, total_correct = 0, 0
    for X, y in loader:
        X, y = X.to(device), y.to(device)
        optimizer.zero_grad()
        output = model(X)
        loss = criterion(output, y)
        loss.backward()
        optimizer.step()
        total_loss    += loss.item() * len(y)
        total_correct += (output.argmax(1) == y).sum().item()
    return total_loss / len(loader.dataset), total_correct / len(loader.dataset)

def eval_epoch(model, loader, criterion):
    model.eval()
    total_loss, total_correct = 0, 0
    with torch.no_grad():
        for X, y in loader:
            X, y = X.to(device), y.to(device)
            output = model(X)
            loss = criterion(output, y)
            total_loss    += loss.item() * len(y)
            total_correct += (output.argmax(1) == y).sum().item()
    return total_loss / len(loader.dataset), total_correct / len(loader.dataset)

# ---- 5. 训练循环 ----
best_acc = 0
for epoch in range(20):
    train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion)
    test_loss,  test_acc  = eval_epoch(model, test_loader, criterion)
    scheduler.step()
    if test_acc > best_acc:
        best_acc = test_acc
        torch.save(model.state_dict(), 'best_mlp.pth')   # 保存最优模型
    print(f"Epoch {epoch+1:2d} | "
          f"Train Loss: {train_loss:.3f} Acc: {train_acc:.3f} | "
          f"Test  Loss: {test_loss:.3f} Acc: {test_acc:.3f} {'✓' if test_acc==best_acc else ''}")

print(f"\n最优 Test Acc: {best_acc:.4f}")
```

**验收**：Test Acc 应达到 88%+。

---

#### Day 3｜自定义 Dataset + DataLoader 深入

**课程**：PyTorch 官方文档 `torch.utils.data`

**实验 8：自定义 Dataset（模拟真实项目场景）**

```
import torch
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np

# ---- 场景：从 CSV 加载表格数据 ----
# 先生成一个模拟 CSV
np.random.seed(42)
n = 500
df = pd.DataFrame({
    'feature1': np.random.randn(n),
    'feature2': np.random.randn(n),
    'feature3': np.random.randn(n),
    'label':    np.random.randint(0, 3, n)   # 3分类
})
df.to_csv('mock_data.csv', index=False)

# ---- 自定义 Dataset ----
class TabularDataset(Dataset):
    def __init__(self, csv_path, feature_cols, label_col):
        df = pd.read_csv(csv_path)
        self.features = torch.tensor(df[feature_cols].values, dtype=torch.float32)
        self.labels   = torch.tensor(df[label_col].values,   dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]

dataset = TabularDataset('mock_data.csv', ['feature1','feature2','feature3'], 'label')

# 按 8:2 划分训练集/测试集
train_size = int(0.8 * len(dataset))
test_size  = len(dataset) - train_size
train_set, test_set = torch.utils.data.random_split(dataset, [train_size, test_size])

train_loader = DataLoader(train_set, batch_size=32, shuffle=True,  num_workers=0)
test_loader  = DataLoader(test_set,  batch_size=32, shuffle=False, num_workers=0)

# 验证数据加载
X_batch, y_batch = next(iter(train_loader))
print(f"Batch 形状：X={X_batch.shape}, y={y_batch.shape}")
print(f"标签分布：{torch.bincount(y_batch)}")
```

---

#### Day 4｜模型保存/加载 + 可视化

**课程**：PyTorch 官方文档 Saving and Loading Models

**实验 9：完整的保存、加载、继续训练流程**

```
import torch
import torch.nn as nn

# ---- 方式1：只保存参数（推荐） ----
torch.save(model.state_dict(), 'model_weights.pth')

# 加载时先定义相同的模型结构，再加载参数
new_model = MLP().to(device)
new_model.load_state_dict(torch.load('model_weights.pth'))
new_model.eval()

# ---- 方式2：保存完整 checkpoint（包含训练状态，用于断点续训） ----
checkpoint = {
    'epoch': 10,
    'model_state_dict':     model.state_dict(),
    'optimizer_state_dict': optimizer.state_dict(),
    'best_acc': best_acc,
}
torch.save(checkpoint, 'checkpoint.pth')

# 恢复训练
ckpt = torch.load('checkpoint.pth')
model.load_state_dict(ckpt['model_state_dict'])
optimizer.load_state_dict(ckpt['optimizer_state_dict'])
start_epoch = ckpt['epoch']
print(f"从 epoch {start_epoch} 恢复训练，之前最优 acc: {ckpt['best_acc']:.4f}")
```

**额外任务**：安装 TensorBoard，把 Day 2 的训练 loss 和 acc 曲线用 TensorBoard 可视化。

```
pip install tensorboard
```

```
from torch.utils.tensorboard import SummaryWriter
writer = SummaryWriter('runs/mlp_experiment')
# 在训练循环里加：
writer.add_scalar('Loss/train', train_loss, epoch)
writer.add_scalar('Accuracy/test', test_acc, epoch)
writer.close()
# 然后命令行运行：tensorboard --logdir=runs
```

---

#### Day 5｜本周综合复盘实验

**实验 10：用本周所学从头搭建并训练一个完整项目**

要求：**不看之前的代码**，独立完成以下所有内容：

1. 加载 MNIST（不是 Fashion-MNIST，换一个数据集检验迁移能力）
2. 定义一个 MLP（自己设计层数和隐层大小）
3. 写完整的 `train_epoch` 和 `eval_epoch` 函数
4. 用 Adam + StepLR 训练20个 epoch
5. 保存最优模型
6. 画出 loss 曲线和 accuracy 曲线

**验收目标**：MNIST Test Acc > 98%（MLP 在 MNIST 上很容易达到）。

---

## 阶段三：CNN + ResNet（第5周）

### 目标

理解卷积神经网络的核心思想，读懂并复现 ResNet，掌握迁移学习的标准流程。

### 从这里开始的 75% 任务量规则

从阶段三开始，每个学习日只要求完成“必做”部分：一个核心概念 + 一个最小可运行实验。标为“选做/后置”的内容不计入当天完成标准，时间充足时再补；它们不是新的隐性作业。

### 第5周每日安排

#### Day 1｜卷积操作基础：shape 与参数量

**课程**：《动手学深度学习》6.1–6.2节

**必做（约 75%）**：理解卷积核、padding 如何影响输出 shape；运行下面的 Sobel 卷积和参数量对比，能解释“参数共享”为什么让卷积层参数更少。

**选做/后置**：阅读 6.3–6.4 节，连续推导多层卷积的感受野，或额外尝试不同 stride、padding 的组合。

**实验 11：用卷积理解输出 shape 与参数共享**

```
import torch
import torch.nn as nn
import torch.nn.functional as F

# ---- 用 F.conv2d 理解卷积参数 ----
# 输入：1张图、1个通道、5x5
X = torch.arange(25, dtype=torch.float32).reshape(1, 1, 5, 5)

# 边缘检测卷积核
kernel = torch.tensor([[[[1.,  0., -1.],
                          [2.,  0., -2.],
                          [1.,  0., -1.]]]])   # Sobel 算子

out = F.conv2d(X, kernel, padding=1)
print("输入 shape:", X.shape)
print("输出 shape:", out.shape)
print("输出：\n", out.squeeze())

# ---- 理解参数量 ----
# 普通线性层：输入 32x32=1024，输出 16，参数量=？
linear = nn.Linear(1024, 16)
print(f"线性层参数量：{sum(p.numel() for p in linear.parameters()):,}")

# 卷积层：3x3 核，输入1通道，输出16通道，参数量=？
conv = nn.Conv2d(1, 16, kernel_size=3, padding=1)
print(f"卷积层参数量：{sum(p.numel() for p in conv.parameters()):,}")
# 思考：为什么卷积层参数少这么多，但效果往往更好？
```

---

#### Day 2｜经典 CNN：LeNet（VGG 后置）

**课程**：《动手学深度学习》6.6节

**必做（约 75%）**：读懂 LeNet 中“卷积/池化 -> 展平 -> 分类器”的数据流，完成一次 Fashion-MNIST 的最小训练和评估。

**选做/后置**：阅读《动手学深度学习》7.2 节的 VGG 堆叠卷积思想；与 MLP 做完整的多轮 accuracy 对比。

**实验 12：从零实现 LeNet 并训练**

```
import torch
import torch.nn as nn

class LeNet(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 6, kernel_size=5, padding=2),  nn.Sigmoid(),
            nn.AvgPool2d(kernel_size=2, stride=2),
            nn.Conv2d(6, 16, kernel_size=5),            nn.Sigmoid(),
            nn.AvgPool2d(kernel_size=2, stride=2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(16*5*5, 120), nn.Sigmoid(),
            nn.Linear(120, 84),     nn.Sigmoid(),
            nn.Linear(84, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))

model = LeNet()
# 用之前写好的 train_epoch / eval_epoch 训练 Fashion-MNIST
# 对比和 MLP 的准确率差异，理解为什么 CNN 更适合图像
```

---

#### Day 3｜残差网络 ResNet：残差块核心

**课程**：《动手学深度学习》7.6节

**必做（约 75%）**：弄清楚两个问题，并手写、运行下面的残差块：

1. 为什么深层网络反而比浅层网络效果差（退化问题）？
2. 残差连接（skip connection）如何解决这个问题？

**选做/后置**：阅读 ResNet 原论文的摘要和结论，并整理更深层网络的实验细节。

**实验 13：手写残差块，理解核心设计**

```
import torch
import torch.nn as nn
import torch.nn.functional as F

class ResidualBlock(nn.Module):
    """标准残差块（BasicBlock）"""
    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels,
                               kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1   = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels,
                               kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2   = nn.BatchNorm2d(out_channels)

        # 当输入输出维度不匹配时，需要 1x1 卷积调整
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels,
                          kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels)
            )

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += self.shortcut(x)   # 这就是残差连接的核心！
        return F.relu(out)

# 验证维度正确
block = ResidualBlock(64, 128, stride=2)
x = torch.randn(4, 64, 32, 32)
print("输入:", x.shape)
print("输出:", block(x).shape)   # 应该是 (4, 128, 16, 16)
```

---

#### Day 4｜迁移学习最小实战

**课程**：PyTorch 官方迁移学习教程

**必做（约 75%）**：完成“加载预训练模型 -> 冻结骨干网络 -> 替换分类头 -> 跑通一次训练/评估”的闭环。先用较轻量的 ResNet18 和 1–2 个 epoch 验证流程。

**选做/后置**：改用 ResNet50、完整训练 CIFAR-10、复杂数据增强，以及解冻更多层的 fine-tune 对比。

**实验 14：用预训练 ResNet18 跑通图像分类迁移流程**

```
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader

# ---- 1. 加载预训练 ResNet18（先完成最小闭环） ----
model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)

# ---- 2. 冻结特征提取层，只训练最后的分类头 ----
for param in model.parameters():
    param.requires_grad = False

# 替换最后一层（原来是1000类，改成你的类别数）
num_classes = 10   # 根据你的数据集修改
model.fc = nn.Linear(model.fc.in_features, num_classes)
# 注意：model.fc 的参数默认 requires_grad=True

if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")
model = model.to(device)

# 只有最后一层的参数会被优化
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
total_params     = sum(p.numel() for p in model.parameters())
print(f"可训练参数：{trainable_params:,} / {total_params:,}")

# ---- 3. 数据预处理（必须和预训练时一致） ----
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ---- 4. 用 CIFAR-10 模拟（快速验证流程）----
import torchvision
cifar_transform = transforms.Compose([
    transforms.Resize(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])
train_set = torchvision.datasets.CIFAR10('./data', train=True,  download=True, transform=cifar_transform)
test_set  = torchvision.datasets.CIFAR10('./data', train=False, download=True, transform=cifar_transform)
train_loader = DataLoader(train_set, batch_size=64, shuffle=True,  num_workers=0)
test_loader  = DataLoader(test_set,  batch_size=64, shuffle=False, num_workers=0)

# 用之前写好的训练函数先训练 1–2 个 epoch，确认迁移学习流程正确
optimizer = torch.optim.Adam(model.fc.parameters(), lr=1e-3)
criterion = nn.CrossEntropyLoss()
# ... 调用 train_epoch / eval_epoch
```

**思考题**（面试常考）：

- 迁移学习为什么有效？底层特征具有通用性。
- 什么时候解冻更多层（fine-tune）？目标域数据量较大时。
- 学习率应该怎么设置？通常预训练层用小学习率，新加层用大学习率。

---

#### Day 5｜阶段三结果复盘

**必做（约 75%）**：选择本周已经跑通的一个 CNN 或迁移学习实验，记录模型、数据、epoch、训练/验证指标，并写出“CNN 为什么比纯 MLP 更适合图像”的三点原因。

**选做/后置**：独立完成 MLP、LeNet、预训练 ResNet 的三模型全量对比；不设固定的 accuracy 硬指标，先保证实验设置和结论可解释。

---

## 阶段四：Transformer + BERT（第6周）

### 目标

理解 Attention 机制和 Transformer 结构，掌握 HuggingFace 的标准使用方式。

### 本阶段的 75% 任务量规则

仍按 5 个学习日推进：先确保能解释 shape、跑通一个注意力模块和一次 BERT 微调；完整结构复现、复杂调参与指标冲刺都放到后置任务。

### 第6周每日安排

#### Day 1｜Attention 机制原理

**课程**：《动手学深度学习》10.1–10.2节

**必做（约 75%）**：理解 `Q @ K^T / sqrt(d_k)`、softmax、加权求和的顺序，运行无 mask 的前向计算并检查输出和权重 shape。

**选做/后置**：阅读 10.3 节；实现并验证 padding mask、causal mask 等 decoder 场景。

**实验 16：手写 Scaled Dot-Product Attention**

```
import torch
import torch.nn.functional as F
import math

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    Q, K, V: (batch, seq_len, d_k)
    """
    d_k = Q.size(-1)
    # 计算注意力分数
    scores = torch.bmm(Q, K.transpose(1, 2)) / math.sqrt(d_k)
    # 可选：加 mask（用于 decoder 的自回归）
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    # Softmax 归一化
    attn_weights = F.softmax(scores, dim=-1)
    # 加权求和
    output = torch.bmm(attn_weights, V)
    return output, attn_weights

# 验证
batch, seq_len, d_k = 2, 5, 64
Q = torch.randn(batch, seq_len, d_k)
K = torch.randn(batch, seq_len, d_k)
V = torch.randn(batch, seq_len, d_k)
out, weights = scaled_dot_product_attention(Q, K, V)
print("输出 shape:", out.shape)         # (2, 5, 64)
print("注意力权重 shape:", weights.shape) # (2, 5, 5)
print("注意力权重行和（应为1）:", weights.sum(dim=-1))
```

---

#### Day 2｜Multi-Head Attention：拆分与合并

**课程**：《动手学深度学习》10.5节

**必做（约 75%）**：理解多头的拆分、每头注意力计算和合并，运行下面的最小 `MultiHeadAttention` 并检查 shape。

**选做/后置**：阅读 10.6–10.7 节和 Jay Alammar 图解博客；从零补齐完整 Transformer Encoder（位置编码、残差、LayerNorm、前馈网络）。

**实验 17：实现 Multi-Head Attention**

```
import torch
import torch.nn as nn
import math

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        assert d_model % num_heads == 0
        self.d_k      = d_model // num_heads
        self.num_heads = num_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def split_heads(self, x):
        # (batch, seq_len, d_model) → (batch, num_heads, seq_len, d_k)
        B, L, _ = x.shape
        return x.reshape(B, L, self.num_heads, self.d_k).transpose(1, 2)

    def forward(self, x):
        B, L, _ = x.shape
        Q = self.split_heads(self.W_q(x))
        K = self.split_heads(self.W_k(x))
        V = self.split_heads(self.W_v(x))
        scores = torch.matmul(Q, K.transpose(-2,-1)) / math.sqrt(self.d_k)
        attn   = torch.softmax(scores, dim=-1)
        out    = torch.matmul(attn, V)
        # 合并多头
        out = out.transpose(1,2).reshape(B, L, -1)
        return self.W_o(out)

# 验证
mha = MultiHeadAttention(d_model=512, num_heads=8)
x = torch.randn(2, 10, 512)   # (batch=2, seq_len=10, d_model=512)
print("输出 shape:", mha(x).shape)   # 应该是 (2, 10, 512)
```

---

#### Day 3–4｜HuggingFace BERT 微调

**课程**：HuggingFace 官方 Fine-tuning 教程

**必做（约 75%）**：Day 3 用小样本完成 `tokenizer -> DataLoader`，检查 batch 字段和 shape；Day 4 用同一份数据跑通 `BERT -> loss -> 1 个 epoch -> 验证` 的最小闭环。

**选做/后置**：扩展到完整训练集、训练 3 个 epoch、调学习率/长度/冻结策略，并把验证指标作为后续实验目标而不是当天硬性验收。

**实验 18：BERT 文本情感分类**

```
pip install transformers datasets
```

```
from transformers import BertTokenizer, BertForSequenceClassification
from datasets import load_dataset
import torch
from torch.utils.data import DataLoader
from transformers import AdamW, get_linear_schedule_with_warmup

# ---- 1. 加载数据集（SST-2 情感分类，二分类） ----
dataset = load_dataset("sst2")
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

def tokenize(batch):
    return tokenizer(batch["sentence"], truncation=True,
                     padding="max_length", max_length=64)

tokenized = dataset.map(tokenize, batched=True)
tokenized.set_format("torch", columns=["input_ids","attention_mask","label"])

train_data = tokenized["train"].shuffle(seed=42).select(range(2000))
val_data = tokenized["validation"].select(range(500))
train_loader = DataLoader(train_data, batch_size=16, shuffle=True)
val_loader   = DataLoader(val_data, batch_size=32)

# ---- 2. 加载预训练 BERT ----
model = BertForSequenceClassification.from_pretrained(
    "bert-base-uncased", num_labels=2)
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")
model = model.to(device)

# ---- 3. 优化器 + 学习率调度 ----
optimizer = AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
total_steps = len(train_loader) * 1   # 先训练 1 个 epoch，验证完整流程
scheduler = get_linear_schedule_with_warmup(
    optimizer, num_warmup_steps=total_steps//10,
    num_training_steps=total_steps)

# ---- 4. 训练 ----
for epoch in range(1):
    model.train()
    total_loss = 0
    for batch in train_loader:
        input_ids      = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels         = batch["label"].to(device)

        optimizer.zero_grad()
        outputs = model(input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels)
        loss = outputs.loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()

    # 验证
    model.eval()
    correct = 0
    with torch.no_grad():
        for batch in val_loader:
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels         = batch["label"].to(device)
            logits = model(input_ids=input_ids,
                           attention_mask=attention_mask).logits
            correct += (logits.argmax(1) == labels).sum().item()
    acc = correct / len(val_data)
    print(f"Epoch {epoch+1} | Loss: {total_loss/len(train_loader):.3f} | Val Acc: {acc:.4f}")
```

**当前验收**：一个 epoch 能无报错完成训练和验证，且能正确打印 loss、验证准确率。高指标不作为当前硬目标。

---

#### Day 5｜方向探索决策日

**必做（约 75%）**：今天不写新代码，做两件事：

1. **回顾本周和上周的实验结果**，对比 CV（图像）和 NLP（文本）任务的感受
2. **做决定**：选定主攻方向（NLP / CV / 推荐），后续复现项目围绕它展开

**选做/后置**：查 Papers with Code，整理感兴趣方向近两年的热门论文。

---

## 阶段五：方向实战 + 论文复现（第7–9周）

### 目标

选定方向，精读论文，完成一个完整的复现项目，上传 GitHub，形成简历素材。

### 总体安排

|   |   |
|---|---|
|周次|任务|
|第7周|精读1篇方向内经典论文，做详细笔记；第2篇作为后置任务|
|旅游留白|放松，最多每天刷1道 LeetCode|
|第8周|完整跑通其中1篇的训练/评估闭环，记录当前指标与原文差距；接近原文指标作为后置任务|
|第9周|整理 GitHub 项目并写 README；简历 STAR 包装作为后置任务|

### 论文选题建议

**NLP 方向**

- TextCNN（Kim 2014）：简单，适合第一次复现，一天能跑出结果
- BERT 微调变体（LoRA / Adapter）：工程价值高，大厂常考

**CV 方向**

- ViT（Vision Transformer）：Transformer 用于图像，近年热点
- YOLO（目标检测）：工程实用，简历亮点

**推荐系统方向**

- DeepFM：工业界标准模型，字节/阿里常用
- DIN（阿里）：序列推荐，有官方代码

### GitHub 项目 README 模板结构

```
# 项目名称：[论文名] PyTorch 复现

## 简介
一句话说清楚做了什么，复现了哪篇论文，在什么数据集上。

## 结果对比
| 指标   | 原论文 | 本复现 |
|--------|--------|--------|
| Top-1 Acc | 76.1% | 75.8% |

## 环境配置
Python 3.10 / PyTorch 2.x / CUDA 11.8

## 快速开始
git clone ...
pip install -r requirements.txt
python train.py --config configs/default.yaml

## 实现细节与踩坑记录
- 数据预处理注意事项...
- 超参数设置...

## 参考
- 原论文链接
- 官方代码链接
```

---

## 开学时的目标成果

|   |   |
|---|---|
|成果|验收标准|
|GitHub 项目|1个完整复现项目，README 清晰，陌生人10分钟能看懂|
|LeetCode|约100道，覆盖链表/树/动态规划/图|
|PyTorch 能力|闭眼能默写完整训练循环|
|论文积累|精读过3–5篇方向内经典论文，能口头讲清楚|
|方向决策|确定主攻 NLP / CV / 推荐系统中的一个|
|简历|初稿完成，项目经历用 STAR 法则撰写|

---

## 参考资料汇总

|   |   |   |
|---|---|---|
|资料|用途|链接|
|《动手学深度学习》PyTorch版|主线教材|zh.d2l.ai|
|PyTorch 官方文档|查函数用法|pytorch.org/docs|
|PyTorch 官方60分钟入门|入门补充|pytorch.org/tutorials|
|Jay Alammar 图解系列|Transformer 直觉理解|jalammar.github.io|
|HuggingFace 文档|BERT/NLP 实战|huggingface.co/docs|
|Papers with Code|找论文 + 开源代码|paperswithcode.com|
|李沐 B站视频|配合教材看|搜"跟李沐学AI"|

---

_制定于 2026年6月_
