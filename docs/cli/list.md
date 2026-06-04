# mem list 命令

`mem list` 命令用于列表查看记忆。

## 语法

```bash
mem list [options]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --scope <scope>` | scope 过滤 | 无 |
| `-c, --category <cat>` | category 过滤 | 无 |
| `-t, --tags <tags>` | 标签过滤（逗号分隔） | 无 |
| `-l, --limit <n>` | 最大条数 | 10 |
| `--offset <n>` | 分页偏移 | 0 |
| `--json` | JSON 输出 | 无 |

## 使用示例

### 基本用法

```bash
# 列出记忆（默认 10 条）
mem list

# 增加数量
mem list -l 20

# 分页查看
mem list -l 10 --offset 10
```

### 过滤选项

```bash
# 按 scope 过滤
mem list --scope project:myapp

# 按分类过滤
mem list -c preference

# 按标签过滤
mem list -t profile,tech

# 组合过滤
mem list --scope project:myapp -c preference -t tech -l 20
```

### JSON 输出

```bash
# JSON 格式输出
mem list --json

# 结合其他选项
mem list --scope project:myapp -l 20 --json
```

## 输出示例

### 文本输出

```
Memories (showing 10 of 42):

1. [preference] 用户偏好使用 pnpm (importance: 0.9)
   Tags: tech,tools
   Scope: project:myapp
   Created: 2024-01-15 10:30:00

2. [fact] 项目基于 LanceDB 存储 (importance: 0.7)
   Tags: project,architecture
   Scope: project:myapp
   Created: 2024-01-14 15:20:00

3. [decision] 决定使用 React 而非 Vue (importance: 0.8)
   Tags: tech,frontend
   Scope: project:myapp
   Created: 2024-01-13 09:15:00
```

### JSON 输出

```json
{
  "memories": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "text": "用户偏好使用 pnpm",
      "category": "preference",
      "tags": ["tech", "tools"],
      "importance": 0.9,
      "scope": "project:myapp",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

## 过滤机制

### Scope 过滤

```bash
# 列出特定 scope 的记忆
mem list --scope project:myapp

# 列出所有 scope 的记忆
mem list
```

### 分类过滤

```bash
# 列出偏好类记忆
mem list -c preference

# 列出事实类记忆
mem list -c fact
```

### 标签过滤

```bash
# 按单个标签过滤
mem list -t profile

# 按多个标签过滤（AND 逻辑）
mem list -t profile,tech
```

## 分页

### 基本分页

```bash
# 第一页
mem list -l 10 --offset 0

# 第二页
mem list -l 10 --offset 10

# 第三页
mem list -l 10 --offset 20
```

### 分页脚本

```bash
#!/bin/bash
# 分页查看所有记忆

LIMIT=10
OFFSET=0

while true; do
  result=$(mem list -l $LIMIT --offset $OFFSET --json)
  count=$(echo "$result" | jq '.memories | length')
  
  if [ "$count" -eq 0 ]; then
    break
  fi
  
  echo "$result" | jq -r '.memories[] | "[\(.category)] \(.text)"'
  
  OFFSET=$((OFFSET + LIMIT))
done
```

## JSON 输出

### 用途

1. **脚本集成**：用于自动化脚本
2. **数据处理**：用于数据分析
3. **API 集成**：用于其他应用

### 示例

```bash
# 获取 JSON 输出
mem list --json

# 处理 JSON
mem list --json | jq '.memories[0].text'

# 导出到文件
mem list --json > memories.json
```

### JSON 结构

```json
{
  "memories": [
    {
      "id": "string",
      "text": "string",
      "category": "string",
      "tags": ["string"],
      "importance": 0.7,
      "scope": "string",
      "createdAt": "ISO8601"
    }
  ],
  "total": 10,
  "limit": 10,
  "offset": 0
}
```

## 最佳实践

### 1. 查看记忆

**推荐**：
```bash
# 查看最近记忆
mem list -l 10

# 查看特定项目记忆
mem list --scope project:myapp

# 查看高重要度记忆
mem list -c preference -l 20
```

### 2. 数据导出

**推荐**：
```bash
# 导出为 JSON
mem list --json > memories.json

# 导出为 CSV
mem list --json | jq -r '.memories[] | [.id, .category, .text, .importance] | @csv' > memories.csv
```

### 3. 分页浏览

**推荐**：
```bash
# 分页查看
mem list -l 10 --offset 0
mem list -l 10 --offset 10

# 查看总数
mem stats
```

### 4. 组合过滤

**推荐**：
```bash
# 项目 + 分类
mem list --scope project:myapp -c preference

# 项目 + 标签
mem list --scope project:myapp -t tech

# 分类 + 标签
mem list -c preference -t tech
```

## 故障排除

### 无结果

**症状**：
列表为空

**可能原因**：
1. 记忆不存在
2. 使用了错误的 scope
3. 过滤条件太严格

**解决**：
```bash
# 列出所有记忆
mem list

# 检查 scope
mem scope list

# 放宽过滤条件
mem list -l 50
```

### 结果不完整

**症状**：
预期有更多结果

**可能原因**：
1. 限制数量太小
2. 分页未正确使用

**解决**：
```bash
# 增加数量
mem list -l 50

# 检查总数
mem stats
```

### JSON 解析错误

**症状**：
JSON 输出格式错误

**可能原因**：
1. 输出包含非 JSON 内容
2. 命令执行错误

**解决**：
```bash
# 检查命令输出
mem list --json 2>&1

# 使用 jq 验证
mem list --json | jq .
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [search 命令](search.md) - 语义搜索
- [stats 命令](stats.md) - 统计信息
- [MCP memory_list](../mcp/memory-tools.md) - MCP 列表工具
