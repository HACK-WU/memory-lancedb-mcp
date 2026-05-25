# 知识索引 SKILL

> 为 AI Agent 提供项目知识全景视图，支持快速路径查询、语义检索回退、外部知识库导入。

## 概述

知识索引 SKILL 在记忆系统上层构建「Group 树索引 → Relations 缓存 → 本地 KB」三层文件系统。

- **快速路径**：热门 Relation 直接走本地 JSON（<10ms）
- **检索路径**：冷门 Relation 退化为关键词词云，AI 组装后走语义检索
- **知识补充**：本地 KB 与记忆系统均未命中时，AI 扫描代码后双写
- **外部导入**：预扫描生成摘要+关键词 → 摘要向量化 → 原文导入本地 KB

## 脚本调用方式

所有脚本使用 `npx jiti` 执行，位于 `knowledge-index/scripts/` 目录下。

### 1. manage-index.ts - 索引管理

```bash
# 创建根节点
npx jiti knowledge-index/scripts/manage-index.ts --scope <scope> --action create-root --root-name <name>

# 创建子节点
npx jiti knowledge-index/scripts/manage-index.ts --scope <scope> --action create --parent <path> --name <name>

# 删除节点（非空需 --force）
npx jiti knowledge-index/scripts/manage-index.ts --scope <scope> --action delete --parent <path> --name <name> [--force]
```

**输出**：`{ "ok": true, "path": "..." }`

### 2. query-group.ts - 查询 Group

```bash
# 完整索引树 + 热门索引
npx jiti knowledge-index/scripts/query-group.ts --scope <scope>

# 查询指定 Group 的 Relations + 词云
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --groups <g1,g2>

# 仅热门索引
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --mode hot

# 紧凑树视图（无评分和分区标签）
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --mode compact

# 按分区过滤（hot|warm|cold|emerging|all）
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --partition hot

# 自定义展示参数
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --hot-count 10 --depth 3
```

**参数**：`--groups` 逗号分隔 Group 路径 | `--mode` full/hot/compact/help | `--partition` hot/warm/cold/emerging/all | `--hot-count` 热门展示个数（默认 5）| `--depth` 层级深度（默认 4，上限 10）

### 3. get-module-info.ts - 模块检索

```bash
npx jiti knowledge-index/scripts/get-module-info.ts --scope <scope> --group <group> --relation <relationId>
```

**输出**：Markdown 文本（stdout），错误时 `{ "ok": false, "error": "...", "hint": "..." }`

### 4. sync-relation.ts - 关系回写

```bash
# 单条模式
npx jiti knowledge-index/scripts/sync-relation.ts --scope <scope> --group <group> \
  --relation <text> --module-info <markdown> --keywords <k1,k2>

# 批量模式
npx jiti knowledge-index/scripts/sync-relation.ts --scope <scope> --input <jsonFile>
```

**批量输入格式**：
```json
{
  "items": [
    {
      "group": "项目/API",
      "relation": "用户登录",
      "module_info": "## 登录流程\n...",
      "keywords": ["登录", "认证", "token"]
    }
  ]
}
```

### 5. import-kb.ts - 外部知识库导入

```bash
# 约定模式：目录 → Group，文件名 → Relation
npx jiti knowledge-index/scripts/import-kb.ts --scope <scope> --source <dir> --root-name <name>

# 配置模式：按 JSON mapping 显式控制
npx jiti knowledge-index/scripts/import-kb.ts --scope <scope> --source <dir> \
  --mapping <jsonFile> --root-name <name>

# 配合预扫描关键词复用
npx jiti knowledge-index/scripts/import-kb.ts --scope <scope> --source <dir> \
  --root-name <name> --scan-index <scan-index.json>
```

**Mapping 格式**：
```json
{
  "groups": [
    {
      "path": "API",
      "sources": [
        { "file": "docs/api.md", "relation": "API 文档", "code_refs": ["src/api.ts"] }
      ]
    }
  ]
}
```

### 6. scan-kb.ts - 预扫描与增量扫描

```bash
# 扫描目录，生成待处理文件列表（支持 Git 增量）
npx jiti knowledge-index/scripts/scan-kb.ts scan --scope <scope> --source <dir> --root-name <name>

# 合并 AI 结果到 scan-index.json
npx jiti knowledge-index/scripts/scan-kb.ts scan --scope <scope> --source <dir> \
  --root-name <name> --results <ai-results.json>

# 列出待向量化条目
npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope <scope>

# 标记向量化完成
npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope <scope> --complete <results.json>
```

**AI 结果格式** (`--results`)：
```json
{
  "entries": [
    {
      "path": "docs/api.md",
      "summary": "API 文档摘要\n[路径] docs/api.md",
      "keywords": ["API", "接口", "认证"],
      "enriched": false
    }
  ]
}
```

