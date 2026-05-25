# 03 数据模型

> - 状态：修订版 v2
> - 起草时间：2026-05-25
> - 关联文件：[02-architecture.md](02-architecture.md)、[04-scoring.md](04-scoring.md)、[05-scripts.md](05-scripts.md)
> - 评审改进：P0-数据版本控制、P0-乐观锁改WAL、P1-跨文档一致性、P2-向量化事务写入

## 1. 版本控制策略

所有 JSON 文件均包含 `version` 字段，用于数据模型演进时的向后兼容。

**规则**：
- 新增字段：旧版本读取时忽略未知字段，兼容
- 删除字段：旧版本写入时保留该字段为 null，不丢弃
- 语义变更：递增 version 号，脚本检查 version 后做适配转换
- 当前版本：`1`

## 2. WAL 写入机制

> 替代原有的乐观锁（时间戳检测）机制，评审 P0 改进。

**写入流程**：

1. 读取原文件内容到内存
2. 在内存中修改数据
3. 将修改后的数据写入临时文件 `{filename}.tmp`
4. 执行原子性 `rename("{filename}.tmp", "{filename}")`
5. 如果 rename 失败，临时文件残留，下次启动时清理

**优势**：
- 原子性：rename 是原子操作，不会出现半写状态
- 无时钟依赖：不依赖文件修改时间戳
- 无假阳性冲突：不会因时钟不同步导致误判

**并发处理**：
- 同一 scope 下同一文件的并发写入：由应用层保证串行（脚本执行为同步）
- 不同 scope 的文件：天然隔离，无冲突
- 并发导入：使用拆分合并机制（详见 [07-external-kb.md](07-external-kb.md)）

## 3. Group 树索引

文件路径：`kb/{scope}/group-index.json`

```json
{
  "version": 1,
  "scope": "project-a",
  "roots": {
    "项目根": {
      "部署": {
        "前端": {},
        "后端": {},
        "启动脚本": {}
      },
      "监控": {
        "告警中心": {},
        "日志查询": {},
        "APM查询": {},
        "告警组": {}
      }
    },
    "wiki": {
      "监控": {
        "告警中心": {
          "告警规则CRUD流程": {},
          "通知渠道配置": {}
        }
      },
      "部署": {
        "前端": {},
        "后端": {}
      }
    }
  },
  "updatedAt": "2026-05-25T10:00:00Z"
}
```

**设计要点**：
- `version`：数据模型版本号，当前为 1
- 支持多个根节点（`roots` 对象），每个根节点下独立一棵子树
- 自建知识的默认根节点为"项目根"，导入知识的根节点由 `--root-name` 指定
- 仅存 key（节点名），value 为空对象 `{}`（叶子）或嵌套对象（分支）
- 完整树可一次性塞入 LLM context
- 树深度建议 ≤ 4 层

## 4. Relations 缓存

文件路径：`kb/{scope}/relations-cache.json`

```json
{
  "version": 1,
  "scope": "project-a",
  "partition_config": {
    "hotPercent": 0.3,
    "warmPercent": 0.5,
    "reservedEmerging": 10,
    "recentHours": 48,
    "minHotCount": 1,
    "decayStep": 5,
    "halfLifeHours": 24,
    "maxHotCount": 10,
    "maxWarmCount": 50,
    "maxColdCount": null,
    "maxKeywordCount": 50
  },
  "groups": {
    "项目根/监控/告警中心": {
      "hot_relations": [
        {
          "id": "rel_001",
          "text": "告警规则CRUD流程",
          "score": 5.2,
          "useCount": 8,
          "lastUsedTime": 1716458400000,
          "keywords": ["规则", "阈值", "触发条件"],
          "isImported": false
        },
        {
          "id": "rel_002",
          "text": "通知渠道配置",
          "score": 3.8,
          "useCount": 5,
          "lastUsedTime": 1716454800000,
          "keywords": ["邮件", "短信", "渠道"],
          "isImported": false
        }
      ],
      "word_cloud_keywords": ["静默", "聚合", "升级", "值班表", "分级"],
      "max_hot_count": 10
    },
    "wiki/监控/告警中心": {
      "hot_relations": [
        {
          "id": "rel_101",
          "text": "告警规则CRUD流程",
          "score": 0,
          "useCount": 0,
          "lastUsedTime": null,
          "keywords": ["规则", "阈值", "CRUD", "触发条件"],
          "isImported": true
        }
      ],
      "word_cloud_keywords": [],
      "max_hot_count": 10
    }
  },
  "updatedAt": "2026-05-25T10:00:00Z"
}
```

