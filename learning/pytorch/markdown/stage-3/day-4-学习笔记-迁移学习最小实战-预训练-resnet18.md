学习目标：AI 方向求职

参考书：PyTorch 官方迁移学习教程，PyTorch 官方 `torchvision.models.resnet18`、`torch.utils.data`、Saving and Loading Models 文档

本阶段重点：在 [Day 3 学习笔记：残差网络 ResNet——残差块核心](Day 3 学习笔记：残差网络 ResNet——残差块核心) 已理解残差块和 shortcut 后，本日将“手写最小残差块”连接到 torchvision 提供的预训练 ResNet18，跑通一个完整、可验证的迁移学习闭环。

今天主线：`预训练 ResNet18 -> backbone / 分类头 -> 冻结 -> 替换 fc -> CIFAR-10 预处理 -> train / val / test -> best_state -> 最终测试`。本日完成固定特征提取器策略；不实施解冻 backbone 的 fine-tune，不把 1--2 epoch 的结果包装成最终性能结论。

本笔记对应 [PyTorch 暑期详细学习计划](PyTorch 暑期详细学习计划) 中第 5 周 Day 4。

---

## 〇、今天完成了什么

1. 理解迁移学习：复用 ImageNet 预训练 ResNet18 的通用图像特征，而不是从随机参数开始训练整个网络。
2. 区分 backbone 与分类头：backbone 将图像转换为特征，`model.fc` 将特征映射为具体任务的类别分数。
3. 加载 `ResNet18_Weights.DEFAULT`，冻结原有参数，并把原始 `Linear(512, 1000)` 替换为 CIFAR-10 的 `Linear(512, 10)`。
4. 在 Apple Silicon 的 MPS 上通过随机输入完成 shape 与参数量验证：输入 `[4, 3, 224, 224]`，输出 `[4, 10]`，可训练参数仅 5,130 个。
5. 使用 CIFAR-10 建立 `45,000 / 5,000 / 10,000` 的 train / validation / test 划分；只用 validation 选择最佳模型，test 最后评估一次。
6. 跑通 `DataLoader -> forward -> CrossEntropyLoss -> backward -> Adam.step -> validation -> best_state -> test` 闭环。
7. 实验结果：2 个 epoch 后最佳 validation accuracy 为 `87.14%`，最终 test accuracy 为 `86.67%`。

---

## 一、迁移学习：不是从零训练整个 ResNet

从零训练时，模型参数随机初始化，训练数据必须让每一层逐渐学会边缘、纹理、局部结构和最终分类规则：

```plain
随机模型 + 任务数据
-> 更新全部参数
-> 学习特征提取与分类
```

迁移学习先使用一个已经在大规模数据上训练过的模型：

```plain
预训练模型 + 新任务数据
-> 复用已有通用特征
-> 重点学习新任务的分类规则
```

ResNet18 的预训练权重来自 ImageNet。它原先学习的是 ImageNet 的 1000 类，并不直接认识 CIFAR-10 的 10 类；但其浅层和中层已学到的边缘、颜色、纹理、局部形状等视觉特征，仍可能对 CIFAR-10 有用。

迁移学习有效的前提不是“预训练一定万能”，而是源任务和目标任务具有可复用的结构。例如 ImageNet 与 CIFAR-10 都是 RGB 自然图像，二者的基础视觉特征有重合。若目标数据与 ImageNet 差异很大，例如医学影像，可能需要解冻更多层进行 fine-tune，或选择更合适的预训练来源。

---

## 二、backbone 与分类头：`图片 -> 特征 -> 类别`

ResNet18 可先拆成两部分理解：

```plain
backbone：图片 -> 图像特征
分类头 fc：图像特征 -> 类别 logits
```

数据流为：

```plain
输入图片 [B, 3, 224, 224]
    -> ResNet18 backbone（卷积、残差块、池化）
    -> 特征 [B, 512]
    -> model.fc = Linear(512, 1000)
    -> ImageNet logits [B, 1000]
```

backbone 包含 Day 3 学过的卷积、BatchNorm、ResidualBlock 和下采样等主体结构。`fc` 是最后的 fully connected 层，即 MLP 中熟悉的 `nn.Linear`。

原始分类头中：

```plain
输入特征数 512：backbone 每张图片最终提取出的 512 维特征
输出特征数 1000：ImageNet 的 1000 个类别分数
```

对 CIFAR-10，应改为：

```plain
[B, 512] -> Linear(512, 10) -> [B, 10]
```

