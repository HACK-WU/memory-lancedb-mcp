# S-03 依赖管理 设计文档

> 状态：草案
> 创建时间：2026-06-03

## 1. 术语

| 术语 | 定义 |
|------|------|
| `npm` | Node.js 包管理器 |
| `package.json` | 项目配置文件，声明依赖和脚本 |
| `dependencies` | 运行时依赖 |
| `devDependencies` | 开发时依赖 |
| `peerDependencies` | 对等依赖，由使用者提供 |
| `mem` | 父项目提供的 CLI 命令，封装向量存储能力 |

## 2. 现状（AS-IS）

**父项目 package.json 依赖**：
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "commander": "^14.0.0",
    "jiti": "^2.6.1",
    "memory-lancedb-pro": "github:CortexReach/memory-lancedb-pro#v1.1.0-beta.10",
    "yaml": "^2.7.1"
  }
}
```

**knowledge-index 实际使用的依赖**：

| 依赖 | 使用位置 | 用途 |
|------|----------|------|
| `commander` | 所有 CLI 脚本 | CLI 参数解析 |
| `jiti` | 运行时（`npx jiti`） | 直接执行 TypeScript |
| `mem` CLI | `scripts/lib/batch-vectorize.ts` | 向量化存储（子进程调用） |

**依赖分析**：
- `commander`：直接使用，需要声明为 dependencies
- `jiti`：运行时工具，需要声明为 dependencies
- `mem` CLI：通过子进程调用，不是 npm 依赖，是外部工具

## 3. 方案（TO-BE）

### 3.1 依赖声明

**package.json 依赖配置**：
```json
{
  "dependencies": {
    "commander": "^14.0.0",
    "jiti": "^2.6.1"
  }
}
```

**说明**：
- `commander`：CLI 参数解析，所有脚本都使用
- `jiti`：TypeScript 运行时，直接执行 .ts 文件

### 3.2 mem CLI 依赖处理

**问题**：`mem` 命令是父项目 `memory-lancedb-mcp` 提供的 CLI，knowledge-indexer 通过子进程调用。

**处理方案**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. 文档说明 | 简单，不增加复杂度 | 用户可能忘记安装 |
| B. peerDependencies | npm 会提示安装 | peerDependencies 用于 npm 包，不适用于 CLI |
| C. 检查脚本 | 启动时检查 mem 是否可用 | 增加代码复杂度 |

**决策**：选择方案 A（文档说明）+ 方案 C（启动时检查）

**实现**：
1. 在 README.md 中明确说明前置条件
2. 在 `scripts/lib/batch-vectorize.ts` 中添加检查：
   ```typescript
   function checkMemAvailable(): boolean {
     try {
       execFileSync('mem', ['--version'], { stdio: 'ignore' });
       return true;
     } catch {
       return false;
     }
   }
   ```

### 3.3 CLI 入口设计

**问题**：用户希望在任意路径下执行命令，而不是必须进入项目目录。

**解决方案**：创建 `bin/knowledge-indexer.mjs` 入口脚本，通过 `npm link` 实现全局调用。

**实现细节**：

1. **bin 入口脚本** (`bin/knowledge-indexer.mjs`)：
   - 接收命令行参数
   - 映射命令到对应的 .ts 脚本
   - 使用 `npx jiti` 执行脚本
   - 自动设置 `cwd` 为项目根目录

2. **package.json 配置**：
   ```json
   {
     "bin": {
       "knowledge-indexer": "./bin/knowledge-indexer.mjs"
     }
   }
   ```

3. **使用方式**：
   ```bash
   # 开发时：npm link 创建全局链接
   cd knowledge-indexer
   npm link
   
   # 之后在任意路径都可以使用
   knowledge-indexer scan-kb import --scope my-project --results ai-results.json
   knowledge-indexer manage-index --scope my-project --action create-root --root-name "我的项目"
   knowledge-indexer query-group --scope my-project
   ```

**命令映射表**：

| 命令 | 脚本文件 |
|------|----------|
| `scan-kb` | `scripts/scan-kb.ts` |
| `manage-index` | `scripts/manage-index.ts` |
| `query-group` | `scripts/query-group.ts` |
| `get-module-info` | `scripts/get-module-info.ts` |
| `sync-relation` | `scripts/sync-relation.ts` |
| `import-kb` | `scripts/import-kb.ts` |
| `migrate-keywords` | `scripts/migrate-keywords.ts` |

### 3.4 安装流程

**用户安装步骤**：
```bash
# 1. 安装 mem CLI（前置条件）
npm install -g memory-lancedb-mcp

# 2. 克隆项目
git clone <repository-url>
cd knowledge-indexer

# 3. 安装依赖
npm install

# 4. 创建全局链接（可选，支持任意路径执行）
npm link

# 5. 验证安装
knowledge-indexer --help
```

### 3.5 接口设计

**CLI 命令接口**（保持不变）：
```bash
# 统一导入
npx jiti scripts/scan-kb.ts import --scope <scope> --results <file>

# 增量更新
npx jiti scripts/scan-kb.ts diff --scope <scope>
npx jiti scripts/scan-kb.ts import --scope <scope> --mode incremental --results <file>

# Group 管理
npx jiti scripts/manage-index.ts --scope <scope> --action create-root --root-name <name>
npx jiti scripts/manage-index.ts --scope <scope> --action create --parent <parent> --name <name>

# 查询
npx jiti scripts/query-group.ts --scope <scope>
npx jiti scripts/query-group.ts --scope <scope> --groups <group>

# 模块信息
npx jiti scripts/get-module-info.ts --scope <scope> --group <group> --relation <relation>

# Relation 同步
npx jiti scripts/sync-relation.ts --scope <scope> --group <group> --relation <relation> --module-info <info> --keywords <keywords>
```

## 4. 关键决策点

### 决策 1：如何处理 mem CLI 依赖？

**备选方案**：
- A. 文档说明：在 README 中明确前置条件
- B. peerDependencies：npm 包级别声明
- C. 启动检查：运行时检查 mem 是否可用

**决策**：选择 A + C（文档说明 + 启动检查）

**理由**：
1. mem 是 CLI 工具，不是 npm 包，不适合 peerDependencies
2. 文档说明是最基本的用户引导
3. 启动检查可以提供友好的错误提示

### 决策 2：是否需要锁定依赖版本？

**备选方案**：
- A. 使用 `^`：允许小版本更新
- B. 使用 `~`：只允许补丁更新
- C. 使用精确版本：完全锁定

**决策**：选择 A（使用 `^`）

**理由**：
1. commander 和 jiti 都是成熟库，小版本更新通常兼容
2. 保持与父项目一致的版本策略
3. package-lock.json 会锁定实际安装版本

## 5. 待定问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 是否需要 devDependencies？ | 开发时工具 | 暂不需要，使用 jiti 直接执行 |
| 是否需要 engines 声明？ | Node.js 版本要求 | 建议添加 `"engines": {"node": ">=18.0.0"}` |