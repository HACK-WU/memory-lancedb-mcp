# S-01 项目初始化 设计文档

> 状态：草案
> 创建时间：2026-06-03

## 1. 术语

| 术语 | 定义 |
|------|------|
| `knowledge-indexer` | 独立化后的项目名称，强调索引整理功能 |
| `jiti` | TypeScript 运行时工具，无需编译直接执行 .ts 文件 |
| `kb/` | 运行时数据目录，按 scope 隔离存储索引数据 |
| `scope` | 项目隔离标识，不同 scope 物理隔离 |

## 2. 现状（AS-IS）

**当前位置**：`/root/memory-lancedb-pro/mcp-wrapper/knowledge-index/`

**目录结构**：
```
knowledge-index/
├── README.md
├── _template/          # 新 scope 初始化模板
├── docs/               # 说明文档
├── kb/                 # 运行时数据（按 scope 隔离）
├── scripts/            # CLI 脚本（TypeScript）
│   ├── lib/            # 内部共享模块
│   └── *.ts            # CLI 入口脚本
├── skills/             # AI Agent SKILL 定义
└── test/               # 测试文件
```

**执行方式**：`npx jiti knowledge-index/scripts/<script>.ts`

**路径计算**：`scripts/lib/constants.ts` 中使用 `import.meta.url` 计算 `KI_ROOT`，指向 `knowledge-index/` 根目录。

## 3. 方案（TO-BE）

**新项目位置**：`/root/memory-lancedb-pro/mcp-wrapper/knowledge-indexer/`

**目录结构**：
```
knowledge-indexer/
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript 配置（可选）
├── README.md           # 项目说明
├── _template/          # 新 scope 初始化模板
├── docs/               # 说明文档
├── kb/                 # 运行时数据
├── scripts/            # CLI 脚本
│   ├── lib/            # 内部共享模块
│   └── *.ts            # CLI 入口脚本
├── skills/             # AI Agent SKILL 定义
└── test/               # 测试文件
```

### 3.1 创建 package.json

```json
{
  "name": "knowledge-indexer",
  "version": "0.1.0",
  "description": "AI Agent 知识索引整理工具 - 对外部知识进行结构化索引和导航",
  "type": "module",
  "scripts": {
    "test": "npx jiti test/manage-index.test.ts",
    "test:all": "npx jiti test/*.test.ts"
  },
  "keywords": [
    "knowledge",
    "indexer",
    "ai-agent",
    "knowledge-management"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "commander": "^14.0.0",
    "jiti": "^2.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 3.2 创建 tsconfig.json（可选）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["scripts/**/*.ts"],
  "exclude": ["node_modules", "dist", "kb", "test"]
}
```

## 4. 数据模型

### 4.1 目录结构数据模型

```
knowledge-indexer/
├── package.json        # 项目元数据、依赖声明
├── tsconfig.json       # TypeScript 配置（可选）
├── README.md           # 项目说明文档
├── _template/          # 模板目录
│   ├── group-index.json
│   └── relations-cache.json
├── docs/               # 文档目录
├── kb/                 # 运行时数据目录
├── scripts/            # 源码目录
├── skills/             # 技能定义目录
└── test/               # 测试目录
```

### 4.2 关键文件说明

| 文件 | 用途 | 必需 |
|------|------|------|
| `package.json` | 项目配置、依赖声明、脚本定义 | 是 |
| `tsconfig.json` | TypeScript 编译配置 | 否（jiti 直接执行） |
| `README.md` | 项目说明、使用指南 | 是 |
| `_template/` | 新 scope 初始化模板 | 是 |

## 5. 待定问题

| 问题 | 影响 | 建议 |
|------|------|------|
| 是否需要 `.gitignore`？ | 防止 kb/ 目录被提交 | 建议添加 |
| 是否需要 `LICENSE` 文件？ | 明确开源协议 | 建议添加 MIT 协议 |
| 是否需要 `.npmignore`？ | 发布时排除测试文件 | 暂不需要，当前不发布到 npm |