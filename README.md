# memory-lancedb-mcp

MCP Server wrapper for [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) — zero-modification adapter that replaces the OpenClaw runtime with the Model Context Protocol.

> **独立仓库**: `git@github.com:HACK-WU/memory-lancedb-mcp.git`
>
> **父项目**: [github.com/CortexReach/memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro)
>
> 感谢 [CortexReach](https://github.com/CortexReach) 团队开源的 memory-lancedb-pro — 本项目基于其核心能力进行 MCP 协议桥接与扩展。
>
> 本仓库是一个**独立 MCP 包装器**，通过 FakeOpenClawApi 桥接 memory-lancedb-pro 核心能力。
> 运行时通过 jiti 直接加载 npm 安装的 `memory-lancedb-pro` TypeScript 源文件，
> **无需克隆父仓库**，纯 npm install 即可运行。

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
                               │ jiti("memory-lancedb-pro")
                    ┌──────────▼──────────┐
│        memory-lancedb-pro (from npm)     │
│   14 tools · hybrid retrieval · LanceDB    │
│   Weibull decay · Smart extraction        │
└──────────────────────────────────────────┘
```

**核心设计**: FakeOpenClawApi 实现了 memory-lancedb-pro 所需的运行时接口（数据库、嵌入、LLM、事件系统）。包装器通过 jiti 直接从 npm 包加载父项目的 TypeScript 源文件，支持两种传输协议：

---

## 适用场景

memory-lancedb-mcp 适合需要**持久化长期记忆**的 AI 应用：

- **AI 代码助手** — 记住项目架构、编码偏好、常见 Bug 模式，提升代码生成质量
- **AI 写作/创作** — 记住写作风格、人物设定、读者偏好，保持一致性
- **AI 客服** — 记住用户画像、历史诉求、解决方案，提供个性化服务
- **AI 研究助理** — 记住研究方向、文献摘要、关键结论，辅助学术写作
- **AI 个人助理** — 记住日程偏好、饮食禁忌、旅行习惯，提供精准建议
- **AI 游戏 NPC** — 记住玩家行为、剧情走向、角色关系，实现动态叙事

核心优势：
- **多项目隔离**：同一套基础设施为不同项目提供完全独立的记忆空间
- **语义检索**：基于向量 + BM25 的混合检索，比关键词搜索更准确
- **自动衰减**：Weibull 衰减模型，自然淡化老旧记忆，保持记忆新鲜度
- **零配置**：默认配置即可工作，高级选项全部 YAML 化
- **stdio** — MCP 标准输入输出，适合 Claude Desktop / Cursor / Cline 等本地客户端
- **SSE** — HTTP 流式传输，支持远程连接和多客户端

---

## Installation

### Prerequisites

- Node.js ≥ 18
- Git
- 嵌入 API 密钥（OpenAI / SiliconFlow / Ollama 等）

### 1. Clone and install

```bash
git clone git@github.com:HACK-WU/memory-lancedb-mcp.git
cd memory-lancedb-mcp
npm install
npx tsc
```

`npm install` 会自动安装 `memory-lancedb-pro@beta`（含所有子依赖，包括 LanceDB）。

### 2. Initialize configuration

```bash
node ./bin/mem.mjs config init
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

### 3. Skip the parent project clone

**以前需要** clone 父仓库并手动 `tsc` 编译 dist/，现在已经不再需要。
memory-lancedb-mcp 通过 `jiti` 直接从 `node_modules/memory-lancedb-pro/` 加载 TypeScript 源文件，零额外步骤。

### Platform-Specific Notes

#### Linux (x64)

```bash
# LanceDB 需要 AVX2 指令集。如果报错 "Illegal instruction"：
# → 使用 
   AVX-only 构建或 ARM64 兼容版本

# 如缺少原生模块，手动安装：
npm install @lancedb/lancedb-linux-x64-gnu
```

#### WSL (Windows Subsystem for Linux)

```bash
# WSL 下 npm 可能检测为 Windows 平台，缺少 Linux 原生模块
# 报错: Cannot find module '@lancedb/lancedb-linux-x64-gnu'
#
# 解决方案 — 手动安装 Linux 原生模块：
npm pack @lancedb/lancedb-linux-x64-gnu --pack-destination /tmp
cd node_modules/@lancedb/
mkdir -p lancedb-linux-x64-gnu
tar -xzf /tmp/lancedb-lancedb-linux-x64-gnu-*.tgz -C lancedb-linux-x64-gnu/ --strip-components=1
```

#### macOS

无需额外操作，LanceDB 原生模块自动安装。

#### ARM64 / Apple Silicon

确保使用 ARM64 原生模块。如遇问题：
```bash
npm rebuild @lancedb/lancedb
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

### Scope 管理

```bash
# 列出所有 scope 及记忆数
node ./bin/mem.mjs scope list

# 预览删除（不实际删除）
node ./bin/mem.mjs scope delete myapp --dry-run

# 删除 scope 内所有记忆（需确认）
node ./bin/mem.mjs scope delete myapp --yes
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
| `memory_recall` | 混合检索（向量 + BM25），语义召回 |
| `memory_store` | 存储新记忆，自动分类 |
| `memory_forget` | 通过 ID 删除记忆 |
| `memory_update` | 更新已有记忆的文本/重要度 |
| `memory_stats` | 使用统计和 scope 分布 |
| `memory_debug` | 检索链路追踪和排名解释 |
| `memory_list` | 列表查看，支持按 scope/分类/时间过滤 |
| `memory_promote` | 提升为治理记忆（高优先级） |
| `memory_archive` | 归档（保留但排除召回） |
| `memory_compact` | 去重并压缩记忆 |
| `memory_explain_rank` | 解释记忆排名的原因 |
| `self_improvement_log` | 记录改进建议 |
| `self_improvement_extract_skill` | 从记忆中提取可复用技能 |
| `self_improvement_review` | 审阅待改进项 |
| `_lifecycle_auto_recall` | 自动召回（prompt 构建前） |
| `_lifecycle_auto_capture` | 自动捕获（agent 结束后） |
| `_lifecycle_session_end` | 会话清理和收尾 |

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

[MIT](LICENSE)

---

本项目基于 [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) 构建，感谢 CortexReach 团队的开源贡献。
