# Stage 5 学习笔记：BERT 全量微调与 LoRA 参数高效微调对比实验

> 这是一份根据我的实际学习过程整理的个人复习笔记。
>
> 目标不是只记录“代码跑通了”，而是把：
>
> - BERT 文本分类的数据流；
> - Full Fine-tuning 与 LoRA 的原理差异；
> - 控制变量实验设计；
> - 参数量、训练时间和分类指标；
> - 我在学习过程中遇到的疑问、报错和解决方式；
> - 关键代码和最终图表
>
> 放在同一个地方，之后可以直接用于复习、项目介绍和面试准备。

---

## 0. 项目基本信息

| 项目 | 内容 |
| --- | --- |
| 项目名称 | BERT 全量微调与 LoRA 参数高效微调对比实验 |
| 任务 | SST-2 英文句子情感二分类 |
| 基础模型 | `bert-base-uncased` |
| Full 方法 | 更新 BERT 和分类头的全部可训练参数 |
| LoRA 方法 | 冻结原始 BERT，只训练 LoRA 参数和分类头 |
| 数据划分 | 有标签数据重新划分为 80% / 10% / 10% |
| 设备 | 训练记录为 Apple Silicon MPS |
| Batch size | 8 |
| 最大序列长度 | 64 |
| Epoch | 3 |
| 学习率 | `2e-5` |
| 随机种子 | 42 |
| LoRA rank | 8 |
| LoRA alpha | 16 |
| LoRA dropout | 0.1 |
| LoRA target modules | `query`, `value` |

项目代码位置：

```text
/Users/yyy/code/pytorch_study/Stage_5_Projects/bert-full-vs-lora/
```

主要文件：

```text
configs/experiment_config.py  统一实验配置
utils.py                      公共数据、模型、训练和评估工具
train_full_finetune.py        Full Fine-tuning 入口
train_lora.py                 LoRA 入口
evaluate.py                   生成最终评估结果和图表
tests/                        单元测试和 smoke test
results/                      训练摘要、混淆矩阵和训练曲线
```

---

## 1. 我在 Stage 5 实际完成了什么

### 1.1 从 Stage 4 继承的知识

Stage 4 已经完成了以下闭环：

```text
原始句子
  -> tokenizer
  -> input_ids / attention_mask / token_type_ids
  -> Dataset / DataLoader
  -> BERT 分类模型
  -> logits / loss
  -> prediction / accuracy
  -> backward
  -> optimizer.step()
  -> validation
  -> test
```

句子分类的 shape 契约是：

```text
input_ids       [B, L]
attention_mask  [B, L]
token_type_ids  [B, L]
labels          [B]

logits          [B, 2]
loss            []       # 标量 Tensor
predictions     [B]
```

其中：

- `B` 是 batch size；
- `L` 是最大序列长度；
- `labels` 是每个句子的一个情感标签，不是每个 token 一个标签；
- `logits.argmax(dim=1)` 将 `[B, 2]` 变成 `[B]`；
- `outputs.loss` 默认是对一个 batch 聚合后的标量 loss。

### 1.2 Stage 5 新增的核心内容

这次不再只学习“如何让 BERT 训练起来”，而是开始做受控实验：

```text
同一个模型
同一份数据
同一个 tokenizer
同一组训练配置
同一套评价方式
只改变微调方法
```

对比的唯一核心变量是：

```text
Full Fine-tuning vs LoRA Fine-tuning
```

我最终完成了：

1. 固定有标签 SST-2 的 80/10/10 划分；
2. 使用相同的 `bert-base-uncased` 和 tokenizer；
3. 使用 PEFT 接入 LoRA；
4. 统计总参数量和可训练参数量；
5. 记录每个 epoch 的 loss、accuracy 和训练时间；
6. 根据 validation loss 选择最佳 checkpoint；
7. 在同一份 test split 上进行最终评估；
8. 生成训练曲线和混淆矩阵；
9. 写入 README、测试和 GitHub 项目。

---

## 2. 为什么要做这个实验

### 2.1 Full Fine-tuning 的问题

Full Fine-tuning 会更新 BERT 几乎所有参数：

```text
W -> W + ΔW
```

优点：

- 模型调整自由度高；
- 在当前任务上通常更容易取得较高效果；
- 逻辑直观，和普通深度学习训练一致。

缺点：

- 可训练参数很多；
- 反向传播和优化器状态开销大；
- 每个任务都保存一整份模型，存储成本高；
- 多任务、多用户场景下不够灵活。

### 2.2 LoRA 的基本想法

LoRA 不直接更新原始权重 `W`，而是冻结 `W`，只学习一个低秩更新：

```text
W' = W + ΔW
ΔW = B × A
```

如果原始权重是：

```text
W: [d_out, d_in]
```

那么 LoRA 使用：

```text
A: [r, d_in]
B: [d_out, r]
```

其中 `r` 是 rank，并且通常远小于 `d_in` 和 `d_out`。

矩阵乘法结果为：

```text
B × A: [d_out, r] × [r, d_in]
     -> [d_out, d_in]
```

因此 `B × A` 的形状可以和 `W` 相加，但训练参数量从：

```text
d_out × d_in
```

变成：

```text
r × d_in + d_out × r
= r × (d_in + d_out)
```

这就是 LoRA 参数效率的来源。

### 2.3 LoRA 不是“只训练一个小矩阵”

这是我之前容易混淆的地方。

LoRA 通常训练两个小矩阵：

```text
A 和 B
```

它们的乘积才构成低秩更新：

```text
ΔW = B × A
```

同时，当前 BERT 分类任务还需要训练分类头：

```text
LoRA 参数 + classifier 参数
```

因此 LoRA 的可训练参数并不等于只有所有 A/B 参数，还包括 `classifier`。

---

## 3. 控制变量法：这次实验如何做到公平

### 3.1 只改变一个变量

实验设计如下：

