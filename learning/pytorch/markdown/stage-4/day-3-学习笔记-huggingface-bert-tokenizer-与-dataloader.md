# HuggingFace BERT tokenizer 与 DataLoader

学习目标：理解文本如何经过 tokenizer 转换为 BERT 可以接收的 Tensor，并使用 PyTorch 原生 `Dataset` 与 `DataLoader` 组织成 batch，完成 shape、dtype 和 MPS 检查。

本笔记对应 [[PyTorch 暑期详细学习计划]] 中第 6 周 Day 3。前置：[[stage4/Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention|Day 1：Scaled Dot-Product Attention]]、[[stage4/Day 2 学习笔记：Multi-Head Attention——拆分与合并|Day 2：Multi-Head Attention]]。

主线：`文本 -> tokenizer -> input_ids / attention_mask / token_type_ids -> Dataset -> DataLoader -> batch -> MPS`。

---

## 〇、今天完成了什么

1. 使用 `BertTokenizer.from_pretrained("bert-base-uncased")` 对少量英文文本编码。
2. 检查 `input_ids`、`attention_mask` 和 `token_type_ids`。
3. 理解 batch 中的三条独立样本，不等于一条样本中的三个句子，因此单句输入的 `token_type_ids` 全为 0。
4. 使用 PyTorch 原生 `torch.utils.data.Dataset` 封装 tokenizer 输出。
5. 使用 `DataLoader(batch_size=2)` 组织 batch。
6. 验证 batch 字段的 shape、dtype，并成功迁移到 Apple Silicon 的 MPS。
7. 没有加载 BERT、计算 loss 或微调；这些内容留到 Day 4。

最终数据流：

```text
原始文本 -> tokenizer -> 三个字段 -> Dataset -> DataLoader -> batch [B, L] -> MPS
```

---

## 一、为什么文本需要 tokenizer

MLP、CNN 和 Attention 接收的是 Tensor，而原始文本是字符串：

```text
"I like cats."
```

字符串不能直接参与矩阵乘法，因此需要先切分为 token，再根据词表转换为整数编号：

```text
"I like cats." -> ["I", "like", "cats", "."] -> [1045, 2066, 8870, 1012]
```

BERT tokenizer 还会添加特殊 token：

```text
[CLS] I like cats . [SEP]
```

它负责切分文本、查词表、添加特殊 token、截断、padding，以及生成 Attention 所需的辅助字段。

重要区分：`input_ids` 是词表中的编号，不是语义向量。后续 BERT 会通过 Embedding 层将它转换为向量：

```text
input_ids [B, L] -> Embedding -> hidden_states [B, L, hidden_size]
```

---

## 二、三个主要 tokenizer 字段

### 2.1 `input_ids`

表示每个位置对应的 token 编号。单条样本通常是 `[L]`，一个 batch 通常是 `[B, L]`。

本次实验中：

```text
101 -> [CLS]
102 -> [SEP]
0   -> [PAD]
```

第一条文本的结果：

```text
[101, 1045, 2066, 8870, 1012, 102, 0, 0, 0, 0, 0, 0]
```

对应：`[CLS] I like cats . [SEP] [PAD] ...`。

### 2.2 `attention_mask`

表示哪些位置是真实 token，哪些位置是 padding：

```text
1 -> 有效 token
0 -> padding，应被 Attention 屏蔽
```

它不是 Attention 权重。Attention 权重表示关注程度；`attention_mask` 是二值屏蔽信号，通常在 Softmax 前作用于分数：

```python
scores = scores.masked_fill(mask == 0, float("-inf"))
```

本次三条文本的有效长度为 `encoded["attention_mask"].sum(dim=1) -> tensor([6, 7, 7])`。

### 2.3 `token_type_ids`

用于区分同一条样本中的句子 A 和句子 B：

```text
句子 A -> 0
句子 B -> 1
```

本次输入是 batch 中的三条独立单句，而不是一条包含三个句子的样本。因此每一行都只有句子 A，`token_type_ids` 全为 0 是正确结果。

```text
3 条独立样本 != 1 条样本中的 3 个句子
```

如果调用 `tokenizer("The cat is cute.", "It is sleeping.")` 输入句子对，同一条样本中才会出现前半段为 0、后半段为 1 的 `token_type_ids`。

---

## 三、加载 tokenizer 并进行批量编码

```python
from transformers import BertTokenizer

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
texts = ["I like cats.", "The weather is good.", "This movie is terrible."]

encoded = tokenizer(
    texts,
    padding="max_length",
    truncation=True,
    max_length=12,
    return_tensors="pt",
)
```

参数含义：`padding="max_length"` 统一补齐；`truncation=True` 截断过长文本；`max_length=12` 设定序列长度 `L`；`return_tensors="pt"` 直接返回 PyTorch Tensor。

实际字段 shape：

```text
input_ids [3, 12]
token_type_ids [3, 12]
attention_mask [3, 12]

---

## 四、为什么本次使用 PyTorch 原生 Dataset

本次使用：

```python
from torch.utils.data import Dataset, DataLoader
```

`torch.utils.data.Dataset` 是 PyTorch 的 Dataset 基类，通常需要实现：

```python
__len__()      # 数据集有多少条样本
__getitem__()  # 如何取第 i 条样本
```

它更贴近此前学习过的数据流：`Dataset` 返回一条样本，`DataLoader` 组织成一个 batch。

HuggingFace 的 `datasets.Dataset` 也可以使用，优势是提供 `map`、`shuffle`、`select`、`set_format` 等文本数据处理功能；后续加载 SST-2 等真实数据集时更方便。但今天的小样本实验不依赖它。

## 五、实现 TokenizedTextDataset

```python
class TokenizedTextDataset(Dataset):
    def __init__(self, encodings):
        self.encodings = encodings

    def __len__(self):
        return self.encodings["input_ids"].shape[0]

    def __getitem__(self, index):
        return {
            key: value[index]
            for key, value in self.encodings.items()
        }

