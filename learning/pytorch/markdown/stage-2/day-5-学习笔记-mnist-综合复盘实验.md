学习目标：AI 方向求职

参考书：《动手学深度学习》PyTorch 版，PyTorch 官方文档，Matplotlib 官方文档

本阶段重点：在 [[Day 1 学习笔记：nn.Module 与常用层入门]] 中已经把层、损失函数与优化器交给 PyTorch 管理；在 [[Day 2 学习笔记：MLP 多层感知机与正则化]] 中已经完成 Fashion-MNIST 的 MLP 训练；在 [[Day 3 学习笔记：自定义 Dataset 与 DataLoader 深入]] 中已经掌握 batch 数据流；在 [[Day 4 学习笔记：模型保存加载与可视化]] 中已经完成保存、加载与曲线记录。本次用一个新的 MNIST 项目把这些能力串成可复用的训练工程。

今天主线：`MNIST MLP 综合复盘：数据划分 -> 训练/验证 -> best model -> 曲线 -> 最终测试`。核心心智模型是：**训练集负责学习参数，验证集负责选择模型，测试集只负责最后一次报告；代码封装不会自动提升结果，曲线才告诉我们训练实际发生了什么。**

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 4 周 Day 5。

---

## 〇、今天完成了什么

本次独立完成了一个 MNIST 手写数字分类项目：

```plain
MNIST
-> train / val / test 三份数据
-> MLP 输出 logits
-> train_one_epoch 更新参数
-> evaluate 计算验证指标
-> 按 val_acc 保存 best model
-> 记录并绘制曲线
-> 加载 best model
-> 在 test 集做一次最终评估
```

最终一次实验记录：

```plain
best val acc: 0.9802
test loss:    0.0848
test acc:     0.9811
```
    
这里的 test 结果是最终报告，不是下一轮调参的依据。

---

## 一、MNIST 与 Fashion-MNIST：变的是任务，不变的是训练接口

本次没有复用 Day 2 的 Fashion-MNIST，而是切换到 MNIST：

| 项目 | Fashion-MNIST | MNIST |
| --- | --- | --- |
| 图片内容 | 衣物 | 手写数字 |
| 类别 | 10 个衣物类别 | 数字 0~9 |
| 单张输入 | `(1, 28, 28)` | `(1, 28, 28)` |
| 标签 | `0~9` | `0~9` |
| 官方划分 | 60000 train + 10000 test | 60000 train + 10000 test |

因此，大部分工程结构可以迁移：`DataLoader`、MLP、`CrossEntropyLoss`、训练/评估函数、保存加载与曲线记录都不因“图片内容换了”而改变。

这说明迁移能力不是背住某个数据集的代码，而是理解下列接口约定：

```plain
输入图像：float32，shape = (batch_size, 1, 28, 28)
标签：int64，shape = (batch_size,)
模型输出：logits，shape = (batch_size, 10)
```

本次一个 batch 的检查结果：

```plain
images.shape: torch.Size([128, 1, 28, 28])
images.dtype: torch.float32
labels.shape: torch.Size([128])
labels.dtype: torch.int64
label range: 0 ~ 9
```

这套 dtype/shape 检查直接继承自 [[Day 3 学习笔记：自定义 Dataset 与 DataLoader 深入]]。在写模型前先检查数据，比在报错后猜 shape 更可靠。

---

## 二、数据边界：train 学习，val 选模型，test 最终报告

官方 MNIST 训练集有 60000 个样本。本次按固定随机种子切为：

```plain
官方训练集 60000
├── train: 54000
└── val:    6000

官方测试集 10000
└── test:  10000
```

```python
train_dataset, val_dataset = random_split(
    train_val_dataset,
    [train_size, val_size],
    generator=torch.Generator().manual_seed(42),
)
```

`manual_seed(42)` 固定的是本次 train/val 划分；这样重跑时验证样本不会随机改变，实验可比较。

职责必须严格分开：

