# S-04 CLI 入口 设计文档

> 状态：草案
> 创建时间：2026-06-03

## 1. 术语

| 术语 | 定义 |
|------|------|
| CLI | Command Line Interface，命令行界面 |
| `commander` | Node.js CLI 参数解析库 |
| `npx` | npm 包执行工具 |
| `jiti` | TypeScript 运行时工具 |
| 入口脚本 | 用户直接调用的脚本文件 |

## 2. 现状（AS-IS）

**当前调用方式**：
```bash
# 在父项目根目录下执行
npx jiti knowledge-index/scripts/scan-kb.ts import --scope my-project --results ai-results.json
npx jiti knowledge-index/scripts/manage-index.ts --scope my-project --action create-root --root-name "我的项目"
npx jiti knowledge-index/scripts/query-group.ts --scope my-project
```

**特点**：
- 需要指定完整路径 `knowledge-index/scripts/`
- 使用 `npx jiti` 执行 TypeScript
- 每个脚本独立入口

**脚本清单**：

| 脚本 | 子命令 | 功能 |
|------|--------|------|
| `scan-kb.ts` | `import` | 统一导入（全量/增量） |
| | `diff` | 增量变更检测 |
| | `scan` | 旧流程扫描（兼容） |
| | `vectorize` | DEPRECATED |
| `manage-index.ts` | `create-root` / `create` / `delete` | Group 树 CRUD |
| `query-group.ts` | - | 查询 Group + 词云 + 分区 |
| `get-module-info.ts` | - | 读取本地 KB 原文 + 更新评分 |
| `sync-relation.ts` | - | 写入 Relation + 关键词校验 |
| `import-kb.ts` | - | @deprecated 旧导入 |
| `migrate-keywords.ts` | - | 数据迁移 |

## 3. 方案（TO-BE）

### 3.1 CLI 入口方案

**方案选择**：保持 `npx jiti` 方式，简化路径

**新的调用方式**：
```bash
# 在项目根目录下执行
cd knowledge-indexer

# 方式 1：直接执行
npx jiti scripts/scan-kb.ts import --scope my-project --results ai-results.json

# 方式 2：使用 npm scripts
npm run scan-kb -- import --scope my-project --results ai-results.json
npm run manage-index -- --scope my-project --action create-root --root-name "我的项目"
npm run query-group -- --scope my-project
```

### 3.2 npm scripts 设计

**package.json scripts 配置**：
```json
{
  "scripts": {
    "scan-kb": "npx jiti scripts/scan-kb.ts",
    "manage-index": "npx jiti scripts/manage-index.ts",
    "query-group": "npx jiti scripts/query-group.ts",
    "get-module-info": "npx jiti scripts/get-module-info.ts",
    "sync-relation": "npx jiti scripts/sync-relation.ts",
    "test": "npx jiti test/manage-index.test.ts",
    "test:all": "npx jiti test/*.test.ts"
  }
}
```

**使用示例**：
```bash
# 统一导入
npm run scan-kb -- import --scope my-project --results ai-results.json

# 增量更新
npm run scan-kb -- diff --scope my-project
npm run scan-kb -- import --scope my-project --mode incremental --results ai-results-incremental.json

# Group 管理
npm run manage-index -- --scope my-project --action create-root --root-name "我的项目"
npm run manage-index -- --scope my-project --action create --parent "我的项目" --name "API"

# 查询
npm run query-group -- --scope my-project
npm run query-group -- --scope my-project --groups "我的项目/API"

# 模块信息
npm run get-module-info -- --scope my-project --group "我的项目/API" --relation "用户登录"

# Relation 同步
npm run sync-relation -- --scope my-project --group "我的项目/API" --relation "用户登录" --module-info "## 登录流程\n..." --keywords "登录,认证,token"
```

### 3.3 CLI 命令映射表

| 功能 | 旧命令 | 新命令 |
|------|--------|--------|
| 统一导入 | `npx jiti knowledge-index/scripts/scan-kb.ts import` | `npm run scan-kb -- import` |
| 增量检测 | `npx jiti knowledge-index/scripts/scan-kb.ts diff` | `npm run scan-kb -- diff` |
| 创建根节点 | `npx jiti knowledge-index/scripts/manage-index.ts --action create-root` | `npm run manage-index -- --action create-root` |
| 创建子节点 | `npx jiti knowledge-index/scripts/manage-index.ts --action create` | `npm run manage-index -- --action create` |
| 删除节点 | `npx jiti knowledge-index/scripts/manage-index.ts --action delete` | `npm run manage-index -- --action delete` |
| 查询 Group | `npx jiti knowledge-index/scripts/query-group.ts` | `npm run query-group` |
| 模块信息 | `npx jiti knowledge-index/scripts/get-module-info.ts` | `npm run get-module-info` |
| Relation 同步 | `npx jiti knowledge-index/scripts/sync-relation.ts` | `npm run sync-relation` |

## 4. 接口设计

### 4.1 CLI 参数格式

**统一格式**：
```bash
<command> [subcommand] [--options]
```

**参数说明**：

| 参数 | 说明 | 必填 |
|------|------|------|
| `--scope` | 项目隔离标识 | 是 |
| `--action` | 操作类型（create-root/create/delete） | 否（默认 create） |
| `--parent` | 父节点路径 | create/delete 时必填 |
| `--name` | 节点名称 | create 时必填 |
| `--root-name` | 根节点名称 | create-root 时必填 |
| `--groups` | Group 路径列表（逗号分隔） | 否 |
| `--mode` | 查询模式（full/hot/compact） | 否（默认 full） |
| `--relation` | Relation 文本或 ID | 是（get-module-info） |
| `--module-info` | Markdown 格式模块信息 | 是（sync-relation） |
| `--keywords` | 逗号分隔关键词 | 是（sync-relation） |
| `--results` | ai-results.json 文件路径 | 是（import） |
| `--force` | 强制删除非空节点 | 否 |

### 4.2 输出格式

**成功输出**：
```json
{
  "ok": true,
  "action": "create",
  "path": "我的项目/API"
}
```

**错误输出**：
```json
{
  "ok": false,
  "error": "父节点不存在"
}
```

## 5. 关键决策点

### 决策 1：是否需要全局 CLI 命令？

**备选方案**：
- A. 保持 npm scripts：使用 `npm run <command>`
- B. 全局 CLI：安装后可直接调用 `knowledge-indexer <command>`

**决策**：选择 A（保持 npm scripts）

**理由**：
1. 避免全局安装的复杂性
2. 保持与父项目一致的使用方式
3. 用户可以通过 `npm link` 实现全局调用（可选）

### 决策 2：是否需要统一入口脚本？

**备选方案**：
- A. 保持独立脚本：每个功能一个脚本文件
- B. 统一入口：一个主脚本分发所有子命令

**决策**：选择 A（保持独立脚本）

**理由**：
1. 保持与父项目一致的代码结构
2. 每个脚本职责单一，易于维护
3. 避免引入额外的路由逻辑

## 6. 待定问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 是否需要 bash 补全？ | 提高 CLI 易用性 | 后续迭代中添加 |
| 是否需要帮助文档？ | 用户引导 | 使用 commander 自动生成 |