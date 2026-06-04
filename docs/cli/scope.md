# mem scope 命令

`mem scope` 命令用于管理 scope。

## 语法

```bash
mem scope <subcommand> [options]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `mem scope list` | 列出所有 scope |
| `mem scope delete <scope>` | 删除 scope |

## mem scope list

列出所有 scope 及记忆数量。

### 语法

```bash
mem scope list
```

### 输出示例

```
Scopes:
  global: 15 memories
  project:myapp: 42 memories
  project:backend: 23 memories
  agent:system: 5 memories
```

### 使用场景

```bash
# 查看所有 scope
mem scope list

# 检查项目 scope
mem scope list | grep project:myapp
```

## mem scope delete

删除 scope 及其所有记忆。

### 语法

```bash
mem scope delete <scope> [options]
```

### 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<scope>` | 要删除的 scope（必需） | 无 |

### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--dry-run` | 预览将删除的数量，不实际删除 | 无 |
| `--yes` | 跳过确认，直接删除 | 无 |

### 使用示例

```bash
# 预览删除范围
mem scope delete project:old --dry-run

# 确认删除
mem scope delete project:old --yes

# 交互式删除
mem scope delete project:old
```

### 输出示例

**预览模式**：
```
Scope: project:old
Memories to delete: 42

This will permanently delete all memories in this scope.
Run with --yes to confirm deletion.
```

**确认删除**：
```
Scope: project:old
Memories to delete: 42

Deleting scope and all memories...
✅ Scope deleted successfully
  Scope: project:old
  Memories deleted: 42
```

## Scope 概念

### 定义

Scope 是记忆的隔离单元，类似于命名空间。不同 scope 的记忆完全独立，互不干扰。

### 命名规范

**推荐格式**：
```bash
project:项目名称
team:团队名称
user:用户名称
```

**示例**：
```bash
project:myapp
project:backend
project:frontend
team:engineering
user:john
```

**允许的字符**：
- 字母、数字
- `_`、`-`、`:`、`/`、`.`
- CJK 中文字符

**禁止的字符**：
- 空格
- 特殊字符

### 默认 Scope

- `global`：全局 scope，默认存储位置
- `agent:system`：系统 scope，用于系统级记忆

## 隔离机制

### 跨 scope 模式

```bash
# 启动服务
mem serve

# 存储到不同 scope
mem store "通用知识"  # 写入 global
mem store "项目信息" --scope project:alpha  # 写入 project:alpha

# 跨 scope 搜索
mem search "架构"  # 搜索所有 scope
```

### 锁定 scope 模式

```bash
# 启动服务时指定 scope
mem serve --scope project:myapp

# 所有操作自动限定在 project:myapp
mem store "项目信息"  # 写入 project:myapp
mem search "架构"    # 搜索 project:myapp
```

## 最佳实践

### 1. Scope 命名

**推荐**：
```bash
# 使用项目名称
project:myapp
project:backend

# 使用团队名称
team:frontend
team:backend

# 使用用户名称
user:john
user:jane
```

**避免**：
```bash
# 过于简单
myapp

# 使用空格
my app

# 使用特殊字符
my@app
```

### 2. Scope 管理

**推荐**：
```bash
# 定期检查 scope
mem scope list

# 清理无用 scope
mem scope delete project:old --dry-run
mem scope delete project:old --yes
```

### 3. 记忆迁移

**推荐**：
```bash
# 导出记忆
mem list --scope project:old --json > old-memories.json

# 导入到新 scope
# (需要编写脚本处理)
```

## 使用场景

### 1. 项目隔离

```bash
# 创建项目 scope
mem store "项目架构" --scope project:myapp

# 查看项目记忆
mem list --scope project:myapp

# 删除项目 scope
mem scope delete project:myapp --yes
```

### 2. 团队协作

```bash
# 创建团队 scope
mem store "团队规范" --scope team:engineering

# 查看团队记忆
mem list --scope team:engineering
```

### 3. 用户隔离

```bash
# 创建用户 scope
mem store "用户偏好" --scope user:john

# 查看用户记忆
mem list --scope user:john
```

## 故障排除

### Scope 不存在

**症状**：
```
❌ Scope not found: project:nonexistent
```

**解决**：
```bash
# 列出所有 scope
mem scope list

# 创建 scope
mem store "初始化" --scope project:new
```

### 删除失败

**症状**：
```
❌ Failed to delete scope
```

**可能原因**：
1. Scope 不存在
2. 权限问题
3. 数据库错误

**解决**：
```bash
# 检查 scope
mem scope list

# 健康检查
mem doctor
```

### Scope 不匹配

**症状**：
```
❌ Scope mismatch: expected project:myapp, got global
```

**解决**：
```bash
# 检查当前 scope
mem config show

# 使用正确的 scope
mem store "信息" --scope project:myapp
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [多项目隔离](../guides/multi-project.md) - 多项目配置
- [list 命令](list.md) - 列表查看
- [delete 命令](delete.md) - 删除记忆
