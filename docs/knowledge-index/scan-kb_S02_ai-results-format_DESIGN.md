# S-02：`ai-results.json` 格式扩展 设计文档

> - 状态：草案
> - 起草时间：2026-05-26
> - 关联父文档：[scan-kb-import-unified_DESIGN.md](scan-kb-import-unified_DESIGN.md)
> - 实施范围：`knowledge-index/scripts/scan-kb.ts` 的 `ScanResultEntry` 接口和相关合并逻辑

## 1. 需求背景 & 目标

### 1.1 背景

旧 `ai-results.json` 只含 `{path, summary, keywords, enriched}`。新流程要求 AI 一次输出中携带 `groupPath`（Group 归属）和 `memoryId`（增量时覆盖写入）。同时消除 `scan-pending.json` 后，文件目录结构信息由 AI 直接从路径推导 `groupPath`。

### 1.2 目标

- 目标 1：`ScanResultEntry` 新增 `groupPath` 字段（必填，格式 `rootName/dir1/dir2`）
- 目标 2：`ScanResultEntry` 新增 `memoryId` 字段（可选，增量时携带）
- 目标 3：向后兼容读取旧格式（缺失字段用默认值填充）

### 1.3 明确不在范围内

- 不改变 `summary` 和 `keywords` 的生成规则
- 不要求 AI 同时填写 `memoryId`（首次导入可空，由 S-03 批量写入后回填）

## 2. 名词术语表

| 术语 | 含义 | 易混淆点 |
|------|------|---------|
| `groupPath` | 条目在 Group 树中的完整路径 | 不含文件名，只到目录层级 |
| `memoryId` | 记忆系统中的记录 ID | 首次导入为空，增量导入可携带用于覆盖 |

## 3. 现状分析（AS-IS）

### 3.1 现有实现

```typescript
// 当前 ScanResultEntry（scan-kb.ts）
interface ScanResultEntry {
  path: string;         // 相对于 sourceDir 的文件路径
  summary: string;
  keywords: string[];
  enriched?: boolean;
  replaces?: string;    // 已废弃
}
```

### 3.2 痛点

- `groupPath` 当前在 `handleScanMerge` 中通过 `buildFullPath()` 计算，依赖 `scan-pending.json` 的 `rootName` 和 `dir` 字段
- 删除 `scan-pending.json` 后，无法从 pending 数据结构推导 dir 信息
- `memoryId` 无承载字段，需要单独的 `vectorize --complete` 回写

## 4. 方案设计（TO-BE）

### 4.1 方案概述

`ScanResultEntry` 新增两个字段：`groupPath` 由 AI 根据文件路径推导（`rootName/dir1/dir2`），`memoryId` 由 AI 或 CLI 填充。`handleScanMerge` 不再依赖 `scan-pending.json`。

### 4.2 关键决策点

| 决策 | 选择 | 理由 | 备选 |
|------|------|------|------|
| groupPath 由谁推导 | AI 推导（按目录结构约定） | 删除 scan-pending 后 CLI 无 dir 信息 | ❌ CLI 再次遍历 sourceDir：与去中间化目标矛盾 |
| memoryId 字段类型 | `string \| null \| undefined` | 区分"不携带"（undefined）和"明确为空"（null） | ❌ 只用 string：无法区分状态 |
| 向后兼容 | 缺失字段用默认值，不报错 | 存量 ai-results.json 可直接使用 | ❌ 强制新格式：破坏已有数据 |

### 4.3 与现状的差异

- `ScanResultEntry` 接口：新增 `groupPath: string`、`memoryId?: string | null`
- `handleScanMerge` / `handleImport`：不再读取 `scan-pending.json`，直接从 `groupPath` 取值

## 5. 架构图 / 流程图

