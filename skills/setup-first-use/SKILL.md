# 首次使用配置 SKILL

> AI 助手首次为用户配置 memory-lancedb-mcp 的完整流程。与用户确认前提条件，逐步完成安装、配置、验证。

## 触发场景

- 用户首次提及要使用 memory-lancedb-mcp / memory MCP / 长期记忆服务
- 用户要求"配置记忆服务"、"安装 mem"、"初始化记忆"
- `mem` 命令不存在或 `mem doctor` 报错需要重新配置

## 前置确认（必须先与用户确认）

**在执行任何操作前，必须逐一确认以下事项：**

### 1. Embedding 供应商与 API Key

向用户确认：
- 使用哪个 Embedding 供应商？

| 供应商 | baseURL | 需要的 API Key | 环境变量名 |
|--------|---------|---------------|------------|
| OpenAI（默认） | `https://api.openai.com/v1` | OpenAI API Key | `OPENAI_API_KEY` |
| SiliconFlow | `https://api.siliconflow.cn/v1` | SiliconFlow API Key | `SILICONFLOW_API_KEY` |
| Ollama（本地） | `http://localhost:11434/v1` | 无需 | — |
| Azure OpenAI | Azure 端点 | Azure API Key | `AZURE_OPENAI_API_KEY` |

- API Key 是否已获取？如果是环境变量引用方式，该环境变量是否已设置？
- 如果使用 Ollama，Ollama 服务是否已启动且目标模型已拉取？

### 2. Rerank（可选，但推荐）

向用户确认：
- 是否需要配置 Rerank（交叉编码器重排）？
  - **不配置**：自动退化为本地余弦相似度重排（零成本，精度一般）
  - **配置**：需要 Rerank API Key

| 供应商 | 环境变量名 | 推荐场景 |
|--------|-----------|---------|
| Jina | `JINA_API_KEY` | 国际用户，高质量 |
| SiliconFlow | `SILICONFLOW_API_KEY` | 国内用户，性价比高 |
| DashScope | `DASHSCOPE_API_KEY` | 中文优化 |
| TEI（自部署） | 无需 | 自部署，免费 |

> 如果用户不确定，建议先跳过 Rerank 配置，后续可随时添加。

### 3. LLM（可选，用于智能提取）

向用户确认：
- 是否启用智能提取（`smartExtraction`）？该功能需要 LLM API 将记忆自动分类为偏好/事实/决策/实体/其他。
  - **启用**：需要 LLM API Key（默认用 `gpt-4o-mini`，可与 Embedding 共用同一个 Key）
  - **禁用**：记忆只按基本分类存储，无需额外 API 调用

> 如果用户使用 OpenAI 且已有 Key，建议启用（无需额外成本）。

### 4. 运行环境

确认：
- Node.js >= 18 是否已安装？（`node -v` 检查）
- 是否需要多项目隔离？（默认 scope 为 `global`）

---

## 执行流程

```
确认前提条件
     │
     ▼
[Step 1] 安装 mem 命令
     │
     ▼
[Step 2] 初始化配置文件
     │
     ▼
[Step 3] 编辑配置（填入 API Key、选择供应商）
     │
     ▼
[Step 4] 验证配置
     │
     ▼
[Step 5] 健康检查
     │
     ▼
[Step 6] 端到端功能验证
     │
     ▼
配置完成
```

---

### Step 1: 安装 mem 命令

```bash
# 下载并执行安装脚本
curl -fsSL https://raw.githubusercontent.com/HACK-WU/memory-lancedb-mcp/master/scripts/install-latest.sh -o install-latest.sh
bash install-latest.sh
```

**验证安装**：
```bash
mem --version
```

如果安装失败，检查 Node.js 版本（需 >= 18）。

---

### Step 2: 初始化配置文件

```bash
mem config init
```

这会在 `~/.config/memory-mcp/config.yaml` 生成默认配置模板。

如果已有旧配置需要重置：
```bash
mem config init --force
```

---

### Step 3: 编辑配置文件

根据 Step 0 中用户确认的信息，编辑 `~/.config/memory-mcp/config.yaml`。

