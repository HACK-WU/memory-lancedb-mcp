# 自我改进工具

本文档介绍 memory-lancedb-mcp 的自我改进工具。

## 工具概览

| 工具 | 说明 |
|------|------|
| `self_improvement_log` | 记录改进建议或错误经验 |
| `self_improvement_extract_skill` | 从记忆提取可复用的技能/规范 |
| `self_improvement_review` | 审阅积压的待改进项 |

## self_improvement_log

记录改进建议或错误经验。

### 用途

- 记录错误经验和教训
- 记录改进建议
- 积累自我改进知识库

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `text` | string | 是 | 改进建议或错误经验 |
| `type` | string | 否 | 类型：`error` / `improvement` / `observation` |

### 示例

```json
{
  "name": "self_improvement_log",
  "arguments": {
    "text": "使用 eval() 存在注入风险，应改用直接调用",
    "type": "error"
  }
}
```

## self_improvement_extract_skill

从记忆提取可复用的技能/规范。

### 用途

- 从历史记忆中提取模式
- 生成可复用的技能规范
- 积累最佳实践

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `topic` | string | 是 | 技能主题 |
| `scope` | string | 否 | 限定 scope |

### 示例

```json
{
  "name": "self_improvement_extract_skill",
  "arguments": {
    "topic": "shell 脚本安全编码",
    "scope": "project:myapp"
  }
}
```

## self_improvement_review

审阅积压的待改进项。

### 用途

- 查看待处理的改进建议
- 审阅错误经验
- 推动持续改进

### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `limit` | number | 否 | 最大条数（默认 10） |

### 示例

```json
{
  "name": "self_improvement_review",
  "arguments": {
    "limit": 5
  }
}
```

## 使用场景

### 记录错误经验

当 AI 助手犯错时，自动或手动记录错误经验，避免重犯。

### 提取最佳实践

从历史交互中提取编码规范、架构模式等最佳实践。

### 定期审阅

定期审阅待改进项，推动代码质量提升。

## 配置

自我改进功能可通过配置文件控制：

```yaml
selfImprovement:
  enabled: true
  beforeResetNote: true
  ensureLearningFiles: true
```

## 相关文档

- [MCP 工具总览](README.md) - MCP 工具概览
- [记忆管理工具](memory-tools.md) - 核心记忆操作
- [治理工具](governance-tools.md) - 治理工具
