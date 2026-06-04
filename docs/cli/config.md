# mem config 命令

`mem config` 命令用于管理 memory-lancedb-mcp 的配置文件。

## 命令概览

| 子命令 | 说明 |
|--------|------|
| `mem config init` | 创建默认配置文件 |
| `mem config show` | 显示当前配置（敏感信息已掩码） |
| `mem config path` | 显示配置文件路径 |
| `mem config validate` | 验证配置文件有效性 |

## mem config init

创建默认配置文件。

**语法**：
```bash
mem config init [options]
```

**选项**：
| 选项 | 说明 |
|------|------|
| `-f, --force` | 覆盖已有配置文件 |

**示例**：
```bash
# 创建配置文件
mem config init

# 强制覆盖已有配置文件
mem config init --force
```

**输出示例**：
```
✅ Config created: ~/.config/memory-mcp/config.yaml
Edit it to add your API key and configure embedding/LLM settings.
```

**配置文件位置**：
- 默认路径：`~/.config/memory-mcp/config.yaml`
- 可通过 `MEM_CONFIG_PATH` 环境变量覆盖

## mem config show

显示当前配置，敏感信息（API 密钥等）会被掩码处理。

**语法**：
```bash
mem config show [options]
```

**选项**：
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

**示例**：
```bash
# 显示配置
mem config show

# JSON 格式输出
mem config show --json
```

**输出示例**：
```yaml
# Config: ~/.config/memory-mcp/config.yaml

embedding:
  apiKey: "sk-***"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536

dbPath: "~/.local/share/memory-mcp/lancedb"
autoCapture: true
smartExtraction: true
```

**说明**：
- API 密钥显示为 `sk-***` 格式
- 环境变量引用（`${VAR}`）会显示为原始引用
- 显示的配置是解析后的最终值

## mem config path

显示配置文件路径。

**语法**：
```bash
mem config path
```

**示例**：
```bash
mem config path
```

**输出示例**：
```
~/.config/memory-mcp/config.yaml
(exists)
```

**说明**：
- 显示当前使用的配置文件路径
- 显示文件是否存在：`(exists)` 或 `(not found)`

## mem config validate

验证配置文件的有效性。

**语法**：
```bash
mem config validate
```

**示例**：
```bash
mem config validate
```

**输出示例**：
```
✅ Config valid: ~/.config/memory-mcp/config.yaml
  Embedding model: text-embedding-3-small
  DB path: ~/.local/share/memory-mcp/lancedb
  Smart extraction: true
  Auto-capture: true
  Auto-recall: false
  Rerank: cross-encoder (provider=jina, apiKey=present)
```

**验证内容**：

1. **配置文件语法**：YAML 语法是否正确
2. **必需字段**：`embedding.apiKey` 是否存在
3. **环境变量**：`${VAR}` 引用的环境变量是否已设置
4. **重排配置**：重排模型配置是否有效

**错误示例**：

**配置文件语法错误**：
```bash
❌ Config invalid: Failed to parse config YAML at ~/.config/memory-mcp/config.yaml: ...
```

**必需字段缺失**：
```bash
❌ Config invalid: Config missing required 'embedding.apiKey'
```

**环境变量未设置**：
```bash
✅ Config valid: ~/.config/memory-mcp/config.yaml
  Embedding model: text-embedding-3-small
  DB path: ~/.local/share/memory-mcp/lancedb
  Smart extraction: true
  Auto-capture: true
  Auto-recall: false
  Rerank: cross-encoder (provider=jina, apiKey=not set (lightweight fallback))
```

**说明**：
- 验证通过显示 ✅ 和配置详情
- 验证失败显示 ❌ 和错误信息
- 环境变量未设置时会显示警告信息

## 配置文件结构

默认配置文件结构：

```yaml
# memory-lancedb-mcp configuration

# 数据库存储路径
dbPath: "~/.local/share/memory-mcp/lancedb"

# 嵌入配置（必需）
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536

# LLM 配置（可选）
llm:
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4o-mini"
  baseURL: "https://api.openai.com/v1"

# 自动捕获
autoCapture: true

# 自动召回
autoRecall: false

# 智能提取
smartExtraction: true

# 检索配置
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankApiKey: "${JINA_API_KEY}"

# Scope 配置
scopes:
  default: "global"
```

## 环境变量支持

配置文件支持 `${VAR}` 语法引用环境变量：

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 从环境变量读取
  model: "text-embedding-3-small"  # 硬编码值
```

**支持的环境变量**：
- `OPENAI_API_KEY`：OpenAI API 密钥
- `SILICONFLOW_API_KEY`：SiliconFlow API 密钥
- `JINA_API_KEY`：Jina Rerank API 密钥
- `DASHSCOPE_API_KEY`：DashScope Rerank API 密钥
- `VOYAGE_API_KEY`：Voyage Rerank API 密钥
- `PINECONE_API_KEY`：Pinecone Rerank API 密钥

**详细说明**：[环境变量详解](../config/environment-variables.md)

## 最佳实践

### 1. 配置文件管理

**推荐**：
```bash
# 初始化配置
mem config init

# 验证配置
mem config validate

# 查看配置
mem config show
```

**说明**：
- 使用 `mem config init` 创建标准配置
- 使用 `mem config validate` 验证配置有效性
- 使用 `mem config show` 查看当前配置

### 2. 环境变量使用

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

**原因**：
- 环境变量不会提交到版本控制
- 不同环境可以使用不同密钥
- 配置文件可以安全共享

### 3. 配置验证

**定期验证**：
```bash
# 部署前验证配置
mem config validate || exit 1

# 健康检查
mem doctor
```

**CI/CD 集成**：
```yaml
# GitHub Actions 示例
- name: Validate config
  run: mem config validate
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
# 设置环境变量
export OPENAI_API_KEY="sk-..."

# 或编辑配置文件
vim ~/.config/memory-mcp/config.yaml
```

### 环境变量未设置

**警告**：
```
[mem:config] Warning: env var OPENAI_API_KEY is not set
```

**解决**：
```bash
# 设置环境变量
export OPENAI_API_KEY="sk-..."

# 或使用默认值
export OPENAI_API_KEY="sk-default-key"
```

### 配置文件语法错误

**错误**：
```
Failed to parse config YAML at ~/.config/memory-mcp/config.yaml: ...
```

**解决**：
```bash
# 检查 YAML 语法
yamllint ~/.config/memory-mcp/config.yaml

# 或重新初始化配置
mem config init --force
```

## 相关文档

- [配置总览](../config/README.md) - 配置系统概览
- [环境变量详解](../config/environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](../config/embedding.md) - 嵌入 API 配置
- [重排配置](../config/rerank.md) - 重排模型配置