## 参数说明

| 参数 | 说明 | 脚本 | 必填 |
|------|------|------|------|
| `--scope` | 项目隔离标识（字母、数字、连字符、下划线） | 全部 | 是 |
| `--action` | create / delete / create-root | manage-index | 否（默认 create） |
| `--parent` | 父节点路径 | manage-index | create/delete 时必填 |
| `--name` | 节点名称 | manage-index | create 时必填 |
| `--root-name` | 根节点名称 | manage-index/import-kb/scan-kb | 是 |
| `--force` | 强制删除非空节点 | manage-index | 否 |
| `--groups` | 逗号分隔的 Group 路径列表 | query-group | 否 |
| `--mode` | full / hot / compact / help | query-group | 否（默认 full） |
| `--partition` | hot / warm / cold / emerging / all | query-group | 否（默认 all） |
| `--hot-count` | 热门展示个数 | query-group | 否（默认 5） |
| `--depth` | 索引层级深度（上限 10） | query-group | 否（默认 4） |
| `--group` | Group 路径 | get-module-info/sync-relation | 是 |
| `--relation` | Relation ID 或描述文本 | get-module-info/sync-relation | 是 |
| `--module-info` | Markdown 格式模块信息 | sync-relation | 是 |
| `--keywords` | 逗号分隔关键词 | sync-relation | 是 |
| `--input` | 批量输入 JSON 文件 | sync-relation | 批量模式必填 |
| `--source` | 外部知识库目录 | import-kb/scan-kb | 是 |
| `--mapping` | JSON 映射配置文件 | import-kb | 否 |
| `--scan-index` | scan-index.json 路径 | import-kb/scan-kb | 否 |
| `--results` | AI 返回结果 JSON | scan-kb scan | 合并模式必填 |
| `--complete` | 向量化完成结果 | scan-kb vectorize | 完成模式必填 |
| `--output` | scan-index.json 输出路径 | scan-kb scan | 否 |

## AI Agent 交互流程

### 决策顺序

AI 在回答知识相关问题时，按以下顺序决策：

1. **快速路径**：热门 Relation 直接命中 → 获取模块信息 → 回答
2. **检索路径**：关键词词云匹配 → 语义检索 → 回写 Relation
3. **知识缺失路径**：均未命中 → 暂停询问用户 → 双写
4. **外部导入路径**：批量外部文档 → 预扫描 → 摘要向量化 → 导入

### 快速路径

1. AI 调用 `query-group.ts --groups <group>` 获取热门 Relation + 关键词词云
2. AI 从热门 Relation 中选择匹配项
3. AI 调用 `get-module-info.ts` 获取 Markdown 文本
4. AI 基于模块信息回答用户问题

### 检索路径

1. AI 调用 `query-group.ts` 获取完整索引树和关键词词云
2. AI 用关键词组装语义查询，调用 `memory_recall` 检索记忆系统
3. 命中后 AI 调用 `sync-relation.ts` 回写新 Relation + 模块信息（提升后续访问速度）
4. 同时调用 `memory_store` 双写确保数据持久

### 知识缺失路径

1. AI 发现本地 KB 与记忆系统均未命中
2. AI **必须暂停**，请求用户提供线索（模块名、文件路径、功能描述等）
3. AI 根据用户提示扫描代码，总结为 Relation 描述 + Markdown 模块信息
4. AI 调用 `manage-index.ts` 创建 Group（如需要）
5. AI 调用 `sync-relation.ts` + `memory_store` 双写

### 外部知识库导入

1. **扫描准备**：`scan-kb.ts scan` — 扫描源目录，生成待处理文件列表（自动 Git 增量检测，包含 A/M/D 三类变更）
2. **AI 摘要生成**：AI 读取文件列表，为每个 `.md` 文件生成摘要 + 关键词（含路径标记 `[路径]`），写入结果 JSON
3. **结果合并**：`scan-kb.ts scan --results` — 将 AI 处理结果合并到 scan-index.json
4. **摘要向量化**：`scan-kb.ts vectorize` — 列出待向量化条目；AI 调用 `memory_store` 向量化摘要；`scan-kb.ts vectorize --complete` — 标记完成
5. **原文导入**：`import-kb.ts` — 将原文导入三层索引（Group 树 + Relations 缓存 + 本地 KB）

#### 增量导入（已有导入内容的目录更新）

1. `scan-kb.ts scan` 自动检测 Git diff，区分 A/M/D 三类变更
2. M 类文件重新生成摘要（保留已有 memoryId 供覆盖）
3. D 类文件可配合 `memory_forget` 清理记忆系统中的过期内容
4. Git 不可用时自动退化为全量扫描（输出 warning）

## 异常分支处理

### 参数校验