这里的 `[B, 10]` 是 10 个 logits，不是已经 softmax 后的概率。它可以直接交给 `nn.CrossEntropyLoss`；标签仍是 shape `[B]` 的类别编号，而不是 one-hot 标签。

---

## 三、加载、冻结与替换分类头

### 1. 加载预训练 ResNet18

```python
from torchvision import models

model = models.resnet18(
    weights=models.ResNet18_Weights.DEFAULT
)
```

`weights` 决定参数初始值：

| 写法 | 网络结构 | 参数初始状态 | 是否是迁移学习 |
| --- | --- | --- | --- |
| `resnet18(weights=None)` | ResNet18 | 随机初始化 | 否，从零训练 |
| `resnet18(weights=ResNet18_Weights.DEFAULT)` | ResNet18 | ImageNet 预训练参数 | 是 |

预训练权重默认缓存于：

```plain
~/.cache/torch/hub/checkpoints/
```

本机实际缓存文件为 `resnet18-f37072fd.pth`。它属于 PyTorch 缓存，不需要复制到学习代码目录，也不应提交进代码仓库。

### 2. 冻结原有参数

```python
for param in model.parameters():
    param.requires_grad = False
```

这与此前的纯 Tensor / autograd 训练直接对应：

```plain
requires_grad=True  -> backward 后为该参数累计 grad -> optimizer 可以更新它
requires_grad=False -> 不为该参数累计 grad -> 参数保持不变
```

冻结不影响 forward。backbone 仍会运行、仍会将图片变为 `[B, 512]` 特征；只是预训练参数不再通过反向传播更新。

### 3. 替换分类头

```python
num_classes = 10
model.fc = nn.Linear(model.fc.in_features, num_classes)
```

`model.fc.in_features` 读取旧分类头的输入维度，即 512。新建的 `nn.Linear(512, 10)` 由默认随机初始化创建，其 weight 和 bias 默认 `requires_grad=True`。

顺序必须是：

```plain
加载预训练模型
-> 冻结原有参数
-> 替换 fc
-> 新 fc 保持可训练
```

若先替换 `fc` 再冻结所有参数，新分类头也会被冻住，无法学习。

### 4. 只将分类头交给优化器

```python
optimizer = torch.optim.Adam(model.fc.parameters(), lr=1e-3)
```

优化器持有需要更新的参数集合。这里故意只传入 `model.fc.parameters()`，表达“本实验只训练新分类头”。这比从零训练时常见的 `model.parameters()` 范围更小。

---

## 四、`eval()`、`requires_grad` 与 `no_grad()` 不要混淆

三者分别控制不同的事情：

| 操作 | 是否为参数求梯度 | 是否影响 BatchNorm / Dropout 行为 |
| --- | --- | --- |
| `param.requires_grad = False` | 不为该参数累计梯度 | 不影响模块模式 |
| `model.train()` / `model.eval()` | 不决定是否求梯度 | 会切换训练/评估行为 |
| `with torch.no_grad():` | 整个代码块不记录梯度 | 不切换模块模式 |

ResNet18 中有许多 `BatchNorm2d`。即使其可学习参数已经冻结，在 `model.train()` 下，BatchNorm 的 `running_mean` 与 `running_var` 这类运行统计量仍可能用当前 batch 更新。它们是 buffer，不是依靠梯度更新的参数。

本日将预训练 backbone 视为固定特征提取器，因此训练时采用：

```python
model.eval()      # 保留预训练 BatchNorm 的运行统计量
model.fc.train()  # 明确分类头处于训练模式
```

`model.eval()` 不会关闭 `fc` 的梯度，不能与 `torch.no_grad()` 混为一谈。训练分类头时若把 forward 放在 `torch.no_grad()` 中，`loss.backward()` 就无法产生 `fc` 的梯度。

若后续解冻 backbone 做 fine-tune，则通常再用 `model.train()` 让要训练的层与 BatchNorm 行为一起适应目标任务；这属于后置实验。

---

## 五、预训练权重配套的输入预处理

CIFAR-10 原始 RGB 图像为：

```plain
单张：[3, 32, 32]
batch：[B, 3, 32, 32]
```

本次最小实验使用的预处理：

```python
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])
```

数据流：

```plain
PIL RGB 图片
-> Resize((224, 224))
-> PIL RGB 图片，空间尺寸 224 x 224
-> ToTensor()
-> Tensor [3, 224, 224]，通道在前，数值约为 [0, 1]
-> Normalize(...)
-> Tensor [3, 224, 224]，shape 不变，数值分布改变
```

