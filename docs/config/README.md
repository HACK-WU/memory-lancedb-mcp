# 配置指南

memory-lancedb-mcp 使用 YAML 配置文件管理所有配置选项。本文档介绍配置系统的基本概念和使用方法。

## 配置文件位置

默认配置文件路径：`~/.config/memory-mcp/config.yaml`

**配置文件查找顺序**：
1. `MEM_CONFIG_PATH` 环境变量指定的路径
2. `~/.config/memory-mcp/config.yaml`（默认位置）
3. 当前目录下的 `config.yaml`

## 配置文件管理

### 初始化配置

```bash
# 创建默认配置文件
mem config init

# 强制覆盖已有配置文件
mem config init --force
```

### 查看配置

```bash
# 显示当前配置（敏感信息已掩码）
mem config show

# 显示配置文件路径
mem config path
```

### 验证配置

```bash
# 验证配置有效性
mem config validate
```

## 初始配置模板

运行 `mem config init` 后，会在 `~/.config/memory-mcp/config.yaml` 生成以下配置：

```yaml
# ── 数据库存储路径 ──────────────────────────────────────
dbPath: "~/.local/share/memory-mcp/lancedb"

# ── 嵌入模型配置（必填）──────────────────────────────────
embedding:
  # provider: "openai-compatible"
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  # dimensions: 1536  # 自动从模型名称检测

# ── 大语言模型（可选，用于智能分类）───────────────────────
# llm:
#   apiKey: "${OPENAI_API_KEY}"
#   model: "gpt-4o-mini"
#   baseURL: "https://api.openai.com/v1"

# ── 自动记忆提取 ────────────────────────────────────────
autoCapture: true          # 是否从对话中自动提取记忆

# ── 自动记忆注入 ────────────────────────────────────────
autoRecall: false          # 是否在处理前自动注入相关记忆
# autoRecallMinLength: 10   # 触发注入的最小用户消息长度
# autoRecallMaxItems: 10    # 单次最多注入条数
# autoRecallMaxChars: 4000  # 单次最多注入字符数
# autoRecallTimeoutMs: 2000 # 注入超时(ms)

# ── 智能提取 ────────────────────────────────────────────
smartExtraction: true      # 启用 LLM 六分类(偏好/事实/决策/实体/其他)
extractMinMessages: 2      # 最少累积 N 条消息才触发提取
extractMaxChars: 8000      # 单次提取最大字符数

# ── 管理工具 ────────────────────────────────────────────
enableManagementTools: true # 暴露 memory_stats / memory_list 等管理工具

# ── 其他可选项 ──────────────────────────────────────────
# captureAssistant: true    # 是否也从 assistant 回复中提取记忆
# mdMirror:                 # 将记忆导出为 Markdown 文件(方便人类浏览)
#   enabled: false
#   dir: "~/.local/share/memory-mcp/mirror"
sessionStrategy: "none"    # MCP 模式下建议为 none

# ── 检索配置 ────────────────────────────────────────────
retrieval:
  mode: "hybrid"           # 检索模式: hybrid(向量+BM25) | vector | bm25
  vectorWeight: 0.7        # 向量搜索权重 (0~1)，BM25 权重 = 1 - vectorWeight
  bm25Weight: 0.3          # BM25 关键词匹配权重
  filterNoise: true        # 过滤低质量/噪音记忆
  minScore: 0.3            # 最低相似度阈值 (0~1)
  hardMinScore: 0.35       # 硬性分数阈值，低于此值的直接丢弃

  # 重排序 — 用交叉编码器对召回结果二次打分，大幅提升精度
  # 未配置 rerankApiKey 时自动退化为轻量级余弦相似度重排
  # 设置为 "none" 可完全禁用重排
  rerank: "cross-encoder"
  # rerankTimeoutMs: 5000   # 重排 API 超时(ms)

  # ── 推荐: Jina Reranker (高质量) ──
  # rerankProvider: "jina"
  # rerankModel: "jina-reranker-v3"
  # rerankEndpoint: "https://api.jina.ai/v1/rerank"
  # rerankApiKey: "${JINA_API_KEY}"

  # ── SiliconFlow (Jina 兼容 API) ──
  # rerankProvider: "siliconflow"
  # rerankModel: "BAAI/bge-reranker-v2-m3"
  # rerankEndpoint: "https://api.siliconflow.cn/v1/rerank"
  # rerankApiKey: "${SILICONFLOW_API_KEY}"

  # ── 阿里云 DashScope (中英文优化) ──
  # rerankProvider: "dashscope"
  # rerankModel: "gte-rerank-v2"
  # rerankEndpoint: "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
  # rerankApiKey: "${DASHSCOPE_API_KEY}"

  # ── Voyage ──
  # rerankProvider: "voyage"
  # rerankModel: "rerank-3"
  # rerankEndpoint: "https://api.voyageai.com/v1/rerank"
  # rerankApiKey: "${VOYAGE_API_KEY}"

  # ── Pinecone ──
  # rerankProvider: "pinecone"
  # rerankModel: "pinecone-rerank-v0"
  # rerankEndpoint: "https://api.pinecone.io/rerank"
  # rerankApiKey: "${PINECONE_API_KEY}"

  # ── HuggingFace TEI (自部署) ──
  # rerankProvider: "tei"
  # rerankModel: "BAAI/bge-reranker-v2-m3"
  # rerankEndpoint: "http://localhost:8080/rerank"
  # rerankApiKey: ""

  # ── 候选池与时间衰减调优 ──
  # candidatePoolSize: 50    # 粗筛候选池大小
  # recencyHalfLifeDays: 30  # 时间衰减半衰期（天），越近的记忆权重越高
  # recencyWeight: 0.1       # 时间衰减比重

# ── 多项目/多租户隔离 ───────────────────────────────────
scopes:
  default: "global"

# ── 自我改进治理 ────────────────────────────────────────
selfImprovement:
  enabled: true            # 启用自我改进功能
  beforeResetNote: true    # 对话重置前自动记录关键记忆
  ensureLearningFiles: true # 确保学习目录存在
```

