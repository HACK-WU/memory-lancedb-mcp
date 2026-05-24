# 代码上下文索引

## 项目概述
这是一个知识索引系统（knowledge-index-skill），为AI智能体提供项目知识导航、检索和缓存能力。系统基于memory-lancedb-pro构建，包含Group树索引、Relations缓存、本地知识库三层架构。

## 相关设计文档

| 文档 | 路径 | 内容说明 | 评审相关度 |
|------|------|---------|-----------|
| 知识索引SKILL_设计文档.md | docs/知识索引SKILL_设计文档.md | 主设计文档，包含需求背景、目标、架构、模块设计、接口设计、数据模型、流程时序图等 | 高 |
| 评分机制_设计文档.md | docs/评分机制_设计文档.md | 评分算法、冷热分区机制、边界衰减、新兴热区设计 | 高 |
| 索引展示方案_设计文档.md | docs/索引展示方案_设计文档.md | 索引展示格式、树形文本格式、参数控制、交互流程 | 中 |
| Relations和关键词展示_设计文档.md | docs/Relations和关键词展示_设计文档.md | Relations和关键词的展示格式、参数控制 | 中 |
| 外部知识库向量化方案_设计文档.md | docs/外部知识库向量化方案_设计文档.md | 外部知识库预扫描、摘要生成、向量化流程 | 中 |

## 核心架构组件

1. **GroupIndexManager** - Group树的增删查
2. **RelationCache** - Relations缓存的读写、评分更新、淘汰逻辑
3. **KnowledgeBaseStore** - 本地KB的读取和写入
4. **QueryRouter** - 双路径路由（快速路径/检索路径）
5. **ScoreEngine** - 评分计算、边界衰减、新兴热区保留席位
6. **KbImporter** - 外部知识库导入
7. **KbScanner** - 外部知识库预扫描
8. **SyncRelationScript** - 关系回写脚本

## 关键数据流

1. **快速路径**：AI查询 → Group索引 → Relations缓存 → 本地KB → 返回Markdown
2. **检索路径**：AI查询 → 关键词组装 → memory_recall → 语义检索 → 回写缓存
3. **知识缺失路径**：本地+记忆均未命中 → AI暂停 → 用户提示 → 扫描总结 → 双写
4. **外部知识库导入**：预扫描 → 摘要向量化 → 导入本地KB

## 技术栈
- TypeScript/JavaScript
- JSON文件存储
- MCP协议集成
- jiti运行时执行