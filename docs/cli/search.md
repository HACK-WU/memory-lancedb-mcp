# mem search 命令

`mem search` 命令用于语义搜索记忆。

## 语法

```bash
mem search <query> [options]
```

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<query>` | 搜索关键词（必需） | 无 |

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --scope <scope>` | 限定 scope | 无 |
| `-t, --tags <tags>` | 标签过滤（逗号分隔） | 无 |
| `-l, --limit <n>` | 最大结果数 | 5 |
| `--json` | JSON 输出 | 无 |

## 使用示例

### 基本用法

```bash
# 语义搜索
mem search "包管理器偏好"

# 按 scope 搜索
mem search "架构设计" --scope project:myapp

# 按标签搜索
mem search "工程师" -t profile

# 增加结果数量
mem search "技术栈" -l 10
```

### 组合搜索

```bash
# scope + 标签
mem search "架构" --scope project:myapp -t architecture

# 标签 + 结果数量
mem search "偏好" -t preference -l 20
```

### JSON 输出

```bash
# JSON 格式输出
mem search "包管理器偏好" --json

# 结合其他选项
mem search "架构" --scope project:myapp -l 10 --json
```

## 输出示例

### 文本输出

```
Found 3 memories:

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
      "createdAt": "2024-01-15T10:30:00Z",
      "score": 0.95
    },
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "text": "项目基于 LanceDB 存储",
      "category": "fact",
      "tags": ["project", "architecture"],
      "importance": 0.7,
      "scope": "project:myapp",
      "createdAt": "2024-01-14T15:20:00Z",
      "score": 0.87
    }
  ],
  "total": 2,
  "query": "包管理器偏好"
}
```

## 搜索算法

### 混合检索

默认使用混合检索模式（向量 + BM25）：

1. **向量检索**：语义相似度
2. **BM25 检索**：关键词匹配
3. **加权合并**：向量权重 0.7，BM25 权重 0.3

### 重排

默认启用重排（cross-encoder）：

1. **初步检索**：获取候选结果
2. **重排评分**：使用重排模型重新评分
3. **结果过滤**：过滤低分结果

### 相似度阈值

- **最低分数**：0.3（初步检索）
- **硬性最低分数**：0.35（重排后）

## Scope 搜索

### 跨 scope 搜索

```bash
# 搜索所有 scope
mem search "架构设计"
```

### 指定 scope 搜索

```bash
# 搜索特定 scope
mem search "架构设计" --scope project:myapp
```

### Scope 隔离

**跨 scope 模式**：
```bash
mem serve
mem search "架构"  # 搜索所有 scope
mem search "架构" --scope project:alpha  # 仅搜索 project:alpha
```

**锁定 scope 模式**：
```bash
mem serve --scope project:myapp
mem search "架构"  # 仅搜索 project:myapp
```

## 标签搜索

### 单标签搜索

```bash
mem search "工程师" -t profile
```

### 多标签搜索

```bash
mem search "工程师" -t profile,tech
```

### 标签过滤机制

标签以 `【标签:x,y】` 前缀嵌入 text 字段，BM25 自然命中标签前缀。

## 结果排序

### 排序因素

1. **语义相似度**：向量检索分数
2. **关键词匹配**：BM25 分数
3. **重要度**：importance 字段
4. **新鲜度**：Weibull 衰减
5. **重排分数**：cross-encoder 评分

### 排序权重

- 向量检索：0.7
- BM25 检索：0.3
- 重排：启用（默认）

## 最佳实践

### 1. 搜索关键词

**推荐**：
```bash
# 使用自然语言
mem search "用户偏好使用什么包管理器"

# 使用关键词
mem search "包管理器偏好"

# 使用短语
mem search "React 而非 Vue"
```

**避免**：
```bash
# 过于宽泛
mem search "信息"

# 过于具体
mem search "用户偏好使用 pnpm 版本 8.5.1"
```

### 2. 结果数量

**推荐**：
```bash
# 默认数量（5）
mem search "架构"

# 增加数量（浏览更多结果）
mem search "架构" -l 20

# 减少数量（快速查看）
mem search "架构" -l 3
```

### 3. Scope 使用

**推荐**：
```bash
# 项目相关搜索
mem search "架构" --scope project:myapp

# 跨项目搜索
mem search "架构"

# 通用搜索
mem search "用户偏好"
```

### 4. 标签使用

**推荐**：
```bash
# 按类别搜索
mem search "偏好" -t preference

# 按技能搜索
mem search "React" -t skill:react

# 按项目搜索
mem search "架构" -t project:myapp
```

## JSON 输出

### 用途

1. **脚本集成**：用于自动化脚本
2. **数据处理**：用于数据分析
3. **API 集成**：用于其他应用

### 示例

```bash
# 获取 JSON 输出
mem search "架构" --json

# 处理 JSON
mem search "架构" --json | jq '.memories[0].text'

# 导出到文件
mem search "架构" --json > search-results.json
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
      "createdAt": "ISO8601",
      "score": 0.95
    }
  ],
  "total": 10,
  "query": "string"
}
```

## 故障排除

### 无结果

**症状**：
搜索返回空结果

**可能原因**：
1. 记忆不存在
2. 使用了错误的 scope
3. 标签不匹配
4. 搜索关键词不相关

**解决**：
```bash
# 列出所有记忆
mem list -l 20

# 检查 scope
mem scope list

# 尝试更宽泛的搜索
mem search "信息"

# 尝试不同的关键词
mem search "偏好"
```

### 结果不相关

**症状**：
搜索结果与预期不符

**可能原因**：
1. 搜索关键词不够精确
2. 语义相似度算法限制
3. 记忆内容不准确

**解决**：
```bash
# 使用更精确的关键词
mem search "用户偏好使用 pnpm"

# 使用标签过滤
mem search "偏好" -t preference

# 增加结果数量
mem search "偏好" -l 20
```

### 搜索速度慢

**症状**：
搜索响应时间过长

**可能原因**：
1. 数据库过大
2. 索引未优化
3. 系统资源不足

**解决**：
```bash
# 检查数据库大小
mem stats

# 压缩记忆
mem compact

# 减少结果数量
mem search "架构" -l 5
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [store 命令](store.md) - 存储记忆
- [list 命令](list.md) - 列表查看
- [MCP memory_recall](../mcp/memory-tools.md) - MCP 召回工具