### 最简配置

仅须填入 Embedding API Key 即可运行：

```yaml
embedding:
  apiKey: "sk-your-key-here"   # 或使用 "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
```

> 推荐使用 `${ENV_VAR}` 语法引用环境变量（如模板中的 `${OPENAI_API_KEY}`），避免敏感信息明文存储。

---

## 配置段详解

### `embedding` — 嵌入模型（必填）

将文本转为向量的模型，是语义检索的核心。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `apiKey` | `string \| string[]` | ✅ | — | API 密钥，支持 `${ENV_VAR}` 语法；数组时轮询使用 |
| `model` | `string` | ❌ | `text-embedding-3-small` | 嵌入模型名称 |
| `baseURL` | `string` | ❌ | `https://api.openai.com/v1` | API 地址，换供应商时修改此项 |
| `provider` | `string` | ❌ | `openai-compatible` | 供应商类型 |
| `dimensions` | `number` | ❌ | 自动检测 | 向量维度，非标准模型需手动指定 |
| `chunking` | `boolean` | ❌ | `true` | 是否开启文本分段 |
| `requestDimensions` | `number` | ❌ | — | 请求维度（某些模型支持） |
| `omitDimensions` | `boolean` | ❌ | `false` | 是否省略维度参数 |
| `normalized` | `boolean` | ❌ | `true` | 是否归一化向量 |

**常用供应商示例**：

| 供应商 | baseURL | model 示例 | dimensions |
|--------|---------|------------|------------|
| OpenAI | `https://api.openai.com/v1` | `text-embedding-3-small` | 1536 |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `Qwen/Qwen3-Embedding-8B` | 4096 |
| Ollama | `http://localhost:11434/v1` | `nomic-embed-text` | 768 |

