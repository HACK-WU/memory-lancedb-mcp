# S-05 文档迁移 设计文档

> 状态：草案
> 创建时间：2026-06-03

## 1. 术语

| 术语 | 定义 |
|------|------|
| SKILL | AI Agent 技能定义文件 |
| 路径引用 | 文档中指向脚本、配置文件的路径 |
| 相对路径 | 相对于当前文件的路径 |
| 绝对路径 | 从根目录开始的完整路径 |

## 2. 现状（AS-IS）

**文档结构**：
```
knowledge-index/
├── README.md                           # 主文档
├── docs/                               # 拆分后的说明文档
│   ├── architecture.md                 # 架构与协作关系
│   ├── cli.md                          # CLI 参考
│   ├── error-handling.md               # 异常处理与恢复建议
│   ├── import-kb.md                    # 外部导入与 mapping 示例
│   ├── scan-kb.md                      # scan-kb 子命令详解
│   └── workflows.md                    # 典型工作流
└── skills/                             # AI Agent SKILL 定义
    ├── README.md
    ├── knowledge-index-build/SKILL.md
    ├── knowledge-index-query/SKILL.md
    ├── knowledge-index-manage/SKILL.md
    ├── knowledge-index-update/SKILL.md
    └── knowledge-index-verify/SKILL.md
```

**路径引用示例**：

README.md 中的路径引用：
```markdown
# 文档导航
- **架构与协作关系**：[`docs/architecture.md`](./docs/architecture.md)
- **CLI 参考**：[`docs/cli.md`](./docs/cli.md)
- **scan-kb 子命令详解**：[`docs/scan-kb.md`](./docs/scan-kb.md)

# 快速开始
npx jiti knowledge-index/scripts/manage-index.ts --scope my-project --action create-root --root-name "我的项目"
```

SKILL.md 中的路径引用：
```markdown
# 命令
npx jiti knowledge-index/scripts/scan-kb.ts import --scope <scope> --results ai-results.json
```

## 3. 方案（TO-BE）

### 3.1 迁移策略

**直接复制 + 路径更新**：复制所有文档文件，更新路径引用。

**迁移清单**：

| 源路径 | 目标路径 | 操作 |
|--------|----------|------|
| `knowledge-index/README.md` | `knowledge-indexer/README.md` | 复制 + 更新路径 |
| `knowledge-index/docs/*.md` | `knowledge-indexer/docs/*.md` | 复制 |
| `knowledge-index/skills/` | `knowledge-indexer/skills/` | 复制 + 更新路径 |

### 3.2 路径更新清单

**需要更新的路径引用**：

1. **README.md** 中的脚本路径：
   ```markdown
   # 旧路径
   npx jiti knowledge-index/scripts/manage-index.ts
   
   # 新路径
   npx jiti scripts/manage-index.ts
   # 或
   npm run manage-index --
   ```

2. **SKILL.md** 中的脚本路径：
   ```markdown
   # 旧路径
   npx jiti knowledge-index/scripts/scan-kb.ts import
   
   # 新路径
   npx jiti scripts/scan-kb.ts import
   # 或
   npm run scan-kb -- import
   ```

3. **docs/*.md** 中的相对路径：
   ```markdown
   # 旧路径（相对 knowledge-index/）
   [`docs/scan-kb.md`](./docs/scan-kb.md)
   
   # 新路径（相对 knowledge-indexer/）
   [`docs/scan-kb.md`](./docs/scan-kb.md)
   ```
   **结论**：相对路径无需调整，因为目录结构保持一致。

### 3.3 文档内容更新

**README.md 需要更新的内容**：

1. **项目标题和描述**：
   ```markdown
   # 旧
   # 知识索引 (Knowledge Index)
   
   # 新
   # Knowledge Indexer - AI 知识索引整理工具
   ```

2. **安装说明**：
   ```markdown
   # 新增安装步骤
   ## 安装
   
   ```bash
   # 克隆项目
   git clone <repository-url>
   cd knowledge-indexer
   
   # 安装依赖
   npm install
   
   # 验证安装
   npm run manage-index -- --help
   ```
   ```

3. **使用说明**：
   ```markdown
   # 更新使用示例
   ## 快速开始
   
   ```bash
   # 1. 初始化索引（创建根节点）
   npm run manage-index -- --scope my-project --action create-root --root-name "我的项目"
   
   # 2. 创建分组
   npm run manage-index -- --scope my-project --action create --parent "我的项目" --name "API"
   
   # 3. 写入一条知识
   npm run sync-relation -- --scope my-project --group "我的项目/API" --relation "用户登录接口" --module-info "## 登录流程\n..." --keywords "登录,认证,token"
   
   # 4. 查询 Group 视图
   npm run query-group -- --scope my-project --groups "我的项目/API"
   
   # 5. 读取模块原文
   npm run get-module-info -- --scope my-project --group "我的项目/API" --relation "用户登录接口"
   ```
   ```

4. **前置条件**：
   ```markdown
   ## 前置条件
   
   1. **全局安装 `mem` 命令**：
      ```bash
      npm install -g memory-lancedb-mcp
      ```
   
   2. **配置嵌入 API**：确保 `~/.config/memory-mcp/config.yaml` 中已配置嵌入 API 密钥。
   
   3. **注册 scope**：首次使用某个 scope 前，需在配置文件中注册该 scope。
   ```

### 3.4 SKILL.md 更新

**所有 SKILL.md 文件需要更新**：

1. **knowledge-index-build/SKILL.md**：
   ```markdown
   # 旧命令
   npx jiti knowledge-index/scripts/scan-kb.ts import --scope <scope> --results ai-results.json
   
   # 新命令
   npx jiti scripts/scan-kb.ts import --scope <scope> --results ai-results.json
   # 或
   npm run scan-kb -- import --scope <scope> --results ai-results.json
   ```

2. **knowledge-index-update/SKILL.md**：
   ```markdown
   # 旧命令
   npx jiti knowledge-index/scripts/scan-kb.ts diff --scope <scope>
   
   # 新命令
   npx jiti scripts/scan-kb.ts diff --scope <scope>
   # 或
   npm run scan-kb -- diff --scope <scope>
   ```

3. **其他 SKILL.md**：类似更新。

## 4. 影响范围

| 影响项 | 影响程度 | 说明 |
|--------|----------|------|
| README.md | 中 | 需要更新项目描述、安装说明、使用示例 |
| docs/*.md | 低 | 相对路径无需调整 |
| skills/*.md | 中 | 需要更新脚本路径引用 |
| 路径格式 | 低 | 从 `knowledge-index/scripts/` 改为 `scripts/` |

## 5. 关键决策点

### 决策 1：是否需要更新文档中的路径格式？

**备选方案**：
- A. 使用相对路径：`scripts/scan-kb.ts`
- B. 使用 npm scripts：`npm run scan-kb`

**决策**：同时提供两种方式

**理由**：
1. 相对路径适合直接执行
2. npm scripts 更简洁
3. 用户可以根据习惯选择

## 6. 待定问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 是否需要添加 CHANGELOG？ | 版本变更记录 | 后续迭代中添加 |
| 是否需要添加贡献指南？ | 开源项目规范 | 暂不需要 |