`Normalize` 对 RGB 三个通道分别计算：

```plain
new_pixel = (old_pixel - mean) / std
```

这套 mean/std 与 ImageNet 预训练权重匹配。Resize 改变 H、W；Normalize 不改变 shape。

ResNet18 的结构可以接收不同的空间尺寸，但 224 与预训练时常用输入尺度一致。本实验优先保证预训练流程正确；若设备速度有限，可在后续速度实验中尝试 128 x 128，并将其视为新的实验设置，不与 224 结果混为一谈。

---

## 六、数据划分：训练、验证、测试各自只做一件事

本实验的 CIFAR-10 划分：

```plain
官方 train 50,000
-> random_split(seed=42)
-> train 45,000：更新分类头参数
-> validation 5,000：选择最佳 epoch

官方 test 10,000：最终只评估一次
```

```python
train_subset, val_subset = random_split(
    train_set,
    [45_000, 5_000],
    generator=torch.Generator().manual_seed(42),
)
```

固定随机种子让每次运行保留相同的 validation 划分，指标才可比较。

`DataLoader` 的最小设置：

```python
train_loader = DataLoader(
    train_subset,
    batch_size=128,
    shuffle=True,
    num_workers=0,
)

val_loader = DataLoader(
    val_subset,
    batch_size=128,
    shuffle=False,
    num_workers=0,
)
```

训练集需要 `shuffle=True`，避免每个 epoch 固定同一顺序；validation/test 不需要随机打乱。Apple Silicon 上本次使用 `num_workers=0`，优先保证单进程加载稳定、错误信息可读。

---

## 七、训练、验证与最佳模型恢复

单个训练 batch 的数据流仍是此前学过的标准流程：

```plain
images, labels 从 DataLoader 取得（CPU）
-> images / labels .to(device)
-> optimizer.zero_grad()
-> logits = model(images)        # [B, 3, 224, 224] -> [B, 10]
-> loss = CrossEntropyLoss(logits, labels)
-> loss.backward()
-> optimizer.step()              # 只更新 fc
```

验证与训练的差异：

| 阶段 | 参数更新 | `torch.no_grad()` | 用途 |
| --- | --- | --- | --- |
| train | 是 | 否 | 让新 `fc` 学习 |
| validation | 否 | 是 | 选择最佳模型 |
| test | 否 | 是 | 最终一次泛化评估 |

### 为什么要保存 `best_state`？

每一轮训练都可能改变模型参数。应依据 validation accuracy 选择最佳轮次，而不是默认取最后一轮：

```python
if val_acc > best_val_acc:
    best_val_acc = val_acc
    best_state = copy.deepcopy(model.state_dict())
```

`model.state_dict()` 包含参数和持久 buffer 的字典，但其中 Tensor 仍引用模型当前状态。若仅写：

```python
best_state = model.state_dict()
```

后续 epoch 更新模型时，这份“最佳状态”也会随之变化。`copy.deepcopy(...)` 会创建独立副本；训练结束后用：

```python
model.load_state_dict(best_state)
```

恢复 validation 表现最好的模型，再进行最终 test。

---

## 八、本次 MPS 最小实验记录

### 1. 模型与 shape 验证

```plain
device: mps
model.fc: Linear(in_features=512, out_features=10, bias=True)
输入 x: [4, 3, 224, 224]
输出 out: [4, 10]
fc weight requires_grad: True
总参数：11,181,642
可训练参数：5,130
```

`5,130 = 512 x 10 + 10`，正好是新分类头的 weight 与 bias 参数数目。这验证了 backbone 已被冻结、只有 `fc` 可训练。

### 2. 指标

| epoch | train loss | train acc | val loss | val acc |
| --- | ---: | ---: | ---: | ---: |
| 1 / 2 | 0.5802 | 81.85% | 0.4149 | 85.26% |
| 2 / 2 | 0.3857 | 86.97% | 0.3695 | 87.14% |

```plain
best val acc: 87.14%
test loss: 0.3943
test acc: 86.67%
```

### 3. 如何诚实解读

训练与验证指标均随 epoch 改善，说明新分类头确实在利用预训练特征学习 CIFAR-10 的类别映射。最佳 validation accuracy 为 87.14%，最终 test accuracy 为 86.67%，相差 0.47 个百分点，差距较小；在这个最小实验中，validation 集表现对未参与模型选择的 test 集具有较好的代表性。

但这不证明“预训练 ResNet18 的最佳性能就是 86.67%”，也不能将此结果直接与不同输入尺寸、数据增强、训练轮数、冻结策略或数据划分的实验相比较。本实验的目标是验证迁移学习闭环与评估流程，而不是刷最高分。

