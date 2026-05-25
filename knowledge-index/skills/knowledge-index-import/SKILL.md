# 外部知识库导入 SKILL

> 将外部文档目录批量导入知识索引系统，支持预扫描、AI摘要、向量化、三层索引写入。

## 触发场景

- 用户请求导入外部文档目录（如"把这些文档导入知识库"）
- 项目初始化时批量导入设计文档、API文档等
- 用户显式指定源目录和目标 Group

## 导入流程（5 步）

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: 扫描准备                                            │
│  scan-kb.ts scan → 生成待处理文件列表                        │
│  （自动检测 Git 增量：A/M/D 三类变更）                       │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: AI 摘要生成                                         │
│  AI 读取文件列表 → 为每个 .md 生成摘要 + 关键词              │
│  （摘要需包含路径标记 [路径]）                               │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: 结果合并                                            │
│  scan-kb.ts scan --results → 合并到 scan-index.json         │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: 摘要向量化                                          │
│  scan-kb.ts vectorize → 列出待向量化条目                     │
│  AI 调用 memory_store 向量化摘要                             │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: 原文导入                                            │
│  import-kb.ts → 将原文导入三层索引                           │
│  （Group 树 + Relations 缓存 + 本地 KB）                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: 扫描准备

### 命令

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> \
  --source <源目录> \
  --root-name <根节点名称>
```

### 输出

生成 `scan-pending.json`：

```json
{
  "version": 1,
  "scope": "my-project",
  "source_dir": "/path/to/docs",
  "root_name": "设计文档",
  "total_files": 20,
  "files": [
    {
      "path": "knowledge-index/01-overview.md",
      "size": 2048,
      "changeType": "A",
      "mode": "full"
    },
    {
      "path": "knowledge-index/02-architecture.md",
      "size": 3072,
      "changeType": "A",
      "mode": "full"
    }
  ],
  "lastScannedCommit": "abc123",
  "createdAt": "2026-05-25T07:00:00.000Z"
}
```

### Git 增量检测

- 自动执行 `git diff --name-status` 对比 `lastScannedCommit` 和 HEAD
- `changeType` 标记：
  - `A`（Added）：新增文件
  - `M`（Modified）：修改文件
  - `D`（Deleted）：删除文件
- Git 不可用时自动退化为全量扫描（输出 warning）

---

## Step 2: AI 摘要生成

### 任务

为 `scan-pending.json` 中的每个 `.md` 文件生成：

1. **摘要**（2-3 句话，包含核心内容）
2. **关键词**（3-5 个自然语言词汇）
3. **路径标记**（必须包含 `[路径] <file_path>`）

### AI 结果格式

```json
{
  "entries": [
    {
      "path": "knowledge-index/01-overview.md",
      "summary": "项目概述文档，介绍知识索引系统的核心概念：Group、Relation、三层架构设计。\n[路径] knowledge-index/01-overview.md",
      "keywords": ["项目概述", "核心概念", "Group", "Relation", "三层架构"],
      "enriched": false
    },
    {
      "path": "knowledge-index/02-architecture.md",
      "summary": "架构设计文档，详细说明三层文件系统的设计：Group树索引、Relations缓存、本地KB。\n[路径] knowledge-index/02-architecture.md",
      "keywords": ["架构设计", "三层架构", "Group索引", "Relations缓存", "本地KB"],
      "enriched": false
    }
  ]
}
```

### 关键词规则

- ✅ 自然语言词汇（如"用户登录"、"认证流程"）
- ❌ 禁止代码符号（类名、方法名、路径等）
- ✅ 关键词必须在原文中出现

---

## Step 3: 结果合并

### 命令

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> \
  --source <源目录> \
  --root-name <根节点名称> \
  --results <ai-results.json>
```

### 输出

更新 `scan-index.json`：

```json
{
  "version": 1,
  "scope": "my-project",
  "total_entries": 20,
  "entries": [
    {
      "path": "knowledge-index/01-overview.md",
      "summary": "项目概述文档...",
      "keywords": ["项目概述", "核心概念"],
      "vectorized": false,
      "imported": false
    }
  ]
}
```

---

## Step 4: 摘要向量化

### 4.1 列出待向量化条目

```bash
npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope <scope>
```

