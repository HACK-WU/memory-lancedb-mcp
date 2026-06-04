# 开发文档

本目录包含 memory-lancedb-mcp 项目的开发文档。

## 文档列表

### 开发指南
- [架构设计](architecture.md) - 系统架构和设计决策
- [贡献指南](contributing.md) - 如何参与项目开发

### 设计文档
- [SSE 鉴权设计](sse-auth-design.md) - SSE 鉴权机制设计
- [代码审查报告](code-review.md) - 代码审查结果

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
```

## 项目结构

```
memory-lancedb-mcp/
├── bin/                    # 可执行文件
│   └── mem.mjs           # CLI 入口
├── src/                    # 源代码
│   ├── cli.ts            # CLI 命令定义
│   ├── config.ts         # 配置管理
│   ├── index.ts          # 主入口
│   ├── mcp-server.ts     # MCP 服务器
│   ├── mcp-server-sse.ts # SSE 服务器
│   └── sse-auth.ts       # SSE 鉴权
├── test/                   # 测试文件
├── docs/                   # 文档
├── scripts/                # 脚本
├── package.json           # 项目配置
└── tsconfig.json          # TypeScript 配置
```

## 核心模块

### CLI 模块 (`src/cli.ts`)

负责命令行参数解析和命令执行。

**主要命令**：
- `mem serve` - 启动 MCP 服务
- `mem config` - 配置管理
- `mem store` - 存储记忆
- `mem search` - 语义搜索
- `mem list` - 列表查看
- `mem stats` - 统计信息
- `mem delete` - 删除记忆
- `mem scope` - Scope 管理
- `mem doctor` - 健康检查

### 配置模块 (`src/config.ts`)

负责配置文件的加载、解析和验证。

**主要功能**：
- 配置文件查找
- YAML 解析
- 环境变量扩展
- 配置验证

### MCP 服务器模块 (`src/mcp-server.ts`)

负责 MCP 协议的实现。

**主要功能**：
- 工具注册
- 请求处理
- 响应生成

### SSE 服务器模块 (`src/mcp-server-sse.ts`)

负责 SSE 模式的实现。

**主要功能**：
- HTTP 服务器
- SSE 连接管理
- 鉴权处理

### 鉴权模块 (`src/sse-auth.ts`)

负责 SSE 鉴权的实现。

**主要功能**：
- Token 提取
- 鉴权策略验证
- 时序安全比较

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "config"

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

### 测试结构

```
test/
├── cli.test.mjs           # CLI 测试
├── config.test.mjs        # 配置测试
├── mcp-server.test.mjs    # MCP 服务器测试
├── sse-auth.test.mjs      # SSE 鉴权测试
└── ...                    # 其他测试
```

### 测试覆盖率

```bash
# 生成覆盖率报告
npm test -- --coverage

# 查看覆盖率报告
open coverage/lcov-report/index.html
```

## 代码质量

### 代码检查

```bash
# ESLint 检查
npm run lint

# 自动修复
npm run lint:fix
```

### 代码格式化

```bash
# Prettier 格式化
npm run format

# 检查格式
npm run format:check
```

### 类型检查

```bash
# TypeScript 类型检查
npm run type-check
```

## 构建和发布

### 构建

```bash
# 构建项目
npm run build

# 清理构建目录
npm run clean
```

### 发布

```bash
# 发布新版本
npm run release

# 或使用脚本
./scripts/release.sh
```

### 版本管理

```bash
# 更新版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

## 调试

### 调试 CLI

```bash
# 启用调试日志
mem serve --verbose

# 使用 Node.js 调试器
node --inspect bin/mem.mjs serve
```

### 调试 MCP 服务器

```bash
# 启用调试日志
mem serve --verbose

# 使用 MCP 调试工具
mem serve --dry-run
```

### 调试 SSE 模式

```bash
# 启用调试日志
mem serve --sse --verbose

# 检查连接
curl http://localhost:3100/health
```

## 常见问题

### Q1: 构建失败

**症状**：
```
npm run build 失败
```

**解决**：
```bash
# 清理并重新构建
npm run clean
npm install
npm run build
```

### Q2: 测试失败

**症状**：
```
npm test 失败
```

**解决**：
```bash
# 检查测试环境
npm run lint
npm run type-check

# 运行特定测试
npm test -- --grep "test name"
```

### Q3: 类型错误

**症状**：
```
TypeScript 类型错误
```

**解决**：
```bash
# 检查类型
npm run type-check

# 更新类型定义
npm install @types/node@latest
```

## 贡献指南

请查看 [贡献指南](contributing.md) 了解如何参与项目开发。

## 相关文档

- [项目主页](../../README.md) - 项目概览
- [CLI 参考](../cli/README.md) - 命令行工具
- [配置指南](../config/README.md) - 配置系统
- [MCP 工具](../mcp/README.md) - MCP 工具参考
