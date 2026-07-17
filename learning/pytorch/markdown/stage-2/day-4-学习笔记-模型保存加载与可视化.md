学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版，PyTorch 官方文档，Matplotlib 官方文档

本阶段重点：在 [[Day 1 学习笔记：nn.Module 与常用层入门]] 中已经把参数、层和优化器交给 `nn.Module` 管理；在 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中已经完成 Fashion-MNIST 的 MLP 训练；在 [[Day 3 学习笔记：自定义 Dataset 与 DataLoader 深入]] 中已经理解数据如何按 batch 进入训练循环。今天把三者组织成一个完整工程闭环：**可训练、可观察、可保存、可恢复、可复用。**

今天主线：`模型保存/加载 + checkpoint + 可视化`。核心心智模型是：**模型结构代码定义“模型长什么样”；`state_dict` 记录“训练后参数是多少”；checkpoint 记录“训练进行到哪里”；曲线记录“训练过程实际发生了什么”。**

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 4 周 Day 4。

---

## 〇、贯穿全天的九条心智主线

### 1. 保存的不是 accuracy，而是模型学到的状态

第 3 周 [[Stage1/Day 3 学习笔记：手写线性回归（纯 Tensor 实现）|纯 Tensor 手写线性回归]] 与 [[Stage1/Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）|纯 Tensor 手写 Softmax 分类]] 中，真正被训练的是手写参数：

```python
w = w - lr * w.grad
b = b - lr * b.grad
```

若程序结束，内存中的 `w`、`b` 消失；只记录“accuracy = 86%”无法恢复模型。

现在参数被 `nn.Module` 统一管理：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(28 * 28, 256),
    nn.ReLU(),
    nn.Dropout(0.2),
    nn.Linear(256, 10),
)
```

本质对应关系：

```plain
纯 Tensor 版本：自己保存 w、b
nn.Module 版本：保存 model 管理的参数状态
```

保存不会自动提高 accuracy。它只让已经得到的实验结果能被预测、比较、恢复与复现。

### 2. `state_dict` 是“带名字的模型状态表”

```python
state_dict = model.state_dict()
```

`state_dict()` 是方法；调用后得到一个类似 Python 字典的对象：键是参数名称，值是 Tensor。

对一个 `nn.Sequential` 模型：

```python
model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(4, 3),
    nn.ReLU(),
    nn.Linear(3, 2),
)
```

可将其理解为：

```python
{
    "1.weight": ...,  # shape: (3, 4)
    "1.bias":   ...,  # shape: (3,)
    "3.weight": ...,  # shape: (2, 3)
    "3.bias":   ...,  # shape: (2,)
}
```

`Flatten`、`ReLU`、`Dropout` 没有可学习参数，所以通常不会像 `Linear.weight` 一样出现在其中。

```plain
state_dict 包含：可学习参数 + 必要的持久 buffer
state_dict 不包含：模型结构代码、forward 代码、optimizer 状态、epoch、loss、DataLoader、当前 train/eval 模式
```

未来使用 BatchNorm 时，运行均值、运行方差也属于需要保存的持久状态；这也是它们会进入 `state_dict` 的原因。

### 3. “创建结构”与“装入参数”是两个动作

`create_model()` **不是 PyTorch 内置 API**，只是我们自己起的普通 Python 函数名。它可以叫 `build_model()`，职责是集中定义模型结构：

```python
def create_model():
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 256),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(256, 10),
    )
```

调用：

```python
model = create_model()
```

会新建一个同结构模型，并随机初始化参数；它不读取旧模型文件。

```plain
create_model()
-> 创建“空的同款机器”：结构正确，参数随机

