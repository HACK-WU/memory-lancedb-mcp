# MCP 工具参考

memory-lancedb-mcp 提供了 17 个 MCP 工具，用于记忆管理、治理和自我改进。

## 工具概览

### 记忆管理工具

| 工具 | 说明 | 文档链接 |
|------|------|----------|
| `memory_store` | 存储记忆 | [memory-tools.md](memory-tools.md) |
| `memory_recall` | 语义召回 | [memory-tools.md](memory-tools.md) |
| `memory_list` | 列表查看 | [memory-tools.md](memory-tools.md) |
| `memory_forget` | 删除记忆 | [memory-tools.md](memory-tools.md) |
| `memory_update` | 更新记忆 | [memory-tools.md](memory-tools.md) |
| `memory_stats` | 统计信息 | [memory-tools.md](memory-tools.md) |

### 治理工具

| 工具 | 说明 | 文档链接 |
|------|------|----------|
| `memory_debug` | 检索链路追踪 | [governance-tools.md](governance-tools.md) |
| `memory_promote` | 提升为治理记忆 | [governance-tools.md](governance-tools.md) |
| `memory_archive` | 归档记忆 | [governance-tools.md](governance-tools.md) |
| `memory_compact` | 去重并压缩 | [governance-tools.md](governance-tools.md) |
| `memory_explain_rank` | 解释排名原因 | [governance-tools.md](governance-tools.md) |

### 自我改进工具

| 工具 | 说明 | 文档链接 |
|------|------|----------|
| `self_improvement_log` | 记录改进建议 | [self-improvement.md](self-improvement.md) |
| `self_improvement_extract_skill` | 提取可复用技能 | [self-improvement.md](self-improvement.md) |
| `self_improvement_review` | 审阅待改进项 | [self-improvement.md](self-improvement.md) |

### 生命周期工具

| 工具 | 说明 | 文档链接 |
|------|------|----------|
| `_lifecycle_auto_recall` | 自动召回 | [lifecycle-tools.md](lifecycle-tools.md) |
| `_lifecycle_auto_capture` | 自动捕获 | [lifecycle-tools.md](lifecycle-tools.md) |
| `_lifecycle_session_end` | 会话清理 | [lifecycle-tools.md](lifecycle-tools.md) |

## 使用方式

### MCP 客户端调用

MCP 工具通过 MCP 协议调用，通常由 AI 助手自动触发：

```json
{
  "name": "memory_store",
  "arguments": {
    "text": "用户偏好使用 pnpm",
    "category": "preference",
    "tags": "tech,tools",
    "importance": 0.9
  }
}
```

### CLI 调用

部分工具也可以通过 CLI 调用：

```bash
# 存储记忆
mem store "用户偏好使用 pnpm" -c preference -t tech,tools -i 0.9

# 搜索记忆
mem search "包管理器偏好"

# 列出记忆
mem list -l 10
```

## 参数说明

### 通用参数

大多数工具支持以下通用参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | string | 限定 scope |
| `category` | string | 记忆分类 |
| `tags` | string | 标签过滤（逗号分隔） |

### 记忆分类

| 分类 | 说明 |
|------|------|
| `preference` | 用户偏好 |
| `fact` | 事实信息 |
| `decision` | 决策记录 |
| `entity` | 实体信息 |
| `reflection` | 反思总结 |
| `other` | 其他 |

### 标签系统

标签支持自定义分类，命名约束：
- 允许：字母、数字、`_`、`-`、`:`、`/`、`.`、CJK 中文字符
- 禁止：空格、emoji、其他标点
- 分隔符：逗号 `,`

**示例**：
```bash
mem store "用户是全栈工程师" --tags profile,tech
mem search "工程师" --tags profile
```

## Scope 隔离

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

## 详细文档

- [记忆管理工具](memory-tools.md) - 核心记忆操作
- [治理工具](governance-tools.md) - 记忆治理功能
- [自我改进工具](self-improvement.md) - 自我改进功能
- [生命周期工具](lifecycle-tools.md) - 生命周期管理

## 相关文档

- [CLI 参考](../cli/README.md) - 命令行工具
- [配置指南](../config/README.md) - 配置系统
- [多项目隔离](../guides/multi-project.md) - 多项目配置
