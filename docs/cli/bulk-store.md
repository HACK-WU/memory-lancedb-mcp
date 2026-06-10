# mem bulk-store 命令

`mem bulk-store` 命令用于从 JSON 数组文件批量存储记忆。串行执行，复用完整的 `memory_store` 工具链路（embedding、去重、scope ACL、标签等）。

> **推荐场景**：需要一次性存储多条记忆时，强烈建议使用 `mem bulk-store` 而非多次调用 `mem store`。
> 单次运行时初始化可节省每条约 930ms 的进程启动开销，**10 条记忆快 77%，100 条记忆可节省约 93 秒**。
> 详见 [性能参考](#性能参考)。

## 语法

```bash
mem bulk-store -f <file> [options]
```

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-f, --file <path>` | JSON 文件路径（必需） | 无 |

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --scope <scope>` | 默认 scope（条目未指定时使用） | 自动检测 |
| `-c, --category <cat>` | 默认分类（条目未指定时使用） | `other` |
| `-i, --importance <n>` | 默认重要度 0-1 | 0.7 |
| `--stop-on-error` | 遇到错误立即停止 | 继续执行 |
| `--dry-run` | 仅验证条目，不实际存储 | 无 |
| `--json` | JSON 格式输出 | 无 |

## JSON 文件格式

JSON 文件必须是一个数组，每个元素包含以下字段：

```json
[
  {
    "text": "记忆内容（必需）",
    "category": "preference",
    "importance": 0.9,
    "tags": "tech,tools",
    "scope": "project:myapp"
  },
  {
    "text": "另一条记忆",
    "category": "fact",
    "importance": 0.8
  }
]
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 记忆内容 |
| `category` | string | 否 | 记忆分类，同 `mem store` |
| `importance` | number | 否 | 重要度 0-1 |
| `tags` | string | 否 | 逗号分隔标签 |
| `scope` | string | 否 | 目标 scope |

## 记忆分类

同 [`mem store`](store.md)，支持：`preference`、`fact`、`decision`、`entity`、`reflection`、`other`。

## 使用示例

### 基本用法

```bash
# 从 JSON 文件批量存储
mem bulk-store -f ./memories.json

# 指定默认 scope
mem bulk-store -f ./memories.json --scope project:myapp
```

### 从 stdin 读取

```bash
# 通过管道输入
cat memories.json | mem bulk-store -f /dev/stdin
```

### 指定默认值

```bash
# 所有条目使用默认 category 和 importance
mem bulk-store -f ./memories.json -c fact -i 0.8
```

### 验证模式

```bash
# 仅验证 JSON 格式和条目有效性，不实际存储
mem bulk-store -f ./memories.json --dry-run
```

### 遇错停止

```bash
# 遇到第一个错误即停止
mem bulk-store -f ./memories.json --stop-on-error
```

### JSON 输出

```bash
# 结构化 JSON 输出，便于程序解析
mem bulk-store -f ./memories.json --json
```

## 输出示例

### 正常输出

```
[1/5] ✅ 用户偏好使用 pnpm → 123e4567-e89b-12d3-a456-426614174000
[2/5] ✅ 项目基于 LanceDB 存储 → 234e5678-e89b-12d3-a456-426614174001
[3/5] ✅ 决定使用 React 而非 Vue → 345e6789-e89b-12d3-a456-426614174002
[4/5] ❌ 无效条目 → Invalid importance value
[5/5] ✅ 用户是全栈工程师 → 456e7890-e89b-12d3-a456-426614174003

──────────────────────────────────────────────────
Bulk store complete (12.3s)
  ✅ Stored: 4
  ❌ Errors: 1
  Processed: 5 / 5
```

### JSON 输出

```json
{
  "total": 5,
  "ok": 4,
  "errors": 1,
  "skipped": 0,
  "elapsedSeconds": 12.3,
  "details": {
    "ok": [
      { "index": 0, "text": "用户偏好使用 pnpm", "id": "123e4567-..." },
      { "index": 1, "text": "项目基于 LanceDB 存储", "id": "234e5678-..." }
    ],
    "errors": [
      { "index": 3, "text": "无效条目", "error": "Invalid importance value" }
    ],
    "skipped": []
  }
}
```

### Dry-run 输出

```
Dry run: 5 entries total, 4 valid, 1 skipped

Skipped entries:
  #2: invalid importance: 1.5
```

## 执行策略

### 串行执行

每条记忆串行处理，确保：
- LanceDB 写锁不冲突
- 去重检查准确（前一条写入后，后续条目可检测到重复）
- 错误可精确定位到具体条目

### 部分成功

默认情况下，单条失败不中断后续条目。使用 `--stop-on-error` 可改为遇错停止。

### 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 全部成功 |
| 1 | 有错误（部分失败或致命错误） |

## 性能参考

每条记忆约需 1~3 秒（含 embedding API 调用 + LanceDB 写入），主要瓶颈在 embedding 生成。

| 条目数 | 预估耗时 |
|--------|----------|
| 10 | ~10-30s |
| 50 | ~1-2.5min |
| 100 | ~2-5min |

## 最佳实践

### 1. 先 dry-run 再存储

```bash
# 先验证
mem bulk-store -f ./memories.json --dry-run

# 确认无误后实际存储
mem bulk-store -f ./memories.json
```

### 2. 合理设置默认值

```bash
# 批量导入知识库时统一设置 category
mem bulk-store -f ./kb.json -c fact -i 0.8 --scope project:docs
```

### 3. 利用 JSON 输出做后续处理

```bash
# 提取成功存储的 ID
mem bulk-store -f ./memories.json --json | jq '.details.ok[].id'
```

### 4. 大文件分批处理

```bash
# 使用 jq 分割大文件
jq '.[0:50]' big-file.json > batch-1.json
jq '.[50:100]' big-file.json > batch-2.json

mem bulk-store -f batch-1.json
mem bulk-store -f batch-2.json
```

## 故障排除

### JSON 解析失败

**症状**：
```
❌ Failed to parse JSON file: Unexpected token
```

**解决**：
```bash
# 验证 JSON 格式
cat memories.json | jq . > /dev/null
```

### 条目缺少 text 字段

**症状**：
```
⏭️  Skipped: 2 entries missing or empty text
```

**解决**：确保每条记录都有 `text` 字段且非空。

### Embedding API 超时

**症状**：
```
[5/10] ❌ 某条记忆 → Request timeout
```

**解决**：
- 检查网络连接和 API 密钥：`mem doctor`
- 减小批次大小
- 稍后重试失败的条目

## 与 mem store 的关系

`mem bulk-store` 是 `mem store` 的批量版本：

- 复用完全相同的工具链路（embedding → 去重 → scope ACL → smart metadata → LanceDB 写入）
- 单次运行时初始化（相比 N 次 `mem store` 子进程调用，省去 N-1 次启动开销）
- 输出格式兼容：成功条目同样通过 `Memory ID` 可追踪

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [store 命令](store.md) - 单条存储
- [search 命令](search.md) - 语义搜索
- [scope 管理](scope.md) - Scope 隔离