```plain
train_loader
-> 计算 loss
-> backward
-> optimizer.step()

val_loader
-> 计算验证 loss / acc
-> 决定保存哪个 epoch 的 best model

test_loader
-> 训练结束后加载 best model
-> 只做一次最终评估
```

即使没有将 test loss 反向传播，只要反复查看 test accuracy 并据此调整层数、学习率或 epoch，测试集信息也会间接参与模型选择，导致测试泄漏。

`shuffle=True` 只用于 `train_loader`；验证和测试不更新参数，因此使用 `shuffle=False`。

---

## 三、MLP：从二维图像到十个 logits

本次模型结构：

```plain
(batch, 1, 28, 28)
-> Flatten
-> (batch, 784)
-> Linear(784, 256) + ReLU
-> Linear(256, 128) + ReLU
-> Linear(128, 32) + ReLU
-> Linear(32, 10)
-> (batch, 10) logits
```

对应代码：

```python
def create_model():
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 256),
        nn.ReLU(),
        nn.Linear(256, 128),
        nn.ReLU(),
        nn.Linear(128, 32),
        nn.ReLU(),
        nn.Linear(32, 10),
    )
```

最后一层后面不能额外加 `Softmax`：

```plain
模型负责输出 logits
CrossEntropyLoss 负责处理 logits 与类别标签
argmax(dim=1) 只用于把 logits 变成预测类别
```

这与第 3 周 [[Stage1/Day 4 学习笔记：手写 Softmax 分类（纯 Tensor 实现）|纯 Tensor 手写 Softmax 分类]] 的关系是：当时手写线性层、Softmax、loss 和梯度；现在 `nn.Module` 管理参数，`CrossEntropyLoss` 提供稳定的损失实现，`optimizer` 完成参数更新。但数据流和“由 scores 选择最大类别”的本质没有变。

---

## 四、两个函数划开训练与评估的边界

### 1. `train_one_epoch`

训练的完整节奏：

```python
model.train()

for X, y in data_loader:
    X = X.to(device)
    y = y.to(device)

    logits = model(X)
    loss = loss_fn(logits, y)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

它对应纯 Tensor 版本中的：

```plain
前向计算 -> loss -> 计算梯度 -> 用梯度更新参数
```

不同之处是：`loss.backward()` 替代手动求导，`optimizer.step()` 替代手写 `w = w - lr * w.grad`。

epoch loss 不能直接把所有 batch 的 `loss.item()` 简单平均；最后一个 batch 可能更小。正确方式是按样本数加权：

```python
total_loss += loss.item() * batch_size
total_samples += batch_size
average_loss = total_loss / total_samples
```

accuracy 的统计逻辑：

```python
predictions = logits.argmax(dim=1)
total_correct += (predictions == y).sum().item()
accuracy = total_correct / total_samples
```

### 2. `evaluate`

验证与测试都调用同一个 `evaluate`，但它们的用途不同：验证用于选择模型，测试只用于最终报告。

```python
def evaluate(model, data_loader, loss_fn, device):
    model.eval()

    with torch.no_grad():
        for X, y in data_loader:
            ...
```

两行缺一不可：

```plain
model.eval()
-> 切换 Dropout、BatchNorm 等层的前向行为

torch.no_grad()
-> 关闭计算图记录，减少评估开销
```

`model.eval()` 不会自动关闭梯度；只写它仍会在验证中建立无用计算图。

这条边界承接 [[Day 4 学习笔记：模型保存加载与可视化]]：保存/加载负责搬运状态，`train()`/`eval()` 决定下一次前向计算如何运行，两者不能混为一谈。

---

## 五、Adam 与 StepLR：参数更新和学习率调整是两件事

本次配置：

```python
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

scheduler = torch.optim.lr_scheduler.StepLR(
    optimizer,
    step_size=5,
    gamma=0.5,
)
```

```plain
optimizer.step()
-> 根据当前 batch 的梯度更新模型参数

