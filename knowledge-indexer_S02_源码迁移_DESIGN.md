# S-02 源码迁移 设计文档

> 状态：草案
> 创建时间：2026-06-03

## 1. 术语

| 术语 | 定义 |
|------|------|
| `scripts/` | CLI 脚本目录，包含所有 .ts 入口文件 |
| `scripts/lib/` | 内部共享模块目录，包含核心逻辑 |
| `import` | TypeScript 模块导入语句 |
| `import.meta.url` | ES Module 元数据，用于计算文件路径 |

## 2. 现状（AS-IS）

**源码位置**：`/root/memory-lancedb-pro/mcp-wrapper/knowledge-index/scripts/`

**文件清单**：

| 文件 | 功能 | 行数 |
|------|------|------|
| `scan-kb.ts` | 统一入口：import / diff / scan / vectorize | ~700 |
| `manage-index.ts` | Group 树 CRUD | ~300 |
| `query-group.ts` | 查询 Group + 词云 + 分区 | ~750 |
| `get-module-info.ts` | 读取本地 KB 原文 | ~200 |
| `sync-relation.ts` | 写入 Relation + 关键词校验 | ~400 |
| `import-kb.ts` | @deprecated 旧导入 | ~400 |
| `migrate-keywords.ts` | 数据迁移 | ~200 |

**lib/ 目录文件**：

| 文件 | 功能 |
|------|------|
| `ai-results.ts` | ai-results.json 解析校验 |
| `batch-vectorize.ts` | 批量 mem store + Memory ID 解析 |
| `constants.ts` | 全局常量 + 路径配置 |
| `diff.ts` | 增量 diff（git diff -z） |
| `import.ts` | 统一导入 5 阶段流水线 |
| `incremental.ts` | 增量导入（add/modify/delete） |
| `scope.ts` | scope 校验 + 路径构造 |
| `scoring.ts` | 评分引擎 + 冷热分区 |
| `store.ts` | JSON 读写 + WAL 写入 + scope 初始化 |
| `wal.ts` | WAL 写入机制 |

**Import 路径分析**：

所有 import 路径均为相对路径，仅在 `scripts/` 和 `scripts/lib/` 内部：
```typescript
// 示例：scan-kb.ts
import { handleImport } from './lib/import.js';
import { handleIncremental } from './lib/incremental.js';
import { handleDiff } from './lib/diff.js';

// 示例：lib/import.ts
import { getGroupIndexPath, getRelationsCachePath } from './scope.js';
import { readJson, writeJson } from './store.js';
```

**关键发现**：无任何 import 指向父项目 `src/` 或其他目录。

## 3. 方案（TO-BE）

### 3.1 迁移策略

**直接复制**：由于源码零耦合，直接复制整个 `scripts/` 目录到新项目。

**迁移清单**：

| 源路径 | 目标路径 | 操作 |
|--------|----------|------|
| `knowledge-index/scripts/*.ts` | `knowledge-indexer/scripts/*.ts` | 复制 |
| `knowledge-index/scripts/lib/*.ts` | `knowledge-indexer/scripts/lib/*.ts` | 复制 |

### 3.2 路径调整

**需要调整的路径**：

1. **`scripts/lib/constants.ts`** 中的 `KI_ROOT` 计算：
   ```typescript
   // 现状：从 knowledge-index/scripts/lib/ 上溯 2 级
   export const KI_ROOT = path.resolve(__dirname, '..', '..');
   
   // 调整后：从 knowledge-indexer/scripts/lib/ 上溯 2 级（逻辑不变）
   export const KI_ROOT = path.resolve(__dirname, '..', '..');
   ```
   **结论**：无需调整，路径逻辑保持不变。

2. **所有脚本中的相对路径**：
   ```typescript
   // 示例：scan-kb.ts
   npx jiti knowledge-index/scripts/scan-kb.ts
   
   // 调整后：
   npx jiti knowledge-indexer/scripts/scan-kb.ts
   ```
   **结论**：这是调用方式的变更，源码内部的相对路径无需调整。

### 3.3 影响范围

| 影响项 | 影响程度 | 说明 |
|--------|----------|------|
| scripts/*.ts | 无 | 直接复制，无需修改 |
| scripts/lib/*.ts | 无 | 直接复制，无需修改 |
| import 路径 | 无 | 全部是相对路径，逻辑不变 |
| 常量路径 | 无 | 使用 import.meta.url 计算，逻辑不变 |

## 4. 关键决策点

### 决策 1：是否需要调整 import 路径？

**备选方案**：
- A. 保持现状：所有 import 路径不变
- B. 调整为绝对路径：使用 `@/` 别名

**决策**：选择 A（保持现状）

**理由**：
1. 相对路径已经能正确工作
2. 避免引入额外的路径解析复杂度
3. 保持与父项目一致的代码风格

## 5. 待定问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 是否需要清理 @deprecated 文件？ | 减少代码体积 | 建议保留，保持向后兼容 |
| 是否需要添加代码注释？ | 提高可维护性 | 后续迭代中逐步添加 |