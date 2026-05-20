# memory-lancedb-mcp

MCP Server wrapper for [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) — zero-modification adapter that replaces the OpenClaw runtime with the Model Context Protocol.

> **独立仓库**: `git@github.com:HACK-WU/memory-lancedb-mcp.git`
>
> 本仓库是一个**独立 MCP 包装器**，通过 FakeOpenClawApi 桥接 memory-lancedb-pro 核心能力。运行时需要先构建好 parent project 的 `dist/` 产物，包装器负责将其暴露为标准的 MCP Server。

## Features

- **17 个记忆工具**暴露为 MCP tools（recall, store, forget, update, stats, list, debug, promote, archive, compact, explain_rank, self-improvement, 以及 3 个生命周期工具）
- **多项目隔离** — `--scope` 参数按 project 隔离记忆，互不干扰
- **智能生命周期桥接** — `before_prompt_build`（auto-recall）和 `agent_end`（auto-capture）
- **双传输模式** — stdio（默认，本地 MCP 客户端）和 SSE（HTTP，远程/多客户端）
- **零侵入** — 不修改 memory-lancedb-pro 一行代码
- **YAML 配置** — 支持 `${ENV_VAR}` 环境变量扩展
- **CLI 管理工具** — `mem` 命令行，支持配置管理、记忆查看、健康诊断
- **多供应商 Embedding** — OpenAI, SiliconFlow, Ollama 等

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              MCP Client (Claude, Cursor, Cline)       │
│                  ↓ stdio / SSE                        │
├──────────────────────────────────────────────────────┤
│               memory-lancedb-mcp                     │
│  ┌─────────────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ MCP Server      │ │ CLI      │ │ Lifecycle   │  │
│  │ (stdio / SSE)   │ │ (mem)    │ │ Bridge      │  │
│  └────────┬────────┘ └─────┬─────┘ └──────┬──────┘  │
│           └────────────────┼──────────────┘         │
│                    ┌─────────▼──────────┐          │
│                    │  FakeOpenClawApi     │          │
│                    └─────────┬───────────┘          │
└──────────────────────────────┼───────────────────────┘
                               │ import("../../dist/index.js")
                    ┌──────────▼──────────┐
│        memory-lancedb-pro (unmodified)    │
│   14 tools · hybrid retrieval · LanceDB    │
│   Weibull decay · Smart extraction        │
└──────────────────────────────────────────┘
```

**核心设计**: FakeOpenClawApi 实现了 memory-lancedb-pro 所需的运行时接口（数据库、嵌入、LLM、事件系统）。包装器将 OpenClaw 插件注册为标准的 MCP Server，支持两种传输协议：
- **stdio** — MCP 标准输入输出，适合 Claude Desktop / Cursor / Cline 等本地客户端
- **SSE** — HTTP 流式传输，支持远程连接和多客户端

---

## Installation

### Prerequisites

- Node.js ≥ 18
- Git
- 嵌入 API 密钥（OpenAI / SiliconFlow / Ollama 等）

### 1. Clone both repositories

```bash
# Clone the MCP wrapper (this repo)
git clone git@github.com:HACK-WU/memory-lancedb-mcp.git
cd memory-lancedb-mcp

# Clone parent project (needed at build time)
git clone https://github.com/CortexReach/memory-lancedb-pro.git ../memory-lancedb-pro
```

### 2. Build parent project

```bash
cd ../memory-lancedb-pro
npm install --ignore-scripts
# dist/ already pre-built; if missing: npx tsc
```

### 3. Build wrapper

```bash
# Back in mcp wrapper dir
cd memory-lancedb-mcp
npm install --ignore-scripts
npx tsc

# Register mem CLI to PATH (optional but recommended)
npm link
```

### 4. Initialize configuration

```bash
# 方式一: 直接 node 启动（任何环境通用）
node ./bin/mem.mjs config init

# 方式二: npm link 后直接用 mem 命令
mem config init

# Creates ~/.config/memory-mcp/config.yaml
```

编辑配置文件，填入你的嵌入 API 密钥：

**OpenAI 示例:**
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536
```

**SiliconFlow 示例:**
```yaml
embedding:
  apiKey: "${SILICONFLOW_API_KEY}"
  model: "Qwen/Qwen3-Embedding-8B"
  baseURL: "https://api.siliconflow.cn/v1"
  dimensions: 4096
```

**Ollama 本地示例:**
```yaml
embedding:
  apiKey: ""
  model: "nomic-embed-text"
  baseURL: "http://localhost:11434"
  dimensions: 768
```

---

## MCP Client Configuration

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 或对应平台的配置文件：

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-lancedb-mcp/bin/mem.mjs", "serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

重启 Claude Desktop 后，在对话中即可使用记忆工具：
- 说 "请帮我记住这个项目的架构" → 触发 `memory_store`
- 说 "关于包管理器，我之前有什么偏好？" → 触发 `memory_recall`

### Cursor

在 Cursor 的 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-lancedb-mcp/bin/mem.mjs", "serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Cline (VS Code 插件)

在 Cline 的 MCP Server 设置中添加：

```json
{
  "command": "node",
  "args": ["/path/to/memory-lancedb-mcp/bin/mem.mjs", "serve"],
  "env": { "OPENAI_API_KEY": "sk-..." }
}
```

### Continue.dev

在 `.continue/config.json` 的 `mcpServers` 中添加：

```json
{
  "mcpServers": [
    {
      "name": "memory",
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/memory-lancedb-mcp/bin/mem.mjs", "serve"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  ]
}
```

### SSE Mode (远程/多客户端)

适用于需要跨网络连接的场景，如 Docker、WSL、远程服务器：

```bash
# 启动 SSE 服务器
mem serve --sse --port 3100 --host 0.0.0.0
```

