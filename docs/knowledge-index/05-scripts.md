# 05 脚本接口

> - 状态：修订版 v2
> - 起草时间：2026-05-25
> - 关联文件：[03-data-model.md](03-data-model.md)、[04-scoring.md](04-scoring.md)、[07-external-kb.md](07-external-kb.md)
> - 评审改进：P0-scan-kb保持CLI+定义AI交互协议

## 1. 脚本总览

| 脚本 | 语言 | 用途 |
|------|------|------|
| `scripts/query-group.mjs` | JS | 查询 Group：传入 Group 路径，返回热门 Relation + 关键词词云 |
| `scripts/get-module-info.ts` | TS | 模块检索：传入 Relation，从本地 KB 读取 Markdown 文本 |
| `scripts/sync-relation.ts` | TS | 关系回写：接收 AI 提供的 relation + 模块信息 + 关键词，校验关键词，写入缓存 + 本地 KB |
| `scripts/import-kb.ts` | TS | 外部知识库导入：扫描外部目录，按映射规则转换为 Group/Relation 结构 |
| `scripts/scan-kb.ts` | TS | 外部知识库预扫描：扫描目录+标题，生成摘要+关键词，写入 scan-index.json |
| `scripts/manage-index.mjs` | JS | 索引管理：新建/删除 Group 节点 |

## 2. query-group.mjs

```
用法: node scripts/query-group.mjs --scope <scope> [--groups <group1,group2>]
       [--hot-count <count>] [--depth <depth>] [--partition <partition>]
       [--mode <mode>] [--help]

输入:
  --scope       项目隔离标识（必填）
  --groups      逗号分隔的 Group 路径列表（可选，默认返回完整 Group 树）
  --hot-count   热门索引展示个数（可选，默认 5）
  --depth       索引层级深度（可选，默认 4，最大 10）
  --partition   分区过滤：hot | warm | cold | emerging | all（可选，默认 all）
  --mode        展示模式：full | hot | compact | help（可选，默认 full）
  --help        显示帮助信息

输出:
  树形文本格式的索引展示（详见 06-display.md）
```

## 3. get-module-info.ts

```
用法: npx jiti scripts/get-module-info.ts --scope <scope> --group <group> --relation <relationId>

输入:
  --scope     项目隔离标识（必填）
  --group     Group 路径（必填）
  --relation  Relation ID 或名称（必填）

输出 (stdout):
  Markdown 纯文本（模块信息）

行为:
  1. 读取本地 KB index.json
  2. 返回对应 Relation 的 Markdown 文本
  3. 更新 Relation 评分（recordUse）

异常:
  - Relation 不存在 → 返回 null + 提示走检索路径
  - 本地 KB 文件损坏 → 返回错误信息 + 建议从记忆系统同步
```

## 4. sync-relation.ts

支持两种调用模式：**单条模式**（命令行参数）和**批量模式**（JSON 文件输入）。

### 4.1 单条模式

```
用法: npx jiti scripts/sync-relation.ts --scope <scope> --group <group>
       --relation <relationText> --module-info <markdownContent>
       --keywords <keyword1,keyword2,...>

输入:
  --scope        项目隔离标识（必填）
  --group        Group 路径（必填）
  --relation     Relation 描述文本（必填）
  --module-info  AI 对代码的理解总结，完整 Markdown 文本（必填）
  --keywords     逗号分隔的关键词列表（必填）
                 关键词必须在 module-info 原文中真实存在
                 禁止代码符号（类名、方法名、路径等）

行为:
  1. 校验 keywords 真实性（在 module-info 原文中出现）
  2. 校验 keywords 是否包含代码符号
  3. 将 relation + keywords 写入 Relations 缓存（WAL）
  4. 如 hot_relations 达到上限，触发最低分淘汰 → 退化为关键词
  5. 将 module-info 写入本地 KB index.json（WAL）

输出 (JSON):
{ "ok": true, "relation": "告警规则静默聚合", "keywords": ["静默", "聚合", "触发条件"], "invalid_keywords": [], "evicted": null }
```

### 4.2 批量模式

```
用法: npx jiti scripts/sync-relation.ts --scope <scope> --input <jsonFile>

输入:
  --scope   项目隔离标识（必填）
  --input   JSON 文件路径（必填）

JSON 文件格式:
{
  "items": [
    {
      "group": "监控/告警中心",
      "relation": "告警规则CRUD流程",
      "module_info": "# 告警规则CRUD\n\n## 调用链\n1. AlertController.create()...",
      "keywords": ["CRUD", "规则", "阈值", "触发条件"]
    }
  ]
}

行为:
  对 items 中每条记录执行与单条模式相同的逻辑，统一写入后一次性 WAL 持久化。

输出 (JSON):
{
  "ok": true,
  "results": [
    { "relation": "告警规则CRUD流程", "keywords": [...], "invalid_keywords": [], "evicted": null }
  ],
  "total": 2,
  "failed": 0
}
```

## 5. import-kb.ts