scheduler.step()
-> 在 epoch 结束后，调整下一阶段使用的学习率
```

本次学习率变化：

```plain
epoch 1~5:   0.001
epoch 6~10:  0.0005
epoch 11~15: 0.00025
```

`scheduler.step()` 必须放在 epoch 循环内、所有 batch 训练完成后；若误放进 batch 循环，会从“每 5 个 epoch 衰减”变成“每 5 个 batch 衰减”，学习率下降过快。

---

## 六、best model 与 last checkpoint：两个文件解决两类问题

输出文件需要按实验隔离：

```plain
checkpoints/
├── day4_FashionMnist_mlp/
├── day5_mnist_mlp/
└── day5_mnist_mlp_dropout/  # 选做实验，尚未完成
```

不同实验若都写入 `best_model.pth` 与 `last_checkpoint.pth`，会互相覆盖。文件名表示角色，目录表示实验身份。

### 1. best model

```python
if val_acc > best_val_acc:
    best_val_acc = val_acc
    torch.save(model.state_dict(), best_model_path)
```

它只保存验证集表现最好的模型权重，用于最终测试或预测。

### 2. last checkpoint

严格恢复训练需要保存：

```python
{
    "epoch": epoch + 1,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "scheduler_state_dict": scheduler.state_dict(),
    "history": history,
    "best_val_acc": best_val_acc,
}
```

其中 `scheduler_state_dict` 是本次新增的重点：若用了 StepLR，恢复训练时不仅要恢复模型、Adam 的内部状态，也要恢复学习率调度器的位置。

推荐顺序是：先打印本轮使用的 lr，再 `scheduler.step()`，最后保存 last checkpoint。这样 checkpoint 中保存的是“下一轮应继续使用”的学习率状态。

本次完成了 last checkpoint 的保存；实际“中断后加载 checkpoint 并继续训练”尚未演练，属于选做。

---

## 七、曲线不是装饰，而是训练诊断工具

本次记录：

```python
history = {
    "train_loss": [],
    "val_loss": [],
    "train_acc": [],
    "val_acc": [],
}
```

每个 epoch 记录一次，画两张图：

```plain
loss 图：train loss 与 val loss
accuracy 图：train acc 与 val acc
```

准确率图中的 best epoch 不应手写；应从本次 history 动态计算：

```python
best_epoch_index = max(
    range(len(history["val_acc"])),
    key=lambda i: history["val_acc"][i],
)
best_epoch = best_epoch_index + 1
best_val_acc = history["val_acc"][best_epoch_index]
```

再使用：

```python
ax.axvline(best_epoch, color="red", linestyle="--")
ax.scatter(best_epoch, best_val_acc, color="red", zorder=3)
```

本次基线曲线的主要行为：

```plain
前期：train / val 指标同时快速改善
后期：train loss 继续下降、train acc 接近 100%
      val loss 和 val acc 进入平台并有小幅波动
```

这是轻度过拟合信号：模型继续记住训练集的细节，但泛化收益已经较小。它不表示训练失败，也不等于必须继续加层、继续训练或强行加入正则化。

正确结论是：**本次根据验证集选择了最优 epoch；没有用 test 指标解释或调整训练。**

---

## 八、最终测试：加载 best model，而不是使用最后一轮模型

训练结束后，内存中的 `model` 是最后一个 epoch 的模型，不一定是 val 指标最好的模型。最终测试前要重新创建同结构模型，再装入 best 权重：

```python
best_model = create_model().to(device)

best_state_dict = torch.load(
    best_model_path,
    weights_only=True,
    map_location=device,
)

best_model.load_state_dict(best_state_dict)
test_loss, test_acc = evaluate(
    best_model,
    test_loader,
    loss_fn,
    device,
)
```

本次 `test acc = 98.11%`，与 `best val acc = 98.02%` 非常接近。测试略高 `0.09` 个百分点是不同样本划分的正常波动，不能解读为“测试集更简单”，也不能据此再调整网络。
### 完整代码
```python
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
import matplotlib.pyplot as plt

if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")
print(f"device: {device}")

