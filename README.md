# memory-lancedb-mcp

为 AI 应用提供**持久化长期记忆**的 MCP Server。支持语义检索、多项目隔离、自动分类与衰减，让 AI 助手记住用户偏好、项目架构、历史决策等关键信息，实现越用越懂你的个性化体验。

**核心能力来自** [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) — 一个由 [CortexReach](https://github.com/CortexReach) 团队开源的 LanceDB 向量记忆引擎，提供混合检索（向量 + BM25）、Weibull 衰减、智能提取等企业级记忆管理功能。

> 感谢 CortexReach 团队开源 memory-lancedb-pro，本项目基于其核心能力进行 MCP 协议桥接与扩展。

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

## CLI Reference

> **提示**：如果 node 不在 PATH 中，所有 `mem` 替换为 `node ./bin/mem.mjs`。
> 所有命令均支持 `--config <path>` 指定配置文件。

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
| `--dry-run` | 验证配置并列出工具，不启动服务 |
| `-q, --quiet` | 抑制调试日志 |

```bash
# stdio 模式（本地 MCP 客户端）
mem serve

# 指定项目 scope
mem serve --scope myapp

# SSE 模式（远程或 docker）
mem serve --sse --port 3100 --host 0.0.0.0

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

通过 `--scope` 参数实现不同项目之间的记忆完全隔离：

### 工作原理

memory-lancedb-pro 基于 **agent scope** 进行隔离。每个 `--scope` 值会被映射为一个独立的 agent ID，所有存储和检索操作自动限定在该 scope 内。

```
项目 A: mem serve --scope myapp      → scope agent:myapp
项目 B: mem serve --scope backend     → scope agent:backend
项目 C: mem serve --scope docs-site   → scope agent:docs-site
```

三条记忆互不交叉，`memory_recall`、`memory_list`、`memory_stats` 均只返回各自项目的记忆。

### 权限模型

| 启动方式 | 可操作的 Scope |
|----------|---------------|
| 未指定 `--scope`（默认 agent:main） | 仅 `agent:main`、`global` |
| `--scope myapp` | 仅 `agent:myapp`、`global` |
| `--scope backend` | 仅 `agent:backend`、`global` |

`memory_store` 指定 `scope:"agent:test-project"` 时会被拒绝，除非服务以 `--scope test-project` 启动。这是安全特性，防止项目间的记忆交叉污染。

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