支持两种映射模式。导入前建议先执行 `scan-kb.ts` 预扫描。

### 5.1 约定模式（零配置）

```
用法: npx jiti scripts/import-kb.ts --scope <scope> --source <sourceDir>
       --root-name <rootName> [--scan-index <scanIndexFile>]

输入:
  --source        外部知识库根目录路径（必填）
  --scope         项目隔离标识（必填）
  --root-name     导入根节点名称（必填）
  --scan-index    扫描索引文件路径（可选），复用关键词

约定规则:
  - 目录 → Group，文件名 → Relation，文件内容 → 模块信息
  - 关键词从 scan-index 复用，未提供则关键词为空
  - 非 .md 文件跳过

输出 (JSON):
{
  "ok": true,
  "root_name": "wiki",
  "groups_created": 4,
  "relations_imported": 5,
  "files_skipped": 2,
  "errors": []
}
```

### 5.2 配置模式

```
用法: npx jiti scripts/import-kb.ts --scope <scope> --source <sourceDir>
       --mapping <mappingFile> --root-name <rootName> [--scan-index <scanIndexFile>]

映射配置文件格式 (import-mapping.json):
{
  "root_name": "wiki",
  "groups": [
    {
      "path": "监控/告警中心",
      "sources": [
        {
          "file": "alerts/crud-guide.md",
          "relation": "告警规则CRUD流程",
          "code_refs": ["src/controllers/alert.ts: AlertController"]
        }
      ]
    }
  ]
}

配置规则:
  - root_name: 覆盖命令行 --root-name
  - groups[].path: 目标 Group 路径（相对于导入根节点）
  - groups[].sources[].file: 相对于 --source 的文件路径
  - groups[].sources[].relation: 导入后的 Relation 描述文本
  - groups[].sources[].code_refs: 可选，代码定位符列表

输出 (JSON):
{
  "ok": true,
  "root_name": "wiki",
  "groups_created": 2,
  "relations_imported": 4,
  "files_skipped": 0,
  "errors": []
}
```

## 6. scan-kb.ts（CLI + AI 交互协议）

> **评审决策**：scan-kb.ts 保持为 CLI 工具，不改为 MCP 工具。初期不支持流式输出，stdout 一次性输出 JSON（O7 决策）。

分两个子命令：`scan`（生成摘要+关键词）和 `vectorize`（摘要向量化）。

### 6.1 scan 子命令

```
用法: npx jiti scripts/scan-kb.ts scan --scope <scope> --source <sourceDir>
       --root-name <rootName> [--output <outputFile>]

输入:
  --scope       项目隔离标识（必填）
  --source      外部知识库根目录路径（必填）
  --root-name   导入根节点名称（必填）
  --output      扫描索引文件输出路径（可选，默认 kb/{scope}/scan-index.json）

行为:
  1. 检测 --source 是否在 git 仓库内
  2. 如在 git 仓库 + scan-index.json 有 lastScannedCommit → 增量扫描
  3. 如不在 git 仓库 / 无 lastScannedCommit → 全量扫描
  4. 输出结构化 JSON 到 stdout，供 AI Agent 读取判断
  5. AI Agent 生成摘要+关键词后，通过 --results 合并
  6. 写入 scan-index.json（WAL），更新 lastScannedCommit = HEAD

增量扫描逻辑:
  执行 git diff --name-status {lastScannedCommit} HEAD -- {sourceDir}
  - A(新增): 走 AI 交互协议生成摘要+关键词
  - M(修改): 标记 dirty，重新走 AI 交互协议生成新摘要+关键词
  - D(删除): 从 scan-index 移除条目，memory_forget(memoryId)
  - 无变更: 跳过

输出 (JSON):
{
  "ok": true,
  "root_name": "wiki",
  "mode": "incremental",
  "changes": { "added": 2, "modified": 1, "deleted": 0, "unchanged": 10 },
  "total_files": 13,
  "output": "kb/project-a/scan-index.json"
}
```

### 6.2 AI 交互协议

scan-kb.ts 作为 CLI 工具，与 AI Agent 通过 **结构化 JSON + 文件** 交互：

```
┌─────────────┐     stdout: 文件列表JSON      ┌─────────────┐
│  scan-kb.ts │ ─────────────────────────────→ │  AI Agent   │
│  (CLI)      │ ←───────────────────────────── │             │
└─────────────┘     stdin: 摘要+关键词JSON     └─────────────┘
```

**交互流程**：

1. **scan-kb.ts 输出文件列表**：扫描目录后，将文件路径列表以 JSON 格式输出到 stdout
2. **AI Agent 读取判断**：AI 读取文件列表，判断哪些文件需要读取内容头部来丰富摘要
3. **AI Agent 生成摘要**：AI 为每个文件生成 3~5 句摘要 + 自然语言关键词
4. **AI Agent 写入结果**：AI 将摘要+关键词写入临时 JSON 文件
5. **scan-kb.ts 读取结果**：scan-kb.ts 从临时文件读取 AI 生成的摘要+关键词，写入 scan-index.json