model.load_state_dict(state_dict)
-> 将保存的训练后参数装进这台机器
```

因此，训练与加载必须共用同一份 `create_model()`。若训练时是 `Linear(784, 256)`，加载时误写为 `Linear(784, 128)`，权重 shape 不匹配，PyTorch 会报错；不要用 `strict=False` 掩盖这种结构错误。

### 4. 三个核心保存 API 各自只做一件事

```python
torch.save(model.state_dict(), path)
```

```plain
model.state_dict()  -> 从模型取出状态字典
torch.save(...)     -> 将一个 Python 对象序列化并写入文件
torch.load(...)     -> 从文件读回对象
load_state_dict(...) -> 将状态字典复制进已创建模型
```

推荐的“只为预测或最终测试加载模型”流程：

```python
best_model = create_model().to(device)

best_state_dict = torch.load(
    best_model_path,
    weights_only=True,
    map_location=device,
)

best_model.load_state_dict(best_state_dict)
```

注意：下面是错误写法：

```python
model.load_state_dict("best_model.pth")
```

因为 `load_state_dict()` 要的是已经读回内存的字典，而不是路径字符串。

### 5. 模型权重文件与 checkpoint 的用途不同

```plain
best_model.pth
-> 验证集表现最好的模型参数
-> 用于最终测试、预测、部署

last_checkpoint.pth
-> 最近一次完整训练状态
-> 用于中断后继续训练
```

checkpoint 通常保存字典：

```python
torch.save(
    {
        "epoch": epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "history": history,
        "best_val_acc": best_val_acc,
    },
    last_checkpoint_path,
)
```

其中：

```plain
model_state_dict      恢复模型参数，必需
optimizer_state_dict  恢复 optimizer 内部历史，续训时必需
epoch                 知道从第几轮接着训练，必需
history               恢复完整曲线，推荐
best_val_acc          不误覆盖历史最佳模型，推荐
```

optimizer 不能随便重新开始：SGD 的 momentum、Adam 的一阶/二阶累计状态都会影响下一次 `optimizer.step()`。只恢复模型参数而不恢复 optimizer，不是严格意义上的无缝续训。

### 6. `model.train()` / `model.eval()` 决定前向行为，不决定保存格式

这是本次最容易混淆的边界：

```plain
state_dict / save / load
-> 搬运模型状态

train / eval
-> 决定下一次 model(X) 如何运行
```

保存、加载本身不要求先切换模式：

```python
model.train()
torch.save(model.state_dict(), path)  # 可以

model.eval()
torch.save(model.state_dict(), path)  # 也可以
```

对当前 MLP，`Dropout` 是模式差异的核心：

```plain
model.train()  -> Dropout 随机屏蔽部分神经元
model.eval()   -> Dropout 停止随机屏蔽，输出稳定
```

因此应按**下一次前向计算的用途**切换：

```python
def train_one_epoch(...):
    model.train()
    ...

def evaluate(...):
    model.eval()
    with torch.no_grad():
        ...
```

```python
# 加载后要继续训练
model.load_state_dict(...)
model.train()

# 加载后要验证、测试、预测
model.load_state_dict(...)
model.eval()
```

`model.eval()` 与 `torch.no_grad()` 也不是一回事：

```plain
model.eval()       改变 Dropout、BatchNorm 等层的行为
torch.no_grad()    关闭梯度记录，节省评估/推理开销
```

验证、测试、预测通常应同时使用二者。

### 7. 用验证集选择最佳模型，test 集只做最终评估

典型情况：

```plain
epoch 8:  train acc 90.1%, val acc 86.4%
epoch 10: train acc 93.0%, val acc 85.1%
```

最后一轮训练集更好，不代表泛化更好。应当在每次验证后按同一规则保存：

```python
best_val_acc = -float("inf")

if val_acc > best_val_acc:
    best_val_acc = val_acc
    torch.save(model.state_dict(), best_model_path)
```

`-float("inf")` 是负无穷，任何正常准确率都会比它大，因此第一轮必然成为当前最佳。

```plain
train 集：用于参数更新
val 集：用于选超参数、选最佳模型、判断过拟合
test 集：训练全部结束后，用最佳模型评估一次
```

不要用 test accuracy 挑选最佳 epoch；否则 test 集已经参与模型选择，不能再视为独立的最终评估。

### 8. 曲线记录的是训练证据，不会让模型自动变好

每个 epoch 不应只记最后一个 batch 的指标，而应汇总整个 DataLoader：

```python
total_loss = 0.0
total_correct = 0
total_samples = 0