- `--scope` 含非法字符 → 报错退出，提示合法字符范围
- `--scope` 含路径遍历 `../` → 报错退出，拒绝执行
- `--partition` 无效值 → 报错退出，提示有效值：`hot | warm | cold | emerging | all`
- `--mode` 无效值 → 报错退出，提示有效值：`full | hot | compact | help`
- `--depth` 超过 10 → 自动限制为 10，输出 warning
- `--hot-count` 超过总数 → 显示全部，输出 warning

### 数据异常

- JSON 文件损坏 → 报错退出，提示损坏文件路径和恢复建议
- 新 scope 首次使用 → 自动从 `_template/` 复制初始化
- relations-cache.json 不存在 → 报错退出
- scan-pending.json 不存在（merge 时）→ 报错退出，提示先执行 scan

### 外部导入异常

- `--source` 目录不存在 → 报错退出
- 根节点已存在 → 输出 warning，幂等覆盖更新
- 空 `.md` 文件 → 跳过，输出 warning
- 超大文件（>10MB）→ 跳过，记入 errors + warning
- 非 `.md` 文件 → 跳过，计入 files_skipped
- 缺少 `--scan-index` → 正常导入但关键词为空，输出 warning

### 预扫描异常

- Git 命令执行失败 → 退化为全量扫描，输出 warning
- lastScannedCommit 不存在 → 退化为全量扫描，输出 warning
- vectorize 时 scan-index.json 不存在 → 报错退出，提示先执行 scan
- 空 `.md` 文件（size=0）→ 自动过滤，不计入待处理列表

## 验证建议

AI Agent 在执行知识索引操作后，建议按以下方式验证：

1. **索引结构验证**：`query-group.ts --mode compact` 确认 Group 树结构正确
2. **关键词验证**：`query-group.ts --groups <group>` 查看 Relation 词云，确认关键词质量
3. **内容完整性**：`get-module-info.ts` 检索已写入的模块信息，确认 Markdown 内容完整
4. **幂等性验证**：重复执行写入操作，确认不产生重复数据、不崩溃
5. **scope 隔离验证**：使用不同 scope 执行相同操作，确认数据互不干扰
6. **增量扫描验证**：修改源目录文件后重新 scan，确认 A/M/D 检测正确

## 测试命令

```bash
# 全量测试
npm run test:ki

# 按模块测试
npm run test:ki:manage-index     # 索引管理
npm run test:ki:query-group      # 查询 Group
npm run test:ki:get-module-info  # 模块检索
npm run test:ki:sync-relation    # 关系回写
npm run test:ki:import-kb        # 外部导入
npm run test:ki:scan-kb          # 预扫描
npm run test:ki:lib              # 内部库
npm run test:ki:integration      # 端到端集成
npm run test:ki:error-handling   # 异常处理与边界
npm run test:ki:scope-isolation  # Scope 隔离
npm run test:ki:batch4           # Batch 4 完整测试套件
```

## 数据目录

```
knowledge-index/
├── kb/{scope}/                    # 运行时数据（自动创建）
│   ├── group-index.json           # Group 树索引
│   ├── relations-cache.json       # Relations 缓存 + 分区配置
│   ├── scan-index.json            # 预扫描索引
│   ├── scan-pending.json          # 待处理文件列表
│   ├── {Group}/                   # 按 Group 分层
│   │   └── index.json             # 本地 KB 模块信息
│   ├── archive/                   # 归档数据
│   └── backup/                    # 增量备份
├── _template/                     # 新 scope 初始化模板
│   ├── group-index.json
│   └── relations-cache.json
├── scripts/                       # CLI 脚本
│   ├── manage-index.ts
│   ├── query-group.ts
│   ├── get-module-info.ts
│   ├── sync-relation.ts
│   ├── import-kb.ts
│   ├── scan-kb.ts
│   └── lib/                       # 内部库
│       ├── constants.ts
│       ├── scope.ts
│       ├── scoring.ts
│       ├── store.ts
│       └── wal.ts
├── test/                          # 测试文件（10 个，112 条测试）
├── skills/                        # SKILL 定义
└── README.md                      # 使用说明
```

## 约束

- **Scope 隔离**：仅允许字母、数字、连字符、下划线；禁止路径遍历 `../`；不同 scope 物理隔离
- **关键词规则**：禁止代码符号（类名、方法名、路径等），仅自然语言词汇；关键词必须在原文中出现
- **数据版本**：所有 JSON 文件包含 `version` 字段，当前版本 1
- **WAL 写入**：所有 JSON 文件写入采用临时文件→原子 rename
- **默认根节点**："项目根"不可删除
- **幂等安全**：重复操作不产生副作用（重复导入覆盖更新）
- **快速失败**：输入校验失败立即退出，不静默降级
- **异常恢复**：新 scope 自动从 `_template/` 初始化；Git 不可用时退化为全量扫描
