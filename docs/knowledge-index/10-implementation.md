# 10 实施计划、风险与待定问题

> - 状态：修订版 v2.3
> - 起草时间：2026-05-25
> - 关联文件：[02-architecture.md](02-architecture.md)、[05-scripts.md](05-scripts.md)
> - 评审改进：P0-数据版本控制、P0-WAL写入、P0-AI交互协议

## 0. 技术约定

### 0.1 独立目录结构

本 SKILL 后续计划独立为单独仓库，因此所有产出代码（脚本、测试、模板、AI 指令文件）统一放在项目根目录下的 `knowledge-index/` 目录中，与 `docs/` 同级。设计文档保留在 `docs/knowledge-index/` 不动。

```
mcp-wrapper/
├── docs/knowledge-index/       # 设计文档（当前，不动）
├── knowledge-index/            # 产出代码（新建，后续独立仓库）
│   ├── scripts/
│   │   ├── lib/                # 共享模块
│   │   ├── manage-index.ts
│   │   ├── query-group.ts
│   │   ├── get-module-info.ts
│   │   ├── sync-relation.ts
│   │   ├── import-kb.ts
│   │   └── scan-kb.ts
│   ├── test/                   # 测试代码
│   ├── _template/              # 新 scope 初始化模板
│   ├── kb/                     # 运行时数据（gitignore）
│   └── skills/                 # AI 指令文件
│       └── knowledge-index/
│           └── SKILL.md
├── src/                        # 现有代码（不动）
└── test/                       # 现有测试（不动）
```

### 0.2 脚本执行方式

所有脚本统一使用 `.ts` 编写，通过 `npx jiti` 直接执行（项目已有 jiti 依赖）。不编译为 JS，不集成到 `bin/mem.mjs` CLI。

**理由**：脚本面向 AI Agent 调用，不是面向终端用户；独立脚本便于 Agent 按需调用，无需理解 commander 子命令体系。

**调用示例**：
```bash
npx jiti knowledge-index/scripts/manage-index.ts --scope project-a --action create ...
npx jiti knowledge-index/scripts/query-group.ts --scope project-a --groups 监控/告警中心
```

### 0.3 共享模块层

6 个脚本共享 WAL 写入、scope 校验、JSON 读写等公共逻辑，统一放在 `knowledge-index/scripts/lib/` 下：

```
knowledge-index/scripts/lib/
├── wal.ts            # WAL 写入（tmp→rename）+ 残留清理
├── scope.ts          # scope 校验（非法字符/路径遍历）+ kb 路径构造
├── store.ts          # JSON 读写 + version 检查 + _template 初始化 + kb/ 首次创建
├── scoring.ts        # 评分引擎（calculateScore + recordUse + hybridPartition + boundaryDecay）
└── constants.ts      # 默认 partition_config、maxUseCount、minRecordInterval 等常量
```

### 0.4 测试策略

每个 Batch 自带对应单元测试，不推迟到最终批次。测试文件放在 `knowledge-index/test/` 下，使用 Node.js test runner。

## 1. 实施批次

### Batch 1：基础设施与共享模块

**目标**：建立数据基础、共享模块层、第一个可运行脚本

**主要产出**：
- `knowledge-index/scripts/lib/wal.ts`（WAL 写入 + 残留清理）
- `knowledge-index/scripts/lib/scope.ts`（scope 校验 + 路径构造）
- `knowledge-index/scripts/lib/store.ts`（JSON 读写 + version 检查 + `_template/` 初始化 + `kb/` 首次创建）
- `knowledge-index/scripts/lib/scoring.ts`（评分引擎：`calculateScore` + `recordUse` + `hybridPartition` + `boundaryDecay`）
- `knowledge-index/scripts/lib/constants.ts`（默认 partition_config 等常量）
- `knowledge-index/scripts/manage-index.ts`（Group 树 CRUD）
- `knowledge-index/_template/` 初始化文件（group-index.json + relations-cache.json）
- `knowledge-index/test/lib.test.ts`（WAL、scope、scoring 单元测试）
- `knowledge-index/test/manage-index.test.ts`（Group 树操作测试）
- `knowledge-index/skills/knowledge-index/SKILL.md`（AI 指令文件初稿，后续迭代完善）

