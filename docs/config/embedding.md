# 嵌入配置

本文档介绍 memory-lancedb-mcp 的嵌入配置选项。

## 嵌入配置结构

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
  # 可选: 请求维度（某些模型支持）
  requestDimensions: 1536
  # 可选: 是否省略维度参数
  omitDimensions: false
  # 可选: 任务查询前缀
  taskQuery: ""
  # 可选: 任务段落前缀
  taskPassage: ""
  # 可选: 是否归一化向量
  normalized: true
  # 可选: 是否启用分块
  chunking: true
```

## 配置选项详解

### apiKey

**类型**：string | string[]

**必填**：是

**说明**：API 密钥，支持 `${ENV_VAR}` 语法。

**示例**：
```yaml
# 使用环境变量
apiKey: "${OPENAI_API_KEY}"

# 直接写入（不推荐）
apiKey: "sk-..."

# 多个密钥（轮询）
apiKey:
  - "${OPENAI_API_KEY_1}"
  - "${OPENAI_API_KEY_2}"
```

### model

**类型**：string

**必填**：是

**说明**：嵌入模型名称。

**示例**：
```yaml
# OpenAI
model: "text-embedding-3-small"
model: "text-embedding-3-large"

# SiliconFlow
model: "Qwen/Qwen3-Embedding-8B"

# Ollama
model: "nomic-embed-text"
```

### baseURL

**类型**：string

**必填**：否

**说明**：自定义 API 地址。

**默认值**：`https://api.openai.com/v1`

**示例**：
```yaml
# OpenAI
baseURL: "https://api.openai.com/v1"

# SiliconFlow
baseURL: "https://api.siliconflow.cn/v1"

# Ollama
baseURL: "http://localhost:11434"
```

### dimensions

**类型**：number

**必填**：可选（某些模型必填）

**说明**：向量维度。

**示例**：
```yaml
# text-embedding-3-small
dimensions: 1536

# text-embedding-3-large
dimensions: 3072

# Qwen3-Embedding-8B
dimensions: 4096

# nomic-embed-text
dimensions: 768
```

### requestDimensions

**类型**：number

**必填**：否

**说明**：请求维度（某些模型支持）。

**示例**：
```yaml
# 请求时指定维度
requestDimensions: 1024
```

### omitDimensions

**类型**：boolean

**必填**：否

**默认值**：false

**说明**：是否省略维度参数。

**示例**：
```yaml
# 省略维度参数
omitDimensions: true
```

### taskQuery

**类型**：string

**必填**：否

**说明**：任务查询前缀。

**示例**：
```yaml
# 查询前缀
taskQuery: "search_query: "
```

### taskPassage

**类型**：string

**必填**：否

**说明**：任务段落前缀。

**示例**：
```yaml
# 段落前缀
taskPassage: "search_document: "
```

### normalized

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否归一化向量。

**示例**：
```yaml
# 归一化向量
normalized: true
```

### chunking

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用分块。

**示例**：
```yaml
# 启用分块
chunking: true
```

## 供应商配置示例

### OpenAI

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536
```

**支持的模型**：
- `text-embedding-3-small`（1536 维）
- `text-embedding-3-large`（3072 维）
- `text-embedding-ada-002`（1536 维）

### SiliconFlow

```yaml
embedding:
  apiKey: "${SILICONFLOW_API_KEY}"
  model: "Qwen/Qwen3-Embedding-8B"
  baseURL: "https://api.siliconflow.cn/v1"
  dimensions: 4096
```

**支持的模型**：
- `Qwen/Qwen3-Embedding-8B`
- `BAAI/bge-large-zh-v1.5`
- `BAAI/bge-large-en-v1.5`

### Ollama（本地）

```yaml
embedding:
  apiKey: ""
  model: "nomic-embed-text"
  baseURL: "http://localhost:11434"
  dimensions: 768
```

**支持的模型**：
- `nomic-embed-text`
- `mxbai-embed-large`
- `all-minilm`

### Azure OpenAI

```yaml
embedding:
  apiKey: "${AZURE_OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://your-resource.openai.azure.com/openai/deployments/your-deployment/embeddings?api-version=2024-02-01"
  dimensions: 1536
```

## 环境变量支持

### 基本用法

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
```

### 默认值

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY:-sk-default-key}"
```

### 多个环境变量

```yaml
embedding:
  apiKey:
    - "${OPENAI_API_KEY_1}"
    - "${OPENAI_API_KEY_2}"
```

## 最佳实践

### 1. API 密钥管理

**推荐**：
```yaml
# 使用环境变量
embedding:
  apiKey: "${OPENAI_API_KEY}"
```

**避免**：
```yaml
# 硬编码密钥
embedding:
  apiKey: "sk-actual-key-here"
```

### 2. 模型选择

**推荐**：
```yaml
# 根据需求选择模型
embedding:
  model: "text-embedding-3-small"  # 平衡性能和成本
  # model: "text-embedding-3-large"  # 更高质量
```

### 3. 维度配置

**推荐**：
```yaml
# 明确指定维度
embedding:
  model: "text-embedding-3-small"
  dimensions: 1536
```

### 4. API 地址配置

**推荐**：
```yaml
# 使用官方地址
embedding:
  baseURL: "https://api.openai.com/v1"

# 或使用代理
embedding:
  baseURL: "https://your-proxy.com/v1"
```

## 故障排除

### API 密钥错误

**症状**：
```
❌ Invalid API key
```

**解决**：
```bash
# 检查环境变量
echo $OPENAI_API_KEY

# 验证配置
mem config validate
```

### 模型不存在

**症状**：
```
❌ Model not found: model-name
```

**解决**：
```bash
# 检查模型名称
# 参考供应商文档

# 验证配置
mem config validate
```

### 维度不匹配

**症状**：
```
❌ Dimension mismatch
```

**解决**：
```bash
# 检查模型维度
# 参考供应商文档

# 更新配置
vim ~/.config/memory-mcp/config.yaml
```

### API 地址错误

**症状**：
```
❌ Connection refused
```

**解决**：
```bash
# 检查 API 地址
# 确保地址可访问

# 验证配置
mem config validate
```

## 相关文档

- [配置总览](README.md) - 配置系统概览
- [环境变量详解](environment-variables.md) - 环境变量与配置文件交互
- [重排配置](rerank.md) - 重排模型配置
- [高级配置](advanced.md) - 高级配置选项
