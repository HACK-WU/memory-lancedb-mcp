# 知识索引 SKILL 设计文档

> - 状态：修订版 v2（基于专家团评审意见重构）
> - 修订时间：2026-05-25
> - 原始草案：2026-05-22
> - 评审报告：`.codebuddy/expert-panel/knowledge-index-skill-review/final-report.md`

## 文档导航

| 编号 | 文件 | 内容 |
|------|------|------|
| 01 | [overview.md](01-overview.md) | 需求背景、目标、范围、术语表、现状分析 |
| 02 | [architecture.md](02-architecture.md) | 方案概述、关键决策、架构图、模块设计、流程时序图 |
| 03 | [data-model.md](03-data-model.md) | 统一数据模型（JSON Schema + version + 约束 + WAL写入） |
| 04 | [scoring.md](04-scoring.md) | 简化评分公式、冷热分区、新兴热区、边界衰减 |
| 05 | [scripts.md](05-scripts.md) | 6个脚本接口定义（含 scan-kb CLI + AI 交互协议） |
| 06 | [display.md](06-display.md) | 索引展示 + Relations/关键词展示（合并） |
| 07 | [external-kb.md](07-external-kb.md) | 外部知识库导入、预扫描、向量化双层架构 |
| 08 | [error-handling.md](08-error-handling.md) | 统一异常处理与边界情况 |
| 09 | [testing.md](09-testing.md) | 测试方案 |
| 10 | [implementation.md](10-implementation.md) | 实施计划、风险、待定问题 |

## 评审结论摘要

**综合评分**：3/5（中等偏上），架构方向正确，核心机制细节需修复。

### 采纳的10项改进（已融入本文档体系）

| 优先级 | 改进项 | 落地文件 |
|--------|--------|----------|
| P0 | 统一评分阈值机制（删除硬编码，用 partition_config 相对排名） | 03, 04, 06 |
| P0 | 乐观锁改 WAL 模式（临时文件→原子 rename） | 03, 08 |
| P0 | 明确 AI Agent 集成方式（scan-kb 保持 CLI + 定义交互协议） | 05, 07 |
| P0 | 添加数据版本控制（version 字段 + 向后兼容策略） | 03 |
| P1 | 边界衰减改为纯函数（返回新对象，不修改输入） | 04 |
| P1 | 冷启动评分优化（简化公式天然消除86倍跳跃） | 04 |
| P1 | 新兴热区过滤导入知识（isImported 不参与新兴热区） | 04 |
| P1 | 统一跨文档数据模型一致性（4处矛盾逐一修订） | 03 |
| P2 | 衰减值改为可配置参数 | 04 |
| P2 | 向量化状态事务性写入 | 03, 07 |

### 用户决策

1. **scan-kb.ts 保持为 CLI 工具**（不改为 MCP 工具），定义 AI Agent 与 CLI 的交互协议
2. **评分公式简化**：从密度评分+活跃度加成+边界衰减 → `score = useCount / (1 + hoursSinceLastUse / halfLifeHours)`

## 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.1 | 2026-05-25 | O8 更新：增量扫描改用 git commit diff；10 个待定问题全部决定；新增 maxWarmCount/maxColdCount；新增 archive/backup 目录 |
| v2 | 2026-05-25 | 基于评审报告重构：文档拆分重组、评分公式简化、10项改进落地 |
| v1 | 2026-05-22 | 初始草案（5份独立文档） |

## 旧文档（已废弃）

以下旧文档已由本目录替代，保留供参考：

- `docs/知识索引SKILL_设计文档.md`
- `docs/外部知识库向量化方案_设计文档.md`
- `docs/评分机制_设计文档.md`
- `docs/索引展示方案_设计文档.md`
- `docs/Relations和关键词展示_设计文档.md`