**具体协议**：

```bash
# 步骤1：scan-kb.ts 扫描目录，输出文件列表
$ npx jiti scripts/scan-kb.ts scan --scope project-a --source ./docs --root-name wiki
# stdout 输出:
{
  "action": "scan_files",
  "files": [
    { "path": "监控/告警中心/告警规则CRUD流程.md", "filename": "告警规则CRUD流程", "dir": "监控/告警中心" },
    { "path": "部署/item-a.md", "filename": "item-a", "dir": "部署" }
  ]
}
# 同时写入 kb/project-a/scan-pending.json（待AI处理的文件列表）

# 步骤2-4：AI Agent 读取待处理文件，生成摘要，写入结果
# AI 读取 kb/project-a/scan-pending.json
# AI 为每个文件生成摘要+关键词
# AI 将结果写入 kb/project-a/scan-results.json

# 步骤5：scan-kb.ts 合并结果
$ npx jiti scripts/scan-kb.ts scan --scope project-a --source ./docs --root-name wiki --results scan-results.json
# 读取 AI 生成的摘要+关键词，写入 scan-index.json
```

**scan-pending.json 格式**：

```json
{
  "scope": "project-a",
  "rootName": "wiki",
  "sourceDir": "./docs",
  "mode": "incremental",
  "lastScannedCommit": "a1b2c3d",
  "currentCommit": "e4f5g6h",
  "files": [
    {
      "path": "监控/告警中心/新增模块.md",
      "filename": "新增模块",
      "dir": "监控/告警中心",
      "changeType": "A",
      "needsEnrichment": false,
      "content": null
    },
    {
      "path": "部署/item-a.md",
      "filename": "item-a",
      "dir": "部署",
      "changeType": "M",
      "needsEnrichment": true,
      "content": "# item-a\n\n## 概述\n前端部署流程...",
      "previousMemoryId": "mem_xyz789"
    }
  ],
  "deleted": [
    {
      "path": "废弃文档.md",
      "memoryId": "mem_old001",
      "fullPath": "wiki/废弃文档"
    }
  ]
}
```

**scan-results.json 格式**（AI 生成）：

```json
{
  "entries": [
    {
      "path": "监控/告警中心/新增模块.md",
      "summary": "新增的监控模块，提供实时指标采集和聚合能力。\n[路径] docs/监控/告警中心/新增模块.md",
      "keywords": ["监控", "指标", "采集", "聚合"],
      "enriched": false
    },
    {
      "path": "部署/item-a.md",
      "summary": "前端部署流程文档，涵盖 npm 构建、CDN 分发、环境配置和回滚策略。\n[路径] docs/部署/item-a.md",
      "keywords": ["前端", "部署", "CDN", "构建", "回滚"],
      "enriched": true,
      "replaces": "mem_xyz789"
    }
  ]
}
```

> **增量模式说明**：`replaces` 字段指示该条目覆盖旧记忆（M 类变更），vectorize 时会用同一 memoryId 覆盖写入。D 类删除在 scan-kb.ts 收到 --results 时自动执行 `memory_forget` + 清理 scan-index 条目 + 清理本地 KB。

### 6.3 vectorize 子命令

```
用法: npx jiti scripts/scan-kb.ts vectorize --scope <scope>
       [--scan-index <scanIndexFile>]

输入:
  --scope        项目隔离标识（必填）
  --scan-index   扫描索引文件路径（可选，默认 kb/{scope}/scan-index.json）

行为:
  1. 读取 scan-index.json
  2. 筛选 vectorized: false 的条目（含增量 M 类变更重置的条目）
  3. 对每条摘要调用 memory_store 写入记忆系统
     - 有 memoryId 的条目：覆盖写入（增量 M 类变更）
     - 无 memoryId 的条目：新建写入（A 类新增）
  4. 写入成功后更新 vectorized: true + memoryId（WAL）

输出 (JSON):
{
  "ok": true,
  "vectorized": 10,
  "updated": 1,
  "skipped": 2,
  "errors": []
}

字段说明:
  vectorized  新建写入数（A 类新增，无 memoryId）
  updated     覆盖写入数（M 类变更，有 memoryId，同 ID 覆盖）
  skipped     已向量化跳过的条目数
  errors      失败的条目列表
```

## 7. manage-index.mjs

```
用法: node scripts/manage-index.mjs --scope <scope> [--action create|delete|create-root]
       [--parent <parentPath>] [--name <nodeName>] [--root-name <rootName>]

输入:
  --scope      项目隔离标识（必填）
  --action     操作：create（默认）| delete | create-root
  --parent     父节点路径（create/delete 时必填）
  --name       新节点名称（create 时必填）
  --root-name  新根节点名称（create-root 时必填）

输出 (JSON):
{ "ok": true, "path": "监控/告警中心" }

约束:
  - 默认根节点"项目根"不可删除
  - 删除非空节点需二次确认
  - 所有写入使用 WAL 机制
```
