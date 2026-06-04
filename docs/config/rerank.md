# 重排配置

本文档介绍 memory-lancedb-mcp 的重排配置选项。

## 重排概述

重排模型对混合检索的候选结果进行二次精排，显著提升检索精度。

## 重排模式

| 模式 | 说明 | API 开销 |
|------|------|----------|
| `cross-encoder` | 调用重排 API（推荐，精度最高） | 每次检索一次 API 调用 |
| `lightweight` | 本地余弦相似度重排（零成本，精度一般） | 无 |
| `none` | 关闭重排 | 无 |

## 配置结构

```yaml
retrieval:
  # 重排模式
  rerank: "cross-encoder"
  # 重排 API 供应商
  rerankProvider: "jina"
  # 重排模型名称
  rerankModel: "jina-reranker-v3"
  # 重排 API 端点
  rerankEndpoint: "https://api.jina.ai/v1/rerank"
  # 重排 API 密钥
  rerankApiKey: "${JINA_API_KEY}"
  # 重排 API 超时（毫秒）
  rerankTimeoutMs: 5000
```

## 供应商配置示例

### Jina（推荐）

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankModel: "jina-reranker-v3"
  rerankEndpoint: "https://api.jina.ai/v1/rerank"
  rerankApiKey: "${JINA_API_KEY}"
```

**支持的模型**：
- `jina-reranker-v3`（推荐）
- `jina-reranker-v2-base-multilingual`

**特点**：
- 高质量重排
- 多语言支持
- 稳定可靠

### SiliconFlow（国内推荐）

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "siliconflow"
  rerankModel: "BAAI/bge-reranker-v2-m3"
  rerankEndpoint: "https://api.siliconflow.cn/v1/rerank"
  rerankApiKey: "${SILICONFLOW_API_KEY}"
```

**支持的模型**：
- `BAAI/bge-reranker-v2-m3`
- `BAAI/bge-reranker-large`

**特点**：
- Jina 兼容格式
- 国内访问友好
- 价格实惠

### DashScope（中文优化）

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "dashscope"
  rerankModel: "gte-rerank-v2"
  rerankEndpoint: "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
  rerankApiKey: "${DASHSCOPE_API_KEY}"
```

**支持的模型**：
- `gte-rerank-v2`
- `gte-rerank`

**特点**：
- 阿里云服务
- 中文优化
- 稳定可靠

### Voyage

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "voyage"
  rerankModel: "rerank-3"
  rerankEndpoint: "https://api.voyageai.com/v1/rerank"
  rerankApiKey: "${VOYAGE_API_KEY}"
```

**支持的模型**：
- `rerank-3`
- `rerank-2`

**特点**：
- 多语言支持
- 高质量重排

### Pinecone

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "pinecone"
  rerankModel: "pinecone-rerank-v0"
  rerankEndpoint: "https://api.pinecone.io/rerank"
  rerankApiKey: "${PINECONE_API_KEY}"
```

**支持的模型**：
- `pinecone-rerank-v0`

**特点**：
- Pinecone 生态
- 集成方便

### HuggingFace TEI（自部署）

```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "tei"
  rerankModel: "BAAI/bge-reranker-v2-m3"
  rerankEndpoint: "http://localhost:8080/rerank"
  rerankApiKey: ""
```

**支持的模型**：
- 任何支持 TEI 的模型

**特点**：
- 自部署
- 免费
- 完全控制

## 配置选项详解

### rerank

**类型**：string

**必填**：否

**默认值**：`cross-encoder`

**说明**：重排模式。

**可选值**：
- `cross-encoder`：API 重排（推荐）
- `lightweight`：本地余弦相似度重排
- `none`：关闭重排

### rerankProvider

**类型**：string

**必填**：否

**默认值**：`jina`

**说明**：重排 API 供应商。

**可选值**：
- `jina`
- `siliconflow`
- `dashscope`
- `voyage`
- `pinecone`
- `tei`

### rerankModel

**类型**：string

**必填**：否

**默认值**：`jina-reranker-v3`

**说明**：重排模型名称。

### rerankEndpoint

**类型**：string

**必填**：否

**默认值**：供应商默认端点

**说明**：重排 API 端点。

### rerankApiKey

**类型**：string

**必填**：否

**说明**：重排 API 密钥，支持 `${ENV_VAR}` 语法。

**示例**：
```yaml
rerankApiKey: "${JINA_API_KEY}"
```

### rerankTimeoutMs

**类型**：number

**必填**：否

**默认值**：5000

**说明**：重排 API 超时（毫秒）。

**示例**：
```yaml
rerankTimeoutMs: 10000
```

## 降级机制

### 自动降级

当重排 API 密钥未设置时，自动退化为 `lightweight` 模式。

**配置示例**：
```yaml
retrieval:
  rerank: "cross-encoder"
  # rerankApiKey 未设置，自动退化为 lightweight
```

### 手动降级

```yaml
retrieval:
  rerank: "lightweight"
```

### 关闭重排

```yaml
retrieval:
  rerank: "none"
```

## 最佳实践

### 1. 选择供应商

**推荐**：
```yaml
# 国际用户
retrieval:
  rerankProvider: "jina"

# 国内用户
retrieval:
  rerankProvider: "siliconflow"

# 中文优化
retrieval:
  rerankProvider: "dashscope"
```

### 2. API 密钥管理

**推荐**：
```yaml
# 使用环境变量
retrieval:
  rerankApiKey: "${JINA_API_KEY}"
```

**避免**：
```yaml
# 硬编码密钥
retrieval:
  rerankApiKey: "sk-actual-key-here"
```

### 3. 超时配置

**推荐**：
```yaml
# 根据网络情况调整超时
retrieval:
  rerankTimeoutMs: 5000  # 默认
  # rerankTimeoutMs: 10000  # 网络较慢时
```

### 4. 性能优化

**推荐**：
```yaml
# 使用高质量重排
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankModel: "jina-reranker-v3"
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
echo $JINA_API_KEY

# 验证配置
mem config validate
```

### API 端点错误

**症状**：
```
❌ Connection refused
```

**解决**：
```bash
# 检查 API 端点
# 确保端点可访问

# 验证配置
mem config validate
```

### 超时错误

**症状**：
```
❌ Request timeout
```

**解决**：
```bash
# 增加超时时间
retrieval:
  rerankTimeoutMs: 10000
```

### 降级到 lightweight

**症状**：
```
⚠️ Rerank API key not set, falling back to lightweight
```

**解决**：
```bash
# 设置 API 密钥
export JINA_API_KEY="..."

# 验证配置
mem config validate
```

## 相关文档

- [配置总览](README.md) - 配置系统概览
- [环境变量详解](environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](embedding.md) - 嵌入 API 配置
- [高级配置](advanced.md) - 高级配置选项