**依赖**：无

**验证标准**：
- manage-index 可创建/删除/查询 Group 节点
- JSON 文件包含 version=1
- WAL 写入后读取数据一致
- 临时文件残留可自动清理
- scope 校验拒绝非法字符和路径遍历
- 评分公式正确：`score = useCount / (1 + hoursSinceLastUse / halfLifeHours)`
- 边界衰减为纯函数，不修改输入
- hybridPartition 正确执行相对排名分区 + 上限截断

### Batch 2：核心查询链路

**目标**：实现查询、回写、缓存淘汰全链路

**主要产出**：
- `knowledge-index/scripts/query-group.ts`（查询 + 词云生成 + 新兴热区展示 + 格式化输出）
- `knowledge-index/scripts/get-module-info.ts`（本地 KB 读取 + 评分更新）
- `knowledge-index/scripts/sync-relation.ts`（回写 + 关键词校验 + 批量模式）
- Relations 缓存淘汰逻辑（复用 `knowledge-index/scripts/lib/scoring.ts`）
- `knowledge-index/test/query-group.test.ts`
- `knowledge-index/test/get-module-info.test.ts`
- `knowledge-index/test/sync-relation.test.ts`

**依赖**：Batch 1

**验证标准**：
- 快速路径端到端延迟 < 10ms
- isImported 的 Relation 不参与新兴热区
- 批量模式中单条失败不中断其余
- 关键词真实性校验 + 代码符号校验正确
- 淘汰 Relation 退化为关键词加入 word_cloud
- 展示格式符合 [06-display.md](06-display.md) 规范

### Batch 3a：外部知识库导入

**目标**：实现 import-kb 导入全流程

**主要产出**：
- `knowledge-index/scripts/import-kb.ts`（约定模式 + 配置模式 + 关键词复用）
- `knowledge-index/test/import-kb.test.ts`

**依赖**：Batch 1, 2

**验证标准**：
- 导入幂等：重复导入不产生重复 Relation
- 导入知识 isImported=true，不参与新兴热区
- 约定模式零配置导入成功
- 配置模式自定义映射正确
- 关键词从 scan-index 复用，未提供时为空
- 超大文件（>10MB）跳过并记录警告

### Batch 3b：预扫描与增量扫描

**目标**：实现 scan-kb 预扫描、向量化、git 增量扫描全流程

**主要产出**：
- `knowledge-index/scripts/scan-kb.ts`（scan + vectorize 子命令 + AI 交互协议 + git 增量扫描）
- scan-index.json 读写 + 向量化状态事务性写入
- `knowledge-index/test/scan-kb.test.ts`（含增量扫描 A/M/D 测试 + 非 git 退化测试）

**依赖**：Batch 1, 2

**验证标准**：
- scan 子命令输出结构化 JSON 到 stdout
- AI 交互协议完整可用（pending → results → merge）
- vectorize 增量处理仅 vectorized=false 的条目
- vectorize 对有 memoryId 的条目执行覆盖写入
- git 仓库增量扫描：A/M/D 变更正确检测和处理
- 非 git 仓库自动退化为全量扫描
- lastScannedCommit 正确更新
- D 类变更自动执行 memory_forget + 清理

### Batch 4：集成测试与交付

**目标**：端到端集成测试、边界测试、使用文档

**主要产出**：
- 集成测试（快速路径、检索路径、知识缺失路径、导入路径）
- 边界测试（损坏 JSON、空数据、非法参数）
- 隔离测试（scope 物理隔离）
- 增量扫描端到端测试（git diff A/M/D 全流程）
- 使用文档与示例
- `knowledge-index/skills/knowledge-index/SKILL.md` 最终版