**场景 A：OpenAI（最常见）**

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
```

确保环境变量已设置：
```bash
export OPENAI_API_KEY="sk-..."
```

**场景 B：SiliconFlow（国内）**

```yaml
embedding:
  apiKey: "${SILICONFLOW_API_KEY}"
  model: "Qwen/Qwen3-Embedding-8B"
  baseURL: "https://api.siliconflow.cn/v1"
  dimensions: 4096
```

**场景 C：Ollama（本地，免费）**

```yaml
embedding:
  apiKey: ""
  model: "nomic-embed-text"
  baseURL: "http://localhost:11434/v1"
  dimensions: 768
```

**如果启用了 Rerank（以 Jina 为例）**，取消注释并填写：

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankModel: "jina-reranker-v3"
  rerankEndpoint: "https://api.jina.ai/v1/rerank"
  rerankApiKey: "${JINA_API_KEY}"
```

**如果启用了智能提取但 LLM 与 Embedding 供应商不同**：

```yaml
llm:
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4o-mini"
  baseURL: "https://api.openai.com/v1"
```

> **注意**：如果 LLM 和 Embedding 使用同一个 Key，可不配置 `llm`，系统会自动回退使用 `embedding.apiKey`。

---

### Step 4: 验证配置语法

```bash
mem config validate
```

预期输出：
```
✅ Config valid: ~/.config/memory-mcp/config.yaml
```

如果报错，根据提示修正配置文件。

---

### Step 5: 健康检查

```bash
mem doctor
```

**10 项检查全部通过**才算配置完成：

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Config file | 配置文件存在 |
| 2 | Config parses | YAML 语法正确 |
| 3 | Embedding API key | API 密钥已设置 |
| 4 | Rerank config | 重排配置有效（警告可接受） |
| 5 | Plugin loads | 运行时插件加载成功 |
| 6 | Tools registered | MCP 工具注册完成 |
| 7 | Embedding API | API 可连通，返回正确维度 |
| 8 | LanceDB read/write | 数据库读写正常 |
| 9 | LLM（条件） | LLM 可连通（仅 smartExtraction 启用时检查） |
| 10 | Rerank API（条件） | 重排管线正常（仅 cross-encoder 模式时检查） |

**常见问题处理**：

| 错误 | 原因 | 修复 |
|------|------|------|
| `❌ Embedding API key missing` | apiKey 未设置或环境变量未 export | 编辑配置或 `export OPENAI_API_KEY="sk-..."` |
| `❌ Embedding API: Connection refused` | baseURL 错误或网络不通 | 检查 API 地址和网络 |
| `❌ Embedding API: Invalid API key` | API Key 无效 | 重新获取正确的 Key |
| `⚠️ Rerank: ... apiKey=not set` | Rerank API Key 未设置 | 自动降级为 lightweight，可接受 |
| `❌ LanceDB: Cannot access database path` | 目录权限问题 | `mkdir -p ~/.local/share/memory-mcp/lancedb` |

---

### Step 6: 端到端功能验证

```bash
# 存储一条测试记忆
mem store "这是一条测试记忆" -c other -t test

# 语义搜索
mem search "测试记忆"

# 查看统计
mem stats
```

预期：搜索能返回刚才存储的记忆，stats 显示 1 条记录。

**验证完成后清理测试数据**：
```bash
# 查看记忆列表获取 ID
mem list

# 删除测试记忆
mem delete <memory-id>
```

---

## MCP 客户端集成

配置完成后，需要将 MCP Server 注册到客户端（如 Claude Desktop、Cursor、Cline 等）。

### stdio 模式（本地，推荐）

```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve"]
    }
  }
}
```

### SSE 模式（远程/多客户端）

SSE 模式支持 Bearer Token 鉴权，**绑定非回环地址（如 `0.0.0.0`）时必须配置鉴权**，否则服务拒绝启动。

#### 服务端启动

**场景 A：本地访问（免鉴权，默认绑定 127.0.0.1）**

```bash
mem serve --sse --port 3100
# 无需 token，仅本机可访问
```

**场景 B：远程访问（必须鉴权）**