输出：
```json
{
  "pending": [
    {
      "path": "knowledge-index/01-overview.md",
      "summary": "项目概述文档..."
    }
  ],
  "count": 20
}
```

### 4.2 AI 调用 memory_store

为每个待向量化条目调用 MCP `memory_store`：

```json
{
  "content": "<summary内容>",
  "tags": "knowledge-index,<scope>,docs,<filename>"
}
```

**重要限制**：
- MCP memory server **不支持自定义 scope**
- 所有记忆默认存入 `global` scope
- 使用 `tags` 实现逻辑隔离

### 4.3 标记向量化完成（可选）

```bash
npx jiti knowledge-index/scripts/scan-kb.ts vectorize \
  --scope <scope> \
  --complete <results.json>
```

**注意**：`memory_store` 不返回结构化的 memory ID，所以 `--complete` 无法自动化。建议：
- 跳过此步骤，保留 `vectorized: false` 状态
- 或手动从 `memory_recall` 结果中捕获 memory ID

---

## Step 5: 原文导入

### 命令

```bash
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> \
  --source <源目录> \
  --root-name <根节点名称> \
  --scan-index <scan-index.json>
```

### 导入逻辑

1. **创建 Group 树**
   - 目录结构 → Group 层级
   - 例如：`docs/knowledge-index/` → `设计文档/knowledge-index`

2. **写入 Relations 缓存**
   - 文件名（去扩展名）→ Relation `text`
   - AI 生成的关键词 → Relation `keywords`
   - 标记 `isImported: true`

3. **写入本地 KB**
   - 原文 Markdown → `kb/<scope>/<group>/index.json`
   - Key 为 Relation `text`

### 输出示例

```json
{
  "ok": true,
  "imported": {
    "groups_created": 2,
    "relations_imported": 20,
    "files_skipped": 0,
    "errors": []
  }
}
```

---

## 参数速查

| 参数 | 说明 | 必填 |
|------|------|------|
| `--scope` | 项目隔离标识 | 是 |
| `--source` | 外部知识库目录 | 是 |
| `--root-name` | 根节点名称 | 是 |
| `--results` | AI 返回结果 JSON | 合并模式必填 |
| `--scan-index` | scan-index.json 路径 | 导入时推荐 |
| `--complete` | 向量化完成结果 | 完成模式必填 |

---

## MCP 工具配合

### memory_store（向量化摘要）

```json
{
  "content": "项目概述文档，介绍知识索引系统的核心概念：Group、Relation、三层架构设计。\n[路径] knowledge-index/01-overview.md",
  "tags": "knowledge-index,my-project,docs,01-overview"
}
```

**注意**：
- 不要传递 `scope` 参数（MCP memory server 会拒绝）
- 使用 `tags` 实现逻辑隔离

### memory_recall（验证导入）

导入后验证：

```json
{
  "query": "知识索引 三层架构 Group",
  "limit": 5,
  "tags": "knowledge-index,my-project"
}
```

---

## 验证建议

导入完成后验证：

1. **Group 树结构**
   ```bash
   npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --mode compact
   ```

2. **Relations + 关键词**
   ```bash
   npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --groups <group>
   ```

3. **本地 KB 内容**
   ```bash
   npx jiti knowledge-index/scripts/get-module-info.ts \
     --scope <scope> \
     --group <group> \
     --relation <relationText>
   ```

4. **语义检索**
   ```json
   {
     "query": "<关键词组合>",
     "limit": 3,
     "tags": "knowledge-index,<scope>"
   }
   ```

---

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| `Access denied to scope: XXX` | `memory_store` 传递了自定义 scope | 移除 `scope` 参数，使用 `tags` |
| `source 目录不存在` | `--source` 路径错误 | 检查路径是否存在 |
| `根节点已存在` | 重复导入同名根节点 | 幂等操作，输出 warning 后继续 |
| `空 .md 文件跳过` | 文件 size=0 | 正常行为，输出 warning |

---

## 与增量导入的区别

| 特性 | 首次导入 | 增量导入 |
|------|---------|---------|
| Git 检测 | 全量扫描 | Git diff（A/M/D） |
| 摘要生成 | 所有文件 | 仅变更文件 |
| memory_store | 全量写入 | 覆盖更新 |
| memory_forget | 不涉及 | D 类文件需清理 |
