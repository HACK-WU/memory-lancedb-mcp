# memory-lancedb-mcp 测试指南

本目录包含 memory-lancedb-mcp 项目的测试套件，用于验证项目的功能、性能和稳定性。

## 测试架构

```
test/
├── cli.test.mjs          # CLI 命令测试
├── mcp.test.mjs          # MCP 工具测试
├── run-all-tests.mjs     # 测试运行器
├── helpers/              # 测试辅助函数
│   ├── cli.mjs          # CLI 测试辅助
│   └── mcp.mjs          # MCP 测试辅助
├── test-data.json        # 测试数据（自动生成）
└── README.md            # 本文件
```

## 快速开始

### 1. 前置条件

确保已完成以下步骤：

```bash
# 1. 安装依赖
npm install

# 2. 编译 TypeScript
npm run build

# 3. 初始化配置
node ./bin/mem.mjs config init

# 4. 编辑配置文件，填入 API 密钥
vim ~/.config/memory-mcp/config.yaml
```

### 2. 运行测试

#### 运行所有测试

```bash
npm test
```

#### 运行特定测试模块

```bash
# CLI 命令测试
npm run test:cli

# MCP 工具测试
npm run test:mcp

# 运行所有测试并生成报告
npm run test:all

# 生成测试报告并打开报告目录
npm run test:report
```

#### 直接运行测试文件

```bash
# 运行单个测试文件
node --test test/cli.test.mjs

# 运行特定测试用例
node --test test/cli.test.mjs --grep "TC-CFG-001"
```

## 测试模块说明

### CLI 命令测试 (`cli.test.mjs`)

测试所有 `mem` CLI 命令的功能正确性，包括：

- **配置管理命令**：`config show`、`config path`、`config validate`
- **记忆存储命令**：`store`、`store --tags`、`store --scope`
- **记忆搜索命令**：`search`、`search --tags`、`search --scope`
- **记忆列表命令**：`list`、`list --limit`、`list --category`
- **记忆统计命令**：`stats`、`stats --json`
- **记忆删除命令**：`delete`、`delete` 不存在的记忆
- **记忆清理命令**：`cleanup --scope`
- **批量操作测试**：批量存储、批量搜索
- **错误处理测试**：无效命令、缺少参数、无效配置
- **JSON 输出测试**：各种命令的 JSON 输出格式

### MCP 工具测试 (`mcp.test.mjs`)

测试所有 MCP 工具的功能正确性，包括：

- **工具注册测试**：验证工具数量、Schema 格式、核心工具存在
- **memory_store 工具**：基本存储、带标签存储、指定 scope 存储
- **memory_recall 工具**：基本召回、带标签召回、指定 scope 召回、指定分类召回
- **memory_list 工具**：基本列表、分页列表、过滤列表
- **memory_forget 工具**：按 ID 删除、按查询删除
- **memory_update 工具**：更新文本、更新重要性
- **memory_stats 工具**：获取统计信息
- **list_scopes 工具**：列出所有 scope
- **memory_promote 工具**：晋升记忆
- **memory_archive 工具**：归档记忆
- **memory_compact 工具**：压缩记忆
- **memory_explain_rank 工具**：解释排名
- **self_improvement 工具**：记录学习、提取技能、审查学习
- **生命周期工具**：自动召回、自动捕获、会话结束

## 测试数据

### 自动生成测试数据

项目提供了自动化测试数据生成脚本，可从项目文档中提取内容生成测试数据：

```bash
# 生成测试数据
node test/generate-test-data.mjs
```

生成的测试数据包含：
- 77 个 CLI 命令测试用例
- 252 个 MCP 工具测试用例
- 5 个端到端场景
- 4 个性能测试场景

### 测试数据来源

测试数据来自项目文档库 `.qoder/repowiki/zh/content`，包含：