| 项目 | Full | LoRA | 是否固定 |
| --- | --- | --- | --- |
| 基础模型 | `bert-base-uncased` | `bert-base-uncased` | 是 |
| 数据来源 | 有标签 SST-2 | 有标签 SST-2 | 是 |
| 数据划分 | 80/10/10 | 80/10/10 | 是 |
| seed | 42 | 42 | 是 |
| tokenizer | BERT tokenizer | BERT tokenizer | 是 |
| max length | 64 | 64 | 是 |
| batch size | 8 | 8 | 是 |
| learning rate | `2e-5` | `2e-5` | 是 |
| epoch | 3 | 3 | 是 |
| device | MPS | MPS | 是 |
| validation/test | 同一套 | 同一套 | 是 |
| 微调方法 | 全量更新 | LoRA 更新 | **改变** |

如果同时改变 batch size、学习率、epoch 或数据集，那么最后无法回答：

```text
结果差异到底来自 LoRA，还是来自其他配置？
```

### 3.2 为什么 test 不能参与训练和调参

三个 split 的职责：

| split | 是否更新参数 | 是否选择 checkpoint | 用途 |
| --- | --- | --- | --- |
| train | 是 | 否 | 学习参数 |
| validation | 否 | 是 | 选择模型、比较方案 |
| test | 否 | 否 | 最终一次性报告 |

正确的数据流是：

```text
train -> 更新参数
validation -> 选择最佳 checkpoint
test -> 最终报告结果
```

如果反复查看 test，再根据 test 结果修改模型，就会把 test 变成隐形 validation，最后的准确率不再是独立评估结果。

---

## 4. 数据划分：为什么代码要进行两次划分

### 4.1 当前数据边界

本实验没有使用官方 SST-2 的无标签 test，而是：

```text
原始 train + 原始 validation
  -> 只保留 label 为 0 或 1 的样本
  -> 重新分层划分
  -> train 80% / validation 10% / local test 10%
```

因此本实验的 test accuracy 是：

```text
本地重新划分的 labeled held-out test accuracy
```

不是官方 GLUE hidden-test leaderboard 结果。

### 4.2 为什么不能一次调用 `train_test_split` 得到三份

`train_test_split` 一次只能把数据分成两份。因此代码采用两次划分：

```python
temporary_ratio = val_ratio + test_ratio

first_split = labeled_dataset.train_test_split(
    test_size=temporary_ratio,
    seed=seed,
    stratify_by_column="label",
)

second_split = first_split["test"].train_test_split(
    test_size=test_ratio / temporary_ratio,
    seed=seed,
    stratify_by_column="label",
)
```

对于 80/10/10：

```text
第一次：80% train + 20% temporary
第二次：temporary 中的 50% validation + 50% test
```

因为：

```text
0.1 / (0.1 + 0.1) = 0.5
```

两次划分并不是重复使用数据，而是把一个二分 API 组合成三分结果。

### 4.3 为什么要 `stratify_by_column="label"`

SST-2 是二分类任务。分层划分可以让 train、validation、test 中的正负样本比例尽量接近，避免某个 split 偶然包含过多正样本或负样本。

---

## 5. BERT 文本分类的完整数据流

### 5.1 tokenizer 阶段

原始文本：

```text
"a very enjoyable movie"
```

经过 tokenizer 后得到：

```text
input_ids       [L]
attention_mask  [L]
token_type_ids  [L]
```

DataLoader 组 batch 后变为：

```text
input_ids       [B, L]
attention_mask  [B, L]
token_type_ids  [B, L]
label           [B]
```

### 5.2 BERT 和分类头

```text
[B, L]
   -> BERT 编码
   -> [CLS] 表示
   -> classifier
   -> logits [B, 2]
```

传入 `labels` 后，Transformers 模型会自动计算交叉熵：

```python
outputs = model(
    input_ids=input_ids,
    attention_mask=attention_mask,
    token_type_ids=token_type_ids,
    labels=labels,
    return_dict=True,
)

logits = outputs.logits   # [B, 2]
loss = outputs.loss       # []
```

预测：

```python
predictions = logits.argmax(dim=1)  # [B]
accuracy = (predictions == labels).float().mean()
```

### 5.3 训练和验证的差别

训练：

```python
model.train()
optimizer.zero_grad()
outputs = model(..., labels=labels)
loss = outputs.loss
loss.backward()
optimizer.step()
```

验证/测试：

```python
model.eval()
with torch.no_grad():
    outputs = model(..., labels=labels)
```

验证和测试不能执行 `backward()` 或 `optimizer.step()`。

---

## 6. 关键代码一：统一配置

Full 和 LoRA 使用同一个配置文件，避免两个入口脚本各自填写参数而产生控制变量错误。

```python
MODEL_NAME = "bert-base-uncased"
DATASET_NAME = "nyu-mll/glue"
DATASET_CONFIG = "sst2"

TRAIN_RATIO = 0.8
VAL_RATIO = 0.1
TEST_RATIO = 0.1
SEED = 42

BATCH_SIZE = 8
MAX_LENGTH = 64
NUM_EPOCHS = 3
LEARNING_RATE = 2e-5

LORA_RANK = 8
LORA_ALPHA = 16
LORA_DROPOUT = 0.1
LORA_TARGET_MODULES = ("query", "value")
```

代码使用：

```python
PROJECT_DIR = Path(__file__).resolve().parents[1]
```

而不是依赖 `Path.cwd()`。这样无论从哪个工作目录启动脚本，缓存和结果路径都相对稳定。

---

## 7. 关键代码二：模型构造和 LoRA 注入

### 7.1 Full 模型

```python
def build_full_model(model_name, cache_dir, device, seed=42, num_labels=2):
    torch.manual_seed(seed)
    model = BertForSequenceClassification.from_pretrained(
        model_name,
        num_labels=num_labels,
        cache_dir=str(cache_dir),
    )
    return model.to(device)
```

加载 `bert-base-uncased` 时，BERT 预训练头中的部分参数会出现：

```text
UNEXPECTED: cls.predictions.*、cls.seq_relationship.*
MISSING: classifier.weight、classifier.bias
```

这不是当前分类模型加载失败，而是：

- 原始 checkpoint 中存在预训练任务的 MLM/NSP 头；
- 当前任务使用的是新的二分类 `classifier`；
- `classifier.weight` 和 `classifier.bias` 需要随机初始化并在 SST-2 上学习。