```mermaid
flowchart LR
    subgraph OLD["旧格式"]
        O1["path"] --> O2["summary"]
        O2 --> O3["keywords"]
        O3 --> O4["enriched"]
    end
    
    subgraph NEW["新格式"]
        N1["path"] --> N2["groupPath ✨"]
        N2 --> N3["summary"]
        N3 --> N4["keywords"]
        N4 --> N5["memoryId ✨"]
    end
    
    OLD -->|兼容读取| NEW
    style N2 fill:#90EE90
    style N5 fill:#90EE90
```

## 6. 模块/类设计

| 模块 | 职责 | 依赖 |
|------|------|------|
| `ScanResultEntry` | 接口定义 | 无 |
| `normalizeAiResults()` | 读取 ai-results.json 并补全默认值 | `ScanResultEntry` |

## 7. 接口设计

```typescript
// scan-kb.ts 新增/修改
interface ScanResultEntry {
  path: string;
  groupPath: string;          // ✨ 新增：如 "wiki/部署运维"
  summary: string;
  keywords: string[];
  enriched?: boolean;
  memoryId?: string | null;   // ✨ 新增：首次空，增量可带
  replaces?: string;          // 保留兼容
}
```

| 接口 | 输入 | 输出 | 异常 |
|------|------|------|------|
| `normalizeAiResults(file)` | `resultsFile: string` | `ScanResultEntry[]` | 文件不存在 / JSON 解析失败 → fail |

`groupPath` 推导规则：`rootName + "/" + path.dir`，根目录文件为 `rootName`。

## 8. 数据模型

### 8.1 新格式示例（首次导入，无 memoryId）

```json
{
  "entries": [
    {
      "path": "部署运维/备份恢复.md",
      "groupPath": "wiki/部署运维",
      "summary": "面向LanceDB数据库的备份恢复SOP...",
      "keywords": ["备份", "恢复", "LanceDB", "灾难恢复"],
      "enriched": true
    }
  ]
}
```

### 8.2 增量格式示例（带 memoryId）

```json
{
  "entries": [
    {
      "path": "部署运维/备份恢复.md",
      "groupPath": "wiki/部署运维",
      "summary": "更新后的摘要...",
      "keywords": ["备份", "恢复"],
      "memoryId": "mem_abc123"
    }
  ]
}
```

## 9. 关键流程时序图

无需时序图。格式读取为同步 JSON 解析。

## 10. 异常处理 & 边界情况

| 场景 | 行为 | 是否对外暴露 |
|------|------|-------------|
| `groupPath` 缺失 | 从 `path` 自动推导：`${rootName}/${dirname(path)}` | 否（静默修复） |
| `memoryId` 缺失 | 视为 null，由 S-03 批量向量化后填充 | 否 |
| JSON 格式非法 | fail 并输出具体错误行 | 是 |
| entry 数量为 0 | 正常完成，无导入内容 | 否 |

## 11. 性能 & 安全考虑

无特殊考虑。`ai-results.json` 通常 <100KB，解析耗时可忽略。

## 12. 测试方案

| 类型 | 范围 | 工具 |
|------|------|------|
| 单元测试 | `normalizeAiResults` 新格式解析、旧格式兼容 | `node --test` |
| 边界测试 | `groupPath`/`memoryId` 缺失补全、空 entries | `node --test` |

## 13. 实施计划 / 里程碑

| 批次 | 主题 | 主要产出 | 依赖 |
|------|------|---------|------|
| Batch 1 | 接口扩展 | `ScanResultEntry` 新增字段 | 无 |
| Batch 2 | 解析逻辑 | `normalizeAiResults()` 函数 | Batch 1 |

## 14. 风险 & 待定问题

### 14.1 已知风险

| 风险 | 影响 | 预案 |
|------|------|------|
| AI 推导的 `groupPath` 与约定不一致 | Group 树创建错误 | `groupPath` 提供校验 + 自动修复（去除多余前缀） |

### 14.2 待定问题

- [ ] `groupPath` 校验规则：是否需要严格匹配目录层级？→ 建议宽松处理，允许 AI 自行推导