| 目录 | 文档数量 | 内容类型 | 适用测试场景 |
|------|----------|----------|--------------|
| 核心概念 | 7 个 | Weibull 衰减、混合检索、标签系统等 | 基础功能测试 |
| 高级功能 | 5 个 | 性能优化、智能提取、衰减模型等 | 高级功能测试 |
| API 参考 | 10 个 | MCP 工具 API、生命周期 API 等 | 接口测试 |
| CLI 工具详解 | 6 个 | 命令参考、配置管理等 | CLI 测试 |
| 部署运维 | 5 个 | 性能优化、监控日志等 | 运维测试 |
| 配置系统 | 6 个 | 基础配置、嵌入配置等 | 配置测试 |
| 其他目录 | 24 个 | 客户端集成、开发者指南等 | 综合测试 |

## 测试报告

测试运行器会自动生成测试报告，保存在 `test-reports/` 目录下。

报告包含：
- 测试概览（总数、通过数、失败数、耗时）
- 每个测试模块的详细结果
- 失败测试的错误信息
- 测试环境信息
- 改进建议

## 测试配置

### 使用真实配置

测试使用用户真实的配置文件 (`~/.config/memory-mcp/config.yaml`)，而不是测试专用配置。

**优点**：
- 测试真实环境下的功能
- 无需维护额外的配置文件
- 更接近实际使用场景

**注意事项**：
- 测试会操作真实数据库
- 建议使用测试专用 scope（如 `test:*`）
- 测试完成后会自动清理测试数据

### 测试 Scope 约定

为避免污染用户数据，测试使用以下 scope 前缀：

```javascript
const TEST_SCOPE_PREFIX = 'test';

// 示例
const scope = `${TEST_SCOPE_PREFIX}:project-a`;
```

## 故障排除

### 常见问题

#### 1. 测试超时

```bash
Error: 测试运行超时
```

**解决方案**：
- 检查网络连接
- 验证 API 密钥是否有效
- 增加超时时间：`node --test test/cli.test.mjs --timeout 60000`

#### 2. 配置文件错误

```bash
Error: Configuration file not found
```

**解决方案**：
- 运行 `node ./bin/mem.mjs config init`
- 检查配置文件路径
- 验证配置文件格式

#### 3. MCP 服务器启动失败

```bash
Error: MCP 服务器启动超时
```

**解决方案**：
- 检查 Node.js 版本（需要 >= 18.0.0）
- 验证依赖是否安装完整
- 检查端口是否被占用

#### 4. 数据库错误

```bash
Error: Database connection failed
```

**解决方案**：
- 检查数据库路径权限
- 验证磁盘空间是否充足
- 尝试清理数据库：`node ./bin/mem.mjs cleanup`

### 调试模式

```bash
# 启用详细日志
DEBUG=* node --test test/cli.test.mjs

# 启用 MCP 协议日志
MCP_DEBUG=1 node --test test/mcp.test.mjs
```

## 持续集成

### GitHub Actions

项目可以配置 GitHub Actions 自动运行测试：

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test
```

### 本地 Git Hooks

项目使用 Lefthook 管理 Git hooks：

```bash
# 安装 hooks
npm run setup-hooks

# 提交前自动运行测试
git commit -m "feat: new feature"
# 会自动运行 lint 和 test
```

## 贡献指南

### 添加新测试

1. 在对应的测试文件中添加测试用例
2. 使用描述性的测试名称（如 `TC-CFG-001: 初始化配置`）
3. 确保测试独立，不依赖其他测试的执行顺序
4. 清理测试数据，避免影响其他测试

### 测试命名规范

```
TC-{模块}-{序号}: {测试描述}
```

示例：
- `TC-CFG-001: 初始化配置`
- `TC-STORE-002: 带标签存储`
- `TC-MCP-RECALL-003: 指定 scope 召回`

### 测试结构

```javascript
describe('测试模块', () => {
  before(async () => {
    // 初始化测试环境
  });
  
  after(async () => {
    // 清理测试数据
  });
  
  it('TC-XXX-001: 测试描述', async () => {
    // 1. 准备测试数据
    // 2. 执行测试操作
    // 3. 验证结果
  });
});
```

## 相关链接

- [项目文档](../README.md)
- [测试方案](../docs/TESTING_PLAN.md)
- [配置说明](../docs/CONFIGURATION.md)
- [API 参考](../docs/API.md)