**设计要点**：
- `version`：数据模型版本号
- `partition_config`：分区配置，统一管理（**评审改进：统一阈值**）
  - 删除硬编码阈值（>=50/20），改用 `hotPercent`/`warmPercent` 相对排名
  - `decayStep`：边界衰减步长，可配置（**评审改进：衰减值可配置**）
  - `halfLifeHours`：评分半衰期，可配置
  - `maxHotCount`：热门 Relation 上限（默认 10）（O4 决策）
  - `maxWarmCount`：常温区 Relation 上限（默认 50，null 表示不限）（O4 决策）
  - `maxColdCount`：冷区 Relation 上限（默认 null，不限）（O4 决策）
  - `maxKeywordCount`：关键词上限（默认 50）
- Group 路径含根节点前缀，确保不同根节点下的同名 Group 不冲突
- `hot_relations` 按 score 降序排列
- `score`：简化评分公式计算（详见 [04-scoring.md](04-scoring.md)）
- `useCount`：有效使用次数（5分钟防刷间隔）
- `lastUsedTime`：最后使用时间戳
- `isImported: true` 的 Relation：score=0、useCount=0、不参与评分淘汰、不参与新兴热区（**评审改进：新兴热区过滤导入知识**）
- 当 `hot_relations` 达到 `max_hot_count` 上限且有新 Relation 加入时，淘汰 score 最低的 Relation → 提取 keywords 合并到 `word_cloud_keywords`
- `word_cloud_keywords` 自动去重，上限 `maxKeywordCount`

## 5. 本地 KB 目录结构

```
kb/
├── project-a/
│   ├── group-index.json          # Group 树索引
│   ├── relations-cache.json      # Relations 缓存
│   ├── scan-index.json           # 预扫描索引
│   ├── archive/                  # 归档数据（O5 决策：保留6个月）
│   │   └── ...
│   ├── backup/                   # 增量备份（O6 决策：每次写入时增量备份）
│   │   └── ...
│   ├── 部署/
│   │   └── index.json            # Relation → Markdown 映射
│   ├── 监控/
│   │   └── index.json
│   └── ...
├── project-b/
│   ├── group-index.json
│   ├── relations-cache.json
│   └── ...
└── _template/                    # 新 scope 初始化模板
    ├── group-index.json
    └── relations-cache.json
```

**归档与备份目录说明**：
- `archive/`：归档数据存储目录，文件格式为 `{filename}.{timestamp}.json`，保留 6 个月后自动清理（O5 决策）
- `backup/`：增量备份存储目录，文件格式为 `{filename}.{ISO8601}.bak.json`，每次写入时自动备份原文件（O6 决策）

**本地 KB index.json** 格式：

```json
{
  "version": 1,
  "告警规则CRUD流程": "# 告警规则CRUD\n\n## 调用链\n1. AlertController.create() → AlertService.validate()\n2. AlertService.create() → AlertRepository.insert()\n\n## 关键模块\n- **AlertController**: src/controllers/alert.ts: AlertController\n- **AlertService**: src/services/alert.ts: AlertService.validate",
  "通知渠道配置": "# 通知渠道配置\n\n## 架构\n通知模块采用策略模式：\n- ChannelFactory 根据 type 创建对应 Channel\n\n## 代码定位\n- src/services/notification.ts: ChannelFactory"
}
```

## 6. 扫描索引文件

文件路径：`kb/{scope}/scan-index.json`

```json
{
  "version": 1,
  "scope": "project-a",
  "rootName": "wiki",
  "sourceDir": "./docs",
  "lastScannedCommit": "a1b2c3d",
  "scannedAt": "2026-05-25T10:00:00Z",
  "entries": [
    {
      "path": "监控/告警中心/告警规则CRUD流程.md",
      "fullPath": "wiki/监控/告警中心/告警规则CRUD流程",
      "summary": "告警中心下的规则管理模块，支持静态/动态阈值规则的创建、查询、更新、删除。规则创建时校验阈值合法性，支持静默聚合和分级触发。\n[路径] docs/监控/告警中心/告警规则CRUD流程.md",
      "keywords": ["规则", "阈值", "CRUD", "触发条件", "静默", "聚合"],
      "enriched": false,
      "vectorized": true,
      "memoryId": "mem_abc123"
    },
    {
      "path": "部署/item-a.md",
      "fullPath": "wiki/部署/item-a",
      "summary": "前端部署流程文档，涵盖 npm 构建、CDN 分发、环境配置和回滚策略。\n[路径] docs/部署/item-a.md",
      "keywords": ["前端", "部署", "CDN", "构建", "回滚"],
      "enriched": true,
      "vectorized": false,
      "memoryId": null
    }
  ],
  "stats": {
    "total": 12,
    "scanned": 12,
    "enriched": 5,
    "vectorized": 10
  }
}
```

