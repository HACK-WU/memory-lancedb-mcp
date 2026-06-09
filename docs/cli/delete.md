# mem delete 命令

`mem delete` 命令用于删除记忆。

## 语法

```bash
mem delete <uuid>
```

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<uuid>` | 记忆的 UUID（必需） | 无 |

## 使用示例

### 基本用法

```bash
# 删除特定记忆
mem delete 123e4567-e89b-12d3-a456-426614174000
```

### 获取 UUID

```bash
# 列出记忆获取 UUID
mem list --json

# 搜索记忆获取 UUID
mem search "查询" --json
```

## 输出示例

### 成功删除

```
✅ Memory deleted successfully
  ID: 123e4567-e89b-12d3-a456-426614174000
```

### 错误示例

**记忆不存在**：
```
❌ Memory not found: 123e4567-e89b-12d3-a456-426614174000
```

**UUID 格式错误**：
```
❌ Invalid UUID format: invalid-uuid
```

## 删除机制

### 硬删除

- 记忆从数据库中永久删除
- 无法恢复
- 释放存储空间

### 软删除

- 记忆标记为已删除
- 仍占用存储空间
- 可通过恢复操作找回

## 使用场景

### 1. 删除错误记忆

```bash
# 找到错误记忆
mem search "错误信息" --json

# 删除错误记忆
mem delete <uuid>
```

### 2. 清理过期记忆

```bash
# 列出旧记忆
mem list --json | jq '.memories[] | select(.createdAt < "2024-01-01")'

# 删除旧记忆
mem delete <uuid>
```

### 3. 批量删除

```bash
# 批量删除脚本
#!/bin/bash

# 获取要删除的 UUID 列表
uuids=$(mem list --json | jq -r '.memories[] | select(.category == "other") | .id')

# 删除每个记忆
for uuid in $uuids; do
  mem delete "$uuid"
done
```

## 最佳实践

### 1. 确认删除

**推荐**：
```bash
# 先查看记忆内容
mem search "查询" --json | jq '.memories[] | select(.id == "<uuid>")'

# 确认后删除
mem delete <uuid>
```

### 2. 备份重要记忆

**推荐**：
```bash
# 导出重要记忆
mem list --json > backup.json

# 删除记忆
mem delete <uuid>
```

### 3. 使用 scope 删除

**推荐**：
```bash
# 删除整个 scope
mem scope delete project:old --yes

# 同时删除多个 scope
mem scope delete project:old project:deprecated --yes

# 清除所有 scope（global 除外）
mem scope delete --all --yes

# 清除所有 scope（包括 global）
mem scope delete --all --include-global --yes

# 预览删除范围
mem scope delete project:old --dry-run

# 而不是逐个删除
mem delete <uuid1>
mem delete <uuid2>
```

## 故障排除

### 记忆不存在

**症状**：
```
❌ Memory not found: <uuid>
```

**可能原因**：
1. UUID 错误
2. 记忆已被删除
3. scope 隔离问题

**解决**：
```bash
# 检查 UUID
mem list --json | jq '.memories[] | select(.id == "<uuid>")'

# 检查 scope
mem scope list
```

### UUID 格式错误

**症状**：
```
❌ Invalid UUID format: <uuid>
```

**可能原因**：
1. UUID 格式不正确
2. 输入错误

**解决**：
```bash
# 获取正确的 UUID
mem list --json | jq -r '.memories[0].id'
```

### 删除失败

**症状**：
```
❌ Failed to delete memory
```

**可能原因**：
1. 数据库错误
2. 权限问题
3. 网络问题

**解决**：
```bash
# 健康检查
mem doctor

# 验证配置
mem config validate
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [list 命令](list.md) - 列表查看
- [scope 命令](scope.md) - Scope 管理
- [MCP memory_forget](../mcp/memory-tools.md) - MCP 删除工具
