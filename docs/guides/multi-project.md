# 多项目隔离

memory-lancedb-mcp 支持多项目隔离，通过 `--scope` 参数实现不同项目之间的记忆完全隔离。

## 概念说明

### Scope

Scope 是记忆的隔离单元，类似于命名空间。不同 scope 的记忆完全独立，互不干扰。

**Scope 命名规范**：
- 推荐格式：`project:项目名称`
- 示例：`project:myapp`、`project:backend`、`project:frontend`
- 允许：字母、数字、`_`、`-`、`:`、`/`、`.`
- 禁止：空格、特殊字符

### 运行模式

| 模式 | 启动方式 | 行为 |
|------|----------|------|
| **跨 scope 模式** | `mem serve` | 可读写任意 scope |
| **锁定 scope 模式** | `mem serve --scope X` | 所有操作强制锁定在 scope X 内 |

## 跨 scope 模式

### 启动方式

```bash
# 不指定 scope
mem serve
```

### 行为特点

1. **存储行为**：
   - `memory_store` 不指定 scope → 自动写入 `global`
   - `memory_store` 指定 `scope: "project:alpha"` → 写入 `project:alpha`

2. **搜索行为**：
   - `memory_recall` 不指定 scope → 跨 scope 返回相关记忆
   - `memory_recall` 指定 scope → 只返回该 scope 的记忆

3. **管理行为**：
   - 可以管理所有 scope 的记忆
   - 可以查看所有 scope 的统计信息

### 使用示例

```bash
# 启动服务
mem serve

# 存储记忆
mem store "通用知识"               # → 写入 global
mem store "项目A信息" --scope project:alpha  # → 写入 project:alpha

# 搜索记忆
mem search "架构设计"              # → 跨 scope 搜索
mem search "架构设计" --scope project:alpha  # → 仅搜索 project:alpha

# 列出记忆
mem list                          # → 列出所有 scope 的记忆
mem list --scope project:alpha    # → 列出 project:alpha 的记忆
```

## 锁定 scope 模式

### 启动方式

```bash
# 指定 scope
mem serve --scope project:myapp
```

### 行为特点

1. **存储行为**：
   - `memory_store` 不指定 scope → 写入 scope X
   - `memory_store` 指定 `scope: "X"`（与服务端一致）→ 允许，写入 scope X
   - `memory_store` 指定 `scope: "Y"`（与服务端不一致）→ **拒绝**，返回 scope 不匹配错误

2. **搜索行为**：
   - `memory_recall` → 只返回 scope X 的记忆，不会泄漏其他 scope

3. **管理行为**：
   - 只能管理 scope X 的记忆
   - 无法查看其他 scope 的信息

### 使用示例

```bash
# 启动服务
mem serve --scope project:myapp

# 存储记忆
mem store "项目A信息"              # → 写入 project:myapp
mem store "项目A信息" --scope project:myapp  # → 允许，写入 project:myapp
mem store "其他信息" --scope global # → 拒绝：Scope mismatch

# 搜索记忆
mem search "架构"                  # → 仅返回 project:myapp 的记忆
```

## MCP 客户端配置

### Claude Desktop

**跨 scope 模式**：
```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

**锁定 scope 模式**：
```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve", "--scope", "project:myapp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

**多项目配置**：
```json
{
  "mcpServers": {
    "memory-app-a": {
      "command": "mem",
      "args": ["serve", "--scope", "project:myapp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    },
    "memory-app-b": {
      "command": "mem",
      "args": ["serve", "--scope", "backend"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

### Cursor

**`.cursor/mcp.json`**：
```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve", "--scope", "project:myapp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### SSE 远程模式

```json
{
  "mcpServers": {
    "memory-remote": {
      "url": "http://remote-host:3100/sse",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

## Scope 管理

### 列出所有 scope

```bash
mem scope list
```

**输出示例**：
```
Scopes:
  global: 15 memories
  project:myapp: 42 memories
  project:backend: 23 memories
  agent:system: 5 memories
```

### 删除 scope

```bash
# 预览删除范围（不实际删除）
mem scope delete project:old --dry-run

# 确认删除单个 scope
mem scope delete project:old --yes

# 同时删除多个 scope
mem scope delete project:old project:deprecated --yes

# 清除所有 scope（global 除外）
mem scope delete --all --yes
```

**警告**：删除 scope 会永久删除该 scope 内所有记忆数据。`global` scope 为系统保留，无法删除。

### 删除记忆

```bash
# 删除特定记忆
mem delete <uuid>