**依赖**：Batch 1, 2, 3a, 3b

**验证标准**：
- 测试覆盖率 > 80%
- 集成测试全路径通过
- 所有 [08-error-handling.md](08-error-handling.md) 中的场景有对应测试
- SKILL.md 经实际 AI Agent 调用验证

## 2. 批次依赖关系

```
Batch 1 ──→ Batch 2 ──→ Batch 3a ──→ Batch 4
  │              │                      ↑
  │              └──→ Batch 3b ─────────┘
  │                     ↑
  └─────────────────────┘
```

**关键路径**：Batch 1 → Batch 2 → Batch 3b → Batch 4（scan-kb.ts 最复杂，是关键路径）

**并行机会**：Batch 3a 和 Batch 3b 可并行开发（均依赖 Batch 1+2，互不依赖）

## 3. 已知风险

| # | 风险 | 影响 | 概率 | 预案 |
|---|------|------|------|------|
| R1 | 本地 KB 与记忆系统内容不一致 | AI 获取到过期模块信息 | 中 | 自动同步机制：Agent 发现记忆不存在时自动同步 |
| R2 | Relations 缓存 JSON 持续膨胀 | 文件过大导致读取变慢 | 低 | 冷热分区 + 分区数量限制 + 冷区超限删除 |
| R3 | 淘汰 Relation 退化为关键词，AI 构造低质量查询 | 检索命中率下降 | 中 | 关键词上限 50 个，超量淘汰最低频词 |
| R4 | 预扫描摘要质量不稳定 | 语义检索匹配质量下降 | 中 | AI 渐进式判断补充内容头部；人工可修正 scan-index.json |
| R5 | scan-kb.ts AI 交互协议复杂度 | 实施和调试成本高 | 中 | 先实现最小可用协议（仅 stdout JSON 输出），迭代增加功能 |
| R6 | 评分参数不适配所有项目规模 | 小项目和大项目行为差异大 | 中 | partition_config 可配置；提供推荐默认值 |
| R7 | 并发导入合并冲突 | 数据丢失或重复 | 低 | 拆分合并机制 + 锁 + 幂等设计 |
| R8 | 数据备份失败 | 知识库丢失后无法恢复 | 低 | 定期备份 + 失败告警 |

## 4. 待定问题（Open Questions）

| # | 问题 | 影响范围 | 决策 | 决策状态 |
|---|------|---------|------|---------|
| O1 | halfLifeHours 默认值 | 评分衰减速度 | 默认值 24，后续按需调整 | ✅ 已决定 |
| O2 | 新兴热区保留席位数（reservedEmerging） | 新内容可见性 | 默认 10；大项目可通过 partition_config 调大 | ✅ 已决定 |
| O3 | decayStep 默认值 | 边界衰减力度 | 默认 5；按项目规模推荐 3（小）/5（中）/8（大），通过 partition_config 配置 | ✅ 已决定 |
| O4 | 热区/常温区最大数量限制 | 存储上限 | 使用 `partition_config.maxHotCount` / `maxWarmCount` / `maxColdCount` 配置 | ✅ 已决定 |
| O5 | 归档数据存储位置和保留时长 | 存储空间 | 归档到 `kb/{scope}/archive/`，保留 6 个月 | ✅ 已决定 |
| O6 | 数据备份频率和存储位置 | 运维成本 | 每次写入时增量备份到 `kb/{scope}/backup/` | ✅ 已决定 |
| O7 | scan-kb.ts AI 交互协议是否支持流式输出 | 大文件列表场景 | 初期不支持，stdout 一次性输出 JSON | ✅ 已决定 |
| O8 | 增量扫描变更检测机制 | 增量扫描 | 使用 git commit diff 检测 A/M/D 变更，非 git 仓库退化为全量扫描 | ✅ 已决定 |
| O9 | 摘要质量是否需要人工抽检机制 | 摘要准确性 | 初期纯 AI 判断；上线后根据反馈决定是否引入人工抽检 | ✅ 已决定 |
| O10 | 关键词是否允许技术术语白名单 | 语义检索精度 | 初期禁止代码符号；后续可增加白名单机制 | ✅ 已决定 |

