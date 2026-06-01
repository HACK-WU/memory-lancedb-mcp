# memory-lancedb-mcp

为 AI 应用提供**持久化长期记忆**的 MCP Server。支持语义检索、多项目隔离、自动分类与衰减，让 AI 助手记住用户偏好、项目架构、历史决策等关键信息，实现越用越懂你的个性化体验。

**核心能力来自** [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) — 一个由 [CortexReach](https://github.com/CortexReach) 团队开源的 LanceDB 向量记忆引擎，提供混合检索（向量 + BM25）、Weibull 衰减、智能提取等企业级记忆管理功能。

> 感谢 CortexReach 团队开源 memory-lancedb-pro，本项目基于其核心能力进行 MCP 协议桥接与扩展。

> **使用手册**：[docs/USAGE_GUIDE.md](./docs/USAGE_GUIDE.md) — 全面的 CLI + MCP 工具使用指南，包含存储/召回最佳实践、标签系统、故障排除等。

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
- 嵌入 API 密钥（OpenAI / SiliconFlow / Ollama 等）
- `mem` 命令（通过全局安装获得，见下方安装步骤）

### 1. 全局安装（推荐）

从 GitHub Release 直接安装预编译包，**无需本地 clone 和构建**：

```bash
npm install -g https://github.com/HACK-WU/memory-lancedb-mcp/releases/download/v0.1.0/memory-lancedb-mcp-0.1.0.tgz
```

安装完成后，`mem` 命令即可全局使用：

```bash
mem --help
mem serve
```

> ⚠️ **重要**：`mem` 是本项目的核心命令，所有 MCP 服务、CLI 操作和知识索引功能都依赖它。请确保在全局安装后再使用本项目。

> 💡 如需安装其他版本，替换 URL 中的版本号即可。可在 [Releases 页面](https://github.com/HACK-WU/memory-lancedb-mcp/releases) 查看所有可用版本。

### 2. 从源码安装（开发者）

如需参与开发或自定义修改，可以从源码安装：

```bash
git clone git@github.com:HACK-WU/memory-lancedb-mcp.git
cd memory-lancedb-mcp
npm install
npm run build
npm link   # 将 mem 命令链接到全局
```

`npm install` 会自动安装 `memory-lancedb-pro`（含所有子依赖，包括 LanceDB）。

### 3. Initialize configuration

```bash
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

### Platform-Specific Notes

#### Linux (x64)

```bash
# LanceDB 需要 AVX2 指令集。如果报错 "Illegal instruction"：
# → 使用 AVX-only 构建或 ARM64 兼容版本

# 如缺少原生模块，手动安装：
npm install -g @lancedb/lancedb-linux-x64-gnu
```

#### WSL (Windows Subsystem for Linux)

```bash
# WSL 下 npm 可能检测为 Windows 平台，缺少 Linux 原生模块
# 报错: Cannot find module '@lancedb/lancedb-linux-x64-gnu'
#
# 解决方案 — 手动安装 Linux 原生模块：
npm pack @lancedb/lancedb-linux-x64-gnu --pack-destination /tmp
cd $(npm root -g)/@lancedb/
mkdir -p lancedb-linux-x64-gnu
tar -xzf /tmp/lancedb-lancedb-linux-x64-gnu-*.tgz -C lancedb-linux-x64-gnu/ --strip-components=1
```

#### macOS

无需额外操作，LanceDB 原生模块自动安装。

#### ARM64 / Apple Silicon

确保使用 ARM64 原生模块。如遇问题：
```bash
npm rebuild -g @lancedb/lancedb
```

---

## MCP Client Configuration

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 或对应平台的配置文件：

```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

启用项目隔离（`--scope` 和值必须分开写）：

```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve", "--scope", "project:myapp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

> 💡 全局安装后 `mem` 命令直接可用。如果 Claude Desktop 找不到 `mem`，请使用完整路径：
> `"command": "node", "args": ["/usr/local/lib/node_modules/memory-lancedb-mcp/bin/mem.mjs", "serve"]`
> （路径取决于你的 npm 全局安装位置，可通过 `which mem` 查看）

重启 Claude Desktop 后，在对话中即可使用记忆工具：
- 说 "请帮我记住这个项目的架构" → 触发 `memory_store`
- 说 "关于包管理器，我之前有什么偏好？" → 触发 `memory_recall`

### Cursor

在 Cursor 的 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve"],
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
  "command": "mem",
  "args": ["serve"],
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
      "command": "mem",
      "args": ["serve"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  ]
}
```

### SSE Mode (远程/多客户端)

适用于需要跨网络连接的场景，如 Docker、WSL、远程服务器：

```bash
# ✅ 本地访问（默认绑定 127.0.0.1，免 token）
mem serve --sse --port 3100

# ✅ 远程访问：必须配置 Bearer token
MEM_MCP_AUTH_TOKEN=$(openssl rand -hex 24) \
  mem serve --sse --port 3100 --host 0.0.0.0

# 或显式传入 token
mem serve --sse --port 3100 --host 0.0.0.0 --auth-token "<token>"
```

#### 启动方式 vs 鉴权要求对照表

| 启动方式 | host | token | 行为 |
|---------|------|-------|------|
| `mem serve --sse` | `127.0.0.1` | 无 | ✅ 启动，免鉴权（保留本地开发体验） |
| `mem serve --sse --auth-token xxx` | `127.0.0.1` | 有 | ✅ 启动，启用鉴权 |
| `mem serve --sse --host 0.0.0.0 --auth-token xxx` | `0.0.0.0` | 有 | ✅ 启动，启用鉴权 |
| `mem serve --sse --host 0.0.0.0` | `0.0.0.0` | 无 | ❌ 拒绝启动（避免裸奔） |
| `mem serve --sse --host 0.0.0.0 --no-auth` | `0.0.0.0` | — | ❌ 拒绝启动（`--no-auth` 仅限回环） |

> ⚠️ **破坏性变更**：升级到本版本后，`mem serve --sse --host 0.0.0.0` 不再允许免 token 启动。
> 必须配合 `--auth-token <token>` 或环境变量 `MEM_MCP_AUTH_TOKEN`，否则启动会立即失败。

#### 鉴权保护范围

启用鉴权后，**所有 HTTP 路径默认受保护**（白名单模式），仅以下请求豁免：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/health` | `GET` | 健康检查，供负载均衡器探活 |
| 任意路径 | `OPTIONS` | CORS 预检请求，必须放行 |

其余所有路径（`/sse`、`/message` 等）均需携带有效 Bearer token，否则返回 `401`。

#### 客户端如何携带 token

**1. IDE / MCP 客户端（推荐 Authorization 头）**

```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3100/sse",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

**2. curl 调试**

```bash
curl -H "Authorization: Bearer <your-token>" http://host:3100/sse
```

**3. 浏览器 EventSource（兜底用 query 参数）**

```js
// 浏览器原生 EventSource 无法自定义 header，仅此场景使用 query 兜底
const es = new EventSource("http://host:3100/sse?token=<your-token>");
```

> ⚠️ **query 参数的安全注意**：`?token=xxx` 会进入 access log / 反向代理日志 /
> 浏览器历史记录。**仅在受控网络或调试时使用**；生产环境优先使用 `Authorization` 头。
> 服务端已自动添加 `Referrer-Policy: no-referrer` 响应头，可防止 token 通过浏览器
> `Referer` 头泄漏到第三方站点。

#### 鉴权配置优先级

1. CLI `--auth-token <token>` （最高优先级）
2. 环境变量 `MEM_MCP_AUTH_TOKEN`
3. `--no-auth` （显式关闭，**仅在回环监听时允许**）

 token 长度 < 16 字符时会打印 WARN 但允许启动；建议使用 ≥24 位的随机字符串。
> token 长度超过 1024 字符将被拒绝（防止 DoS），并通过时序安全比较防御侧信道攻击。

#### CORS 策略

SSE 模式下 CORS 行为：

- **有 `Origin` 请求头**：动态回显该 Origin 值到 `Access-Control-Allow-Origin`，并添加 `Vary: Origin`，确保浏览器缓存正确区分不同来源。
- **无 `Origin` 请求头**（如 curl、非浏览器客户端）：不设置 `Access-Control-Allow-Origin`。
- `Access-Control-Allow-Headers` 包含 `Authorization`，支持 Bearer token 预检。
- 所有响应自动添加 `Referrer-Policy: no-referrer`，防止敏感信息通过 `Referer` 头泄漏。

---

## CLI Reference

> **提示**：全局安装后 `mem` 命令直接可用。所有命令均支持 `--config <path>` 指定配置文件。
> 如未全局安装，可将 `mem` 替换为 `node ./bin/mem.mjs`。

### serve — 启动 MCP 服务

```
mem serve [options]
```

| 参数 | 说明 |
|------|------|
| `-c, --config <path>` | 配置文件路径 |
| `-s, --scope <scope>` | 项目隔离 scope（如 myapp） |
| `--sse` | 切换为 SSE 模式（默认 stdio） |
| `-p, --port <n>` | SSE 端口（默认 3100） |
| `--host <host>` | SSE 绑定地址（默认 127.0.0.1） |
| `--auth-token <token>` | SSE Bearer token（覆盖 `MEM_MCP_AUTH_TOKEN` 环境变量） |
| `--no-auth` | 显式关闭 SSE 鉴权（仅当监听回环地址时允许） |
| `--dry-run` | 验证配置并列出工具，不启动服务 |
| `-q, --quiet` | 抑制调试日志 |

```bash
# stdio 模式（本地 MCP 客户端）
mem serve

# 指定项目 scope
mem serve --scope myapp

# SSE 模式（本地，默认免 token）
mem serve --sse --port 3100

# SSE 模式（远程，必须配置 token）
MEM_MCP_AUTH_TOKEN=<token> mem serve --sse --host 0.0.0.0 --port 3100

# 预览注册的工具
mem serve --dry-run
```

### store — 存储记忆

```
mem store <text> [options]
```

| 参数 | 说明 |
|------|------|
| `-c, --category <cat>` | 记忆分类：`preference` / `fact` / `decision` / `entity` / `other` |
| `-t, --tags <tags>` | 自定义标签，逗号分隔（如 `profile,project,tech`） |
| `-i, --importance <n>` | 重要度 0-1（默认 0.7） |
| `-s, --scope <scope>` | 目标 scope |

```bash
mem store "用户偏好使用 pnpm" -c preference -t tech,tools -i 0.9
mem store "项目基于 LanceDB 存储" -c fact --scope myapp
```

### search — 语义搜索

```
mem search <query> [options]
```

| 参数 | 说明 |
|------|------|
| `-s, --scope <scope>` | 限定 scope |
| `-t, --tags <tags>` | 标签过滤（逗号分隔） |
| `-l, --limit <n>` | 最大结果数（默认 5） |
| `--json` | JSON 输出 |

```bash
mem search "包管理器偏好" -s myapp -l 10
mem search "工程师" -t profile
mem search "数据库" -t project --json
```

### list — 列表查看

```
mem list [options]
```

| 参数 | 说明 |
|------|------|
| `-s, --scope <scope>` | scope 过滤 |
| `-c, --category <cat>` | category 过滤 |
| `-t, --tags <tags>` | 标签过滤（逗号分隔） |
| `-l, --limit <n>` | 最大条数（默认 10） |
| `--offset <n>` | 分页偏移（默认 0） |
| `--json` | JSON 输出 |

```bash
mem list -s myapp -c preference -l 20
mem list -t profile,tech
mem list --json
```

### stats — 统计信息

```
mem stats [options]
```

| 参数 | 说明 |
|------|------|
| `-s, --scope <scope>` | scope 过滤 |
| `--json` | JSON 输出 |

### delete — 删除记忆

```
mem delete <uuid>
```

### scope — Scope 管理

```
mem scope list
mem scope delete <scope> [--dry-run] [--yes]
```

| 参数 | 说明 |
|------|------|
| `--dry-run` | 预览将删除的数量，不实际删除 |
| `--yes` | 跳过确认，直接删除 |

### config — 配置管理

```
mem config init [-f, --force]
mem config show [--json]
mem config path
```

| 参数 | 说明 |
|------|------|
| `-f, --force` | 覆盖已有配置文件 |
| `--json` | JSON 输出 |

### doctor — 健康检查

```
mem doctor [--config <path>] [--mcp]
```

| 参数 | 说明 |
|------|------|
| `--mcp` | 测试 MCP 协议握手 |

---

## Multi-Project Isolation

通过 `--scope` 参数实现不同项目之间的记忆完全隔离。支持两种运行模式：

### 运行模式

| 模式 | 启动方式 | 行为 |
|------|----------|------|
| **跨 scope 模式** | `mem serve`（不指定 `--scope`） | 可读写任意 scope；`memory_store` 不指定 scope 时自动写入 `global` |
| **锁定 scope 模式** | `mem serve --scope X` | 所有操作强制锁定在 scope X 内；请求其他 scope 会被拒绝 |

### 跨 scope 模式（默认）

不指定 `--scope` 时，服务以跨 scope 模式运行：

- `memory_store` 不指定 scope → 自动写入 `global`（避免写入 `agent:system` 私有空间）
- `memory_store` 指定 `scope: "project:alpha"` → 写入 `project:alpha`
- `memory_recall` 不指定 scope → 跨 scope 返回相关记忆
- `memory_recall` 指定 scope → 只返回该 scope 的记忆

```bash
mem serve                          # 跨 scope 模式
mem store "通用知识"               # → 写入 global
mem store "项目A信息" --scope project:alpha  # → 写入 project:alpha
mem search "架构设计"              # → 跨 scope 搜索
mem search "架构设计" --scope project:alpha  # → 仅搜索 project:alpha
```

### 锁定 scope 模式

指定 `--scope X` 时，服务以锁定模式运行，**所有操作强制限定在 scope X 内**：

- `memory_store` 不指定 scope → 写入 scope X
- `memory_store` 指定 `scope: "X"`（与服务端一致）→ 允许，写入 scope X
- `memory_store` 指定 `scope: "Y"`（与服务端不一致）→ **拒绝**，返回 scope 不匹配错误
- `memory_recall` → 只返回 scope X 的记忆，不会泄漏其他 scope

```bash
mem serve --scope project:alpha    # 锁定到 project:alpha
mem store "项目A信息"              # → 写入 project:alpha
mem store "项目A信息" --scope project:alpha  # → 允许，写入 project:alpha
mem store "其他信息" --scope global # → 拒绝：Scope mismatch
mem search "架构"                  # → 仅返回 project:alpha 的记忆
```

### 工作原理

memory-lancedb-pro 基于 **scope ACL** 进行隔离。锁定模式下，wrapper 使用 `agentId="system"`（系统级绕过 ID）通过 ACL 检查，同时在 wrapper 层强制将 `normalized.scope` 设为服务端 scope 值，确保：

1. ACL 检查通过（`isSystemBypassId("system")` 使 `isAccessible()` 返回 true）
2. 实际写入的 scope 始终是服务端指定的值
3. 不一致的 scope 请求在进入插件前即被拒绝

### 使用示例

```bash
# 跨 scope 模式（stdio）
mem serve

# 锁定 scope 模式（stdio）
mem serve --scope project:myapp

# 锁定 scope + SSE 远程模式
mem serve --sse --port 3100 --scope project:myapp

# CLI 查看特定项目的记忆
mem list --scope project:myapp --limit 10
mem search "TypeScript" --scope project:myapp
mem stats --scope project:myapp

# 删除整个 scope 的所有记忆
mem scope delete project:myapp --yes
```

### MCP 客户端配置（多项目）

> **注意**：`--scope` 和值必须作为 `args` 数组中的**两个独立元素**，不能写成 `"--scope myapp"` 一个字符串。

```json
{
  "mcpServers": {
    "memory-app-a": {
      "command": "mem",
      "args": ["serve", "--scope", "project:myapp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    },
    "memory-app-b": {
      "command": "mem",
      "args": ["serve", "--scope", "backend"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

SSE 远程模式配置（远程访问需携带 token）：

```json
{
  "mcpServers": {
    "memory-remote": {
      "url": "http://remote-host:3100/sse",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

### Scope 管理

```bash
# 列出所有 scope 及记忆数量
mem scope list

# 预览删除范围（不实际删除）
mem scope delete project:old --dry-run

# 确认删除整个 scope（会永久删除该 scope 内所有记忆数据）
mem scope delete project:old --yes
```

---

## MCP Tool Reference

### 记忆管理

#### memory_store — 存储记忆

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `text` | string | ✅ | 记忆内容 |
| `category` | preference / fact / decision / entity / reflection / other | | 记忆分类 |
| `tags` | string | | 自定义标签，逗号分隔（自动嵌入 text 前缀） |
| `importance` | number 0-1 | | 重要度（默认 0.7） |
| `scope` | string | | 目标 scope（默认 agent scope） |

#### memory_recall — 语义召回

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `query` | string | ✅ | 搜索关键词 |
| `limit` | number | | 最大结果数（默认 5，最大 20） |
| `scope` | string | | 限定 scope |
| `category` | preference / fact / decision / entity / reflection / other | | 限定分类 |
| `tags` | string | | 标签过滤（嵌入 query 前缀，BM25 命中） |

#### memory_list — 列表查看

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `limit` | number | | 最大条数（默认 10，最大 50） |
| `offset` | number | | 分页偏移（默认 0） |
| `scope` | string | | 限定 scope |
| `category` | string | | 限定分类 |
| `tags` | string | | 标签过滤（逗号分隔） |

#### memory_forget — 删除记忆

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `memoryId` | string | 二选一 | 直接按 ID 删除 |
| `query` | string | 二选一 | 搜索后选择删除 |

#### memory_update — 更新记忆

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `query` | string | ✅ | 搜索匹配要更新的记忆 |
| `text` | string | | 新文本内容 |
| `importance` | number 0-1 | | 新重要度 |
| `category` | preference / ... | | 新分类 |

#### memory_stats — 统计信息

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `scope` | string | | 限定 scope |

### 治理与管理

以下工具为高级治理功能，用于记忆的归档、提升、去重和调试：

| 工具 | 说明 |
|------|------|
| `memory_debug` | 检索链路追踪和排名解释 |
| `memory_promote` | 提升为治理记忆（高优先级，不会被衰减淘汰） |
| `memory_archive` | 归档（保留但排除召回） |
| `memory_compact` | 去重并压缩记忆 |
| `memory_explain_rank` | 解释记忆排名的原因 |

### 自我改进

| 工具 | 说明 |
|------|------|
| `self_improvement_log` | 记录改进建议或错误经验 |
| `self_improvement_extract_skill` | 从记忆提取可复用的技能/规范 |
| `self_improvement_review` | 审阅积压的待改进项 |

### 生命周期（内部）

以下工具由 MCP 服务生命周期自动触发，通常无需手动调用：

| 工具 | 说明 |
|------|------|
| `_lifecycle_auto_recall` | 自动召回（prompt 构建前注入上下文） |
| `_lifecycle_auto_capture` | 自动捕获（agent 结束后提取关键信息） |
| `_lifecycle_session_end` | 会话清理和收尾 |

### Scope 与 Category 参数

`memory_store`、`memory_recall`、`memory_list`、`memory_stats` 均支持 `scope` 和 `category` 参数在调用时限制操作范围。
当前 agent 只能操作自身 scope 内的记忆（权限模型见 [Multi-Project Isolation](#multi-project-isolation)）。

### Tags 标签

突破 category 固有限制，支持自定义**多标签分类**（如 `profile`、`project`、`tech`）。

**存储机制**：tags 以 `【标签:x,y】` 前缀嵌入 text 字段，不修改父项目的 TypeBox schema。

```
mem store "用户是全栈工程师" --tags profile,tech
→ text = "【标签:profile,tech】 用户是全栈工程师"
```

**检索机制**：BM25 自然命中标签前缀，无需额外索引。结果展示时自动剥离前缀。

```
mem search "工程师" --tags profile    → 只返回含 profile 标签的记忆
mem list --tags profile,tech          → 按标签过滤列表
```

**MCP 调用约定**：AI 助手直接传 `tags` 参数即可，wrapper 自动处理前缀嵌入。

```json
{ "text": "用户信息", "category": "other", "tags": "profile,tech" }
```

**标签命名约束**：标签内容仅允许下列字符：

- 字母、数字
- `_`、`-`、`:`、`/`、`.`
- CJK 中文字符（`\u4e00-\u9fff`）
- `,` 作为分隔符

保留字符 `【` 和 `】` 是前缀语法的边界标记，**禁止用于标签名**；空格、emoji、其他标点也会被拒绝。
传入非法字符时 wrapper / CLI 会直接抛出 `Invalid tag value: ...` 错误，不会静默落库，避免破坏前缀结构造成检索/剥离异常。

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

### 重排模型配置（Rerank）

重排模型对混合检索的候选结果进行二次精排，显著提升检索精度。支持以下模式：

| 模式 | 说明 | API 开销 |
|------|------|----------|
| `cross-encoder` | 调用重排 API（推荐，精度最高） | 每次检索一次 API 调用 |
| `lightweight` | 本地余弦相似度重排（零成本，精度一般） | 无 |
| `none` | 关闭重排 | 无 |

默认 `rerank: "cross-encoder"`。若未配置 `rerankApiKey`，自动退化为 `lightweight` 模式。

**支持的供应商：**

| 供应商 | rerankProvider | 默认模型 | 说明 |
|--------|---------------|---------|------|
| Jina | `jina` | `jina-reranker-v3` | 推荐，高质量 |
| SiliconFlow | `siliconflow` | `BAAI/bge-reranker-v2-m3` | Jina 兼容格式，国内访问友好 |
| DashScope | `dashscope` | `gte-rerank-v2` | 阿里云，中文优化 |
| Voyage | `voyage` | `rerank-3` | 多语言支持 |
| Pinecone | `pinecone` | `pinecone-rerank-v0` | Pinecone 生态 |
| HuggingFace TEI | `tei` | 自选 | 自部署，免费 |

**配置示例：**

Jina（推荐）：
```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankModel: "jina-reranker-v3"
  rerankEndpoint: "https://api.jina.ai/v1/rerank"
  rerankApiKey: "${JINA_API_KEY}"
```

SiliconFlow（国内推荐）：
```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "siliconflow"
  rerankModel: "BAAI/bge-reranker-v2-m3"
  rerankEndpoint: "https://api.siliconflow.cn/v1/rerank"
  rerankApiKey: "${SILICONFLOW_API_KEY}"
```

DashScope（中文优化）：
```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "dashscope"
  rerankModel: "gte-rerank-v2"
  rerankEndpoint: "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
  rerankApiKey: "${DASHSCOPE_API_KEY}"
```

自部署 TEI（免费）：
```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "tei"
  rerankModel: "BAAI/bge-reranker-v2-m3"
  rerankEndpoint: "http://localhost:8080/rerank"
  rerankApiKey: ""
```

关闭重排：
```yaml
retrieval:
  rerank: "none"
```

**完整检索参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `retrieval.mode` | `hybrid` | 检索模式：`hybrid`（向量+BM25）或 `vector`（纯向量） |
| `retrieval.vectorWeight` | `0.7` | 向量检索权重 |
| `retrieval.bm25Weight` | `0.3` | BM25 检索权重 |
| `retrieval.minScore` | `0.3` | 最低分数阈值 |
| `retrieval.hardMinScore` | `0.35` | 重排后硬性最低分数 |
| `retrieval.rerank` | `cross-encoder` | 重排模式 |
| `retrieval.rerankProvider` | `jina` | 重排 API 供应商 |
| `retrieval.rerankModel` | `jina-reranker-v3` | 重排模型名称 |
| `retrieval.rerankEndpoint` | Jina 默认 | 重排 API 端点 |
| `retrieval.rerankApiKey` | — | 重排 API 密钥 |
| `retrieval.rerankTimeoutMs` | `5000` | 重排 API 超时（毫秒） |
| `retrieval.candidatePoolSize` | `20` | 候选池大小 |
| `retrieval.filterNoise` | `true` | 是否过滤噪声结果 |

### 环境变量

| Variable | Description |
|----------|-------------|
| `MEM_CONFIG_PATH` | 覆盖默认配置文件路径 |
| `MEM_MCP_AUTH_TOKEN` | SSE 模式 Bearer token（可被 `--auth-token` 覆盖） |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `SILICONFLOW_API_KEY` | SiliconFlow API 密钥 |
| `JINA_API_KEY` | Jina Rerank API 密钥 |
| `DASHSCOPE_API_KEY` | DashScope Rerank API 密钥 |
| `VOYAGE_API_KEY` | Voyage Rerank API 密钥 |
| `PINECONE_API_KEY` | Pinecone Rerank API 密钥 |

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