### 7.2 LoRA 注入

```python
def apply_lora(
    model,
    rank=8,
    alpha=16,
    dropout=0.1,
    target_modules=("query", "value"),
):
    lora_config = LoraConfig(
        task_type=TaskType.SEQ_CLS,
        r=rank,
        lora_alpha=alpha,
        lora_dropout=dropout,
        target_modules=list(target_modules),
        modules_to_save=["classifier"],
        bias="none",
    )
    return get_peft_model(model, lora_config)
```

这里最重要的是：

```text
task_type=SEQ_CLS
target_modules=["query", "value"]
modules_to_save=["classifier"]
```

### 7.3 为什么是 `query`、`value`，不是 `q_proj`、`v_proj`

不同 Transformer 实现的模块命名不一样：

```text
BERT 常见命名：query、key、value
其他模型可能命名：q_proj、k_proj、v_proj
```

因此不能凭记忆把所有模型都写成 `q_proj` 和 `v_proj`。应该先检查实际模型：

```python
for name, module in model.named_modules():
    if "query" in name or "value" in name:
        print(name, type(module))
```

### 7.4 为什么分类头必须保存为可训练模块

LoRA 只负责对 BERT 的指定线性层做低秩更新，但 SST-2 的分类头仍然需要从头学习二分类任务。因此：

```python
modules_to_save=["classifier"]
```

表示分类头不是 LoRA 矩阵，但仍然参与训练和保存。

---

## 8. 关键代码三：参数统计和手算

代码统计方式：

```python
def count_parameters(model):
    total = sum(parameter.numel() for parameter in model.parameters())
    trainable = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.requires_grad
    )
    return {"total": total, "trainable": trainable}
```

### 8.1 Full 参数量

Full 实验中：

```text
total      = 109,483,778
trainable  = 109,483,778
```

因为没有冻结参数，所以总参数量和可训练参数量相等。

### 8.2 LoRA 参数量

LoRA 实验中：

```text
total      = 109,780,228
trainable  = 296,450
```

注意：LoRA 的 `total` 可能比 Full 略大，因为模型中额外加入了 LoRA 参数；但真正参与梯度更新的只有 `296,450` 个参数。

### 8.3 用 BERT 的形状估算 LoRA 参数

BERT-base 的 hidden size 是 `768`。每层的 `query` 和 `value` 通常都是：

```text
W: [768, 768]
```

Full 更新一个矩阵的参数量：

```text
768 × 768 = 589,824
```

LoRA rank 为 8 时，两个低秩矩阵的参数量：

```text
A: [8, 768]  -> 8 × 768 = 6,144
B: [768, 8]  -> 768 × 8 = 6,144

总计 = 12,288
```

因此一个 LoRA 注入位置大约是：

```text
12,288 / 589,824 ≈ 2.08%
```

每层有 `query` 和 `value` 两个目标模块：

```text
12,288 × 2 = 24,576
```

12 层 BERT 的 LoRA 矩阵大约为：

```text
24,576 × 12 = 294,912
```

再加上分类头参数，得到实验中约 `296,450` 的可训练参数量。

### 8.4 参数量结论

```text
Full 可训练参数：109,483,778
LoRA 可训练参数：296,450
```

LoRA 使用的可训练参数约为总参数的：

```text
0.2700%
```

Full 的可训练参数约是 LoRA 的：

```text
109,483,778 / 296,450 ≈ 369.3 倍
```

---

## 9. 关键代码四：训练、验证和 checkpoint

### 9.1 只把可训练参数交给优化器

```python
def create_optimizer(model, learning_rate=2e-5):
    trainable_parameters = [
        parameter
        for parameter in model.parameters()
        if parameter.requires_grad
    ]
    return torch.optim.AdamW(
        trainable_parameters,
        lr=learning_rate,
    )
```

LoRA 的冻结参数不应该传给优化器。这样可以：

- 明确实验边界；
- 避免为冻结参数建立不必要的优化器状态；
- 让参数量统计和实际更新保持一致。

### 9.2 一个 epoch 的核心逻辑

```python
training = optimizer is not None
model.train() if training else model.eval()

with torch.set_grad_enabled(training):
    for batch in data_loader:
        batch_on_device = {
            key: value.to(device)
            for key, value in batch.items()
        }
        labels = batch_on_device["label"]

        if training:
            optimizer.zero_grad()

        outputs = model(
            input_ids=batch_on_device["input_ids"],
            attention_mask=batch_on_device["attention_mask"],
            token_type_ids=batch_on_device["token_type_ids"],
            labels=labels,
            return_dict=True,
        )

        loss = outputs.loss
        predictions = outputs.logits.argmax(dim=1)

        if training:
            loss.backward()
            optimizer.step()
```

训练和验证共用同一个 `run_epoch`，区别只在于是否传入 optimizer：

```text
optimizer != None -> 训练并更新参数
optimizer == None -> 只做评估
```

### 9.3 loss 为什么要乘回 batch size

每个 batch 的 `outputs.loss` 通常是 batch 内样本的平均 loss。为了得到整个数据集的平均 loss：

```python
total_loss += loss.item() * batch_size
total_samples += batch_size

epoch_loss = total_loss / total_samples
```

不能简单平均所有 batch loss，因为最后一个 batch 可能比其他 batch 小。

### 9.4 checkpoint 选择规则

代码只根据 validation loss 保存最佳模型：

```python
if val_loss < best_val_loss:
    best_val_loss = val_loss
    best_epoch = epoch + 1
    torch.save(
        {
            "epoch": best_epoch,
            "model_state_dict": model.state_dict(),
            "val_loss": val_loss,
            "val_accuracy": val_accuracy,
        },
        checkpoint_path,
    )
```

正确顺序：

```text
训练 train
  -> 每轮 validation
  -> 保存 validation loss 最低的 checkpoint
  -> 所有 epoch 完成
  -> 恢复最佳 checkpoint
  -> 最后评估 test
```

---

## 10. 关键代码五：混淆矩阵和 F1

混淆矩阵约定为：

```text
行：真实标签
列：预测标签
```

因此：

```text
              预测 0   预测 1
真实 0          TN       FP
真实 1          FN       TP
```