**设计要点**：
- `version`：数据模型版本号
- `lastScannedCommit`：上次扫描时的 git commit SHA（**Git 增量扫描关键字段**）
  - 有值 + `--source` 在 git 仓库内 → 增量扫描模式
  - 无值 / `--source` 不在 git 仓库内 → 全量扫描模式
  - 增量扫描完成后自动更新为当前 HEAD commit
- `path`：相对于 --source 的文件路径，用于 import-kb.ts 匹配
- `fullPath`：含根节点前缀的完整 Group 路径
- `summary`：3~5 句总结性描述，最后一行必须包含 `[路径] {relativePath}`
- `keywords`：自然语言关键词，禁止代码符号
- `enriched`：是否读取了文件内容头部来丰富摘要
- `vectorized`：向量化状态（**评审改进：事务性写入**）
  - `false`：未向量化
  - `true`：已向量化
  - 不使用中间状态"vectorizing"，而是在 memory_store 成功后立即 WAL 写入更新
- `memoryId`：记忆系统中的记录 ID

### 向量化状态事务性写入（评审 P2 改进）

**问题**：memory_store 成功但更新 scan-index.json 失败 → 重复向量化

**解决方案**：
1. 调用 memory_store 写入记忆系统
2. 写入成功后，立即将 scan-index.json 中的该条目 `vectorized` 更新为 `true` + 填入 `memoryId`
3. 使用 WAL 写入 scan-index.json（临时文件→原子 rename）
4. 如果 scan-index.json 写入失败，下次 vectorize 时该条目仍为 `false`，会重复调用 memory_store（幂等，记忆系统覆盖写入即可）

## 7. 代码定位符格式

代码定位符用于在模块信息中精确标注源码位置。

**格式规范**：

```
<相对路径>[: <类名>[.<方法名>]]
```

**示例**：

| 代码定位符 | 含义 |
|-----------|------|
| `src/controllers/alert.ts` | 定位到文件 |
| `src/controllers/alert.ts: AlertController` | 定位到文件中的关键类 |
| `src/services/alert.ts: AlertService.validate` | 定位到类中的关键方法 |
| `scripts/deploy-fe.sh` | 定位到脚本文件 |
| `config/notification.yml` | 定位到配置文件 |

**使用规则**：
- 路径必须是相对路径，不以 `/` 开头
- 类名和方法名可选
- 代码定位符写在 Markdown 正文中（如 `## 关键模块` 章节），而非单独字段
- 关键词中禁止使用代码符号

## 8. 约束

| 约束项 | 规则 |
|--------|------|
| Group 名称 | 中文/英文均可，同一层级不可重名 |
| Relation ID | 自动生成（格式 `rel_{自增序号}`），不可手动指定 |
| 本地 KB Markdown 正文 | 无长度限制，建议每段 ≤ 2000 字 |
| 评分范围 | 0 ~ N，无上限，使用简化公式 |
| 代码定位符 | 必须为相对路径，可选附加类名/方法名 |
| 关键词规则 | 禁止代码符号（类名、方法名、路径、文件名等），仅自然语言词汇 |
| 导入知识 | 关键词由预扫描生成并复用；摘要向量化存入记忆系统；原文仅存本地 KB |
| 摘要质量 | 3~5 句总结性描述，涵盖核心职责、关键业务流程、涉及模块 |
| 数据版本 | 所有 JSON 文件包含 version 字段，当前版本 1 |
| WAL 写入 | 所有 JSON 文件写入采用临时文件→原子 rename |
| scope 参数 | 仅允许字母、数字、连字符、下划线，拒绝路径遍历字符 |
| 归档数据 | 存储在 `kb/{scope}/archive/`，保留 6 个月后自动清理（O5 决策） |
| 增量备份 | 每次写入时增量备份到 `kb/{scope}/backup/`（O6 决策） |
| 增量扫描 | 优先使用 git commit diff 检测变更；非 git 仓库退化为全量扫描（O8 更新） |
