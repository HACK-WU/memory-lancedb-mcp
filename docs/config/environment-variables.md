# 环境变量详解

本文档详细说明 memory-lancedb-mcp 中环境变量与配置文件的交互机制。

## 配置解析优先级

配置值的解析遵循以下优先级（从高到低）：

```
1. CLI 参数（最高优先级）
2. 环境变量直接覆盖（如 MEM_DB_PATH）
3. 配置文件中的 ${VAR} 引用
4. 配置文件中的硬编码值
5. 默认值（最低优先级）
```

## 环境变量语法

在配置文件中，使用 `${VAR_NAME}` 语法引用环境变量：

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 运行时替换为环境变量值
  model: "text-embedding-3-small"  # 硬编码值
```

## 处理流程

1. **读取配置文件**：加载 YAML 配置文件
2. **解析语法**：识别 `${VAR_NAME}` 模式
3. **查找环境变量**：在 `process.env` 中查找对应变量
4. **替换值**：
   - 如果环境变量存在：替换为环境变量值
   - 如果环境变量不存在：替换为空字符串并发出警告

**代码示例**：
```typescript
function expandEnvVars(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      const envVal = process.env[varName.trim()];
      if (envVal === undefined) {
        console.warn(`[mem:config] Warning: env var ${varName} is not set`);
        return "";
      }
      return envVal;
    });
  }
  // ... 递归处理对象和数组
}
```

## 环境变量分类

### 配置路径类

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MEM_CONFIG_PATH` | 配置文件路径 | `/custom/config.yaml` |
| `MEM_DB_PATH` | 数据库存储路径 | `/data/memory/lancedb` |

**优先级**：
- `MEM_CONFIG_PATH` 覆盖默认配置文件路径
- `MEM_DB_PATH` 覆盖配置文件中的 `dbPath` 设置

### API 密钥类

| 变量名 | 说明 | 用途 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | 嵌入、LLM |
| `SILICONFLOW_API_KEY` | SiliconFlow API 密钥 | 嵌入、重排 |
| `JINA_API_KEY` | Jina Rerank API 密钥 | 重排 |
| `DASHSCOPE_API_KEY` | DashScope Rerank API 密钥 | 重排 |
| `VOYAGE_API_KEY` | Voyage Rerank API 密钥 | 重排 |
| `PINECONE_API_KEY` | Pinecone Rerank API 密钥 | 重排 |

### 服务配置类

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MEM_MCP_AUTH_TOKEN` | SSE 鉴权 token | `my-secret-token` |

**优先级**：CLI `--auth-token` 参数 > `MEM_MCP_AUTH_TOKEN` 环境变量

## 使用场景示例

### 场景 1：使用环境变量存储 API 密钥

**设置环境变量**：
```bash
export OPENAI_API_KEY="sk-..."
```

**配置文件**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
```

**优点**：
- API 密钥不会提交到版本控制
- 不同环境可以使用不同的密钥
- 配置文件可以安全共享

### 场景 2：完全使用环境变量

**设置环境变量**：
```bash
export OPENAI_API_KEY="sk-..."
export MEM_DB_PATH="/custom/path"
```

**配置文件**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
dbPath: "~/.local/share/memory-mcp/lancedb"  # 会被 MEM_DB_PATH 覆盖
```

**说明**：
- `dbPath` 的硬编码值会被 `MEM_DB_PATH` 环境变量覆盖
- 配置文件中的值作为默认值，环境变量作为覆盖值

### 场景 3：混合使用

**配置文件**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 从环境变量读取
  model: "text-embedding-3-small"  # 硬编码值
  baseURL: "https://api.openai.com/v1"  # 硬编码值
  dimensions: 1536  # 硬编码值

retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankApiKey: "${JINA_API_KEY}"  # 从环境变量读取
```

**说明**：
- 敏感信息（API 密钥）使用环境变量
- 非敏感配置使用硬编码值
- 灵活组合，满足不同需求

### 场景 4：多环境配置