for X, y in data_loader:
    logits = model(X)                 # shape: (B, 10)
    loss = criterion(logits, y)       # 标量

    batch_size = y.size(0)
    total_loss += loss.item() * batch_size
    total_correct += (logits.argmax(dim=1) == y).sum().item()
    total_samples += batch_size

average_loss = total_loss / total_samples
accuracy = total_correct / total_samples
```

`CrossEntropyLoss` 默认返回一个 batch 的平均 loss，因此要先乘回 `batch_size`，最后除以总样本数，才能正确处理最后一个较小 batch。

记录四条历史：

```python
history = {
    "train_loss": [],
    "val_loss": [],
    "train_acc": [],
    "val_acc": [],
}
```

每轮结束后追加：

```python
history["train_loss"].append(train_loss)
history["val_loss"].append(val_loss)
history["train_acc"].append(train_acc)
history["val_acc"].append(val_acc)
```

### 9. 曲线用于诊断，但结论必须来自实际趋势

```plain
欠拟合：train / val 都不好，差距通常不大
过拟合：train 持续变好，val loss 后期上升或 val acc 停滞/下降，差距扩大
训练稳定：指标总体向好，允许有小幅波动
训练不稳定：loss 大幅震荡、发散，或出现 nan / inf
```

单次验证准确率小幅下降不等于过拟合。应看连续趋势，并结合 loss、正则化、训练轮数与对照实验；不能因为用了保存、DataLoader 或画图，就默认效果一定更好。

---

## 一、Day 2、Day 3、Day 4 如何拼成一个完整训练闭环

```plain
Day 3：Dataset / DataLoader
    -> 每个 batch 提供 X, y

Day 2：MLP / CrossEntropyLoss / optimizer
    -> 前向、loss、反向传播、参数更新

Day 4：history / best model / checkpoint / curves
    -> 记录、选择、保存、恢复、观察
```

Fashion-MNIST 的必要 shape：

```plain
DataLoader 输出：X.shape = (B, 1, 28, 28), y.shape = (B,)
nn.Flatten 后：X.shape = (B, 784)
MLP 输出：logits.shape = (B, 10)
argmax(dim=1) 后：预测类别 shape = (B,)
```

最小模型工厂：

```python
def create_model():
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 256),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(256, 10),
    )
```

训练函数与评估函数都接收 DataLoader；这正延续了 [[Day 3 学习笔记：自定义 Dataset 与 DataLoader 深入]] 中“Dataset 返回一条样本、DataLoader 编排 batch”的分工。

---

## 二、完整训练项目的关键代码骨架

### 1. 设备与模型

```python
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

model = create_model().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-4,
)
```

`model`、输入 `X`、标签 `y` 必须位于同一个 device。

### 2. 保存目录与路径

```python
from pathlib import Path

checkpoint_dir = Path("checkpoints")
checkpoint_dir.mkdir(exist_ok=True)

best_model_path = checkpoint_dir / "best_model.pth"
last_checkpoint_path = checkpoint_dir / "last_checkpoint.pth"
```

这两个是相对路径，默认相对于**当前工作目录**：

```python
print(Path.cwd())
```

若只想保存到“运行 Python 时的工作目录”，原写法已经正确，不必硬编码绝对路径。

若想无论从哪里运行命令，都将文件保存到 `.py` 脚本所在目录旁边，则在普通 `.py` 脚本中使用：

```python
project_dir = Path(__file__).resolve().parent
checkpoint_dir = project_dir / "checkpoints"
checkpoint_dir.mkdir(exist_ok=True)
```

`__file__` 指的是当前脚本文件路径；在 notebook 或交互式解释器中不一定可用。

### 3. 主训练循环

```python
for epoch in range(num_epochs):
    train_loss, train_acc = train_one_epoch(
        model, train_loader, optimizer, criterion, device
    )

    val_loss, val_acc = evaluate(
        model, val_loader, criterion, device
    )

    history["train_loss"].append(train_loss)
    history["val_loss"].append(val_loss)
    history["train_acc"].append(train_acc)
    history["val_acc"].append(val_acc)

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), best_model_path)

    torch.save(
        {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "history": history,
            "best_val_acc": best_val_acc,
        },
        last_checkpoint_path,
    )
