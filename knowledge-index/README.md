# 知识索引 (Knowledge Index)

> 在父项目记忆系统之上增加一层**可读、可导航、可快速命中**的本地知识索引，为 AI Agent 提供“先本地命中、再语义召回、最后补写回流”的项目知识访问能力。

## 这是什么

`knowledge-index` 不是一个独立的向量数据库，也不是用来替代父项目记忆系统的另一套存储。

它解决的是一个更贴近 Agent 使用体验的问题：

- **父项目记忆系统**擅长语义召回、长期持久化、跨会话记忆治理
- **知识索引**擅长把项目知识组织成 AI 更容易浏览和落地使用的结构化视图

两者组合后，形成一个完整系统：

- **发现层**：父项目记忆系统负责语义检索、长期存储、冷热治理
- **交付层**：`knowledge-index` 负责 Group 导航、热门 Relation 缓存、原文交付

换句话说，父项目更像“**长期记忆引擎**”，而 `knowledge-index` 更像“**面向 Agent 的知识目录与本地交付层**”。

## 文档导航

- **架构与协作关系**：[`docs/architecture.md`](./docs/architecture.md)
- **CLI 参考**：[`docs/cli.md`](./docs/cli.md)
- **scan-kb 子命令详解**（含 `import`、`diff`）：[`docs/scan-kb.md`](./docs/scan-kb.md)
- **外部导入与 `mapping` 示例**：[`docs/import-kb.md`](./docs/import-kb.md)
- **异常处理与恢复建议**：[`docs/error-handling.md`](./docs/error-handling.md)
- **典型工作流**：[`docs/workflows.md`](./docs/workflows.md)
- **设计文档**（S-01~S-06）：[`../docs/knowledge-index/`](../docs/knowledge-index/)

如果你现在最关心 `scan-kb import` 的 `ai-results.json` 格式，请直接看：[`docs/scan-kb.md`](./docs/scan-kb.md)

## 核心概念

| 概念 | 含义 |
|------|------|
| `scope` | 项目隔离标识，不同 scope 物理隔离 |
| `Group` | 知识分组路径，例如 `项目/API`、`项目/前端/状态管理` |
| `Relation` | 某个 Group 下可被检索和命中的知识条目 |
| `module-info` | Relation 对应的 Markdown 原文说明 |
| 热门 Relation | 被频繁访问、优先展示的本地知识 |
| 关键词词云 | 为 AI 组装检索语句提供的自然语言提示 |

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
  --module-info "## 登录流程\n用户输入账号密码后进入认证流程，服务端校验成功后返回 token。" \
  --keywords "登录,认证,token"

# 4. 查询 Group 视图
npx jiti knowledge-index/scripts/query-group.ts \
  --scope my-project \
  --groups "我的项目/API"

# 5. 读取模块原文
npx jiti knowledge-index/scripts/get-module-info.ts \
  --scope my-project \
  --group "我的项目/API" \
  --relation "用户登录接口"
```

## `ai-results.json` 最小示例

如果你只想先知道 `ai-results.json` 长什么样，可以先看这个最小示例：

```json
{
  "meta": {
    "sourceDir": ".qoder/repowiki/zh/content",
    "rootName": "QoderWiki"
  },
  "entries": [
    {
      "path": "核心概念/Scope 隔离机制.md",
      "groupPath": "QoderWiki/核心概念",
      "relation": "Scope 隔离机制",
      "summary": "Scope 隔离通过服务端 scope 注入、agentId 绕过与 wrapper 层 ACL 检查三段式实现。",
      "keywords": ["Scope", "隔离", "访问控制", "ACL", "agentId"],
      "action": "add"
    }
  ]
}
```

更完整的字段说明、校验规则和导入建议见：[`docs/scan-kb.md`](./docs/scan-kb.md)

## 典型工作流

### 本地知识沉淀

1. `manage-index.ts` 创建 Group
2. `sync-relation.ts` 写入模块说明
3. `query-group.ts` 查看导航与热点
4. `get-module-info.ts` 读取原文回答

### 外部知识库导入（推荐：S-04 统一流程）

> 前置条件：**首次使用某个 `scope` 前**，需在 `~/.config/memory-mcp/config.yaml` 注册该 scope，否则 `mem store` 会提示 `Access denied to scope: <scope>`。最小配置：
>
> ```yaml
> scopes:
>   default: "global"
>   definitions:
>     my-project:
>       description: "knowledge-index 项目 scope"
>       acl: ["global", "my-project"]
> ```

#### 首次导入（2 步）

1. AI 生成 `ai-results.json`（顶层 `meta: { sourceDir, rootName }` + `entries[]`）
2. 一条命令完成：

```bash
npx jiti knowledge-index/scripts/scan-kb.ts import \
  --scope my-project \
  --results ai-results.json