> 详细说明：[嵌入配置](embedding.md)

### `llm` — 大语言模型（可选）

仅在使用智能提取（`smartExtraction: true`）时需要，用于将对话内容分类为"偏好/事实/决策/实体/其他"六种类型。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKey` | `string` | ❌ | LLM API 密钥。如未设置，回退使用 `embedding.apiKey` 的第一个元素 |
| `model` | `string` | ❌ | 模型名，默认 `gpt-4o-mini` |
| `baseURL` | `string` | ❌ | API 地址 |

```yaml
llm:
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4o-mini"
  baseURL: "https://api.openai.com/v1"
```

> **回退链**：`llm.apiKey` → `embedding.apiKey`（取第一个元素）。即只需配一个 key 即可同时用于 embedding 和 LLM。

### `autoCapture` — 自动提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoCapture` | `boolean` | `true` | 是否从对话中自动提取记忆 |

### `autoRecall` — 自动注入

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoRecall` | `boolean` | `false` | 是否在处理前自动注入相关记忆 |
| `autoRecallMinLength` | `number` | `10` | 触发注入的最小用户消息长度 |
| `autoRecallMaxItems` | `number` | `10` | 单次最多注入条数 |
| `autoRecallMaxChars` | `number` | `4000` | 单次最多注入字符数 |
| `autoRecallTimeoutMs` | `number` | `2000` | 注入超时(ms) |

> 在 MCP 模式下，建议设为 `false`，让 Agent 显式调用 `memory_recall`。

### `smartExtraction` — 智能提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `smartExtraction` | `boolean` | `true` | 启用 LLM 六分类提取 |
| `extractMinMessages` | `number` | `2` | 最少累积 N 条消息才触发提取 |
| `extractMaxChars` | `number` | `8000` | 单次提取最大字符数 |

### `retrieval` — 检索配置

控制记忆检索的行为，包括检索模式、权重、重排序等。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `string` | `hybrid` | 检索模式：`hybrid`（向量+BM25）、`vector`、`bm25` |
| `vectorWeight` | `number` | `0.7` | 向量搜索权重 (0~1)，BM25 权重 = 1 - vectorWeight |
| `bm25Weight` | `number` | `0.3` | BM25 关键词匹配权重 |
| `filterNoise` | `boolean` | `true` | 过滤低质量/噪音记忆 |
| `minScore` | `number` | `0.3` | 最低相似度阈值 (0~1) |
| `hardMinScore` | `number` | `0.35` | 硬性分数阈值，低于此值的直接丢弃 |
| `rerank` | `string` | `cross-encoder` | 重排模式：`cross-encoder`、`lightweight`、`none` |
| `rerankTimeoutMs` | `number` | `5000` | 重排 API 超时(ms) |
| `candidatePoolSize` | `number` | `50` | 粗筛候选池大小 |
| `recencyHalfLifeDays` | `number` | `30` | 时间衰减半衰期（天） |
| `recencyWeight` | `number` | `0.1` | 时间衰减比重 |

> 详细说明：[重排配置](rerank.md)

### `captureAssistant` — 助手消息提取

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `captureAssistant` | `boolean` | `true` | 是否也从 assistant 回复中提取记忆 |

### `mdMirror` — Markdown 镜像

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mdMirror.enabled` | `boolean` | `false` | 是否启用 MD 镜像导出 |
| `mdMirror.dir` | `string` | `~/.local/share/memory-mcp/mirror` | 镜像目录 |

启用后，记忆会被导出为 `.md` 文件，方便人类浏览和搜索。

### `sessionStrategy` — 会话策略

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sessionStrategy` | `string` | `none` | 会话策略：`none`、`simple`、`advanced` |

MCP 模式下建议为 `none`。

### `enableManagementTools` — 管理工具

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableManagementTools` | `boolean` | `true` | 是否暴露 `memory_stats`、`memory_list` 等管理工具 |

