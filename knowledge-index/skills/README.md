# 知识索引 Skills

> 按场景拆分的知识索引操作指南，Agent 按需加载。

## Skills 列表

| Skill | 场景 | 频率 | 核心能力 |
|-------|------|------|---------|
| **knowledge-index-query** | 知识库查询 | 高（日常） | 快速路径 + 检索路径 + 知识缺失路径 |
| **knowledge-index-import** | 外部知识库首次导入 | 低（项目初始化） | scan → AI摘要 → vectorize → import |
| **knowledge-index-incremental** | 外部知识库增量更新 | 中（文档迭代） | Git diff → A/M/D → 部分更新 |
| **knowledge-index-manage** | 索引结构管理 | 低（手动操作） | Group/Relation CRUD |

## 使用方式

Agent 根据用户请求自动加载对应的 skill：

```
用户提问 → 加载 knowledge-index-query
用户请求导入 → 加载 knowledge-index-import
用户请求更新 → 加载 knowledge-index-incremental
用户请求创建Group → 加载 knowledge-index-manage
```

## 三层架构基础

所有 skill 共享的三层文件系统：

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Group 树索引 (group-index.json)          │
│  - 层级导航：项目根 → 子Group → ...                 │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: Relations 缓存 (relations-cache.json)    │
│  - 热门 Relation 列表 + 评分 + 冷热分区             │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3: 本地 KB (index.json)                     │
│  - Markdown 模块信息全文                            │
└─────────────────────────────────────────────────────┘
```

## MCP 工具配合

所有 skill 需要配合父项目的 MCP 工具：

| MCP 工具 | 使用场景 | Skill |
|---------|---------|-------|
| `memory_recall` | 检索路径：语义检索 | query |
| `memory_store` | 向量化摘要 | import, incremental |
| `memory_forget` | D 类文件清理 | incremental |

## 目录结构

```
knowledge-index/skills/
  ├── knowledge-index-query/
  │   └── SKILL.md
  ├── knowledge-index-import/
  │   └── SKILL.md
  ├── knowledge-index-incremental/
  │   └── SKILL.md
  ├── knowledge-index-manage/
  │   └── SKILL.md
  └── README.md
```

## 相关文档

- 设计文档：`docs/knowledge-index/`（10 篇）
- 脚本目录：`knowledge-index/scripts/`
- 测试覆盖：`knowledge-index/test/`（10 个测试文件）
