# 外部知识库增量更新 SKILL

> 已导入知识库的增量更新，基于 Git diff 检测 A/M/D 变更，部分更新摘要、向量、本地 KB。

## 触发场景

- 已导入的外部文档目录有变更（新增、修改、删除文件）
- 用户请求"更新知识库"或"同步最新文档"
- 定期同步外部知识库（自动化场景）

## 增量流程（5 步）

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Git 增量扫描                                         │
│  scan-kb.ts scan → Git diff 检测 A/M/D 变更                  │
│  （对比 lastScannedCommit 和 HEAD）                          │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: 分类处理                                            │
│  A: 新增文件 → 全量处理                                      │
│  M: 修改文件 → 重新生成摘要（保留 memoryId）                 │
│  D: 删除文件 → 清理 Relations + memory_forget               │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: AI 摘要更新                                         │
│  仅处理 A/M 类文件，生成新摘要 + 关键词                       │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: 向量化更新                                          │
│  A: memory_store 新增                                       │
│  M: memory_store 覆盖（使用已有 memoryId）                   │
│  D: memory_forget 清理                                      │
└─────────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: 本地 KB 更新                                        │
│  import-kb.ts → 更新三层索引                                 │
│  （A: 新增 / M: 覆盖 / D: 删除）                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Git 增量扫描

### 命令

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> \
  --source <源目录> \
  --root-name <根节点名称>
```

### Git 检测逻辑

自动执行：
```bash
git diff --name-status <lastScannedCommit> HEAD
```

输出 `scan-pending.json`：

```json
{
  "files": [
    {
      "path": "knowledge-index/11-new-feature.md",
      "changeType": "A",   // 新增
      "mode": "full"
    },
    {
      "path": "knowledge-index/02-architecture.md",
      "changeType": "M",   // 修改
      "mode": "full",
      "existingMemoryId": "mem_abc123"  // 保留已有 memoryId
    },
    {
      "path": "knowledge-index/03-old-doc.md",
      "changeType": "D",   // 删除
      "mode": "delete"
    }
  ]
}
```

### Git 不可用时

- 自动退化为全量扫描
- 输出 warning：`Git 命令执行失败，退化为全量扫描`
- `changeType` 全部标记为 `A`

---

## Step 2: 分类处理

### A 类（新增文件）

处理方式：**全量处理**
- 生成新摘要 + 关键词
- `memory_store` 新增向量
- `import-kb.ts` 新增 Relation + 本地 KB

### M 类（修改文件）

处理方式：**覆盖更新**
- 重新生成摘要 + 关键词
- `memory_store` 覆盖（使用已有 `memoryId`）
- `import-kb.ts` 覆盖 Relation + 本地 KB

### D 类（删除文件）

处理方式：**清理删除**
- 从 `relations-cache.json` 删除 Relation
- 从本地 KB 删除 Markdown 内容
- 调用 `memory_forget` 清理向量

---

## Step 3: AI 摘要更新

### 仅处理 A/M 类文件

为变更文件生成新摘要：

```json
{
  "entries": [
    {
      "path": "knowledge-index/11-new-feature.md",
      "summary": "新功能文档...\n[路径] knowledge-index/11-new-feature.md",
      "keywords": ["新功能", "特性"],
      "enriched": false
    },
    {
      "path": "knowledge-index/02-architecture.md",
      "summary": "更新后的架构文档...\n[路径] knowledge-index/02-architecture.md",
      "keywords": ["架构", "三层设计"],
      "enriched": false,
      "existingMemoryId": "mem_abc123"  // 保留用于覆盖
    }
  ]
}
```

### 合并到 scan-index.json

```bash
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> \
  --source <源目录> \
  --root-name <根节点名称> \
  --results <ai-results.json>