**开发环境**：
```bash
export OPENAI_API_KEY="sk-dev-..."
export MEM_DB_PATH="./dev-data/lancedb"
```

**生产环境**：
```bash
export OPENAI_API_KEY="sk-prod-..."
export MEM_DB_PATH="/data/memory/lancedb"
```

**配置文件**（两个环境共享）：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
dbPath: "${MEM_DB_PATH}"
```

## 错误处理

### 环境变量未设置

**行为**：
- 替换为空字符串
- 打印警告日志

**日志示例**：
```
[mem:config] Warning: env var OPENAI_API_KEY is not set
```

**影响**：
- API 密钥为空可能导致 API 调用失败
- 数据库路径为空可能使用默认路径

**建议**：
- 使用 `mem config validate` 检查配置
- 使用 `mem doctor` 进行健康检查

### 配置文件语法错误

**行为**：
- 抛出异常
- 服务无法启动

**错误示例**：
```
Failed to parse config YAML at ~/.config/memory-mcp/config.yaml: ...
```

**解决**：
- 检查 YAML 语法
- 使用 `mem config validate` 验证配置

### 必需字段缺失

**行为**：
- 抛出异常
- 服务无法启动

**错误示例**：
```
Config missing required 'embedding.apiKey'
```

**解决**：
- 确保 `embedding.apiKey` 已设置
- 可以使用环境变量或硬编码值

## 最佳实践

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

**原因**：
- 环境变量不会提交到版本控制
- 不同环境可以使用不同密钥
- 配置文件可以安全共享

### 2. 灵活性

**推荐**：
```yaml
dbPath: "${MEM_DB_PATH:-~/.local/share/memory-mcp/lancedb}"  # 带默认值
```

**说明**：
- 使用 `${VAR:-default}` 语法提供默认值
- 环境变量未设置时使用默认值

### 3. 可维护性

**推荐**：
```yaml
# 环境变量说明
# OPENAI_API_KEY: OpenAI API 密钥
# MEM_DB_PATH: 数据库存储路径
embedding:
  apiKey: "${OPENAI_API_KEY}"
dbPath: "${MEM_DB_PATH}"
```

**说明**：
- 添加注释说明环境变量用途
- 便于团队协作和维护

### 4. 验证配置

**定期验证**：
```bash
# 验证配置有效性
mem config validate

# 健康检查
mem doctor
```

**CI/CD 集成**：
```bash
# 在部署前验证配置
mem config validate || exit 1
```

## 常见问题

### Q1: 环境变量设置后配置文件还需要修改吗？

**A**: 不需要。如果配置文件中已经使用了 `${VAR}` 语法，设置环境变量即可，无需修改配置文件。

### Q2: 环境变量和配置文件哪个优先级更高？

**A**: 
- 对于 `MEM_DB_PATH` 这类直接覆盖的环境变量，优先级高于配置文件
- 对于 `${VAR}` 语法引用的环境变量，是配置文件的一部分，没有优先级问题

### Q3: 如何在不同环境间切换配置？

**A**: 使用环境变量：
```bash
# 开发环境
export OPENAI_API_KEY="sk-dev-..."
export MEM_DB_PATH="./dev-data"

# 生产环境
export OPENAI_API_KEY="sk-prod-..."
export MEM_DB_PATH="/data/memory"
```

### Q4: 配置文件中的 `${VAR}` 语法支持默认值吗？

**A**: 支持。使用 `${VAR:-default}` 语法：
```yaml
dbPath: "${MEM_DB_PATH:-~/.local/share/memory-mcp/lancedb}"
```

### Q5: 如何调试环境变量问题？

**A**: 使用以下命令：
```bash
# 显示当前配置
mem config show

# 验证配置有效性
mem config validate

# 检查环境变量
echo $OPENAI_API_KEY
```

## 相关文档

- [配置总览](README.md) - 配置系统概览
- [嵌入配置](embedding.md) - 嵌入 API 配置
- [重排配置](rerank.md) - 重排模型配置
- [高级配置](advanced.md) - 高级配置选项