---

## 九、常见错误与检查清单

### 常见错误

1. **忘记替换 `fc`**：模型仍输出 `[B, 1000]`，与 CIFAR-10 的 10 类不匹配。
2. **替换后再冻结所有参数**：新 `fc` 也被设为 `requires_grad=False`，没有任何可训练参数。
3. **训练时使用 `torch.no_grad()`**：新分类头无法得到梯度。
4. **训练阶段把 `model.eval()` 误解为不能更新参数**：`eval()` 只切换 BatchNorm / Dropout 等模块行为；更新与否由梯度和优化器决定。
5. **用 test 集选择 epoch 或调学习率**：测试集不再是独立的最终评估数据。
6. **直接保存 `best_state = model.state_dict()`**：后续训练会改变该引用，应使用 `copy.deepcopy`。
7. **将 CIFAR-10 的标签做成 one-hot 后误用 `CrossEntropyLoss`**：本实验标签应为 `[B]` 的整型类别编号。
8. **将预训练权重 `.pth` 复制并提交到代码目录**：它应保留在 PyTorch 缓存，代码只保留加载逻辑。

### 本日验收

- [x] 能解释迁移学习为什么可能有效，以及它不保证对所有目标域都有效。
- [x] 能解释 backbone 是“图片 -> 特征”的主体，`fc` 是“特征 -> 类别”的分类头。
- [x] 能推导 `[B, 3, 224, 224] -> [B, 512] -> [B, 10]`。
- [x] 能说明 `requires_grad=False`、`model.eval()`、`torch.no_grad()` 的区别。
- [x] 能完成冻结、替换分类头、仅优化 `model.fc.parameters()` 的代码翻译。
- [x] 能说明 validation 用于模型选择，test 仅用于最终一次评估。
- [x] 能解释为什么保存最佳模型时需要 `copy.deepcopy(model.state_dict())`。

---

## 十、选做 / 后置

1. 在固定 train / validation / test 划分下，对比 `Resize(224)` 与 `Resize(128)` 的速度和指标；记录输入尺寸、每 epoch 耗时与验证准确率。
2. 使用较小训练子集（如 10,000 张）验证代码或学习流程，避免在 MacBook 上反复等待完整训练。
3. 解冻 `layer4` 或更多后层，使用更小学习率做 fine-tune；与“只训练 fc”比较，不预设一定更好。
4. 仅对训练集加入随机翻转等数据增强，验证集与测试集保持确定性预处理。
5. 将当前最佳模型的 `state_dict` 保存到文件，并在新进程中加载验证；这是后续模型保存/加载主题的自然延伸。

---

## 十一、完整可运行代码：`Day4.py`

下面是本次学习使用的完整代码，路径为：

```plain
/Users/yyy/code/pytorch_study/Stage_3_CNN_ResNet/Code/Day4.py
```

注意：上文“本次 MPS 最小实验记录”中的指标来自 `num_epochs = 2` 的运行；以下代码当前保留 `num_epochs = 5`，若要复现实验表中的两轮结果，将该值改为 `2` 即可。两种设置的模型、数据划分、优化器与流程相同，区别只是训练轮数。