```

---

## Step 4: 向量化更新

### A 类：memory_store 新增

```json
{
  "content": "<新摘要>",
  "tags": "knowledge-index,<scope>,docs,<filename>"
}
```

### M 类：memory_store 覆盖

**注意**：`memory_store` 不支持显式指定 memoryId 覆盖，实际行为是新增一条记忆。建议：
- 直接调用 `memory_store`（新增）
- 或先 `memory_forget` 再 `memory_store`（替换）

### D 类：memory_forget 清理

```json
{
  "memoryId": "<memoryId>"
}
```

**获取 memoryId**：
- 从 `scan-index.json` 的 `entries[].memoryId` 字段
- 或从 `memory_recall` 结果中提取

---

## Step 5: 本地 KB 更新

### 命令

```bash
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> \
  --source <源目录> \
  --root-name <根节点名称> \
  --scan-index <scan-index.json>
```

### 更新逻辑

- **A 类**：新增 Relation + 本地 KB 内容
- **M 类**：覆盖 Relation 关键词 + 本地 KB 内容
- **D 类**：删除 Relation + 本地 KB 内容

---

## 参数速查

| 参数 | 说明 | 必填 |
|------|------|------|
| `--scope` | 项目隔离标识 | 是 |
| `--source` | 外部知识库目录 | 是 |
| `--root-name` | 根节点名称 | 是 |
| `--results` | AI 返回结果 JSON | 合并模式必填 |
| `--scan-index` | scan-index.json 路径 | 导入时推荐 |

---

## MCP 工具配合

### memory_store（A/M 类）

```json
{
  "content": "<更新后的摘要>",
  "tags": "knowledge-index,<scope>,docs,<filename>"
}
```

### memory_forget（D 类）

```json
{
  "memoryId": "mem_abc123"
}
```

**注意**：
- `memoryId` 从 `scan-index.json` 或 `memory_recall` 结果中获取
- 如果 memoryId 不存在，`memory_forget` 会报错

### memory_recall（验证更新）

```json
{
  "query": "<关键词>",
  "limit": 5,
  "tags": "knowledge-index,<scope>"
}
```

---

## 验证建议

增量更新后验证：

1. **变更检测正确性**
   ```bash
   # 查看变更文件列表
   cat knowledge-index/kb/<scope>/scan-pending.json
   ```

2. **Relations 更新状态**
   ```bash
   npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --groups <group>
   ```
   
   检查：
   - A 类：新增 Relation 出现
   - M 类：关键词更新
   - D 类：Relation 消失

3. **本地 KB 内容**
   ```bash
   npx jiti knowledge-index/scripts/get-module-info.ts \
     --scope <scope> \
     --group <group> \
     --relation <relationText>
   ```

4. **向量清理验证**
   ```json
   {
     "query": "<D类文件的关键词>",
     "limit": 3,
     "tags": "knowledge-index,<scope>"
   }
   ```
   
   应返回空或不再包含已删除文件的摘要

---

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| `Git 命令执行失败` | Git 不可用或不在 Git 仓库中 | 自动退化为全量扫描 |
| `lastScannedCommit 不存在` | commit hash 无效 | 自动退化为全量扫描 |
| `memory_forget: memoryId 不存在` | memoryId 已被删除或无效 | 检查 scan-index.json 中的 memoryId |
| `D 类 Relation 删除失败` | Relation 不在 Relations 缓存中 | 检查 relations-cache.json |

---

## 与首次导入的区别

| 特性 | 首次导入 | 增量导入 |
|------|---------|---------|
| Git 检测 | 全量扫描 | Git diff（A/M/D） |
| 摘要生成 | 所有文件 | 仅变更文件 |
| memory_store | 全量写入 | A: 新增 / M: 覆盖 |
| memory_forget | 不涉及 | D 类文件需清理 |
| 效率 | O(n) | O(变更数) |

---

## 自动化建议

### 定期同步脚本

```bash
# 每日同步
npx jiti knowledge-index/scripts/scan-kb.ts scan --scope my-project --source ./docs --root-name "设计文档"

# AI 处理变更文件（自动化场景需配合 AI 服务）

# 合并 + 导入
npx jiti knowledge-index/scripts/scan-kb.ts scan --scope my-project --source ./docs --root-name "设计文档" --results ./ai-results.json
npx jiti knowledge-index/scripts/import-kb.ts --scope my-project --source ./docs --root-name "设计文档" --scan-index ./scan-index.json
```

### Git Hook 集成

在 `post-commit` hook 中触发增量扫描（需配合自动化 AI 服务）。