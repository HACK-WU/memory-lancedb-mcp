# 生命周期工具

本文档介绍 memory-lancedb-mcp 的生命周期工具。

## 工具概览

| 工具 | 说明 |
|------|------|
| `_lifecycle_auto_recall` | 自动召回（prompt 构建前注入上下文） |
| `_lifecycle_auto_capture` | 自动捕获（agent 结束后提取关键信息） |
| `_lifecycle_session_end` | 会话清理和收尾 |

> **注意**：以下工具由 MCP 服务生命周期自动触发，通常无需手动调用。

## _lifecycle_auto_recall

自动召回。

### 触发时机

在 prompt 构建前自动触发，将相关记忆注入上下文。

### 工作原理

1. 分析当前对话上下文
2. 检索相关记忆
3. 将记忆注入到 prompt 中

### 配置

```yaml
autoRecall: false  # MCP 模式建议关闭，让 Agent 显式调用 memory_recall
autoRecallMinLength: 10
autoRecallMaxItems: 5
autoRecallMaxChars: 2000
autoRecallTimeoutMs: 5000
```

## _lifecycle_auto_capture

自动捕获。

### 触发时机

在 agent 结束后自动触发，从对话中提取关键信息并存储。

### 工作原理

1. 分析对话内容
2. 使用 LLM 提取关键信息
3. 分类并存储记忆

### 配置

```yaml
autoCapture: true
smartExtraction: true
extractMinMessages: 2
extractMaxChars: 8000
```

## _lifecycle_session_end

会话清理。

### 触发时机

在会话结束时触发。

### 工作原理

1. 清理会话状态
2. 持久化临时数据
3. 记录会话摘要

### 配置

```yaml
sessionStrategy: "none"  # MCP 模式建议 none
```

## 配置建议

### MCP 模式

在 MCP 模式下，建议让 Agent 显式调用记忆工具，而不是依赖自动生命周期：

```yaml
autoCapture: true     # 自动捕获（从对话中提取记忆）
autoRecall: false     # 关闭自动召回（让 Agent 显式调用 memory_recall）
smartExtraction: true # 启用智能提取
```

### 原因

- `autoRecall` 可能注入不相关的记忆，浪费 token
- Agent 显式调用 `memory_recall` 可以更精确地获取所需信息
- `autoCapture` 仍然有用，可以自动积累记忆

## 相关文档

- [MCP 工具总览](README.md) - MCP 工具概览
- [记忆管理工具](memory-tools.md) - 核心记忆操作
- [配置指南](../config/README.md) - 配置系统
