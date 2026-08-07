from pathlib import Path
import time

import matplotlib.pyplot as plt
import torch
from datasets import concatenate_datasets, load_dataset
from torch.utils.data import DataLoader
from transformers import BertForSequenceClassification, BertTokenizer


# ============================================================
# 1. 配置
# ============================================================

CODE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = CODE_DIR / "data" / "huggingface_cache"
OUTPUT_DIR = CODE_DIR / "data" / "outputs"

CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TRAIN_RATIO = 0.8
VAL_RATIO = 0.1
TEST_RATIO = 0.1
SEED = 42

BATCH_SIZE = 8
MAX_LENGTH = 64
NUM_EPOCHS = 3
LEARNING_RATE = 2e-5


# ============================================================
# 2. 设备
# ============================================================

if torch.backends.mps.is_available():
    device = torch.device("mps")
else:
    device = torch.device("cpu")

print("device:", device)
print("cache dir:", CACHE_DIR)
print("output dir:", OUTPUT_DIR)


# ============================================================
# 3. 加载并重新划分有标签数据
# ============================================================

raw_dataset = load_dataset(
    "nyu-mll/glue",
    "sst2",
    cache_dir=str(CACHE_DIR),
)

# 只合并原始 train 和 validation；官方 test 不参与本实验。
labeled_dataset = concatenate_datasets(
    [raw_dataset["train"], raw_dataset["validation"]]
)

# 显式过滤标签，确保后续三个 split 都是有标签数据。
labeled_dataset = labeled_dataset.filter(
    lambda row: row["label"] in (0, 1)
)

# 第一次：80% train，20% 临时数据。
first_split = labeled_dataset.train_test_split(
    test_size=1.0 - TRAIN_RATIO,
    seed=SEED,
    stratify_by_column="label",
)

# 第二次：把临时数据等分为 10% validation 和 10% test。
second_split = first_split["test"].train_test_split(
    test_size=TEST_RATIO / (VAL_RATIO + TEST_RATIO),
    seed=SEED,
    stratify_by_column="label",
)

split_dataset = {
    "train": first_split["train"],
    "validation": second_split["train"],
    "test": second_split["test"],
}

print("split sizes:")
for split_name, split in split_dataset.items():
    print(split_name, len(split))


# ============================================================
# 4. Tokenizer
# ============================================================

tokenizer = BertTokenizer.from_pretrained(
    "bert-base-uncased",
    cache_dir=str(CACHE_DIR),
)


def tokenize_batch(batch):
    return tokenizer(
        batch["sentence"],
        padding="max_length",
        truncation=True,
        max_length=MAX_LENGTH,
    )


tokenized_dataset = {
    split_name: split.map(tokenize_batch, batched=True)
    for split_name, split in split_dataset.items()
}


# ============================================================
# 5. Tensor 格式与 DataLoader
# ============================================================

model_columns = [
    "input_ids",
    "attention_mask",
    "token_type_ids",
    "label",
]

for split in tokenized_dataset.values():
    split.set_format(
        type="torch",
        columns=model_columns,
    )

train_loader = DataLoader(
    tokenized_dataset["train"],
    batch_size=BATCH_SIZE,
    shuffle=True,
)

val_loader = DataLoader(
    tokenized_dataset["validation"],
    batch_size=BATCH_SIZE,
    shuffle=False,
)

test_loader = DataLoader(
    tokenized_dataset["test"],
    batch_size=BATCH_SIZE,
    shuffle=False,
)

batch = next(iter(train_loader))
print("batch keys:", batch.keys())
print("input_ids shape:", batch["input_ids"].shape)
print("attention_mask shape:", batch["attention_mask"].shape)
print("token_type_ids shape:", batch["token_type_ids"].shape)
print("label shape:", batch["label"].shape)
print("label dtype:", batch["label"].dtype)


# ============================================================
# 6. 模型与优化器
# ============================================================

model = BertForSequenceClassification.from_pretrained(
    "bert-base-uncased",
    num_labels=2,
    cache_dir=str(CACHE_DIR),
).to(device)

optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=LEARNING_RATE,
)


def move_batch_to_device(batch):
    return {
        key: value.to(device)
        for key, value in batch.items()
    }


