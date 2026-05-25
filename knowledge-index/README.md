# 知识索引 (Knowledge Index)

> 在记忆系统上层构建「Group 树索引 → Relations 缓存 → 本地 KB」三层文件系统，为 AI Agent 提供项目知识全景视图。

## 目录

- [快速开始](#快速开始)
- [CLI 命令](#cli-命令)
  - [manage-index — 索引管理](#1-manage-index--索引管理)
  - [query-group — 查询 Group](#2-query-group--查询-group)
  - [get-module-info — 模块检索](#3-get-module-info--模块检索)
  - [sync-relation — 关系回写](#4-sync-relation--关系回写)
  - [import-kb — 外部知识库导入](#5-import-kb--外部知识库导入)
  - [scan-kb — 预扫描与增量扫描](#6-scan-kb--预扫描与增量扫描)
- [工作流](#工作流)
  - [快速路径](#快速路径)
  - [检索路径](#检索路径)
  - [知识缺失路径](#知识缺失路径)
  - [外部导入路径](#外部导入路径)
- [数据目录](#数据目录)
- [测试](#测试)
- [约束与边界](#约束与边界)

## 快速开始

所有脚本使用 `npx jiti` 执行，位于 `knowledge-index/scripts/` 目录下。

```bash
# 1. 初始化索引（创建根节点）
npx jiti knowledge-index/scripts/manage-index.ts \
  --scope my-project \
  --action create-root \
  --root-name "我的项目"

# 2. 创建分组
npx jiti knowledge-index/scripts/manage-index.ts \
  --scope my-project \
  --action create \
  --parent "我的项目" \
  --name "API"

# 3. 写入一条知识
npx jiti knowledge-index/scripts/sync-relation.ts \
  --scope my-project \
  --group "我的项目/API" \
  --relation "用户登录接口" \
  --module-info "## 登录流程\n..." \
  --keywords "登录,认证,token"

# 4. 查询知识
npx jiti knowledge-index/scripts/get-module-info.ts \
  --scope my-project \
  --group "我的项目/API" \
  --relation "用户登录接口"
```

## CLI 命令

### 1. manage-index — 索引管理

管理 Group 树索引节点的创建与删除。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--scope` | string | 是 | - | 项目隔离标识（字母、数字、连字符、下划线） |
| `--action` | string | 否 | `create` | 操作：`create` / `delete` / `create-root` |
| `--parent` | string | 条件 | - | 父节点路径（create/delete 时必填） |
| `--name` | string | 条件 | - | 节点名称（create 时必填） |
| `--root-name` | string | 条件 | - | 根节点名称（create-root 时必填） |
| `--force` | boolean | 否 | `false` | 强制删除非空节点 |

```bash
# 创建根节点
npx jiti knowledge-index/scripts/manage-index.ts \
  --scope <scope> --action create-root --root-name <name>

# 创建子节点
npx jiti knowledge-index/scripts/manage-index.ts \
  --scope <scope> --action create --parent <path> --name <name>

# 删除节点（非空需 --force）
npx jiti knowledge-index/scripts/manage-index.ts \
  --scope <scope> --action delete --parent <path> --name <name> [--force]
```

输出：`{ "ok": true, "path": "..." }` 或 `{ "ok": false, "error": "..." }`

### 2. query-group — 查询 Group

查询 Group 树索引、热门 Relations 列表、关键词词云。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--scope` | string | 是 | - | 项目隔离标识 |
| `--groups` | string | 否 | - | 逗号分隔的 Group 路径列表 |
| `--mode` | string | 否 | `full` | 展示模式：`full` / `hot` / `compact` / `help` |
| `--partition` | string | 否 | `all` | 分区过滤：`hot` / `warm` / `cold` / `emerging` / `all` |
| `--hot-count` | number | 否 | `5` | 热门知识展示个数 |
| `--depth` | number | 否 | `4` | 索引层级深度（上限 10） |

```bash
# 完整索引树 + 热门索引
npx jiti knowledge-index/scripts/query-group.ts --scope <scope>

# 查询指定 Group 的 Relations + 词云
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --groups "项目/API,项目/数据"

# 仅热门索引
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --mode hot

# 紧凑树视图
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --mode compact

# 按分区过滤
npx jiti knowledge-index/scripts/query-group.ts --scope <scope> --partition hot
```

### 3. get-module-info — 模块检索

按 Group 路径 + Relation 名称检索本地 KB 中的详细 Markdown 内容。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--scope` | string | 是 | 项目隔离标识 |
| `--group` | string | 是 | Group 路径（如 `项目/API`） |
| `--relation` | string | 是 | Relation ID（如 `rel_001`）或名称文本 |

```bash
npx jiti knowledge-index/scripts/get-module-info.ts \
  --scope <scope> --group <group> --relation <relation>
```

输出：Markdown 文本（stdout）。错误时输出 `{ "ok": false, "error": "...", "hint": "..." }`。

### 4. sync-relation — 关系回写

将 Relation + 模块信息写入 Relations 缓存和本地 KB。支持单条和批量两种模式。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--scope` | string | 是 | 项目隔离标识 |
| `--group` | string | 单条必填 | Group 路径 |
| `--relation` | string | 单条必填 | Relation 描述文本 |
| `--module-info` | string | 单条必填 | Markdown 格式模块信息 |
| `--keywords` | string | 单条必填 | 逗号分隔关键词列表 |
| `--input` | string | 批量必填 | JSON 批量输入文件路径 |

```bash
# 单条模式
npx jiti knowledge-index/scripts/sync-relation.ts \
  --scope <scope> --group <group> \
  --relation <text> --module-info <markdown> --keywords <k1,k2>

# 批量模式（JSON 文件格式见下方）
npx jiti knowledge-index/scripts/sync-relation.ts \
  --scope <scope> --input <jsonFile>
```

**批量输入格式** (`--input` 文件)：
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

### 5. import-kb — 外部知识库导入

将外部 Markdown 知识库文件导入三层索引。支持约定模式（目录→Group，文件名→Relation）和配置模式（JSON mapping 显式控制）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--scope` | string | 是 | 项目隔离标识 |
| `--source` | string | 是 | 外部知识库根目录路径 |
| `--root-name` | string | 是 | 导入根节点名称（已存在则幂等覆盖更新，会发出警告） |
| `--mapping` | string | 否 | JSON 映射配置文件（提供则进入配置模式） |
| `--scan-index` | string | 否 | scan-index.json 路径，用于复用摘要关键词 |

```bash
# 约定模式：直接按目录结构导入
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> --root-name <name>

# 配置模式：按 JSON mapping 显式控制
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> \
  --mapping <jsonFile> --root-name <name>

# 配合预扫描关键词
npx jiti knowledge-index/scripts/import-kb.ts \
  --scope <scope> --source <dir> \
  --root-name <name> --scan-index <scan-index.json>
```

**Mapping 文件格式**：
```json
{
  "root_name": "可选，提供后会覆盖 --root-name",
  "groups": [
    {
      "path": "API",
      "sources": [
        {
          "file": "docs/api.md",
          "relation": "API 文档",
          "code_refs": ["src/api.ts"]
        }
      ]
    }
  ]
}
```

> 说明：`groups[].path` 是相对 `root_name` 的路径（不包含根名）；若首段与 `root_name` 重名，导入时会发出警告并自动去重，避免双层嵌套。一个 `path` 下可配多个 `sources`，每个对应一个 Relation。

### 6. scan-kb — 预扫描与增量扫描

分为 `scan` 和 `vectorize` 两个子命令。

#### scan 子命令

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--scope` | string | 是 | 项目隔离标识 |
| `--source` | string | 是 | 外部知识库根目录路径 |
| `--root-name` | string | 是 | 导入根节点名称 |
| `--output` | string | 否 | scan-index.json 输出路径（覆盖默认） |
| `--results` | string | 否 | AI 返回结果 JSON，提供则进入合并模式 |

```bash
# 第一步：扫描目录，生成待处理文件列表
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> --source <dir> --root-name <name>

# 第二步：AI 处理文件后，合并结果到索引
npx jiti knowledge-index/scripts/scan-kb.ts scan \
  --scope <scope> --source <dir> --root-name <name> \
  --results <ai-results.json>
```

**AI 结果文件格式** (`--results`)：
```json
{
  "entries": [
    {
      "path": "docs/api.md",
      "summary": "API 文档摘要",
      "keywords": ["API", "接口", "认证"],
      "enriched": false
    }
  ]
}
```

#### vectorize 子命令

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--scope` | string | 是 | 项目隔离标识 |
| `--scan-index` | string | 否 | scan-index.json 路径（覆盖默认） |
| `--complete` | string | 否 | 向量化完成结果文件 |

```bash
# 列出所有待向量化条目
npx jiti knowledge-index/scripts/scan-kb.ts vectorize --scope <scope>

# 标记向量化完成
npx jiti knowledge-index/scripts/scan-kb.ts vectorize \
  --scope <scope> --complete <vectorize-results.json>
```

## 工作流

### 快速路径

热门 Relation 直接从本地 JSON 读取 (<10ms)：

1. AI 调用 `query-group.ts --groups <group>` 获取热门 Relation + 词云
2. AI 选择匹配的 Relation
3. AI 调用 `get-module-info.ts` 获取 Markdown 文本

### 检索路径

冷门 Relation 退化为关键词词云 + 语义检索：

1. AI 调用 `query-group.ts` 获取关键词词云
2. AI 组装关键词，调用 `memory_recall` 语义检索
3. AI 调用 `sync-relation.ts` 回写新 Relation（提升后续访问速度）

### 知识缺失路径

本地 KB 与记忆系统均未命中：

1. AI **暂停**，请求用户提供线索
2. AI 根据用户提示扫描代码，总结为 Relation
3. AI 调用 `manage-index.ts` 创建 Group（如需要）
4. AI 调用 `sync-relation.ts` + `memory_store` 双写

### 外部导入路径

批量导入外部知识库 Markdown 文件：

1. `scan-kb.ts scan` — 扫描目录，生成文件列表（支持 Git 增量扫描）
2. AI 读取文件列表，为每个文件生成摘要 + 关键词，写入结果 JSON
3. `scan-kb.ts scan --results` — 合并 AI 结果到 scan-index.json
4. `scan-kb.ts vectorize` — 列出待向量化条目
5. AI 调用 `memory_store` 向量化摘要
6. `scan-kb.ts vectorize --complete` — 标记向量化完成
7. `import-kb.ts` — 将原文导入三层索引

## 数据目录

```
knowledge-index/
├── kb/{scope}/                    # 运行时数据（自动创建）
│   ├── group-index.json           # Group 树索引
│   ├── relations-cache.json       # Relations 缓存 + 评分
│   ├── scan-index.json            # 预扫描索引
│   ├── scan-pending.json          # 待处理文件列表
│   ├── {Group}/
│   │   └── index.json             # 本地 KB 模块信息
│   ├── archive/                   # 归档数据
│   └── backup/                    # 增量备份
├── _template/                     # 新 scope 初始化模板
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
├── test/                          # 测试文件
└── skills/                        # SKILL 定义
```

## 测试

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

## 约束与边界

- **Scope 隔离**：仅允许字母、数字、连字符、下划线；禁止路径遍历 `../`；不同 scope 物理隔离
- **关键词规则**：仅自然语言词汇，禁止代码符号（类名、方法名、路径等）
- **数据版本**：所有 JSON 文件包含 `version` 字段，当前版本 1
- **WAL 写入**：所有 JSON 写入采用临时文件 → 原子 rename
- **默认根节点**："项目根" 不可删除
- **幂等安全**：重复操作不产生副作用（重复导入覆盖更新）
- **快速失败**：输入校验失败立即退出，不静默降级
- **异常恢复**：运行时数据损坏自动从 `_template/` 恢复
