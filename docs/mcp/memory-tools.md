# 记忆管理工具

本文档介绍 memory-lancedb-mcp 的记忆管理工具。

## 工具概览

| 工具 | 说明 |
|------|------|
| `memory_store` | 存储记忆 |
| `memory_recall` | 语义召回 |
| `memory_list` | 列表查看 |
| `memory_forget` | 删除记忆 |
| `memory_update` | 更新记忆 |
| `memory_stats` | 统计信息 |

## memory_store

存储记忆。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `text` | string | 是 | 记忆内容 |
| `category` | preference / fact / decision / entity / reflection / other | 否 | 记忆分类 |
| `tags` | string | 否 | 自定义标签，逗号分隔 |
| `importance` | number 0-1 | 否 | 重要度（默认 0.7） |
| `scope` | string | 否 | 目标 scope |

### 示例

```json
{
  "name": "memory_store",
  "arguments": {
    "text": "用户偏好使用 pnpm",
    "category": "preference",
    "tags": "tech,tools",
    "importance": 0.9,
    "scope": "project:myapp"
  }
}
```

## memory_recall

语义召回。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `query` | string | 是 | 搜索关键词 |
| `limit` | number | 否 | 最大结果数（默认 5，最大 20） |
| `scope` | string | 否 | 限定 scope |
| `category` | string | 否 | 限定分类 |
| `tags` | string | 否 | 标签过滤 |

### 示例

```json
{
  "name": "memory_recall",
  "arguments": {
    "query": "包管理器偏好",
    "limit": 5,
    "scope": "project:myapp"
  }
}
```

## memory_list

列表查看。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `limit` | number | 否 | 最大条数（默认 10，最大 50） |
| `offset` | number | 否 | 分页偏移 |
| `scope` | string | 否 | 限定 scope |
| `category` | string | 否 | 限定分类 |
| `tags` | string | 否 | 标签过滤 |

### 示例

```json
{
  "name": "memory_list",
  "arguments": {
    "limit": 10,
    "scope": "project:myapp"
  }
}
```

## memory_forget

删除记忆。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `memoryId` | string | 二选一 | 直接按 ID 删除 |
| `query` | string | 二选一 | 搜索后选择删除 |

### 示例

```json
{
  "name": "memory_forget",
  "arguments": {
    "memoryId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

## memory_update

更新记忆。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `query` | string | 是 | 搜索匹配要更新的记忆 |
| `text` | string | 否 | 新文本内容 |
| `importance` | number 0-1 | 否 | 新重要度 |
| `category` | string | 否 | 新分类 |

### 示例

```json
{
  "name": "memory_update",
  "arguments": {
    "query": "用户偏好",
    "text": "用户偏好使用 pnpm 8.x",
    "importance": 0.95
  }
}
```

## memory_stats

统计信息。

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `scope` | string | 否 | 限定 scope |

### 示例

```json
{
  "name": "memory_stats",
  "arguments": {
    "scope": "project:myapp"
  }
}
```

### 响应

```json
{
  "total": 42,
  "byCategory": {
    "preference": 10,
    "fact": 20,
    "decision": 8,
    "entity": 4
  }
}
```

## Scope 与 Category 参数

`memory_store`、`memory_recall`、`memory_list`、`memory_stats` 均支持 `scope` 和 `category` 参数。

## Tags 标签

突破 category 固有限制，支持自定义多标签分类。

**存储机制**：tags 以 `【标签:x,y】` 前缀嵌入 text 字段。

**检索机制**：BM25 自然命中标签前缀，无需额外索引。

**标签命名约束**：仅允许字母、数字、`_`、`-`、`:`、`/`、`.`、CJK 中文字符。

## 相关文档

- [MCP 工具总览](README.md) - MCP 工具概览
- [治理工具](governance-tools.md) - 治理工具
- [CLI store 命令](../cli/store.md) - CLI 存储命令
- [CLI search 命令](../cli/search.md) - CLI 搜索命令