代码中的更新方式：

```python
confusion_matrix[label.item(), prediction.item()] += 1
```

计算指标：

```text
accuracy  = (TP + TN) / 总样本数
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 × precision × recall / (precision + recall)
```

这次项目代码主要记录了 loss、accuracy 和 confusion matrix；F1 可以根据混淆矩阵离线计算，因此复习时补充如下：

```text
Full:
TN=2843, FP=178, FN=151, TP=3651
precision ≈ 0.9535
recall    ≈ 0.9603
F1        ≈ 0.9569

LoRA:
TN=2823, FP=198, FN=405, TP=3397
precision ≈ 0.9449
recall    ≈ 0.8935
F1        ≈ 0.9185
```

从 Full 到 LoRA，正类 recall 下降更明显，说明 LoRA 在这次固定三 epoch 配置下漏掉了更多真实正类样本。

---

## 11. 实验结果

### 11.1 规模和时间

| 指标 | Full Fine-tuning | LoRA |
| --- | ---: | ---: |
| 总参数量 | 109,483,778 | 109,780,228 |
| 可训练参数量 | 109,483,778 | 296,450 |
| 可训练参数比例 | 100% | 0.2700% |
| 训练时间 | 68.82 min | 35.95 min |
| 速度关系 | — | 约 1.91 倍加速 |
| 时间减少 | — | 约 47.76% |

### 11.2 训练和验证结果

Full：

| Epoch | Train loss | Train acc | Val loss | Val acc |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0.2155 | 91.64% | 0.1636 | 94.53% |
| 2 | 0.1139 | 96.16% | 0.1514 | 95.32% |
| 3 | 0.0773 | 97.41% | 0.1504 | 95.10% |

LoRA：

| Epoch | Train loss | Train acc | Val loss | Val acc |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0.3486 | 84.10% | 0.2469 | 89.74% |
| 2 | 0.2629 | 89.03% | 0.2276 | 91.03% |
| 3 | 0.2434 | 89.96% | 0.2067 | 91.32% |

### 11.3 最终 test 结果

| 指标 | Full Fine-tuning | LoRA |
| --- | ---: | ---: |
| Test loss | 0.1502 | 0.2148 |
| Test accuracy | 95.18% | 91.16% |
| 正类 F1 | 95.69% | 91.85% |
| 最佳 epoch | 3 | 3 |

### 11.4 结果解释

在相同的三 epoch 预算下：

- LoRA 只使用约 0.27% 的可训练参数；
- LoRA 训练时间减少约 47.76%；
- Full 的 test accuracy 比 LoRA 高约 4.02 个百分点；
- LoRA 的 validation loss 在第 3 轮仍然下降。

因此当前结论是：

```text
在本次固定三 epoch、batch size=8、MPS、SST-2 本地划分的实验条件下，
LoRA 显著减少了可训练参数和训练时间，但最终任务指标低于 Full。
```

不能把这个结果写成：

```text
LoRA 永远不如 Full
```

因为 LoRA 只训练了 3 个 epoch，而且 validation loss 还没有稳定。当前实验是固定预算对比，不是收敛性研究。

---

## 12. 实验图表

### 12.1 Loss 和 Accuracy 曲线

![[attachments/training_curves_comparison.png]]

读图重点：

- Full 的 train loss 下降更快，训练 accuracy 更高；
- Full 的 validation loss 在第 2、3 轮已经比较稳定；
- LoRA 的 train/validation loss 都还在下降；
- LoRA 在当前预算下可能仍有继续训练的空间。

### 12.2 Full 混淆矩阵

![[attachments/full_test_confusion_matrix.png]]

```text
[[2843, 178],
 [ 151,3651]]
```

Full 的 FP 和 FN 都相对较少，正类 recall 约为 96.03%。

### 12.3 LoRA 混淆矩阵

![[attachments/lora_test_confusion_matrix.png]]

```text
[[2823, 198],
 [ 405,3397]]
```

LoRA 的 FN 为 405，明显高于 Full 的 151，这与 LoRA 较低的正类 recall 相一致。

---

## 13. 我在学习过程中提出的重要问题与回答

### Q1：为什么要进行两次划分，直接一次划分好不行吗？

回答：`train_test_split` 一次只返回两份数据，所以先划出 80% train 和 20% temporary，再把 temporary 分成 10% validation 和 10% test。两次划分不是重复使用数据，而是组合出三份数据。

### Q2：LoRA 参数量少了这么多，为什么训练一轮还需要约 10 分钟？是不是 batch size 太小？

回答：参数量少主要减少的是“需要梯度更新的参数”和部分优化器开销，不等于完整的 BERT forward 一起消失。每个样本仍然要经过 12 层 BERT，输入数据量、序列长度、batch 数量和 MPS 上的计算效率仍然存在。

这次 batch size=8 是控制变量，不能为了 LoRA 单独修改，否则比较就不公平。LoRA 的收益不是“每轮一定非常快”，而是通常在可训练参数、显存/内存、存储和多任务适配方面更有优势。

### Q3：为什么 LoRA 训练时间比 Full 少，但没有少到 0.27%？

回答：`0.27%` 是可训练参数比例，不是总计算量比例。冻结的 BERT 仍然要执行 forward，反向传播也仍然需要通过网络传播到 LoRA 插入位置。Full 需要对大量参数保留梯度并更新，LoRA 可以减少一部分开销，但不会把整个 BERT 的计算删除。

### Q4：PEFT 是什么？

回答：PEFT 是 Parameter-Efficient Fine-Tuning，参数高效微调。它不是单独的一种矩阵算法，而是一组减少微调成本的方法和工具框架。LoRA 是 PEFT 中的一种方法，PEFT 库负责把 LoRA 配置注入模型、冻结原始参数、标记可训练参数和保存/加载适配器。

当前项目使用的是：

```text
PEFT 工程实现 + LoRA 原理理解
```

而不是手写完整 LoRA 层。

### Q5：为什么看到 `use_return_dict is deprecated`？需要重新训练吗？

回答：这是 Transformers 版本中的 API 弃用提示，不是训练结果错误。代码已经显式使用：

```python
return_dict=True
```