```python
import torch
import torch.nn as nn
from torchvision import models
from pathlib import Path
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, random_split
import copy


# Apple Silicon 优先使用 MPS
device = torch.device(
    "mps" if torch.backends.mps.is_available() else "cpu"
)

print("device:", device)

# 加载在 ImageNet 上预训练过的 ResNet18
model = models.resnet18(
    weights=models.ResNet18_Weights.DEFAULT
)

# 冻结原有的全部参数（backbone 和原来的分类头）
for param in model.parameters():
    param.requires_grad = False

# 将原来的 Linear(512, 1000) 替换为 CIFAR-10 的 Linear(512, 10)
num_classes = 10
model.fc = nn.Linear(model.fc.in_features, num_classes)

# 把整个模型移到 MPS / CPU
model = model.to(device)

# 验证：随机输入经过模型后，输出应为 [4, 10]
x = torch.randn(4, 3, 224, 224, device=device)

model.eval()

with torch.no_grad():
    out = model(x)

# 统计参数量
total_params = sum(param.numel() for param in model.parameters())
trainable_params = sum(
    param.numel()
    for param in model.parameters()
    if param.requires_grad
)

print("model.fc:", model.fc)
print("input shape:", x.shape)
print("output shape:", out.shape)
print("fc weight requires_grad:", model.fc.weight.requires_grad)
print("total params:", total_params)
print("trainable params:", trainable_params)

assert out.shape == (4, 10)
assert model.fc.weight.requires_grad is True
assert trainable_params == 5130

print("model setup and shape validation passed!")

# 预训练 ResNet18 配套的最小预处理
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])

# 数据下载到 Stage_3_CNN_ResNet/Data/
data_root = Path(__file__).resolve().parent.parent / "Data"

train_set = datasets.CIFAR10(
    root=data_root,
    train=True,
    download=True,
    transform=transform,
)

test_set = datasets.CIFAR10(
    root=data_root,
    train=False,
    download=True,
    transform=transform,
)

# 从 50,000 张训练数据中划出 5,000 张验证数据
val_size = int(len(train_set) * 0.1)
train_size = len(train_set) - val_size

train_subset, val_subset = random_split(
    train_set,
    [train_size, val_size],
    generator=torch.Generator().manual_seed(42),
)

train_loader = DataLoader(
    train_subset,
    batch_size=128,
    shuffle=True,
    num_workers=0,
)

val_loader = DataLoader(
    val_subset,
    batch_size=128,
    shuffle=False,
    num_workers=0,
)

test_loader = DataLoader(
    test_set,
    batch_size=128,
    shuffle=False,
    num_workers=0,
)

print("train samples:", len(train_subset))
print("val samples:", len(val_subset))
print("test samples:", len(test_set))

criterion = nn.CrossEntropyLoss()

optimizer = torch.optim.Adam(
    model.fc.parameters(),
    lr=1e-3,
)


def train_one_epoch(model, data_loader, criterion, optimizer, device):
    # 固定 backbone 的 BatchNorm 状态，避免其运行统计量被训练数据改写
    model.eval()

    # Linear 层没有 train/eval 行为差异，但明确表示它是当前训练目标
    model.fc.train()

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    for images, labels in data_loader:
        # DataLoader 产出的数据默认在 CPU；训练前移到 MPS
        images = images.to(device)
        labels = labels.to(device)

        # 清空上一 batch 残留的 fc 梯度
        optimizer.zero_grad()

        # forward： [B, 3, 224, 224] -> [B, 10]
        logits = model(images)

        # logits: [B, 10]，labels: [B]
        loss = criterion(logits, labels)

        # backward：只会为 fc 的参数计算梯度
        loss.backward()

        # 更新 fc 参数
        optimizer.step()

        batch_size = images.size(0)
        total_loss += loss.item() * batch_size
        total_correct += (logits.argmax(dim=1) == labels).sum().item()
        total_samples += batch_size

    avg_loss = total_loss / total_samples
    accuracy = total_correct / total_samples

    return avg_loss, accuracy


def evaluate(model, data_loader, criterion, device):
    # 验证时：BatchNorm 使用固定统计量
    model.eval()

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    # 验证不训练，不需要构建反向传播图
    with torch.no_grad():
        for images, labels in data_loader:
            images = images.to(device)
            labels = labels.to(device)

            logits = model(images)
            loss = criterion(logits, labels)

            batch_size = images.size(0)
            total_loss += loss.item() * batch_size
            total_correct += (logits.argmax(dim=1) == labels).sum().item()
            total_samples += batch_size

    avg_loss = total_loss / total_samples
    accuracy = total_correct / total_samples

    return avg_loss, accuracy


num_epochs = 5

best_val_acc = -1.0
best_state = None

for epoch in range(1, num_epochs + 1):
    train_loss, train_acc = train_one_epoch(
        model=model,
        data_loader=train_loader,
        criterion=criterion,
        optimizer=optimizer,
        device=device,
    )

    val_loss, val_acc = evaluate(
        model=model,
        data_loader=val_loader,
        criterion=criterion,
        device=device,
    )

    print(
        f"epoch {epoch}/{num_epochs} | "
        f"train loss: {train_loss:.4f} | "
        f"train acc: {train_acc:.2%} | "
        f"val loss: {val_loss:.4f} | "
        f"val acc: {val_acc:.2%}"
    )

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        best_state = copy.deepcopy(model.state_dict())

# 恢复验证集表现最好的那一轮模型
model.load_state_dict(best_state)

test_loss, test_acc = evaluate(
    model=model,
    data_loader=test_loader,
    criterion=criterion,
    device=device,
)

print(f"best val acc: {best_val_acc:.2%}")
print(f"test loss: {test_loss:.4f}")
print(f"test acc:  {test_acc:.2%}")
```