transform = transforms.ToTensor()
data_dir = Path(__file__).resolve().parent.parent / "data"
train_val_dataset = datasets.MNIST(
    root=data_dir,
    train=True,
    transform=transform,
    download=True,
)
test_dataset = datasets.MNIST(
    root=data_dir,
    train=False,
    transform=transform,
    download=True,
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

images, labels = next(iter(train_loader))
print("images.shape:", images.shape)
print("images.dtype:", images.dtype)
print("labels.shape:", labels.shape)
print("labels.dtype:", labels.dtype)
print("label range:", labels.min().item(), "~", labels.max().item())

def create_model():
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 256),
        nn.ReLU(),
        nn.Linear(256, 128),
        nn.ReLU(),
        nn.Linear(128, 32),
        nn.ReLU(),
        nn.Linear(32, 10),
    )

def train_one_epoch(model, data_loader, optimizer, loss_fn, device):
    model.train()
    total_loss = 0.0
    total_correct = 0.0
    total_samples = 0.0

    for X, y in data_loader:
        X = X.to(device)
        y = y.to(device)
        logits = model(X)
        loss = loss_fn(logits, y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        batch_size = y.shape[0]
        total_loss += loss.item() * batch_size
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_samples += batch_size

    average_loss = total_loss / total_samples
    accuracy = total_correct / total_samples
    return average_loss, accuracy

def evaluate(model, data_loader, loss_fn, device):
    model.eval()
    total_loss = 0.0
    total_correct = 0.0
    total_samples = 0.0

    with torch.no_grad():
        for X, y in data_loader:
            X = X.to(device)
            y = y.to(device)
            logits = model(X)
            loss = loss_fn(logits, y)
            batch_size = y.size(0)
            total_loss += loss.item() * batch_size
            total_correct += (logits.argmax(dim=1) == y).sum().item()
            total_samples += batch_size

    average_loss = total_loss / total_samples
    accuracy = total_correct / total_samples
    return average_loss, accuracy

model = create_model().to(device)
loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
scheduler = torch.optim.lr_scheduler.StepLR(
    optimizer,
    step_size=5,
    gamma=0.5,
)
num_epochs = 20
print("initial lr:", optimizer.param_groups[0]["lr"])
history = {
    "train_loss": [],
    "val_loss": [],
    "train_acc": [],
    "val_acc": [],
}
best_val_acc = float("-inf")
project_dir = Path(__file__).resolve().parent
checkpoint_dir = project_dir / "checkpoints" / "day5_mnist_mlp"
checkpoint_dir.mkdir(parents=True, exist_ok=True)
best_model_path = checkpoint_dir / "best_model.pth"
last_checkpoint_path = checkpoint_dir / "last_checkpoint.pth"

for epoch in range(num_epochs):
    train_loss, train_acc = train_one_epoch(
        model, train_loader, optimizer, loss_fn, device
    )
    val_loss, val_acc = evaluate(model, val_loader, loss_fn, device)
    history["train_loss"].append(train_loss)
    history["val_loss"].append(val_loss)
    history["train_acc"].append(train_acc)
    history["val_acc"].append(val_acc)

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), best_model_path)

    torch.save(
        {
            "epoch": epoch + 1,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict(),
            "history": history,
            "best_val_acc": best_val_acc,
        },
        last_checkpoint_path,
    )
    current_lr = optimizer.param_groups[0]["lr"]
    print(
        f"epoch {epoch + 1:02d}/{num_epochs} | "
        f"lr: {current_lr:.6f} | "
        f"train loss: {train_loss:.4f}, train acc: {train_acc:.4f} | "
        f"val loss: {val_loss:.4f}, val acc: {val_acc:.4f}"
    )
    scheduler.step()

best_model = create_model().to(device)
best_state_dict = torch.load(
    best_model_path,
    weights_only=True,
    map_location=device,
)
best_model.load_state_dict(best_state_dict)
test_loss, test_acc = evaluate(best_model, test_loader, loss_fn, device)
print(f"best val acc: {best_val_acc:.4f}")
print(f"test loss: {test_loss:.4f}")
print(f"test acc: {test_acc:.4f}")