因此不需要因为这个 warning 重新训练，已经完成的训练结果也不受影响。

### Q6：为什么 Full 模型加载时出现 `UNEXPECTED` 和 `MISSING`？

回答：`bert-base-uncased` checkpoint 包含预训练阶段的 MLM/NSP 头，而当前使用的是 sequence classification 架构。旧的预训练头没有被当前任务使用，所以出现 `UNEXPECTED`；当前二分类头是新建的，所以 `classifier.weight` 和 `classifier.bias` 出现 `MISSING` 并被随机初始化。这是下游分类任务的正常现象。

### Q7：LoRA 的 target module 为什么写 `query,value`，不是 `q_proj,v_proj`？

回答：模块名称取决于具体模型实现。BERT 的注意力层常见名称是 `query`、`key`、`value`；其他 Transformer 模型可能使用 `q_proj`、`k_proj`、`v_proj`。不能脱离模型结构凭记忆填写，应该先通过 `named_modules()` 检查。

### Q8：只训练 LoRA 参数时，分类头要不要训练？

回答：要训练。LoRA 只负责对 BERT 指定层进行低秩更新，分类头仍然需要学习 SST-2 的二分类映射，因此代码中使用：

```python
modules_to_save=["classifier"]
```

### Q9：训练三轮后 LoRA 的 loss 还在下降，需要继续训练到稳定吗？

回答：如果研究问题是“谁最终收敛得更好”，就需要更长训练和更严格的收敛实验；但当前实验采用的是固定三 epoch 预算，研究问题是“相同预算下的参数效率与任务效果”。因此本次不继续训练，README 中明确标注“固定预算对比，不是收敛性研究”。

### Q10：这个实验是不是本地设备花费时间太多，不适合？

回答：对于 Apple Silicon 本地教学和实验，完整 BERT + 80/10/10 SST-2 数据量确实较重。它适合作为一次完整对照实验，但不适合频繁重复调参。后续应优先使用小样本 smoke test 验证代码，再进行正式长时间实验。

### Q11：为什么必须加每个 epoch 的进度条？

回答：长时间训练如果只有最终输出，很难判断程序是在运行、卡住还是发生了异常。`tqdm` 显示当前 epoch、batch 进度和 batch loss，让训练过程可观察，也方便估算剩余时间。

### Q12：`ModuleNotFoundError: No module named 'peft'` 怎么解决？

回答：问题不是代码本身，而是运行脚本的 Python 环境没有安装 `peft`。本项目最终使用的环境是：

```text
Python       3.11.15
peft         0.20.0
transformers 5.14.1
datasets     5.0.0
```

关键原则是始终用运行脚本的同一个解释器安装和检查依赖：

```bash
/opt/miniconda3/envs/pytorch_env/bin/python -m pip show peft
```

### Q13：为什么测试代码导入 `utils` 会失败？

回答：直接运行 `tests/test_utils.py` 时，Python 的当前模块搜索路径可能只包含 `tests/`，不包含项目根目录，因此找不到根目录下的 `utils.py`。解决方式可以是：

```bash
cd /Users/yyy/code/pytorch_study/Stage_5_Projects/bert-full-vs-lora
/opt/miniconda3/envs/pytorch_env/bin/python tests/test_utils.py
```

或者把项目组织成可安装包。当前项目采用从项目目录运行测试的简单方式。

### Q14：网络 warning 和代码失败是一回事吗？

回答：不是。Hugging Face 的 unauthenticated request warning 主要表示没有设置 `HF_TOKEN`，会影响下载速率和限额；只要数据和模型已经缓存，仍可能正常运行。代理连接成功但 ChatGPT 页面得到 Cloudflare 403，也不能直接等同于本地 VPN 完全失效。排查时要区分：

```text
提示 warning
依赖缺失
数据下载失败
模型加载失败
训练逻辑失败
```

### Q15：当前实验是否已经结束？

回答：实验运行、最终评估、图表、README、测试和 GitHub 同步已经完成。需要保留的限制是：

```text
这是固定 3 epoch 的对比实验，不是 LoRA 的充分收敛实验。
```

---

## 14. 这次实验中的错误排查方法

### 14.1 先确认解释器

```bash
which python
python --version
python -m pip --version
python -m pip show peft transformers datasets
```

不要混用系统 Python、conda 环境和 VS Code 解释器。

### 14.2 先做小测试，再跑长实验

本项目加入了以下测试：

- DataLoader 字段和 shape；
- tokenizer 输出字段和 dtype；
- BERT forward contract；
- Full/LoRA 模型构造；
- LoRA 可训练参数选择；
- optimizer 只接收可训练参数；
- 单 batch 参数更新；
- epoch train/eval 模式；
- checkpoint 保存和恢复；
- confusion matrix 样本计数；
- 多 epoch 最佳 checkpoint。

原则：

```text
小数据、少 batch、短时间 smoke test
  -> 确认 shape/API/梯度/保存逻辑
  -> 再跑完整实验
```

### 14.3 常见 warning 不要误判成失败

```text
Hugging Face unauthenticated warning   -> 下载身份/速率提示
UNEXPECTED / MISSING                   -> 预训练头和下游分类头差异
use_return_dict deprecated             -> API 弃用提示
```

真正需要停止并排查的通常是：

```text
ModuleNotFoundError
RuntimeError: tensor device 不一致
shape mismatch
loss 为 NaN
checkpoint 无法恢复
```

---

## 15. 项目交付和 GitHub 记录

项目已经直接推送到 GitHub 的 `main` 分支：

```text
仓库：snowstorm-121/pytorch_learning
项目目录：Stage_5_Projects/bert-full-vs-lora/
commit：1be7075
```

已同步：

- 源代码；
- 配置；
- 测试；
- README；
- 实验 summary；
- 训练曲线；
- 混淆矩阵。

没有同步：

- 本地 Hugging Face 数据缓存；
- `__pycache__`；
- 两个大型 `best_model.pt` checkpoint。

checkpoint 保留在本地项目目录中，但由于文件很大，没有放进 GitHub。README 中已说明这一点。

---

## 16. 复习时需要能口述的完整答案

### 16.1 2 分钟项目介绍