```

保存时即使 `evaluate()` 刚把模型设为 `eval()` 也没有问题。下一轮 `train_one_epoch()` 自己调用 `model.train()`，模式由下一次前向计算的目的决定。

### 4. 中断后继续训练

```python
model = create_model().to(device)
optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-4,
)

checkpoint = torch.load(
    last_checkpoint_path,
    weights_only=True,
    map_location=device,
)

model.load_state_dict(checkpoint["model_state_dict"])
optimizer.load_state_dict(checkpoint["optimizer_state_dict"])

start_epoch = checkpoint["epoch"] + 1
history = checkpoint["history"]
best_val_acc = checkpoint["best_val_acc"]
model.train()
```

若 checkpoint 中保存 `epoch = 11`，表示编号为 11 的 epoch 已完成，恢复时从 `12` 开始，不能重复训练第 11 轮。

### 5. 加载最佳模型并做最终测试

```python
best_model = create_model().to(device)

best_state_dict = torch.load(
    best_model_path,
    weights_only=True,
    map_location=device,
)

best_model.load_state_dict(best_state_dict)

test_loss, test_acc = evaluate(
    best_model, test_loader, criterion, device
)
```

这里故意新建 `best_model`，以验证“重新创建结构 + 读取参数文件”的加载流程确实成立，而不是依赖训练结束后仍在内存中的 `model`。

---

## 三、本次真实报错：MPS 输入与 CPU 权重不在同一设备

测试集评估时遇到：

```plain
RuntimeError: Tensor for argument weight is on cpu but expected on mps
```

根因是测试用模型最初写成：

```python
best_model = create_model()
```

此时：

```plain
test_loader 的 X -> MPS
best_model.weight -> CPU
model(X) -> 设备不一致，报错
```

修复是：

```python
best_model = create_model().to(device)
```

`map_location=device` 负责控制从文件反序列化得到的 Tensor 放在哪里；它**不会自动移动已创建的模型对象**。因此模型本身仍需要 `.to(device)`。

这个错误与 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中训练时的规则完全相同：每次前向计算前，模型、输入、标签必须在同一设备。

---

## 四、绘制与保存训练曲线

```python
import matplotlib.pyplot as plt

epochs = range(1, len(history["train_loss"]) + 1)
fig, axes = plt.subplots(1, 2, figsize=(12, 4))

axes[0].plot(epochs, history["train_loss"], label="train loss")
axes[0].plot(epochs, history["val_loss"], label="val loss")
axes[0].set_xlabel("epoch")
axes[0].set_ylabel("loss")
axes[0].set_title("Loss curve")
axes[0].legend()
axes[0].grid()

axes[1].plot(epochs, history["train_acc"], label="train accuracy")
axes[1].plot(epochs, history["val_acc"], label="val accuracy")
axes[1].set_xlabel("epoch")
axes[1].set_ylabel("accuracy")
axes[1].set_title("Accuracy curve")
axes[1].legend()
axes[1].grid()