### `scopes` — 多项目隔离

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `scopes.default` | `string` | `global` | 默认 scope |

> 详细说明：[高级配置](advanced.md) 中的 Scope 配置段

### `selfImprovement` — 自我改进

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `selfImprovement.enabled` | `boolean` | `true` | 启用自我改进功能 |
| `selfImprovement.beforeResetNote` | `boolean` | `true` | 对话重置前自动记录关键记忆 |
| `selfImprovement.ensureLearningFiles` | `boolean` | `true` | 确保学习目录存在 |

### `dbPath` — 数据库路径

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dbPath` | `string` | `~/.local/share/memory-mcp/lancedb` | LanceDB 数据库存储路径 |

---

## 环境变量支持

配置文件支持 `${VAR}` 语法引用环境变量：

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
```

也支持默认值语法 `${VAR:-default}`：

```yaml
dbPath: "${MEM_DB_PATH:-~/.local/share/memory-mcp/lancedb}"
```

**详细说明**：[环境变量详解](environment-variables.md)

## 配置优先级

配置值的解析遵循以下优先级（从高到低）：

1. **CLI 参数**：`--config`、`--auth-token` 等
2. **环境变量直接覆盖**：`MEM_DB_PATH`、`MEM_MCP_AUTH_TOKEN`
3. **配置文件中的 `${VAR}` 引用**：`${OPENAI_API_KEY}`
4. **配置文件中的硬编码值**：`model: "text-embedding-3-small"`
5. **默认值**：系统内置默认值

## 常见配置场景

### 场景 1：基本配置

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"

autoCapture: true
smartExtraction: true
```

### 场景 2：使用 SiliconFlow

```yaml
embedding:
  apiKey: "${SILICONFLOW_API_KEY}"
  model: "Qwen/Qwen3-Embedding-8B"
  baseURL: "https://api.siliconflow.cn/v1"
  dimensions: 4096
```

### 场景 3：本地 Ollama

```yaml
embedding:
  apiKey: ""
  model: "nomic-embed-text"
  baseURL: "http://localhost:11434/v1"
  dimensions: 768
```

### 场景 4：启用重排

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankApiKey: "${JINA_API_KEY}"
```

## 配置验证

### 自动验证

```bash
# 验证配置有效性
mem config validate
```

### 健康检查

```bash
# 全面健康检查（含 API 连通性、数据库读写）
mem doctor
```

## 配置最佳实践

### 1. 安全性

**推荐**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 使用环境变量
```

**避免**：
```yaml
embedding:
  apiKey: "sk-actual-key-here"  # 硬编码密钥
```

### 2. 灵活性

```yaml
dbPath: "${MEM_DB_PATH:-~/.local/share/memory-mcp/lancedb}"
```

### 3. 版本控制

```yaml
# .gitignore
config.yaml
*.env
```

## 故障排除

### 配置文件不存在

**错误**：
```
No config found. Run 'mem config init' first.
```

**解决**：
```bash
mem config init
```

### API 密钥未设置

**错误**：
```
Config missing required 'embedding.apiKey'
```

**解决**：
```bash
export OPENAI_API_KEY="sk-..."
mem config validate
```

### 环境变量未设置

**警告**：
```
[mem:config] Warning: env var OPENAI_API_KEY is not set
```

**解决**：
```bash
export OPENAI_API_KEY="sk-..."
```

### 配置语法错误

**错误**：
```
Failed to parse config YAML
```

**解决**：
```bash
# 重新初始化
mem config init --force
```

## 相关文档

- [环境变量详解](environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](embedding.md) - 嵌入 API 配置详解
- [重排配置](rerank.md) - 重排模型配置详解
- [高级配置](advanced.md) - 高级配置选项
- [CLI config 命令](../cli/config.md) - 配置管理命令
- [CLI doctor 命令](../cli/doctor.md) - 健康检查命令