```text
我基于 bert-base-uncased 在本地重新划分的有标签 SST-2 数据上，
实现了 Full Fine-tuning 和 PEFT LoRA 的受控对比实验。

两种方法固定相同的数据划分、tokenizer、batch size、学习率、epoch、
设备和评价流程，只改变微调方法。Full 更新全部 BERT 参数，LoRA 冻结
原始 BERT，只在 query/value 模块注入低秩更新并训练分类头。

三 epoch 结果显示，LoRA 只训练 0.27% 的参数，训练时间减少约 47.76%，
但 test accuracy 为 91.16%，低于 Full 的 95.18%。由于 LoRA validation
loss 在第 3 轮仍下降，这个结果应解释为固定预算下的工程对比，而不是
LoRA 最终性能上限。
```

### 16.2 5 分钟技术追问顺序

1. 数据如何划分？为什么不用官方 test？
2. `input_ids`、`attention_mask`、`token_type_ids` 和 `labels` 的 shape 是什么？
3. BERT 输出什么？loss 如何得到？
4. Full 和 LoRA 的唯一自变量是什么？
5. LoRA 的 `A`、`B`、`ΔW`、rank、alpha 分别是什么？
6. 为什么 target module 是 `query`、`value`？
7. 为什么 classifier 也要训练？
8. 参数量是如何手算和验证的？
9. 为什么参数量少不代表训练时间按同样比例减少？
10. checkpoint 如何选择？test 是否参与调参？
11. 这次结果有什么限制？
12. 如果继续研究，如何设计收敛性实验？

---

## 17. 易错点清单

1. `labels` 是 `[B]`，不是 `[B, L]`。
2. `loss` 默认是标量 `[]`，不是 `[B]`。
3. `argmax(dim=1)` 后预测形状是 `[B]`。
4. 两次划分是因为一个 API 只能二分，不是重复使用数据。
5. validation 用于选择 checkpoint，test 只能最后报告。
6. LoRA 是训练 `A` 和 `B` 两个矩阵，不是一个矩阵。
7. `ΔW = B × A`，矩阵顺序不能写反。
8. `rank` 越小，参数量通常越少，但表达能力也可能受限。
9. `alpha` 是缩放因子，不等于 rank。
10. `query/value` 和 `q_proj/v_proj` 是不同模型的命名差异。
11. LoRA 冻结 BERT，但分类头需要保持可训练。
12. 可训练参数比例不是总计算量比例。
13. 3 个 epoch 的固定预算结果不能当作最终收敛结论。
14. 本地 labeled held-out test 不是官方 GLUE hidden test。
15. MPS 上设置 seed 不保证每次训练逐位一致。

---

## 18. 当前项目的不足与下一步行动

### 已完成

- 实验代码；
- Full/LoRA 对比；
- 参数量和训练时间；
- accuracy、F1、混淆矩阵；
- 训练曲线；
- README、测试和 GitHub 同步。

### 仍可补强

- 更系统地阅读 LoRA 原论文；
- 记录一个完整的失败案例：现象、定位、修复和影响；
- 练习从零解释 PEFT 和 LoRA 的代码数据流；
- 准备简历中的项目描述和面试口述；
- 如果未来做收敛性研究，再增加 epoch，并预先声明新的实验问题；
- 之后再进入当前求职计划中的 RAG 数据管道与基础检索项目。

### 复习顺序

```text
先看本笔记第 3 节：控制变量
  -> 再看第 5 节：BERT 数据流
  -> 再看第 7、8 节：LoRA 配置和参数手算
  -> 再看第 11、12 节：实验结果和图
  -> 最后练习第 16 节：项目口述
```

---

## 19. 参考资料