def run_epoch(model, data_loader, optimizer=None):
    training = optimizer is not None
    model.train() if training else model.eval()

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    with torch.set_grad_enabled(training):
        for batch in data_loader:
            batch = move_batch_to_device(batch)
            labels = batch["label"]

            if training:
                optimizer.zero_grad()

            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
                token_type_ids=batch["token_type_ids"],
                labels=labels,
            )

            loss = outputs.loss
            predictions = outputs.logits.argmax(dim=1)

            if training:
                loss.backward()
                optimizer.step()

            batch_size = labels.size(0)
            total_loss += loss.item() * batch_size
            total_correct += (predictions == labels).sum().item()
            total_samples += batch_size

    return (
        total_loss / total_samples,
        total_correct / total_samples,
    )


# ============================================================
# 7. 训练与验证
# ============================================================

history = {
    "train_loss": [],
    "train_accuracy": [],
    "val_loss": [],
    "val_accuracy": [],
}

for epoch in range(NUM_EPOCHS):
    start_time = time.perf_counter()

    train_loss, train_accuracy = run_epoch(
        model,
        train_loader,
        optimizer=optimizer,
    )

    val_loss, val_accuracy = run_epoch(
        model,
        val_loader,
    )

    elapsed = time.perf_counter() - start_time

    history["train_loss"].append(train_loss)
    history["train_accuracy"].append(train_accuracy)
    history["val_loss"].append(val_loss)
    history["val_accuracy"].append(val_accuracy)

    print(
        f"epoch {epoch + 1}/{NUM_EPOCHS}, "
        f"time: {elapsed / 60:.2f} min"
    )
    print(f"train loss: {train_loss:.4f}")
    print(f"train accuracy: {train_accuracy:.4f}")
    print(f"validation loss: {val_loss:.4f}")
    print(f"validation accuracy: {val_accuracy:.4f}")


# ============================================================
# 8. 测试集评估与 confusion matrix
# ============================================================

test_loss, test_accuracy = run_epoch(
    model,
    test_loader,
)

print(f"test loss: {test_loss:.4f}")
print(f"test accuracy: {test_accuracy:.4f}")

confusion_matrix = torch.zeros(
    (2, 2),
    dtype=torch.int64,
)

model.eval()
with torch.no_grad():
    for batch in test_loader:
        batch_on_device = move_batch_to_device(batch)
        logits = model(
            input_ids=batch_on_device["input_ids"],
            attention_mask=batch_on_device["attention_mask"],
            token_type_ids=batch_on_device["token_type_ids"],
        ).logits

        predictions = logits.argmax(dim=1).cpu()
        labels = batch["label"]

        for label, prediction in zip(labels, predictions):
            confusion_matrix[label.item(), prediction.item()] += 1

print("confusion matrix:")
print(confusion_matrix)


# ============================================================
# 9. 保存训练曲线
# ============================================================

epochs = range(1, NUM_EPOCHS + 1)

figure, axes = plt.subplots(1, 2, figsize=(12, 4))

axes[0].plot(
    epochs,
    history["train_loss"],
    marker="o",
    label="train loss",
)
axes[0].plot(
    epochs,
    history["val_loss"],
    marker="o",
    label="validation loss",
)
axes[0].set_title("Loss")
axes[0].set_xlabel("Epoch")
axes[0].set_ylabel("Loss")
axes[0].legend()
axes[0].grid(True)

axes[1].plot(
    epochs,
    history["train_accuracy"],
    marker="o",
    label="train accuracy",
)
axes[1].plot(
    epochs,
    history["val_accuracy"],
    marker="o",
    label="validation accuracy",
)
axes[1].set_title("Accuracy")
axes[1].set_xlabel("Epoch")
axes[1].set_ylabel("Accuracy")
axes[1].set_ylim(0, 1)
axes[1].legend()
axes[1].grid(True)

figure.tight_layout()
curve_path = OUTPUT_DIR / "training_curves.png"
figure.savefig(curve_path, dpi=150)
plt.close(figure)


# ============================================================
# 10. 保存 confusion matrix 图像
# ============================================================

figure, axis = plt.subplots(figsize=(5, 5))
image = axis.imshow(confusion_matrix.numpy(), cmap="Blues")
figure.colorbar(image, ax=axis)

axis.set_title("Test Confusion Matrix")
axis.set_xlabel("Predicted label")
axis.set_ylabel("True label")
axis.set_xticks([0, 1])
axis.set_yticks([0, 1])

for row in range(2):
    for column in range(2):
        axis.text(
            column,
            row,
            str(confusion_matrix[row, column].item()),
            ha="center",
            va="center",
        )

figure.tight_layout()
matrix_path = OUTPUT_DIR / "test_confusion_matrix.png"
figure.savefig(matrix_path, dpi=150)
plt.close(figure)

print("training curves saved to:", curve_path)
print("confusion matrix saved to:", matrix_path)
