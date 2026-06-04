# 贡献指南

感谢您对 memory-lancedb-mcp 项目的关注！本文档介绍如何参与项目开发。

## 如何贡献

### 1. 报告问题

**步骤**：
1. 检查 [GitHub Issues](https://github.com/HACK-WU/memory-lancedb-mcp/issues) 是否已有类似问题
2. 创建新 Issue，包含以下信息：
   - 问题描述
   - 复现步骤
   - 期望行为
   - 实际行为
   - 环境信息（OS、Node.js 版本等）

**Issue 模板**：
```markdown
## 问题描述
简要描述问题

## 复现步骤
1. 执行 `mem ...`
2. 看到错误 `...`

## 期望行为
描述期望的行为

## 实际行为
描述实际的行为

## 环境信息
- OS: macOS 14.0
- Node.js: 18.17.0
- memory-lancedb-mcp: 0.1.0

## 日志
```
粘贴相关日志
```
```

### 2. 提交代码

**步骤**：
1. Fork 项目仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

**分支命名规范**：
- 功能分支：`feature/your-feature`
- 修复分支：`fix/your-fix`
- 文档分支：`docs/your-docs`

**提交信息规范**：
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**：
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

**示例**：
```
feat(cli): add mem config validate command

Add validation command to check config file validity.

Closes #123
```

### 3. 代码审查

**审查要点**：
- 代码风格一致性
- 测试覆盖率
- 文档完整性
- 性能影响

**审查流程**：
1. 提交 Pull Request
2. 自动运行测试
3. 代码审查
4. 修改并重新提交
5. 合并到主分支

## 开发环境

### 前置条件

- Node.js ≥ 18
- npm 或 pnpm
- Git

### 从源码安装

```bash
# 克隆仓库
git clone git@github.com:HACK-WU/memory-lancedb-mcp.git
cd memory-lancedb-mcp

# 安装依赖
npm install

# 构建项目
npm run build

# 链接到全局
npm link
```

### 开发命令

```bash
# 开发模式（热编译）
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化代码
npm run format

# 类型检查
npm run type-check
```

## 代码规范

### 1. 代码风格

**TypeScript**：
- 使用 TypeScript 编写
- 启用严格模式
- 使用接口定义类型

**示例**：
```typescript
interface Config {
  embedding: {
    apiKey: string;
    model: string;
    baseURL?: string;
  };
}

function loadConfig(path: string): Config {
  // 实现
}
```

### 2. 命名规范

**变量和函数**：camelCase
```typescript
const configPath = getConfigPath();
function loadConfig(path: string): Config { ... }
```

**类和接口**：PascalCase
```typescript
class McpServer { ... }
interface MemConfig { ... }
```

**常量**：UPPER_SNAKE_CASE
```typescript
const DEFAULT_CONFIG_PATH = "~/.config/memory-mcp/config.yaml";
```

### 3. 错误处理

**使用 try-catch**：
```typescript
try {
  const config = loadConfig(path);
} catch (err) {
  console.error(`Failed to load config: ${err.message}`);
  process.exit(1);
}
```

**使用自定义错误**：
```typescript
class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
```

### 4. 日志规范

**使用 console 方法**：
```typescript
console.log("信息日志");
console.warn("警告日志");
console.error("错误日志");
```

**使用前缀**：
```typescript
console.log("[mem] 信息日志");
console.warn("[mem:config] 警告日志");
console.error("[mem:serve] 错误日志");
```

## 测试规范

### 1. 测试结构

**测试文件**：
```
test/
├── cli.test.mjs           # CLI 测试
├── config.test.mjs        # 配置测试
├── mcp-server.test.mjs    # MCP 服务器测试
├── sse-auth.test.mjs      # SSE 鉴权测试
└── ...                    # 其他测试
```

**测试命名**：
```javascript
describe("mem config", () => {
  it("should create config file", () => {
    // 测试代码
  });

  it("should validate config", () => {
    // 测试代码
  });
});
```

### 2. 测试覆盖率

**目标**：
- 语句覆盖率：> 80%
- 分支覆盖率：> 70%
- 函数覆盖率：> 90%

**检查覆盖率**：
```bash
npm test -- --coverage
```

### 3. 测试类型

**单元测试**：
```javascript
describe("Config", () => {
  it("should load config from file", () => {
    const config = loadConfig("test/fixtures/config.yaml");
    expect(config.embedding.model).toBe("text-embedding-3-small");
  });
});
```

**集成测试**：
```javascript
describe("MCP Server", () => {
  it("should handle memory_store request", async () => {
    const server = createMcpServer();
    const result = await server.handleRequest({
      name: "memory_store",
      arguments: { text: "test memory" }
    });
    expect(result.success).toBe(true);
  });
});
```

### 4. 测试最佳实践

**独立性**：每个测试独立运行
```javascript
beforeEach(() => {
  // 清理测试环境
});

afterEach(() => {
  // 清理测试数据
});
```

**可重复性**：测试结果一致
```javascript
it("should return consistent results", () => {
  const result = someFunction();
  expect(result).toBe(expectedValue);
});
```

**可读性**：测试代码清晰
```javascript
it("should validate config with valid embedding settings", () => {
  const config = {
    embedding: {
      apiKey: "sk-test",
      model: "text-embedding-3-small"
    }
  };
  expect(validateConfig(config)).toBe(true);
});
```

## 文档规范

### 1. 文档结构

**文档目录**：
```
docs/
├── README.md               # 主文档
├── cli/                   # CLI 文档
├── config/                # 配置文档
├── mcp/                   # MCP 工具文档
├── guides/                # 使用指南
└── development/           # 开发文档
```

### 2. 文档格式

**使用 Markdown**：
```markdown
# 标题

## 二级标题

正文内容。

### 三级标题

- 列表项 1
- 列表项 2

```代码块```
```

### 3. 文档内容

**必须包含**：
- 功能说明
- 使用方法
- 示例代码
- 注意事项

**可选包含**：
- 配置选项
- 故障排除
- 相关链接

### 4. 文档更新

**更新时机**：
- 新增功能
- 修改功能
- 修复问题
- 配置变更

**更新流程**：
1. 更新文档内容
2. 检查链接有效性
3. 提交更改
4. 审查文档

## 发布流程

### 1. 版本管理

**语义化版本**：
- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

**版本更新**：
```bash
# 更新版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

### 2. 发布准备

**检查清单**：
- [ ] 所有测试通过
- [ ] 代码检查通过
- [ ] 文档已更新
- [ ] 版本号已更新
- [ ] 更新日志已编写

**更新日志**：
```markdown
# Changelog

## [1.0.1] - 2024-01-15

### Added
- 新增 `mem config validate` 命令
- 新增环境变量详解文档

### Fixed
- 修复配置文件解析错误
- 修复 SSE 鉴权问题

### Changed
- 优化检索性能
- 更新文档结构
```

### 3. 发布执行

**发布命令**：
```bash
# 构建项目
npm run build

# 运行测试
npm test

# 发布到 npm
npm publish

# 或使用脚本
./scripts/release.sh
```

### 4. 发布后

**验证发布**：
```bash
# 检查 npm 包
npm view memory-lancedb-mcp

# 测试安装
npm install -g memory-lancedb-mcp
mem --version
```

## 社区准则

### 1. 行为准则

**尊重他人**：
- 尊重不同观点
- 避免人身攻击
- 保持专业态度

**建设性反馈**：
- 提供具体建议
- 避免负面评论
- 关注问题本身

### 2. 沟通方式

**Issue 讨论**：
- 清晰描述问题
- 提供必要信息
- 耐心等待回复

**Pull Request**：
- 详细描述更改
- 响应审查意见
- 及时修改问题

### 3. 时间预期

**响应时间**：
- Issue：1-3 个工作日
- Pull Request：3-7 个工作日
- 紧急问题：24 小时内

## 获取帮助

### 1. 文档

**优先查看**：
- [项目主页](../../README.md)
- [CLI 参考](../cli/README.md)
- [配置指南](../config/README.md)
- [故障排除](../guides/troubleshooting.md)

### 2. 社区

**交流渠道**：
- [GitHub Issues](https://github.com/HACK-WU/memory-lancedb-mcp/issues)
- [GitHub Discussions](https://github.com/HACK-WU/memory-lancedb-mcp/discussions)

### 3. 联系方式

**邮箱**：
- 项目维护者：[your-email@example.com]

## 致谢

感谢所有贡献者对 memory-lancedb-mcp 项目的贡献！

## 相关文档

- [项目主页](../../README.md) - 项目概览
- [架构设计](architecture.md) - 系统架构
- [开发总览](README.md) - 开发指南
