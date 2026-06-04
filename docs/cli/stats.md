# mem stats 命令

`mem stats` 命令用于查看记忆统计信息。

## 语法

```bash
mem stats [options]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --scope <scope>` | scope 过滤 | 无 |
| `--json` | JSON 输出 | 无 |

## 使用示例

### 基本用法

```bash
# 查看所有统计信息
mem stats

# 按 scope 过滤
mem stats --scope project:myapp

# JSON 格式输出
mem stats --json
```

## 输出示例

### 文本输出

```
Memory Statistics:

Total memories: 156

By scope:
  global: 45
  project:myapp: 78
  project:backend: 33

By category:
  preference: 23
  fact: 67
  decision: 34
  entity: 18
  other: 14

By importance:
  High (>0.7): 45
  Medium (0.4-0.7): 89
  Low (<0.4): 22

Storage:
  DB path: ~/.local/share/memory-mcp/lancedb
  DB size: 15.2 MB
```

### JSON 输出

```json
{
  "total": 156,
  "byScope": {
    "global": 45,
    "project:myapp": 78,
    "project:backend": 33
  },
  "byCategory": {
    "preference": 23,
    "fact": 67,
    "decision": 34,
    "entity": 18,
    "other": 14
  },
  "byImportance": {
    "high": 45,
    "medium": 89,
    "low": 22
  },
  "storage": {
    "dbPath": "~/.local/share/memory-mcp/lancedb",
    "dbSize": "15.2 MB"
  }
}
```

## 统计信息

### 总数统计

- **Total memories**：所有记忆的总数

### Scope 统计

- **By scope**：按 scope 分组统计
- 显示每个 scope 的记忆数量

### 分类统计

- **By category**：按分类分组统计
- 显示每个分类的记忆数量

**分类类型**：
- `preference`：用户偏好
- `fact`：事实信息
- `decision`：决策记录
- `entity`：实体信息
- `other`：其他

### 重要度统计

- **By importance**：按重要度分组统计
- 显示不同重要度范围的记忆数量

**重要度范围**：
- High (>0.7)：高重要度
- Medium (0.4-0.7)：中等重要度
- Low (<0.4)：低重要度

### 存储统计

- **DB path**：数据库路径
- **DB size**：数据库大小

## JSON 输出

### 用途

1. **监控**：用于监控记忆增长
2. **分析**：用于数据分析
3. **报告**：用于生成报告

### 示例

```bash
# 获取 JSON 输出
mem stats --json

# 处理 JSON
mem stats --json | jq '.total'

# 导出到文件
mem stats --json > stats.json
```

### JSON 结构

```json
{
  "total": 156,
  "byScope": {
    "global": 45,
    "project:myapp": 78
  },
  "byCategory": {
    "preference": 23,
    "fact": 67
  },
  "byImportance": {
    "high": 45,
    "medium": 89,
    "low": 22
  },
  "storage": {
    "dbPath": "~/.local/share/memory-mcp/lancedb",
    "dbSize": "15.2 MB"
  }
}
```

## 使用场景

### 1. 监控记忆增长

```bash
# 定期检查统计信息
mem stats

# 记录统计数据
mem stats --json >> stats.log
```

### 2. 分析记忆分布

```bash
# 分析 scope 分布
mem stats --json | jq '.byScope'

# 分析分类分布
mem stats --json | jq '.byCategory'
```

### 3. 生成报告

```bash
# 生成统计报告
mem stats --json > report.json

# 生成文本报告
mem stats > report.txt
```

## 最佳实践

### 1. 定期检查

**推荐**：
```bash
# 每周检查统计信息
mem stats

# 检查特定项目
mem stats --scope project:myapp
```

### 2. 数据分析

**推荐**：
```bash
# 分析记忆增长趋势
mem stats --json | jq '.total'

# 分析分类分布
mem stats --json | jq '.byCategory'
```

### 3. 存储管理

**推荐**：
```bash
# 检查数据库大小
mem stats --json | jq '.storage.dbSize'

# 压缩记忆
mem compact
```

## 故障排除

### 统计信息不准确

**症状**：
统计信息与预期不符

**可能原因**：
1. 数据库损坏
2. 统计缓存过期
3. scope 隔离问题

**解决**：
```bash
# 健康检查
mem doctor

# 验证配置
mem config validate
```

### 数据库大小异常

**症状**：
数据库大小异常大

**可能原因**：
1. 记忆数量过多
2. 数据库未压缩
3. 索引损坏

**解决**：
```bash
# 压缩记忆
mem compact

# 检查记忆数量
mem list -l 1000 | wc -l
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [list 命令](list.md) - 列表查看
- [MCP memory_stats](../mcp/memory-tools.md) - MCP 统计工具