fig.tight_layout()
fig.savefig(checkpoint_dir / "training_curves.png", dpi=150)
plt.show()
```

对象分工：

```plain
fig      整张画布
axes[0]  左侧 loss 坐标图
axes[1]  右侧 accuracy 坐标图
plot     画一条曲线
label    给曲线命名
legend   显示曲线名称
savefig  将图写入图片文件
```

`history` 是普通 Python 数值列表；画图不训练模型、不更新参数、不改变 checkpoint。

---

## 五、常见错误与排查顺序

### 1. 模型结构不一致

症状：

```plain
Missing key(s)
Unexpected key(s)
size mismatch
```

检查：训练与加载是否使用同一个 `create_model()`；层顺序、层宽度、命名是否一致。

### 2. device 不一致

症状：

```plain
Expected all tensors to be on the same device
Tensor for argument weight is on cpu but expected on mps
```

检查：

```python
model = model.to(device)
X = X.to(device)
y = y.to(device)
```

### 3. 忘记模式切换

症状：验证、测试或预测输出不稳定；或继续训练时 Dropout 一直关闭。

检查：

```python
train_one_epoch()  开头调用 model.train()
evaluate()         开头调用 model.eval()
```

### 4. 路径错误

症状：

```plain
FileNotFoundError
```

检查当前工作目录：

```python
print(Path.cwd())
print(best_model_path)
```

父目录不存在时，先：

```python
checkpoint_dir.mkdir(exist_ok=True)
```

### 5. 续训时漏掉 optimizer / history

症状：参数虽然恢复，但优化器状态被重置；或曲线从恢复点断开。

检查 checkpoint 是否同时保存、加载：

```plain
optimizer_state_dict
history
epoch
best_val_acc
```

---
## 六、结果展示
```python
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
import matplotlib.pyplot as plt

# 设备准备
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")
print("device:", device)

# 数据准备
transform = transforms.ToTensor()
data_dir = Path(__file__).resolve().parent.parent / "data"
train_val_dataset = datasets.FashionMNIST(
    root=data_dir,
    train=True,
    download=True,
    transform=transform,
)
test_dataset = datasets.FashionMNIST(
    root=data_dir,
    train=False,
    download=True,
    transform=transform,
)
train_size = int(0.9 * len(train_val_dataset))
val_size = len(train_val_dataset) - train_size
train_dataset, val_dataset = random_split(
    train_val_dataset,
    [train_size, val_size],
    generator=torch.Generator().manual_seed(42),
)
batch_size = 128
train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

# 模型准备
def create_model():
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 256),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(256, 10),
    )

# 训练一个 epoch
def train_one_epoch(model, data_loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    total_correct = 0.0
    total_samples = 0.0

    for X, y in data_loader:
        X = X.to(device)
        y = y.to(device)
        logits = model(X)
        loss = criterion(logits, y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        batch_size = y.size(0)
        total_loss += loss.item() * batch_size
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_samples += batch_size

    average_loss = total_loss / total_samples
    accuracy = total_correct / total_samples
    return average_loss, accuracy

# 评估
def evaluate(model, data_loader, criterion, device):
    model.eval()
    total_loss = 0.0
    total_correct = 0.0
    total_samples = 0.0

    with torch.no_grad():
        for X, y in data_loader:
            X = X.to(device)
            y = y.to(device)
            logits = model(X)
            loss = criterion(logits, y)
            batch_size = y.size(0)
            total_loss += loss.item() * batch_size
            total_correct += (logits.argmax(dim=1) == y).sum().item()
            total_samples += batch_size

    average_loss = total_loss / total_samples
    accuracy = total_correct / total_samples
    return average_loss, accuracy

# 创建模型/损失函数/optimizer
model = create_model().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-4,
)

# 创建保存目录与文件路径
project_dir = Path(__file__).resolve().parent
checkpoint_dir = project_dir / "checkpoints"
checkpoint_dir.mkdir(exist_ok=True)
best_model_path = checkpoint_dir / "best_model.pth"
last_checkpoint_path = checkpoint_dir / "last_checkpoint.pth"

# 初始化训练
num_epochs = 20
history = {
    "train_loss": [],
    "val_loss": [],
    "train_acc": [],
    "val_acc": [],
}
best_val_acc = -float("inf")

for epoch in range(num_epochs):
    train_loss, train_acc = train_one_epoch(
        model,
        train_loader,
        optimizer,
        criterion,
        device,
    )
    val_loss, val_acc = evaluate(
        model,
        val_loader,
        criterion,
        device,
    )
    history["train_loss"].append(train_loss)
    history["val_loss"].append(val_loss)
    history["train_acc"].append(train_acc)
    history["val_acc"].append(val_acc)

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), best_model_path)

    torch.save(
        {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "history": history,
            "best_val_acc": best_val_acc,
        },
        last_checkpoint_path,
    )
    print(
        f"epoch {epoch + 1:02d}/{num_epochs} | "
        f"train loss: {train_loss:.4f}, train acc: {train_acc:.4f} | "
        f"val loss: {val_loss:.4f}, val acc: {val_acc:.4f}"
    )