客户端配置：
```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3100/sse"
    }
  }
}
```

---

## CLI Usage

> **提示**: 如果 node 不在 PATH 中，所有 `mem` 命令替换为 `node ./bin/mem.mjs`。
> 推荐执行 `npm link` 后直接用 `mem` 命令。

### 服务管理

```bash
# 方式一: 直接 node 启动（任何环境通用）
node ./bin/mem.mjs serve

# 方式二: npm link 注册后直接调用
mem serve

# 指定项目 scope（多项目记忆隔离）
node ./bin/mem.mjs serve --scope myapp
node ./bin/mem.mjs serve --scope backend-service

# 启动 SSE 模式
node ./bin/mem.mjs serve --sse --port 3100 --host 0.0.0.0

# 验证配置（不启动服务）
node ./bin/mem.mjs serve --dry-run

# 健康检查
node ./bin/mem.mjs doctor
```

### 记忆操作

```bash
# 列出最近记忆
node ./bin/mem.mjs list --limit 10

# 语义搜索
node ./bin/mem.mjs search "TypeScript 包管理器" --limit 5

# 存储记忆
node ./bin/mem.mjs store "我喜欢使用 pnpm 作为包管理器"

# 查看统计
node ./bin/mem.mjs stats

# 删除记忆
node ./bin/mem.mjs delete <memory-id>
```

### 配置管理

```bash
# 初始化配置文件
node ./bin/mem.mjs config init

# 查看当前配置（敏感信息已脱敏）
node ./bin/mem.mjs config show

# 验证配置格式
node ./bin/mem.mjs config validate
```

---

## Multi-Project Isolation

通过 `--scope` 参数实现不同项目之间的记忆完全隔离：

### 工作原理

memory-lancedb-pro 基于 **agent scope** 进行隔离。每个 `--scope` 值会被映射为一个独立的 agent ID，所有存储和检索操作自动限定在该 scope 内。

```
项目 A: mem serve --scope myapp      → scope agent:myapp
项目 B: mem serve --scope backend     → scope agent:backend
项目 C: mem serve --scope docs-site   → scope agent:docs-site
```

三条记忆互不交叉，`memory_recall`、`memory_list`、`memory_stats` 均只返回各自项目的记忆。

### 使用示例

```bash
# 启动项目 A 的 MCP Server（stdio 模式）
node ./bin/mem.mjs serve --scope myapp
# 所有 memory_store / memory_recall 操作自动限定在 myapp

# 启动项目 B 的 SSE 服务
node ./bin/mem.mjs serve --sse --port 3101 --scope backend

# CLI 查看特定项目的记忆
node ./bin/mem.mjs list --scope myapp --limit 10
node ./bin/mem.mjs search "TypeScript" --scope myapp
node ./bin/mem.mjs stats --scope myapp
```

### MCP 客户端配置（多项目）

在 MCP 客户端配置中为不同项目指定不同的 scope：

```json
{
  "mcpServers": {
    "memory-app-a": {
      "command": "node",
      "args": ["/path/to/memory-lancedb-mcp/bin/mem.mjs", "serve", "--scope", "myapp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    },
    "memory-app-b": {
      "command": "node",
      "args": ["/path/to/memory-lancedb-mcp/bin/mem.mjs", "serve", "--scope", "backend"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `memory_recall` | Hybrid search (vector + BM25)，语义检索 |
| `memory_store` | Store new memory with auto-categorization |
| `memory_forget` | Delete memory by ID |
| `memory_update` | Update existing memory text/importance |
| `memory_stats` | Usage statistics and scope breakdown |
| `memory_debug` | Retrieval pipeline trace and ranking explanation |
| `memory_list` | List with filtering (scope, category, time) |
| `memory_promote` | Promote to governance (high-priority memory) |
| `memory_archive` | Archive (keep but exclude from recall) |
| `memory_compact` | Deduplicate and compress memories |
| `memory_explain_rank` | Explain why memories were ranked this way |
| `self_improvement_log` | Log improvement suggestions |
| `self_improvement_extract_skill` | Extract reusable skill from memory |
| `self_improvement_review` | Review backlog of improvements |
| `_lifecycle_auto_recall` | Auto-recall (before prompt build) |
| `_lifecycle_auto_capture` | Auto-capture (after agent end) |
| `_lifecycle_session_end` | Session cleanup and finalization |

---

## Configuration Reference

### 默认配置文件

路径: `~/.config/memory-mcp/config.yaml`

```yaml
embedding:
  # 必填: API 密钥，支持 ${ENV_VAR} 语法
  apiKey: "${OPENAI_API_KEY}"
  # 必填: 模型名称
  model: "text-embedding-3-small"
  # 可选: 自定义 API 地址
  baseURL: "https://api.openai.com/v1"
  # 可选: 向量维度（如 model 不包含 dimensions 则必填）
  dimensions: 1536

# 可选: 数据库存储路径（默认 ~/.local/share/memory-mcp/lancedb）
storagePath: "/custom/path/lancedb"

# 可选: 默认 scope（默认 agent:main）
defaultScope: "agent:main"

# 可选: 智能提取配置
smartExtraction:
  enabled: true
  model: "openai/gpt-oss-120b"
  baseURL: "https://api.openai.com/v1"
  apiKey: "${OPENAI_API_KEY}"
```

### 环境变量

| Variable | Description |
|----------|-------------|
| `MEM_CONFIG_PATH` | 覆盖默认配置文件路径 |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `SILICONFLOW_API_KEY` | SiliconFlow API 密钥 |

---

## Development

```bash
# 开发模式（热编译）
npm run dev

# 构建
npm run build

# 运行测试
npm test
```

---

## License

MIT