- [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685)
- [Hugging Face PEFT 官方文档](https://huggingface.co/docs/peft/en/index)
- [Hugging Face LoRA 概念指南](https://huggingface.co/docs/peft/main/conceptual_guides/lora)
- [Hugging Face BERT 模型文档](https://huggingface.co/docs/transformers/model_doc/bert)
- [Hugging Face GLUE 数据集卡片](https://huggingface.co/datasets/nyu-mll/glue)
- [项目 README](https://github.com/snowstorm-121/pytorch_learning/tree/main/Stage_5_Projects/bert-full-vs-lora)

---

## 下一步行动

先不要重新训练。下一次复习先完成以下口述检查：

1. 不看代码解释为什么需要两次划分；
2. 手算一个 BERT `query/value` LoRA 层的参数量；
3. 解释为什么 LoRA 参数量少但训练不会快到 0.27%；
4. 解释 validation 和 test 的区别；
5. 用 2 分钟讲清楚这次项目。

通过后，再进入当前执行计划中的 RAG 数据管道学习。

---

## 20. 2026-08-02：Stage 5 项目巩固与面试复盘

本次复盘暂不重新训练，也不修改项目代码、README 或 GitHub。重点是把已有实验结果解释清楚，并确认项目是否已经达到可以写入简历、用于面试的程度。

### 20.1 四项分类指标的复盘

BERT 二分类的评估数据流是：

~~~
logits:      [B, 2]
    -> argmax(dim=1)
predictions: [B]
labels:      [B]
    -> 汇总整个 test split
confusion_matrix: [2, 2]
~~~

项目代码中：

~~~
predictions = outputs.logits.argmax(dim=1)
confusion_matrix[label.item(), prediction.item()] += 1
~~~

混淆矩阵的约定是：

~~~
行：真实标签
列：预测标签

              预测 0   预测 1
真实 0          TN       FP
真实 1          FN       TP
~~~

对于正类 1：

~~~
Accuracy  = (TP + TN) / (TP + TN + FP + FN)
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 × Precision × Recall / (Precision + Recall)
~~~

本次根据混淆矩阵离线计算的正类指标为：

| 指标 | Full | LoRA |
| --- | ---: | ---: |
| Accuracy | 95.18% | 91.16% |
| Precision | 95.35% | 94.49% |
| Recall | 96.03% | 89.35% |
| F1 | 95.69% | 91.85% |

Accuracy 反映所有样本整体预测正确的比例，不能分别揭示 FP 和 FN。Precision 关注“预测为正类的样本中有多少是真的正类”，Recall 关注“所有真实正类中有多少被找出来”，F1 则综合 Precision 和 Recall。

这里的 Precision、Recall 和 F1 指定的是正类 1；如果要完整报告多类别表现，还需要明确使用 macro average、weighted average 还是逐类指标。

### 20.2 根据混淆矩阵解释误分类

Full 的混淆矩阵：

~~~
                预测 0    预测 1
真实 0           2843       178
真实 1            151      3651
~~~

~~~
FP = 178
FN = 151
~~~

LoRA 的混淆矩阵：

~~~
                预测 0    预测 1
真实 0           2823       198
真实 1            405      3397
~~~

~~~
FP = 198
FN = 405
~~~

与 Full 相比：

~~~
FP：178 -> 198，增加 20
FN：151 -> 405，增加 254
~~~

因此 LoRA 主要增加的是 FN，也就是更多真实类别 1 的样本被预测成了类别 0。在 SST-2 标签约定下，可以表述为：

> LoRA 把更多真实的正面情感样本识别成了负面情感，因此类别 1 的 Recall 明显下降。

混淆矩阵能够确认错误发生在哪里，但不能单独确认错误增加的根因。仅凭 FN 增加，不能直接断言是 rank 太小、训练不充分还是某类样本本身更难，需要结合训练曲线、配置和进一步的样本分析。

### 20.3 一个真实失败案例：SST-2 数据加载失败

#### 现象

实验初期运行：

~~~
load_dataset("glue", "sst2")
~~~

出现：

~~~
HfUriError
~~~

错误发生在数据加载阶段，因此还没有进入 tokenizer、BERT forward 或 MPS 训练阶段。

#### 初步假设

当时需要区分以下可能性：

- Hugging Face Hub 网络问题；
- 数据集名称或配置名称错误；
- cache 目录问题；
- 缺少登录 token；
- datasets API 与当前数据集标识不兼容。

#### 排查过程

先确认错误发生在 load_dataset，而不是 tokenizer、模型构造、设备迁移或训练循环。然后比较数据集标识，将加载方式改为：

~~~
load_dataset(
    "nyu-mll/glue",
    "sst2",
    cache_dir=str(cache_dir),
)
~~~

修改后数据成功加载，后续可以继续进行有标签数据合并、分层切分、tokenizer 和训练。

#### 根因

有证据支持的根因是：旧的数据集标识 "glue" 在当前环境下无法被 load_dataset 正常解析；切换到 "nyu-mll/glue" 后数据加载成功。

不能把这个错误直接解释成 LoRA 配置错误、MPS 不支持或必须使用 Hugging Face token。未认证 warning 只是提示，不能与真正阻断数据加载的 HfUriError 混为一谈。

#### 影响

~~~
直接影响：训练流程被阻断，Full 和 LoRA 都无法启动。
最终影响：修正数据集标识后实验恢复，没有改变最终实验结论。
~~~

面试中的简短表达：

> 实验初期在数据加载阶段遇到 HfUriError。我先定位到问题发生在 load_dataset，排除了 tokenizer、MPS 和模型构造环节；随后将数据集标识从 glue 改为 nyu-mll/glue，数据成功加载，实验得以继续。该问题阻断了训练启动，但没有改变最终实验结论。

### 20.4 LoRA 原论文到项目实现的对应关系

LoRA 原论文的核心假设是：下游任务需要的权重变化不一定要用完整矩阵表示，可以用低秩矩阵表示。对于：

~~~
W0: [d_out, d_in]
~~~

LoRA 使用：

~~~
A: [r, d_in]
B: [d_out, r]
ΔW = B × A: [d_out, d_in]
W' = W0 + B × A
~~~

训练时冻结 W0，只训练 A、B。前向可以理解为：

~~~
h = W0 x + B A x
~~~

项目中的 PEFT 配置为：

~~~
LoraConfig(
    task_type=TaskType.SEQ_CLS,
    r=8,
    lora_alpha=16,
    lora_dropout=0.1,
    target_modules=["query", "value"],
    modules_to_save=["classifier"],
    bias="none",
)
~~~

对应关系：

| 论文概念 | PEFT 配置 | 本项目含义 |
| --- | --- | --- |
| 低秩维度 r | r=8 | A、B 的中间维度为 8 |
| 缩放系数 alpha | lora_alpha=16 | LoRA 分支缩放为 alpha / r = 2 |
| 注入位置 | target_modules=query,value | 只在 BERT 的 query/value 注入 LoRA |
| 冻结预训练权重 | PEFT 冻结基础模型 | 原始 BERT 权重不更新 |
| 任务相关参数 | modules_to_save=classifier | 二分类头保持可训练 |
| bias 策略 | bias=none | 不额外训练 bias |

### 20.5 LoRA 参数量的手算

BERT Base 有 12 层，每层选择一个 query 和一个 value：

~~~
12 × 2 = 24 个目标矩阵
~~~

每个目标矩阵的原始 shape 为 [768, 768]，rank 为 8，因此每个目标矩阵的 LoRA 参数量为：

~~~
8 × 768 + 768 × 8 = 12,288
~~~

24 个目标矩阵：

~~~
24 × 12,288 = 294,912
~~~

二分类头：

~~~
classifier.weight: [2, 768] = 1,536
classifier.bias:   [2]       = 2
~~~

总可训练参数：

~~~
294,912 + 1,538 = 296,450
~~~

因此 296,450 不是孤立的统计数字，而是：

~~~
24 个 query/value LoRA 模块
+ 1 个二分类 classifier
= 296,450 个可训练参数
~~~

### 20.6 为什么 LoRA 更快，但不会快到 0.27%

Full：

~~~
全部参数参与梯度计算和 optimizer.step()
AdamW 为大量参数维护优化器状态
~~~

LoRA：

~~~
W0 冻结
不为 W0 保存梯度
不为 W0 维护优化器状态
主要更新 A、B 和 classifier
~~~

因此 LoRA 的反向传播和优化器更新成本更低。但冻结的 BERT 仍然需要完成 forward，输入仍然要经过 12 层 Transformer，所以：

~~~
可训练参数比例 0.27% != 总计算量比例 0.27%
~~~

实际速度还会受到硬件、batch size、数据加载和框架实现影响。本项目中训练时间为：

~~~
Full：68.82 分钟
LoRA：35.95 分钟
减少约 47.76%
~~~

### 20.7 为什么当前 LoRA 准确率低于 Full

已观察到的事实：

- Full test accuracy 为 95.18%；
- LoRA test accuracy 为 91.16%；
- LoRA validation loss 从第 1 到第 3 个 epoch 仍在下降；
- LoRA 的 FN 为 405，高于 Full 的 151。

可能原因：

- 当前三 epoch 预算不足，LoRA 在给定预算内可能尚未充分收敛；
- rank=8 对权重更新的表达能力有限；
- query/value 目标模块、alpha、dropout 和学习率未必是最优组合。

严谨结论是：

> 当前实验只能证明固定三 epoch 条件下 LoRA 的准确率低于 Full，不能断言 LoRA 充分收敛后的最终性能上限低于 Full。若要验证，需要增加训练预算或系统调参，并保持其他变量不变。

### 20.8 2 分钟项目介绍：少记数字版本

2 分钟介绍不需要背完整实验报告，只记住四条主线：

~~~
问题：LoRA 能否用更少参数完成 BERT 下游分类？
方法：相同条件，只改变 Full 和 LoRA 的微调方式。
结果：Full 约 95%，LoRA 约 91%，LoRA 参数比例 0.27%，训练更快。
限制：固定三 epoch，LoRA validation loss 仍在下降。
~~~

推荐口述：

> 我做了一个 BERT 全量微调和 LoRA 参数高效微调的对比实验，使用 SST-2 二分类任务，重点研究 LoRA 能否用更少参数完成下游分类。为了保证公平，两种方法使用相同的数据划分、tokenizer、训练配置和测试集。LoRA 冻结 BERT 主体，只训练 query/value 的低秩矩阵和分类头。结果上，Full 准确率约为 95%，LoRA 约为 91%，但 LoRA 的可训练参数只有 Full 的 0.27%，训练速度也更快。需要注意的是，本实验只固定训练三 epoch，LoRA 的 validation loss 仍在下降，因此这个结果是固定预算下的比较，不能直接代表 LoRA 充分收敛后的最终性能。

完整数字放在被追问时再说：

~~~
Full：109,483,778 个可训练参数，68.82 分钟
LoRA：296,450 个可训练参数，35.95 分钟
~~~

### 20.9 5 分钟技术讲解骨架

~~~
数据流：文本 -> tokenizer -> Dataset/DataLoader -> [B,L]
      -> BERT -> logits [B,2]、loss []
      -> backward -> optimizer.step()
      -> validation/test

Full：全部 BERT 参数和分类头参与更新。
LoRA：冻结 W0，只更新 A、B 和 classifier。
公平：固定数据、tokenizer、split、seed、超参数、test 和评价代码。
结论：LoRA 参数少、训练更快，但当前固定预算下 accuracy 较低。
~~~

其中 backward 和 optimizer.step() 属于训练阶段；validation 用于选择 checkpoint，test 只用于最终报告。Full 和 LoRA 使用相同的 AdamW 算法和学习率，但传给优化器的参数集合不同，这是微调方式差异的一部分。

### 20.10 简历与面试表述

简历项目名称：

~~~
BERT Full Fine-tuning vs LoRA 参数高效微调对比实验
~~~

简历表述：

- 基于有标签 SST-2 数据集，完成 BERT 全量微调与 LoRA 参数高效微调对比实验；固定数据划分、tokenizer、训练超参数、随机种子、测试集和评价流程，保证实验公平性。
- 使用 PEFT 在 BERT query/value 模块注入 LoRA，冻结预训练主体，仅训练低秩矩阵与分类头；LoRA 可训练参数降至 Full 的 0.27%，训练时间减少约 47.76%。
- 在固定三 epoch 预算下，Full 测试准确率为 95.18%，LoRA 为 91.16%；结合 validation loss 和混淆矩阵分析 LoRA 的误分类特征，并明确该结果不是充分收敛结论。

面试中回答“是否公平”：

> 这个实验在固定三 epoch 的条件下是公平的，因为两种方法使用了相同的数据划分、tokenizer、模型基础、训练超参数、seed、test 集和评价代码，主要变量只有 Full 与 LoRA 的微调方式。需要注意的是，这证明的是固定训练预算下的公平比较，不代表两者都已经充分收敛。

面试中回答“为什么 LoRA 更快”：

> LoRA 更快的主要原因不是只减少了前向计算，而是冻结了绝大多数 BERT 参数，使这些参数不需要参与梯度更新，也不需要由 AdamW 维护对应的优化器状态。训练时主要更新低秩矩阵 A、B 和分类头，因此反向传播和优化器更新成本更低。不过实际加速比例还会受到硬件、batch size、数据加载和框架实现影响。

面试中回答“为什么 LoRA 准确率较低”：

> 当前实验只使用固定三 epoch 预算，LoRA 的 validation loss 到第 3 个 epoch 仍在下降，说明在当前预算下可能尚未充分收敛。增加训练轮数或进一步调参可能缩小与 Full 的差距，但是否能够达到接近 Full 的效果，需要额外实验验证。

### 20.11 Stage 5 最终验收结果

本次复盘确认以下内容已经能够独立解释：

~~~
指标与混淆矩阵             通过
真实失败案例               通过
LoRA 论文公式与 PEFT 配置  通过
参数量手算与实验结果       通过
2 分钟项目介绍             通过
5 分钟技术讲解             通过
简历和面试表述             通过
实验边界和结论限制         通过
~~~

最终验收时必须保留的边界：

~~~
这是固定三 epoch 的对比实验，不是充分收敛实验。
test accuracy 来自有标签数据重新划分的 local held-out test，
不是官方 SST-2 hidden-test leaderboard 结果。
~~~

### 20.12 本次复盘后的状态

Stage 5 项目已经完成代码、测试、结果、README、GitHub 同步、个人笔记和面试复盘。当前暂不立即进入 RAG，先把这次整理后的笔记作为后续复习材料。