epochs = range(1, len(history["train_loss"]) + 1)
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes = axes.flatten()
ax = axes[0]
ax.plot(epochs, history["train_loss"], label="train_loss")
ax.plot(epochs, history["val_loss"], label="val_loss")
ax.set_xlabel("epoch")
ax.set_ylabel("loss")
ax.set_title("Loss curve")
ax.legend()
ax.grid()
ax = axes[1]
ax.plot(epochs, history["train_acc"], label="train_acc")
ax.plot(epochs, history["val_acc"], label="val_acc")
best_epoch_index = max(
    range(len(history["val_acc"])),
    key=lambda i: history["val_acc"][i],
)
best_epoch = best_epoch_index + 1
best_val_acc = history["val_acc"][best_epoch_index]
ax.axvline(
    best_epoch,
    color="red",
    linestyle="--",
    label=f"best model: epoch {best_epoch}",
)
ax.scatter(best_epoch, best_val_acc, color="red", zorder=3)
ax.set_xlabel("epoch")
ax.set_ylabel("accuracy")
ax.set_title("Accuracy curve")
ax.legend()
ax.grid()
fig.tight_layout()
curve_path = checkpoint_dir / "day5_training_curves.png"
fig.savefig(curve_path, dpi=150)
plt.show()
print(f"curves saved to: {curve_path}")
```
### 结果展示
![[Pasted image 20260713121044.png]]

---

## 九、本次踩过的坑与排查顺序

### 1. 验证函数只写 `model.eval()`，忘记 `torch.no_grad()`

问题：验证仍会建立计算图，浪费内存和时间。

检查顺序：

```plain
评估函数是否 model.eval()
-> 是否 with torch.no_grad()
-> 是否没有 backward / optimizer.step()
```

### 2. StepLR 创建了但没有调用 `scheduler.step()`

问题：学习率从未变化。

检查：每个 epoch 打印 `optimizer.param_groups[0]["lr"]`，确认第 6、11 个 epoch 的学习率是否如预期变化。

### 3. 不同实验覆盖同名 checkpoint

问题：Day 4 与 Day 5 都叫 `best_model.pth`，若共用目录会覆盖。

修复：每个实验一个子目录，而不是靠不同日期“记住哪个文件是谁”。

### 4. 绘图时设置错了 Axes

问题：第二张 accuracy 图误使用 `axes[0]` 设置标题与坐标轴，导致 loss 图标签被覆盖。

修复：先保存局部变量：

```python
ax = axes[1]
ax.set_xlabel("epoch")
ax.set_ylabel("accuracy")
ax.set_title("Accuracy curve")
```

### 5. 看完 test 结果后再改模型

问题：会让 test 集间接参与模型选择。

本次在最终 test 后想到 Dropout，是一个独立的正则化练习；若继续，只能先比较 train/val 行为，不应再次用同一 test 集选择 Dropout 是否更好。

---

## 十、Day 5 掌握清单

- [x] 能加载一个新但接口兼容的数据集 MNIST。
- [x] 能从官方训练集划分 train / val，并固定划分随机种子。
- [x] 能从输入 shape 设计 `Flatten -> MLP -> logits`。
- [x] 能独立写 `train_one_epoch` 与 `evaluate`。
- [x] 能解释 `train()`、`eval()`、`no_grad()` 的不同职责。
- [x] 能使用 Adam 与 StepLR，并把 `scheduler.step()` 放在 epoch 结束处。
- [x] 能只按验证集保存 best model。
- [x] 能区分 best model 与 last checkpoint。
- [x] 能记录、绘制并解读 loss / train acc / val acc。
- [x] 能加载 best model，并仅在 test 集做一次最终评估。
- [ ] 能从 last checkpoint 恢复模型、optimizer、scheduler、epoch 与 history 后继续训练。
- [ ] 选做：完成仅基于验证集的 Dropout 对比实验，并解释其是否改善泛化行为。

## 今日一句话总结

> 一个可靠的训练项目不是“跑出一个 accuracy”，而是让每份数据各司其职、让每轮训练可观察、让最佳模型可复用，并能解释曲线为什么这样变化。
