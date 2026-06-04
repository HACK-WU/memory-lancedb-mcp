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

## 配置文件结构

配置文件分为以下几个主要部分：

### 1. 嵌入配置（必需）

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536
```

**详细说明**：[嵌入配置](embedding.md)

### 2. 检索配置

```yaml
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankApiKey: "${JINA_API_KEY}"
```

**详细说明**：[重排配置](rerank.md)

### 3. 自动化配置

```yaml
autoCapture: true
autoRecall: false
smartExtraction: true
```

### 4. 存储配置

```yaml
dbPath: "~/.local/share/memory-mcp/lancedb"
```

### 5. 高级配置

```yaml
llm:
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4o-mini"
  baseURL: "https://api.openai.com/v1"

scopes:
  default: "global"

selfImprovement:
  enabled: true
```

**详细说明**：[高级配置](advanced.md)

## 环境变量支持

配置文件支持 `${VAR}` 语法引用环境变量：

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
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
  dimensions: 1536

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
  baseURL: "http://localhost:11434"
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

### 手动验证

```bash
# 检查 YAML 语法
yamllint ~/.config/memory-mcp/config.yaml

# 检查环境变量
echo $OPENAI_API_KEY
```

### 健康检查

```bash
# 全面健康检查
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

**推荐**：
```yaml
dbPath: "${MEM_DB_PATH:-~/.local/share/memory-mcp/lancedb}"
```

**说明**：使用 `${VAR:-default}` 语法提供默认值

### 3. 可维护性

**推荐**：
```yaml
# 环境变量说明
# OPENAI_API_KEY: OpenAI API 密钥
embedding:
  apiKey: "${OPENAI_API_KEY}"
```

**说明**：添加注释说明配置项用途

### 4. 版本控制

**推荐**：
```yaml
# .gitignore
config.yaml
*.env
```

**说明**：将配置文件排除在版本控制之外

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
# 检查语法
yamllint ~/.config/memory-mcp/config.yaml

# 重新初始化
mem config init --force
```

## 相关文档

- [环境变量详解](environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](embedding.md) - 嵌入 API 配置
- [重排配置](rerank.md) - 重排模型配置
- [高级配置](advanced.md) - 高级配置选项
- [CLI config 命令](../cli/config.md) - 配置管理命令