```bash
# 方式 1：通过 --auth-token 传入
mem serve --sse --port 3100 --host 0.0.0.0 --auth-token "your-secret-token"

# 方式 2：通过环境变量传入（推荐，避免 token 出现在进程列表中）
export MEM_MCP_AUTH_TOKEN="your-secret-token"
mem serve --sse --port 3100 --host 0.0.0.0

# 方式 3：一次性生成随机 token 并启动
MEM_MCP_AUTH_TOKEN=$(openssl rand -hex 24) mem serve --sse --port 3100 --host 0.0.0.0
```

> **Token 安全建议**：长度 >= 16 位随机字符串。服务端启动时若 token 长度 < 16 会打印 WARNING。

#### 鉴权规则速查

| 启动方式 | host | token | 行为 |
|---------|------|-------|------|
| `mem serve --sse` | `127.0.0.1` | 无 | ✅ 启动，免鉴权 |
| `mem serve --sse --auth-token xxx` | `127.0.0.1` | 有 | ✅ 启动，启用鉴权 |
| `mem serve --sse --host 0.0.0.0 --auth-token xxx` | `0.0.0.0` | 有 | ✅ 启动，启用鉴权 |
| `mem serve --sse --host 0.0.0.0` | `0.0.0.0` | 无 | ❌ 拒绝启动 |
| `mem serve --sse --host 0.0.0.0 --no-auth` | `0.0.0.0` | — | ❌ 拒绝启动 |

> **Token 优先级**：`--auth-token` > `MEM_MCP_AUTH_TOKEN` 环境变量 > 无 token

#### 鉴权保护范围

启用鉴权后，所有 HTTP 请求均需携带 Bearer Token，仅以下请求豁免：
- `GET /health` — 健康检查
- `OPTIONS *` — CORS 预检请求

#### 客户端配置

**无鉴权（本地）**：
```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3100/sse"
    }
  }
}
```

**有鉴权（远程）**：
```json
{
  "mcpServers": {
    "memory": {
      "url": "http://your-server:3100/sse",
      "headers": {
        "Authorization": "Bearer your-secret-token"
      }
    }
  }
}
```

**有鉴权（URL Query 参数方式，部分客户端不支持 headers）**：
```
http://your-server:3100/sse?token=your-secret-token
```

> 客户端提取 token 优先级：`Authorization: Bearer xxx` Header > `?token=xxx` Query 参数

### 验证 MCP 连接

在客户端中尝试调用 `memory_store` 或 `memory_recall`，确认工具列表中出现了 17 个 memory_* 工具。

---

## 环境变量持久化

如果使用环境变量引用 API Key，确保它们持久化：

```bash
# 添加到 shell 配置文件
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc
source ~/.bashrc

# 或使用 .env 文件
echo 'OPENAI_API_KEY=sk-...' >> ~/.env
```

---

## 注意事项

1. **API Key 安全**：推荐使用 `${ENV_VAR}` 语法，避免明文存储在配置文件中
2. **Rerank 可后补**：初始配置可跳过 Rerank，后续在 `retrieval` 段添加即可
3. **配置修改后需重启**：MCP Server 不会热重载配置，修改后需重启 `mem serve`
4. **多项目隔离**：如需多项目隔离，在 `scopes.definitions` 中添加 scope 定义
5. **Ollama 需先拉模型**：使用 Ollama 前需执行 `ollama pull nomic-embed-text`

---

## 错误处理

| 错误 | 修复 |
|------|------|
| `mem: command not found` | 重新运行安装脚本，或检查 PATH |
| `mem config init` 报权限错误 | 检查 `~/.config/memory-mcp/` 目录权限 |
| `mem doctor` 全部失败 | 先确认 `mem config validate` 通过，再排查网络 |
| Embedding API 超时 | 检查网络连通性，可能需要配置代理 |
| LanceDB 锁文件冲突 | 删除 `~/.local/share/memory-mcp/lancedb/*.lock` |

---

## 相关文档

- [配置指南](docs/config/README.md) - 完整配置模板与字段说明
- [嵌入配置](docs/config/embedding.md) - Embedding 供应商详解
- [重排配置](docs/config/rerank.md) - Rerank 供应商详解
- [doctor 命令](docs/cli/doctor.md) - 健康检查详解
- [高级配置](docs/config/advanced.md) - 高级配置选项
