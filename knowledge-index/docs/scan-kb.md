## `scan-kb` 使用说明

`scan-kb.ts` 用来处理**外部 Markdown 知识库的预扫描与增量扫描**。

它解决的是导入前的两个问题：

- 哪些 `.md` 文件需要交给 AI 生成摘要和关键词
- 哪些摘要已经完成向量化，哪些还没有

`scan-kb.ts` 分成两个子命令：

- **`scan`**：生成待处理文件列表，或把 AI 结果合并为 `scan-index.json`
- **`vectorize`**：列出待向量化条目，或回写已完成的 `memoryId`

## 命令总览

```bash
# 1) 扫描目录，生成待处理文件列表
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> --source <dir> --root-name <name>

# 2) 合并 AI 摘要结果，生成 scan-index.json
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> --source <dir> --root-name <name> \
  --results <ai-results.json>

# 3) 列出待向量化条目
npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope <scope>

# 4) 回写向量化完成结果
npx jiti knowledge-index/scripts/scan-kb.ts vectorize \
  --scope <scope> --complete <vectorize-results.json>
```

## 产物文件

`scan-kb.ts` 运行过程中会涉及 3 类文件：

| 文件 | 作用 |
|------|------|
| `scan-pending.json` | 扫描准备阶段输出的待处理列表 |
| `scan-index.json` | 合并 AI 摘要结果后的扫描索引 |
| `vectorize-results.json` | 向量化完成后由外部流程整理出的回写文件 |

## 第一步：扫描准备

执行：

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope mcp-test \
  --source ./external-kb \
  --root-name wiki
```

这一步会：

- 扫描 `--source` 下的 Markdown 文件
- 跳过空 `.md` 文件
- 跳过超过 10MB 的文件
- 生成 `scan-pending.json`
- 输出本次扫描模式：`full` 或 `incremental`

### 输出示例

```json
{
  "ok": true,
  "action": "scan_files",
  "root_name": "wiki",
  "mode": "full",
  "changes": {
    "added": 12,
    "modified": 0,
    "deleted": 0,
    "unchanged": 0
  },
  "total_files": 12,
  "pending_file": ".../scan-pending.json",
  "output": ".../scan-index.json"
}
```

### `scan-pending.json` 里有什么

`scan-pending.json` 记录的是**下一步要交给 AI 处理的文件**，而不是最终索引。

核心字段包括：

- `files[].path`：相对 `--source` 的路径
- `files[].filename`：去掉 `.md` 后的文件名
- `files[].dir`：所属目录
- `files[].changeType`：`A` / `M`
- `deleted[]`：增量扫描中发现被删除的文件

## 第二步：合并 AI 摘要结果

在 AI 根据 `scan-pending.json` 生成摘要和关键词后，执行：

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope mcp-test \
  --source ./external-kb \
  --root-name wiki \
  --results ./ai-results.json
```

这一步会：

- 读取 `scan-pending.json`
- 读取 `--results` 指向的 AI 结果文件
- 合并为 `scan-index.json`
- 记录每个条目的 `summary`、`keywords`、`memoryId`、`vectorized`

### AI 结果文件格式

```json
{
  "entries": [
    {
      "path": "docs/api.md",
      "summary": "API 文档摘要",
      "keywords": ["API", "接口", "认证"],
      "enriched": false
    }
  ]
}
```

### 合并后的 `scan-index.json` 会保存什么

每条记录至少包含：

- `path`
- `fullPath`
- `summary`
- `keywords`
- `enriched`
- `vectorized`
- `memoryId`

其中：

- `vectorized: false` 表示还没完成摘要向量化
- `memoryId` 用于和父项目记忆系统中的条目建立映射

## 第三步：列出待向量化条目

执行：

```bash
npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope mcp-test
```

这一步**不会向量化**，只是把待向量化条目列出来，供 AI 或上层流程继续处理。

### 输出示例

```json
{
  "ok": true,
  "action": "list_pending",
  "pending": 2,
  "entries": [
    {
      "path": "docs/api.md",
      "summary": "API 文档摘要",
      "keywords": ["API", "接口", "认证"],
      "memoryId": null,
      "content": "[摘要] API 文档摘要\n[路径] docs/api.md\n[关键词] API, 接口, 认证"
    }
  ]
}
```

其中 `content` 就是建议送入父项目 `memory_store` 的摘要文本。

## 第四步：回写向量化完成结果

在摘要完成向量化后，整理出一个结果文件，例如：

```json
{
  "entries": [
    {
      "path": "docs/api.md",
      "memoryId": "mem_xxx"
    }
  ]
}
```

然后执行：

```bash
npx jiti knowledge-index/scripts/scan-kb.ts vectorize \
  --scope mcp-test \
  --complete ./vectorize-results.json
```

这一步会：

- 根据 `path` 找到对应扫描条目
- 写回 `memoryId`
- 将对应条目标记为 `vectorized: true`

## 增量扫描如何工作

如果 `--source` 是 Git 仓库，且当前已经存在有效的 `scan-index.json`，`scan-kb.ts` 会优先尝试走**增量扫描**。

它会基于上次记录的 `lastScannedCommit` 与当前 `HEAD` 比较变更，区分：

- **`A`**：新增文件
- **`M`**：修改文件
- **`D`**：删除文件
- **`R`**：重命名文件
- **`C`**：复制文件

### 增量扫描的关键点

- 修改文件会重新进入待处理列表
- 删除文件会进入 `deleted[]`
- 重命名文件会尽量沿用旧 `memoryId`，减少向量索引漂移
- 如果 Git 信息不可用，会自动退化成全量扫描

## 退化与回退行为

以下情况会自动退化为全量扫描，并输出警告：

- 无法获取 Git 信息
- `lastScannedCommit` 不存在
- 增量扫描失败

这类退化属于**正常兜底行为**，不会直接报错退出。

## 常见误区

### 1. `vectorize` 不是生成 `scan-index.json`

不是。

`vectorize` 只读取已有的 `scan-index.json`。如果你还没执行 `scan --results`，那就只有 `scan-pending.json`，此时直接执行 `vectorize` 会报错。

### 2. `scan-pending.json` 不是最终索引

`scan-pending.json` 只是“待 AI 处理列表”。真正给后续流程使用的是 `scan-index.json`。

### 3. `--source` 应该指向外部知识库目录

`--source` 应该传入外部 Markdown 文档目录，而不是 `knowledge-index/kb/{scope}` 这样的运行时数据目录。

## 推荐执行顺序

```text
scan
  ↓
AI 生成摘要与关键词
  ↓
scan --results
  ↓
vectorize
  ↓
memory_store
  ↓
vectorize --complete
  ↓
import-kb
```

## 与其他文档的关系

- 外部导入总览：[`import-kb.md`](./import-kb.md)
- 错误与恢复建议：[`error-handling.md`](./error-handling.md)
- 完整工作流：[`workflows.md`](./workflows.md)