# 创建同结构模型，加载验证集最佳参数
best_model = create_model().to(device)
best_state_dict = torch.load(
    best_model_path,
    weights_only=True,
    map_location=device,
)
best_model.load_state_dict(best_state_dict)

# 对测试集做评估
test_loss, test_acc = evaluate(
    best_model,
    test_loader,
    criterion,
    device,
)
print(f"best model test loss: {test_loss:.4f}")
print(f"best model test acc: {test_acc:.4f}")

# 绘制并保存训练曲线
epochs = range(1, len(history["train_loss"]) + 1)
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].plot(epochs, history["train_loss"], label="train loss")
axes[0].plot(epochs, history["val_loss"], label="val loss")
axes[0].set_xlabel("epoch")
axes[0].set_ylabel("loss")
axes[0].set_title("Loss curve")
axes[0].legend()
axes[0].grid()
axes[1].plot(epochs, history["train_acc"], label="train accuracy")
axes[1].plot(epochs, history["val_acc"], label="val accuracy")
axes[1].set_xlabel("epoch")
axes[1].set_ylabel("accuracy")
axes[1].set_title("Accuracy curve")
axes[1].legend()
axes[1].grid()
fig.tight_layout()
curve_path = checkpoint_dir / "training_curves.png"
fig.savefig(curve_path, dpi=150)
plt.show()
print(f"curves saved to: {curve_path}")
```

![[Pasted image 20260711131522.png]]
## 七、今天最值得记住的对应关系

```plain
第 3 周手写 w / b
<-> model.state_dict() 中的参数 Tensor

第 3 周手写参数更新
<-> optimizer.step() 与 optimizer.state_dict()

Day 2 的 MLP + Dropout
<-> train() / eval() 下不同的前向行为

Day 3 的 DataLoader batch
<-> train_one_epoch() / evaluate() 的 X, y 输入

训练过程的每轮指标
<-> history 列表与训练曲线
```

---

## 八、掌握清单

- [x] 能解释为什么保存 accuracy 不能恢复模型，保存参数才可以。
- [x] 能说清 `state_dict` 保存什么、不保存什么。
- [x] 能区分 `create_model()`、`torch.save()`、`torch.load()`、`load_state_dict()` 的职责。
- [x] 能区分 `best_model.pth` 与 `last_checkpoint.pth`。
- [x] 能解释为什么恢复训练还需要 optimizer 状态和 epoch。
- [x] 能说清 `train()` / `eval()` 改变前向行为，不是保存/加载的前置条件。
- [x] 能用验证集而不是测试集选择最佳模型。
- [x] 能记录整轮 train/val loss 与 accuracy，并画出曲线。
- [x] 能从 train/val 曲线趋势判断欠拟合、过拟合与不稳定的线索。
- [x] 能定位并修复模型在 CPU、输入在 MPS 的设备不一致错误。
- [ ] 重新运行修复后的完整脚本，确认打印最终 test loss/test acc 且生成曲线图片。

## 九、下一步

先完成最后一项运行验证：确认 `best_model.pth` 能在 MPS 上被加载并完成 test 集评估。之后进入第 5 周前，可将本项目作为基线：更换模型、学习率、Dropout、weight decay 时，都使用同样的 `history + best model + checkpoint` 结构做公平比较。