dataset = TokenizedTextDataset(encoded)
```

整体 `encoded` 字段是 `[B, L] = [3, 12]`。`dataset[0]` 取出一条样本后，三个字段都是 `[12]`：

```text
input_ids [12]
token_type_ids [12]
attention_mask [12]
```

`__getitem__` 对每个字段执行 `value[index]`，从 `[B, L]` 取出一行，变成 `[L]`。

## 六、使用 DataLoader 组成 batch

```python
data_loader = DataLoader(
    dataset,
    batch_size=2,
    shuffle=False,
)

batch = next(iter(data_loader))
```

数据流：

```text
dataset[0]["input_ids"] -> [12]
dataset[1]["input_ids"] -> [12]
DataLoader -> batch["input_ids"] -> [2, 12]
```

实际验证结果：

```text
input_ids torch.Size([2, 12]) torch.int64
token_type_ids torch.Size([2, 12]) torch.int64
attention_mask torch.Size([2, 12]) torch.int64
```

这说明三个字段都被正确保留，并从单条样本的 `[12]` 组织成了 batch 的 `[2, 12]`。

---

## 七、MPS 设备检查

```python
if torch.backends.mps.is_available():
    device = torch.device("mps")
else:
    device = torch.device("cpu")

batch_on_device = {
    key: value.to(device)
    for key, value in batch.items()
}
```

实际验证结果：

```text
device: mps
input_ids shape: torch.Size([2, 12]) dtype: torch.int64 device: mps:0
token_type_ids shape: torch.Size([2, 12]) dtype: torch.int64 device: mps:0
attention_mask shape: torch.Size([2, 12]) dtype: torch.int64 device: mps:0
```

设备迁移只改变 Tensor 所在设备，不改变 shape、dtype 和字段含义。本日没有进行 BERT 前向计算，只验证文本 batch 可以迁移到后续模型将使用的 MPS 设备。

---

## 八、报错记录

### 8.1 `transformers` 未安装

错误：

```text
ModuleNotFoundError: No module named 'transformers'
```

在当前虚拟环境中使用同一个 Python 安装：

```bash
python -m pip install transformers
```

### 8.2 `datasets` 未安装

错误：

```text
ModuleNotFoundError: No module named 'datasets'
```

后来确认本次小样本实验不需要 HuggingFace `datasets.Dataset`，改用 PyTorch 原生 `Dataset`，因此没有把额外的 `datasets` 依赖加入当前最小实验。

经验：使用 `python -m pip` 比单独使用 `pip` 更稳妥，因为它能确保依赖安装到当前运行脚本的 Python 环境中。

## 九、与已有知识的连接

### 9.1 与 Tensor 和 shape 的连接

今天仍然沿用“先看 shape，再写模型”的习惯：

```text
单条 input_ids: [L]
batch input_ids: [B, L]
```

这和之前图像数据的 `[C, H, W] -> [B, C, H, W]` 是同一个 batch 组织思想。

### 9.2 与 MLP、CNN 训练流程的连接

以前的流程是：

```text
Dataset -> DataLoader -> batch features -> model -> loss
```

今天变成：

```text
Dataset -> DataLoader -> batch 字典 -> BERT -> loss
```

训练循环整体结构没有改变，只是模型输入从一个 feature Tensor 变成多个命名字段。

### 9.3 与 Attention 的连接

后续 BERT 会接收 `input_ids`、`attention_mask` 和 `token_type_ids`。大致数据流是：

```text
input_ids [B, L]
    -> Embedding
hidden states [B, L, d_model]
    -> Q/K/V 线性投影
    -> Multi-Head Attention
```

`attention_mask` 会在 Attention 分数进入 Softmax 前屏蔽 padding 位置，这正好连接 Day 1 的 mask 机制。

---

## 十、Day 3 验收结果

- [x] tokenizer 成功加载并完成批量编码；
- [x] 理解 `input_ids` 是词表编号，不是语义向量；
- [x] 理解 `attention_mask` 与 Attention 权重的区别；
- [x] 理解单句样本中 `token_type_ids` 全为 0 的原因；
- [x] 使用 PyTorch 原生 Dataset 完成样本封装；
- [x] 验证 DataLoader batch shape `[2, 12]`；
- [x] 验证 dtype 为 `torch.int64`；
- [x] 成功将 batch 迁移到 MPS；
- [x] 暂未进入 BERT 微调，符合 Day 3 范围。

## 十一、下一步行动

Day 4 使用今天已经得到的 batch，完成最小闭环：

```text
batch -> BERT -> logits / loss -> backward -> optimizer.step() -> 1 个 epoch -> 简单验证
```

进入 Day 4 前，应该能够不看代码口述：文本为什么要 tokenizer、三个字段分别是什么、Dataset 如何返回一条样本、DataLoader 如何组成 `[B, L]`，以及 `attention_mask` 为什么需要传给 BERT。
