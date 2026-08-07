# Task 2 实施报告：PyTorch 一键同步

## 范围与边界

- 仅在 `clock-lyrics-widget` worktree 的 `feature/midnight-archive-atlas` 分支实施。
- 源知识库只读；所有生成内容仅写入 `learning/pytorch/`。
- 未实施 Task 3/4 的页面视觉与交互重设计。
- `markdown-it` 仅列为开发依赖，生成页面没有新增浏览器运行时依赖。

## 盘点

- 源 Markdown：32 篇。
- 阶段：7 个，阶段文章分布为 `10 / 4 / 5 / 5 / 5 / 1 / 1`，另有 1 篇总览。
- 旧站点：24 篇文章；专用回归测试固定检查全部 24 条既有 URL。
- 远程图片引用：29 个唯一 URL。
- 本地代码附件：被引用的 `Day5.py`。

## TDD 证据

### RED

首次运行：

```text
node --test tests/pytorch-sync.test.mjs
tests 5, pass 0, fail 5
```

失败原因均为同步模块尚不存在。随后新增的安全扫描回归测试先复现了文本附件未扫描的问题；overview 回归测试先复现了不存在的阶段面包屑链接。

### GREEN

最终专用测试：

```text
tests 6, pass 6, fail 0
```

覆盖：32/7/29 盘点、24 条旧 URL、确定性 slug、Markdown 表格/列表/任务/引用/代码/链接、Obsidian 双链与嵌入、`Day5.py` 折叠源码和下载、远程图片 opt-in、缺图、失效双链 warning、Markdown 与文本附件密钥扫描、manifest 安全清理、`--check` 漂移检测。

## 真实同步结果

首次资源抓取：

```text
PyTorch archive synchronized: 32 notes, 7 stages, 29 remote images, 0 warnings.
```

普通同步与检查模式：

```text
PyTorch archive synchronized: 32 notes, 7 stages, 29 remote images, 0 warnings.
PyTorch archive checked: 32 notes, 7 stages, 29 remote images, 0 warnings.
```

当前知识库没有失效双链，因此真实同步 warning 为 0；测试夹具确认失效双链会保留文字、产生 warning 且不生成链接。

固定命令已经写入 `package.json`：

```text
npm run sync:pytorch -- --source "/Users/yyy/Documents/知识库/Notes/Pytorch学习"
npm run sync:pytorch -- --source "/Users/yyy/Documents/知识库/Notes/Pytorch学习" --fetch-remote-assets
npm run sync:pytorch -- --source "/Users/yyy/Documents/知识库/Notes/Pytorch学习" --check
```

当前受控运行环境没有 `npm` 可执行文件，因此实际验证使用同一 Node 入口直接执行；依赖安装由 bundled pnpm 完成并生成锁文件。

## 最终验证

- 全量主页 + 同步测试：78/78 通过（主页基线已由 Task 1 从计划中的 68 增至 72，Task 2 新增 6）。
- 同步脚本、主页脚本、游鱼共享脚本：`node --check` 全部通过。
- 生成页面：40 个 HTML，静态链接缺失 0，远程 `<img>` 0。
- 远程本地资源：29 个文件，空文件 0。
- Manifest：32 notes、7 stages、29 remote assets、116 generated files、0 warnings。
- `git diff --check`：通过。生成 Markdown 保留原文中有语义的尾随双空格，并由 `.gitattributes` 限定该目录不将其视为错误。

## 已知风险

- 普通同步刻意拒绝知识库中新出现的远程图片；新增图片必须显式使用 `--fetch-remote-assets`。
- 已本地化资源不会在普通同步中重新请求上游，这保证确定性，也意味着上游图片内容变化不会自动覆盖本地副本。
