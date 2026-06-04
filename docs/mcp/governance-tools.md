# 治理工具

本文档介绍 memory-lancedb-mcp 的治理工具。

## 工具概览

| 工具 | 说明 |
|------|------|
| `memory_debug` | 检索链路追踪和排名解释 |
| `memory_promote` | 提升为治理记忆（高优先级，不会被衰减淘汰） |
| `memory_archive` | 归档（保留但排除召回） |
| `memory_compact` | 去重并压缩记忆 |
| `memory_explain_rank` | 解释记忆排名的原因 |

## memory_debug

检索链路追踪和排名解释。

### 用途

调试检索结果，了解记忆的排名原因。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `query` | string | 是 | 搜索关键词 |
| `scope` | string | 否 | 限定 scope |

### 示例

```json
{
  "name": "memory_debug",
  "arguments": {
    "query": "包管理器偏好",
    "scope": "project:myapp"
  }
}
```

### 响应

返回详细的检索链路信息，包括向量分数、BM25 分数、重排分数等。

## memory_promote

提升为治理记忆。

### 用途

将重要记忆提升为治理记忆，使其：
- 高优先级
- 不会被衰减淘汰
- 持续参与检索

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `memoryId` | string | 是 | 记忆 ID |

### 示例

```json
{
  "name": "memory_promote",
  "arguments": {
    "memoryId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

## memory_archive

归档记忆。

### 用途

归档不再需要但不想删除的记忆：
- 保留数据
- 排除召回
- 节省检索开销

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `memoryId` | string | 是 | 记忆 ID |

### 示例

```json
{
  "name": "memory_archive",
  "arguments": {
    "memoryId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

## memory_compact

去重并压缩记忆。

### 用途

- 合并重复记忆
- 压缩存储空间
- 提升检索效率

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `scope` | string | 否 | 限定 scope |

### 示例

```json
{
  "name": "memory_compact",
  "arguments": {
    "scope": "project:myapp"
  }
}
```

### 响应

```json
{
  "merged": 5,
  "archived": 3,
  "before": 100,
  "after": 92
}
```

## memory_explain_rank

解释记忆排名的原因。

### 用途

了解特定记忆在检索结果中的排名原因。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `memoryId` | string | 是 | 记忆 ID |
| `query` | string | 否 | 查询上下文 |

### 示例

```json
{
  "name": "memory_explain_rank",
  "arguments": {
    "memoryId": "123e4567-e89b-12d3-a456-426614174000",
    "query": "包管理器偏好"
  }
}
```

### 响应

返回详细的排名因素，包括向量相似度、BM25 分数、重要度、新鲜度等。

## 使用场景

### 记忆维护

```bash
# 定期压缩记忆
# 通过 MCP 调用 memory_compact

# 归档过期记忆
# 通过 MCP 调用 memory_archive
```

### 调试检索

```bash
# 调试检索结果
# 通过 MCP 调用 memory_debug

# 解释排名原因
# 通过 MCP 调用 memory_explain_rank
```

## 相关文档

- [MCP 工具总览](README.md) - MCP 工具概览
- [记忆管理工具](memory-tools.md) - 核心记忆操作
- [自我改进工具](self-improvement.md) - 自我改进功能
