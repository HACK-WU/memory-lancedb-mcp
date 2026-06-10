# mem store 命令

`mem store` 命令用于存储记忆。

## 语法

```bash
mem store <text> [options]
```

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<text>` | 记忆内容（必需） | 无 |

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-c, --category <cat>` | 记忆分类 | `other` |
| `-t, --tags <tags>` | 自定义标签，逗号分隔 | 无 |
| `-i, --importance <n>` | 重要度 0-1 | 0.7 |
| `-s, --scope <scope>` | 目标 scope | 自动检测 |

## 记忆分类

| 分类 | 说明 | 示例 |
|------|------|------|
| `preference` | 用户偏好 | "用户偏好使用 pnpm" |
| `fact` | 事实信息 | "项目基于 LanceDB 存储" |
| `decision` | 决策记录 | "决定使用 React 而非 Vue" |
| `entity` | 实体信息 | "用户是全栈工程师" |
| `reflection` | 反思总结 | "这次重构提升了性能" |
| `other` | 其他 | 通用信息 |

## 使用示例

### 基本用法

```bash
# 存储偏好
mem store "用户偏好使用 pnpm" -c preference

# 存储事实
mem store "项目基于 LanceDB 存储" -c fact

# 存储决策
mem store "决定使用 React 而非 Vue" -c decision
```

### 使用标签

```bash
# 单个标签
mem store "用户是全栈工程师" -c entity -t profile

# 多个标签
mem store "用户偏好使用 pnpm" -c preference -t tech,tools

# 标签命名规范
mem store "项目架构信息" -c fact -t project:myapp,architecture
```

### 设置重要度

```bash
# 高重要度
mem store "用户是管理员" -c entity -i 0.9

# 低重要度
mem store "临时笔记" -c other -i 0.3
```

### 指定 Scope

```bash
# 存储到指定 scope
mem store "项目信息" -c fact --scope project:myapp

# 存储到 global（默认）
mem store "通用知识" -c fact
```

## 输出示例

### 成功存储

```
✅ Memory stored successfully
  ID: 123e4567-e89b-12d3-a456-426614174000
  Category: preference
  Tags: tech,tools
  Importance: 0.9
  Scope: project:myapp
```

### 错误示例

**标签格式错误**：
```
❌ Invalid tag value: "my tag" (contains spaces)
```

**Scope 不匹配**：
```
❌ Scope mismatch: expected project:myapp, got global
```

## 标签系统

### 命名规范

**允许的字符**：
- 字母、数字
- `_`、`-`、`:`、`/`、`.`
- CJK 中文字符（`\u4e00-\u9fff`）
- `,` 作为分隔符

**禁止的字符**：
- 空格
- emoji
- 其他标点符号
- `【` 和 `】`（保留用于前缀语法）

### 标签示例

```bash
# 有效标签示例
mem store "信息" -t profile
mem store "信息" -t tech,tools
mem store "信息" -t project:myapp
mem store "信息" -t 中文标签

# 无效标签示例
mem store "信息" -t "my tag"  # 包含空格
mem store "信息" -t "tag@name"  # 包含特殊字符
```

### 标签存储机制

标签以 `【标签:x,y】` 前缀嵌入 text 字段：

```
原始文本: "用户是全栈工程师"
存储文本: "【标签:profile,tech】 用户是全栈工程师"
```

### 标签检索机制

BM25 自然命中标签前缀，无需额外索引。结果展示时自动剥离前缀。

## 重要度

### 范围说明

| 重要度 | 说明 | 示例 |
|--------|------|------|
| 0.0 - 0.3 | 低重要度 | 临时笔记、草稿 |
| 0.4 - 0.6 | 中等重要度 | 一般信息 |
| 0.7 - 0.9 | 高重要度 | 重要偏好、关键事实 |
| 1.0 | 最高重要度 | 核心决策、关键信息 |

### 默认值

默认重要度：0.7

### 使用建议

```bash
# 用户偏好
mem store "用户偏好使用 pnpm" -c preference -i 0.8

# 项目架构
mem store "项目使用微服务架构" -c fact -i 0.9

# 临时笔记
mem store "待办事项" -c other -i 0.3
```

## Scope 隔离

### 跨 scope 模式

```bash
# 启动服务
mem serve

# 存储到不同 scope
mem store "通用知识"  # 写入 global
mem store "项目信息" --scope project:alpha  # 写入 project:alpha
```

### 锁定 scope 模式

```bash
# 启动服务时指定 scope
mem serve --scope project:myapp

# 所有操作自动限定在 project:myapp
mem store "项目信息"  # 写入 project:myapp
mem store "其他信息" --scope global  # 拒绝：Scope mismatch
```

## 最佳实践

### 1. 分类选择

**推荐**：
```bash
# 用户偏好
mem store "用户偏好使用 pnpm" -c preference

# 事实信息
mem store "项目基于 LanceDB 存储" -c fact

# 决策记录
mem store "决定使用 React 而非 Vue" -c decision

# 实体信息
mem store "用户是全栈工程师" -c entity
```

### 2. 标签使用

**推荐**：
```bash
# 使用有意义的标签
mem store "用户是全栈工程师" -c entity -t profile,tech

# 使用项目标签
mem store "项目架构信息" -c fact -t project:myapp,architecture

# 使用技能标签
mem store "用户擅长 React" -c entity -t skill:react
```

### 3. 重要度设置

**推荐**：
```bash
# 关键信息设置高重要度
mem store "用户是管理员" -c entity -i 0.9

# 一般信息使用默认重要度
mem store "项目信息" -c fact

# 临时信息设置低重要度
mem store "临时笔记" -c other -i 0.3
```

### 4. Scope 管理

**推荐**：
```bash
# 项目相关记忆使用项目 scope
mem store "项目架构" -c fact --scope project:myapp

# 通用知识使用 global
mem store "用户偏好" -c preference  # 写入 global
```

## 故障排除

### 标签格式错误

**症状**：
```
❌ Invalid tag value: "my tag" (contains spaces)
```

**解决**：
```bash
# 使用有效字符
mem store "信息" -t my-tag

# 避免空格
mem store "信息" -t my_tag
```

### Scope 不匹配

**症状**：
```
❌ Scope mismatch: expected project:myapp, got global
```

**解决**：
```bash
# 使用正确的 scope
mem store "信息" --scope project:myapp

# 或切换到跨 scope 模式
mem serve
```

### 存储失败

**症状**：
```
❌ Failed to store memory
```

**解决**：
```bash
# 检查配置
mem config validate

# 健康检查
mem doctor

# 检查数据库路径
ls -la ~/.local/share/memory-mcp/
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [bulk-store 命令](bulk-store.md) - 批量存储记忆（推荐大数据量使用）
- [search 命令](search.md) - 语义搜索
- [list 命令](list.md) - 列表查看
- [MCP memory_store](../mcp/memory-tools.md) - MCP 存储工具

## 批量存储提示

> **需要一次性存储多条记忆？** 推荐使用 [`mem bulk-store`](bulk-store.md) 命令。
> 相比多次调用 `mem store`，`bulk-store` 单次初始化运行时，每条可节省约 930ms 的进程启动开销。
> 10 条记忆：`mem store` 约 12 秒 vs `mem bulk-store` 约 2.7 秒（快 **77%**）。