# 列出记忆以获取 UUID
mem list --scope project:myapp --json
```

## 工作原理

### Scope ACL

memory-lancedb-pro 基于 **scope ACL** 进行隔离：

1. **ACL 检查**：验证请求的 scope 是否可访问
2. **Scope 规范化**：确保写入的 scope 是服务端指定的值
3. **权限控制**：锁定模式下，不一致的 scope 请求在进入插件前即被拒绝

### 系统绕过 ID

锁定模式下，wrapper 使用 `agentId="system"`（系统级绕过 ID）通过 ACL 检查，同时在 wrapper 层强制将 `normalized.scope` 设为服务端 scope 值，确保：

1. ACL 检查通过（`isSystemBypassId("system")` 使 `isAccessible()` 返回 true）
2. 实际写入的 scope 始终是服务端指定的值
3. 不一致的 scope 请求在进入插件前即被拒绝

## 最佳实践

### 1. Scope 命名规范

**推荐**：
```bash
project:myapp
project:backend
project:frontend
user:john
team:engineering
```

**避免**：
```bash
myapp  # 不够明确
project-myapp  # 使用冒号分隔
My App  # 包含空格
```

### 2. 项目隔离策略

**按项目隔离**：
```bash
mem serve --scope project:myapp
mem serve --scope project:backend
```

**按团队隔离**：
```bash
mem serve --scope team:frontend
mem serve --scope team:backend
```

**按用户隔离**：
```bash
mem serve --scope user:john
mem serve --scope user:jane
```

### 3. 记忆分类

**项目相关记忆**：
```bash
mem store "项目使用 React + TypeScript" -c fact --scope project:myapp
mem store "用户偏好使用 pnpm" -c preference --scope project:myapp
```

**通用记忆**：
```bash
mem store "用户是全栈工程师" -c fact  # 写入 global
mem store "用户偏好使用 VS Code" -c preference  # 写入 global
```

### 4. 搜索策略

**项目内搜索**：
```bash
mem search "架构设计" --scope project:myapp
```

**跨项目搜索**：
```bash
mem search "架构设计"  # 搜索所有 scope
```

**按标签搜索**：
```bash
mem search "工程师" -t profile
```

## 常见场景

### 场景 1：多项目开发

**需求**：同时开发多个项目，需要隔离记忆

**配置**：
```json
{
  "mcpServers": {
    "memory-frontend": {
      "command": "mem",
      "args": ["serve", "--scope", "project:frontend"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    },
    "memory-backend": {
      "command": "mem",
      "args": ["serve", "--scope", "project:backend"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

**使用**：
```bash
# 前端项目
mem store "使用 React 18" -c fact --scope project:frontend
mem search "组件设计" --scope project:frontend

# 后端项目
mem store "使用 Express.js" -c fact --scope project:backend
mem search "API 设计" --scope project:backend
```

### 场景 2：团队协作

**需求**：团队成员共享通用知识，但项目记忆隔离

**配置**：
```json
{
  "mcpServers": {
    "memory-team": {
      "command": "mem",
      "args": ["serve"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

**使用**：
```bash
# 团队通用知识
mem store "团队编码规范" -c fact  # 写入 global

# 项目特定知识
mem store "项目架构" -c fact --scope project:myapp
mem store "用户偏好" -c preference --scope project:myapp
```

### 场景 3：个人助理

**需求**：个人助理需要区分工作和个人记忆

**配置**：
```json
{
  "mcpServers": {
    "memory-work": {
      "command": "mem",
      "args": ["serve", "--scope", "work"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    },
    "memory-personal": {
      "command": "mem",
      "args": ["serve", "--scope", "personal"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

**使用**：
```bash
# 工作相关
mem store "项目截止日期" -c fact --scope work
mem search "会议安排" --scope work

# 个人相关
mem store "生日提醒" -c fact --scope personal
mem search "旅行计划" --scope personal
```

## 故障排除

### Q1: Scope 不匹配错误

**症状**：
```
Scope mismatch: expected project:myapp, got global
```

**原因**：在锁定 scope 模式下，尝试访问其他 scope

**解决**：
```bash
# 检查当前 scope
mem config show

# 使用正确的 scope
mem store "信息" --scope project:myapp
```

### Q2: 无法访问其他 scope

**症状**：搜索不到其他 scope 的记忆

**原因**：在锁定 scope 模式下，只能访问指定的 scope

**解决**：
```bash
# 切换到跨 scope 模式
mem serve

# 或使用正确的 scope
mem search "查询" --scope project:myapp
```

### Q3: 记忆丢失

**症状**：找不到之前存储的记忆

**可能原因**：
1. 使用了错误的 scope
2. 记忆被删除
3. 数据库损坏

**解决**：
```bash
# 列出所有 scope
mem scope list

# 检查特定 scope
mem list --scope project:myapp

# 健康检查
mem doctor
```

## 相关文档

- [CLI 参考](../cli/README.md) - 命令行工具
- [配置指南](../config/README.md) - 配置系统
- [MCP 工具](../mcp/README.md) - MCP 工具参考
- [故障排除](troubleshooting.md) - 常见问题解决