```

CLI 内部完成：格式校验 → 批量 `mem store` 向量化 → Group 树创建 → `relations-cache` 写入（含 `memoryId`） → `local KB` 写入 → `group-index.source` 块记录（含 git HEAD commit）。

#### 增量更新（3 步）

1. `scan-kb diff --scope my-project` 输出变更文件列表（含已导入条目的 `memoryId`）
2. AI 根据 diff 处理变更，生成增量 `ai-results.json`（每条带 `action: 'add' | 'modify' | 'delete'`）
3. `scan-kb import --scope my-project --mode incremental --results ai-results.json`

增量语义：

- `add`：新增 → 向量化 + 写入索引
- `modify`：更新 → `mem delete <oldId>` + 重新向量化（拿新 id）+ 替换索引
- `delete`：删除 → `mem delete <oldId>` + 移除索引

### 外部知识库导入（旧流程，仍可用）

旧的 7 步流程仍保留兼容：`scan` → `scan --results` → `vectorize` → `memory_store` → `vectorize --complete` → `import-kb`。`vectorize` 子命令已标记 DEPRECATED，建议迁移到 `import` 子命令。

## 数据目录

```text
knowledge-index/
├── kb/{scope}/                    # 运行时数据（自动创建）
│   ├── group-index.json           # Group 树索引 + source 块（dir/rootName/commit）
│   ├── relations-cache.json       # Relations 缓存 + 评分/分区（含 memoryId/sourcePath）
│   ├── scan-index.json            # [旧流程] 预扫描索引
│   ├── scan-pending.json          # [旧流程] 待处理文件列表
│   ├── {Group}/
│   │   └── index.json             # 本地 KB 模块信息原文
│   ├── archive/                   # 归档数据
│   └── backup/                    # 增量备份
├── _template/                     # 新 scope 初始化模板
├── docs/                          # 拆分后的说明文档
│   ├── architecture.md
│   ├── cli.md
│   ├── import-kb.md
│   ├── scan-kb.md
│   ├── error-handling.md
│   └── workflows.md
├── scripts/                       # CLI 脚本
│   ├── scan-kb.ts                 # 统一入口（import / diff / scan / vectorize）
│   ├── import-kb.ts               # [旧流程] @deprecated
│   ├── manage-index.ts
│   ├── query-group.ts
│   ├── get-module-info.ts
│   ├── sync-relation.ts
│   └── lib/                       # 内部模块
│       ├── ai-results.ts          # S-02: ai-results.json 解析与校验
│       ├── batch-vectorize.ts     # S-03: 批量 mem store + Memory ID 解析
│       ├── import.ts              # S-04: 统一导入 5 阶段流水线
│       ├── diff.ts                # S-05: 增量 diff（git diff -z）
│       ├── incremental.ts         # S-06: 增量导入（add/modify/delete）
│       ├── scope.ts               # scope 路径与 source 块管理
│       ├── scoring.ts             # 评分/分区/词云
│       └── store.ts               # JSON 读写工具
├── test/                          # 测试文件
└── skills/                        # SKILL 定义
```

## 约束与边界

- **Scope 隔离**：仅允许字母、数字、连字符、下划线；禁止路径遍历 `../`；不同 scope 物理隔离
- **关键词规则**：仅自然语言词汇，禁止代码符号（类名、方法名、路径等）；关键词必须真实出现在 `module-info` 原文中，避免随意指定关键词
- **数据版本**：所有 JSON 文件包含 `version` 字段，当前版本 1
- **WAL 写入**：所有 JSON 写入采用临时文件 → 原子 rename
- **默认根节点**：`项目根` 不可删除
- **幂等安全**：重复操作不产生副作用（重复导入覆盖更新）
- **快速失败**：输入校验失败立即退出，不静默降级
- **异常恢复**：运行时数据损坏自动从 `_template/` 恢复

## 一句话总结

`knowledge-index` 和父项目记忆系统不是二选一关系，而是上下分层关系：

- **父项目记忆系统**负责“记得住、搜得到、管得住”
- **knowledge-index** 负责“看得见、找得快、交付原文”

两者配合后，AI 才同时具备：

- **长期记忆能力**
- **项目结构化导航能力**
- **本地快速命中能力**
- **可直接回答的原文交付能力**
