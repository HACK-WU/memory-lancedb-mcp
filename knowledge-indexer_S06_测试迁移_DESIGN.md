# S-06 测试迁移 设计文档

> 状态：草案
> 创建时间：2026-06-03

## 1. 术语

| 术语 | 定义 |
|------|------|
| 测试脚本 | 自动化测试文件 |
| mock | 模拟对象，用于隔离测试依赖 |
| 测试覆盖率 | 代码被测试覆盖的比例 |
| 集成测试 | 测试多个模块协作的测试 |

## 2. 现状（AS-IS）

**测试文件位置**：`/root/memory-lancedb-pro/mcp-wrapper/knowledge-index/test/`

**测试文件清单**：

| 文件 | 测试内容 | 类型 |
|------|----------|------|
| `manage-index.test.ts` | Group 树 CRUD | 单元测试 |
| `query-group.test.ts` | 查询 Group + 词云 | 单元测试 |
| `get-module-info.test.ts` | 读取本地 KB 原文 | 单元测试 |
| `sync-relation.test.ts` | 写入 Relation | 单元测试 |
| `import-kb.test.ts` | 旧导入流程 | 单元测试 |
| `scan-kb.test.ts` | 统一导入流程 | 单元测试 |
| `lib.test.ts` | 内部库函数 | 单元测试 |
| `integration.test.ts` | 端到端集成测试 | 集成测试 |
| `error-handling.test.ts` | 错误处理 | 单元测试 |
| `scope-isolation.test.ts` | scope 隔离 | 单元测试 |
| `migrate-keywords.test.ts` | 数据迁移 | 单元测试 |
| `fixtures/mock-mem.mjs` | mem 命令 mock | 测试工具 |

**测试执行方式**：
```bash
# 父项目 package.json 中的脚本
"test:ki": "npx jiti knowledge-index/test/manage-index.test.ts knowledge-index/test/query-group.test.ts ..."
"test:ki:manage-index": "npx jiti knowledge-index/test/manage-index.test.ts"
"test:ki:query-group": "npx jiti knowledge-index/test/query-group.test.ts"
# ... 等 10+ 个 test:ki:* 脚本
```

**测试特点**：
- 使用 `npx jiti` 直接执行 TypeScript 测试文件
- 使用 `fixtures/mock-mem.mjs` 模拟 `mem` 命令
- 测试数据存储在临时目录，测试后清理

## 3. 方案（TO-BE）

### 3.1 迁移策略

**直接复制 + 路径更新**：复制所有测试文件，更新路径引用。

**迁移清单**：

| 源路径 | 目标路径 | 操作 |
|--------|----------|------|
| `knowledge-index/test/*.test.ts` | `knowledge-indexer/test/*.test.ts` | 复制 |
| `knowledge-index/test/fixtures/` | `knowledge-indexer/test/fixtures/` | 复制 |

### 3.2 测试脚本更新

**package.json scripts 配置**：
```json
{
  "scripts": {
    "test": "npx jiti test/manage-index.test.ts",
    "test:all": "npx jiti test/*.test.ts",
    "test:manage-index": "npx jiti test/manage-index.test.ts",
    "test:query-group": "npx jiti test/query-group.test.ts",
    "test:get-module-info": "npx jiti test/get-module-info.test.ts",
    "test:sync-relation": "npx jiti test/sync-relation.test.ts",
    "test:import-kb": "npx jiti test/import-kb.test.ts",
    "test:scan-kb": "npx jiti test/scan-kb.test.ts",
    "test:lib": "npx jiti test/lib.test.ts",
    "test:integration": "npx jiti test/integration.test.ts",
    "test:error-handling": "npx jiti test/error-handling.test.ts",
    "test:scope-isolation": "npx jiti test/scope-isolation.test.ts",
    "test:migrate-keywords": "npx jiti test/migrate-keywords.test.ts"
  }
}
```

**使用示例**：
```bash
# 运行所有测试
npm run test:all

# 运行单个测试
npm run test:manage-index
npm run test:query-group

# 运行集成测试
npm run test:integration
```

### 3.3 测试路径更新

**需要更新的路径引用**：

1. **测试文件中的 import 路径**：
   ```typescript
   // 旧路径
   import { manageIndex } from '../scripts/manage-index.js';
   
   // 新路径（相对路径不变）
   import { manageIndex } from '../scripts/manage-index.js';
   ```
   **结论**：相对路径无需调整，因为目录结构保持一致。

2. **测试文件中的脚本调用路径**：
   ```typescript
   // 旧路径
   const stdout = execFileSync('npx', ['jiti', 'knowledge-index/scripts/manage-index.ts', ...args]);
   
   // 新路径
   const stdout = execFileSync('npx', ['jiti', 'scripts/manage-index.ts', ...args]);
   ```

3. **mock 文件路径**：
   ```typescript
   // 旧路径
   const mockMemPath = path.resolve(import.meta.dirname, 'fixtures', 'mock-mem.mjs');
   
   // 新路径（相对路径不变）
   const mockMemPath = path.resolve(import.meta.dirname, 'fixtures', 'mock-mem.mjs');
   ```

### 3.4 测试数据目录

**测试数据位置**：
- 测试临时目录：系统临时目录（如 `/tmp/`）
- 测试数据：`test/fixtures/` 目录
- 运行时数据：`kb/` 目录

**说明**：测试数据目录无需调整，因为：
1. 测试使用系统临时目录，不依赖项目结构
2. `test/fixtures/` 相对路径不变
3. `kb/` 目录路径通过 `constants.ts` 计算，逻辑不变

## 4. 影响范围

| 影响项 | 影响程度 | 说明 |
|--------|----------|------|
| 测试文件 | 低 | 相对路径无需调整 |
| 测试脚本 | 中 | 需要更新 package.json 中的脚本路径 |
| mock 文件 | 无 | 相对路径不变 |
| 测试数据 | 无 | 使用临时目录，不依赖项目结构 |

## 5. 关键决策点

### 决策 1：是否需要添加测试覆盖率工具？

**备选方案**：
- A. 不添加：保持现状
- B. 添加 c8/nyc：生成覆盖率报告

**决策**：选择 A（不添加）

**理由**：
1. 当前测试已经覆盖主要功能
2. 避免增加复杂性
3. 后续迭代中可以添加

### 决策 2：是否需要添加 CI/CD 配置？

**备选方案**：
- A. 不添加：手动运行测试
- B. 添加 GitHub Actions：自动运行测试

**决策**：选择 A（不添加）

**理由**：
1. 当前是独立项目，暂不需要 CI/CD
2. 后续发布时可以添加
3. 保持简单

## 6. 待定问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 是否需要添加性能测试？ | 测试性能回归 | 后续迭代中添加 |
| 是否需要添加端到端测试？ | 测试完整流程 | 当前集成测试已覆盖 |