## 5. 评审改进追踪

以下为评审报告中 10 项采纳改进的实施映射：

| # | 改进项 | 优先级 | 实施批次 | 目标文件 |
|---|--------|--------|---------|---------|
| 1 | 乐观锁改为 WAL 模式 | P0 | Batch 1（scripts/lib/wal.ts） | [03-data-model.md](03-data-model.md) §2 |
| 2 | 统一评分阈值机制 | P0 | Batch 1（scripts/lib/scoring.ts） | [04-scoring.md](04-scoring.md) §3 |
| 3 | 边界衰减改为纯函数 | P1 | Batch 1（scripts/lib/scoring.ts） | [04-scoring.md](04-scoring.md) §4 |
| 4 | scan-kb.ts 保持 CLI + AI 交互协议 | P0 | Batch 3b | [05-scripts.md](05-scripts.md) §5 |
| 5 | 添加数据版本控制 | P0 | Batch 1（scripts/lib/store.ts） | [03-data-model.md](03-data-model.md) §1 |
| 6 | 冷启动评分优化 | P1 | Batch 1（scripts/lib/scoring.ts） | [04-scoring.md](04-scoring.md) §2.3 |
| 7 | 新兴热区过滤导入知识 | P1 | Batch 1（scripts/lib/scoring.ts） | [04-scoring.md](04-scoring.md) §3.2 |
| 8 | 并发导入拆分合并策略 | P1 | Batch 3a | [07-external-kb.md](07-external-kb.md) §6 |
| 9 | 向量化状态事务性写入 | P2 | Batch 3b | [07-external-kb.md](07-external-kb.md) §3.3 |
| 10 | 跨文档数据模型一致性 | P1 | Batch 1-3 | 全部文档统一修订 |

## 6. 旧文档废弃说明

以下原始文档已被本目录下的新文档替代，不再维护：

| 旧文档 | 替代为 |
|--------|--------|
| `docs/知识索引SKILL_设计文档.md` | 01~10 全系列 |
| `docs/评分机制_设计文档.md` | 04-scoring.md |
| `docs/外部知识库向量化方案_设计文档.md` | 07-external-kb.md |
| `docs/索引展示方案_设计文档.md` | 06-display.md |
| `docs/Relations和关键词展示_设计文档.md` | 06-display.md |
| `docs/评分机制更新总结.md` | 已合并至 04-scoring.md |
| `docs/评分机制和新兴热区更新总结.md` | 已合并至 04-scoring.md |

## 7. 修订历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-05-22~24 | 原始5份设计文档 |
| v2 | 2026-05-25 | 重组为10文件体系；采纳评审10项改进；简化评分公式；scan-kb.ts 保持 CLI；新增数据版本控制与 WAL 机制 |
| v2.1 | 2026-05-25 | O8 更新：增量扫描改用 git commit diff（非 fileHash）；10 个待定问题全部决定；新增 maxWarmCount/maxColdCount；新增 archive/backup 目录 |
| v2.2 | 2026-05-25 | 实施计划重构：新增§0技术约定（共享模块层、脚本执行方式、测试策略）；Batch 3 拆分为 3a（import-kb）+ 3b（scan-kb）；每个 Batch 自带测试；评分引擎提前到 Batch 1；统一 .ts + jiti 执行 |
| v2.3 | 2026-05-25 | 产出代码独立目录：所有脚本、测试、模板、SKILL.md 统一放在 `knowledge-index/` 目录下（与 docs/ 同级），为后续独立仓库做准备 |
