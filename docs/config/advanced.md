# 高级配置

本文档介绍 memory-lancedb-mcp 的高级配置选项。

## 配置结构

```yaml
# 数据库存储路径
dbPath: "~/.local/share/memory-mcp/lancedb"

# 默认 scope
defaultScope: "agent:main"

# 智能提取配置
smartExtraction:
  enabled: true
  model: "openai/gpt-oss-120b"
  baseURL: "https://api.openai.com/v1"
  apiKey: "${OPENAI_API_KEY}"

# LLM 配置
llm:
  auth: "api-key"
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4o-mini"
  baseURL: "https://api.openai.com/v1"
  timeoutMs: 30000

# 自动捕获
autoCapture: true

# 自动召回
autoRecall: false

# 自动召回配置
autoRecallMinLength: 10
autoRecallMaxItems: 5
autoRecallMaxChars: 2000
autoRecallTimeoutMs: 5000

# 捕获助手
captureAssistant: true

# 智能提取配置
smartExtraction: true
extractMinMessages: 2
extractMaxChars: 8000

# 管理工具
enableManagementTools: true

# 会话策略
sessionStrategy: "none"

# 检索配置
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  minScore: 0.3
  hardMinScore: 0.35
  candidatePoolSize: 20
  filterNoise: true
  lengthNormAnchor: 100
  timeDecayHalfLifeDays: 30
  recencyHalfLifeDays: 30
  recencyWeight: 0.3
  reinforcementFactor: 1.2
  maxHalfLifeMultiplier: 3.0

# 衰减配置
decay:
  enabled: true
  halfLifeDays: 30
  minScore: 0.1

# 分层配置
tier:
  enabled: true
  tiers:
    - name: "core"
      minImportance: 0.8
      halfLifeDays: 90
    - name: "standard"
      minImportance: 0.5
      halfLifeDays: 30
    - name: "ephemeral"
      minImportance: 0.0
      halfLifeDays: 7

# Scope 配置
scopes:
  default: "global"
  definitions:
    global:
      description: "Global scope for shared memories"
    project:myapp:
      description: "MyApp project scope"
  agentAccess:
    agent:main: ["global", "project:*"]

# 自我改进配置
selfImprovement:
  enabled: true
  beforeResetNote: true
  skipSubagentBootstrap: false
  ensureLearningFiles: true

# 记忆反思配置
memoryReflection:
  enabled: true
  intervalHours: 24
  maxReflections: 10

# MD 镜像配置
mdMirror:
  enabled: false
  dir: "~/.local/share/memory-mcp/md-mirror"

# 准入控制
admissionControl:
  enabled: true
  maxMemories: 10000
  maxMemorySize: 10000

# 记忆压缩
memoryCompaction:
  enabled: true
  threshold: 0.9
  maxDuplicates: 3

# 会话压缩
sessionCompression:
  enabled: true
  maxMessages: 100
  compressionRatio: 0.5

# 提取节流
extractionThrottle:
  enabled: true
  maxExtractionsPerMinute: 10
  cooldownMs: 60000

# 工作区边界
workspaceBoundary:
  enabled: true
  allowedPaths: ["/home/user/projects"]
  deniedPaths: ["/home/user/secrets"]
```

## 配置选项详解

### dbPath

**类型**：string

**必填**：否

**默认值**：`~/.local/share/memory-mcp/lancedb`

**说明**：数据库存储路径。

**示例**：
```yaml
dbPath: "~/.local/share/memory-mcp/lancedb"
dbPath: "/data/memory/lancedb"
dbPath: "${MEM_DB_PATH}"
```

### defaultScope

**类型**：string

**必填**：否

**默认值**：`agent:main`

**说明**：默认 scope。

**示例**：
```yaml
defaultScope: "global"
defaultScope: "agent:main"
```

### smartExtraction

**类型**：object

**必填**：否

**说明**：智能提取配置。

**示例**：
```yaml
smartExtraction:
  enabled: true
  model: "openai/gpt-oss-120b"
  baseURL: "https://api.openai.com/v1"
  apiKey: "${OPENAI_API_KEY}"
```

### llm

**类型**：object

**必填**：否

**说明**：LLM 配置。

**示例**：
```yaml
llm:
  auth: "api-key"
  apiKey: "${OPENAI_API_KEY}"
  model: "gpt-4o-mini"
  baseURL: "https://api.openai.com/v1"
  timeoutMs: 30000
```

### autoCapture

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用自动捕获。

### autoRecall

**类型**：boolean

**必填**：否

**默认值**：false

**说明**：是否启用自动召回。

### autoRecallMinLength

**类型**：number

**必填**：否

**默认值**：10

**说明**：自动召回最小长度。

### autoRecallMaxItems

**类型**：number

**必填**：否

**默认值**：5

**说明**：自动召回最大条目数。

### autoRecallMaxChars

**类型**：number

**必填**：否

**默认值**：2000

**说明**：自动召回最大字符数。

### autoRecallTimeoutMs

**类型**：number

**必填**：否

**默认值**：5000

**说明**：自动召回超时（毫秒）。

### captureAssistant

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否捕获助手消息。

### smartExtraction

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用智能提取。

### extractMinMessages

**类型**：number

**必填**：否

**默认值**：2

**说明**：智能提取最小消息数。

### extractMaxChars

**类型**：number

**必填**：否

**默认值**：8000

**说明**：智能提取最大字符数。

### enableManagementTools

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用管理工具。

### sessionStrategy

**类型**：string

**必填**：否

**默认值**：`none`

**说明**：会话策略。

**可选值**：
- `none`：无会话管理
- `simple`：简单会话管理
- `advanced`：高级会话管理

## 检索配置

### retrieval.mode

**类型**：string

**必填**：否

**默认值**：`hybrid`

**说明**：检索模式。

**可选值**：
- `hybrid`：混合检索（向量 + BM25）
- `vector`：纯向量检索

### retrieval.vectorWeight

**类型**：number

**必填**：否

**默认值**：0.7

**说明**：向量检索权重。

### retrieval.bm25Weight

**类型**：number

**必填**：否

**默认值**：0.3

**说明**：BM25 检索权重。

### retrieval.minScore

**类型**：number

**必填**：否

**默认值**：0.3

**说明**：最低分数阈值。

### retrieval.hardMinScore

**类型**：number

**必填**：否

**默认值**：0.35

**说明**：重排后硬性最低分数。

### retrieval.candidatePoolSize

**类型**：number

**必填**：否

**默认值**：20

**说明**：候选池大小。

### retrieval.filterNoise

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否过滤噪声结果。

## 衰减配置

### decay.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用衰减。

### decay.halfLifeDays

**类型**：number

**必填**：否

**默认值**：30

**说明**：衰减半衰期（天）。

### decay.minScore

**类型**：number

**必填**：否

**默认值**：0.1

**说明**：衰减最低分数。

## 分层配置

### tier.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用分层。

### tier.tiers

**类型**：array

**必填**：否

**说明**：分层配置。

**示例**：
```yaml
tier:
  enabled: true
  tiers:
    - name: "core"
      minImportance: 0.8
      halfLifeDays: 90
    - name: "standard"
      minImportance: 0.5
      halfLifeDays: 30
    - name: "ephemeral"
      minImportance: 0.0
      halfLifeDays: 7
```

## Scope 配置

### scopes.default

**类型**：string

**必填**：否

**默认值**：`global`

**说明**：默认 scope。

### scopes.definitions

**类型**：object

**必填**：否

**说明**：Scope 定义。

**示例**：
```yaml
scopes:
  definitions:
    global:
      description: "Global scope for shared memories"
    project:myapp:
      description: "MyApp project scope"
```

### scopes.agentAccess

**类型**：object

**必填**：否

**说明**：Agent 访问控制。

**示例**：
```yaml
scopes:
  agentAccess:
    agent:main: ["global", "project:*"]
```

## 自我改进配置

### selfImprovement.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用自我改进。

### selfImprovement.beforeResetNote

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否在重置前记录笔记。

### selfImprovement.skipSubagentBootstrap

**类型**：boolean

**必填**：否

**默认值**：false

**说明**：是否跳过子代理引导。

### selfImprovement.ensureLearningFiles

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否确保学习文件存在。

## 记忆反思配置

### memoryReflection.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用记忆反思。

### memoryReflection.intervalHours

**类型**：number

**必填**：否

**默认值**：24

**说明**：反思间隔（小时）。

### memoryReflection.maxReflections

**类型**：number

**必填**：否

**默认值**：10

**说明**：最大反思数量。

## MD 镜像配置

### mdMirror.enabled

**类型**：boolean

**必填**：否

**默认值**：false

**说明**：是否启用 MD 镜像。

### mdMirror.dir

**类型**：string

**必填**：否

**默认值**：`~/.local/share/memory-mcp/md-mirror`

**说明**：MD 镜像目录。

## 准入控制

### admissionControl.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用准入控制。

### admissionControl.maxMemories

**类型**：number

**必填**：否

**默认值**：10000

**说明**：最大记忆数量。

### admissionControl.maxMemorySize

**类型**：number

**必填**：否

**默认值**：10000

**说明**：最大记忆大小（字符）。

## 记忆压缩

### memoryCompaction.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用记忆压缩。

### memoryCompaction.threshold

**类型**：number

**必填**：否

**默认值**：0.9

**说明**：压缩阈值。

### memoryCompaction.maxDuplicates

**类型**：number

**必填**：否

**默认值**：3

**说明**：最大重复数量。

## 会话压缩

### sessionCompression.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用会话压缩。

### sessionCompression.maxMessages

**类型**：number

**必填**：否

**默认值**：100

**说明**：最大消息数量。

### sessionCompression.compressionRatio

**类型**：number

**必填**：否

**默认值**：0.5

**说明**：压缩比率。

## 提取节流

### extractionThrottle.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用提取节流。

### extractionThrottle.maxExtractionsPerMinute

**类型**：number

**必填**：否

**默认值**：10

**说明**：每分钟最大提取次数。

### extractionThrottle.cooldownMs

**类型**：number

**必填**：否

**默认值**：60000

**说明**：冷却时间（毫秒）。

## 工作区边界

### workspaceBoundary.enabled

**类型**：boolean

**必填**：否

**默认值**：true

**说明**：是否启用工作区边界。

### workspaceBoundary.allowedPaths

**类型**：array

**必填**：否

**说明**：允许的路径。

### workspaceBoundary.deniedPaths

**类型**：array

**必填**：否

**说明**：拒绝的路径。

## 最佳实践

### 1. 存储路径

**推荐**：
```yaml
dbPath: "~/.local/share/memory-mcp/lancedb"
```

**避免**：
```yaml
dbPath: "/tmp/lancedb"  # 临时目录
```

### 2. 检索配置

**推荐**：
```yaml
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  candidatePoolSize: 20
```

### 3. 衰减配置

**推荐**：
```yaml
decay:
  enabled: true
  halfLifeDays: 30
  minScore: 0.1
```

### 4. 分层配置

**推荐**：
```yaml
tier:
  enabled: true
  tiers:
    - name: "core"
      minImportance: 0.8
      halfLifeDays: 90
    - name: "standard"
      minImportance: 0.5
      halfLifeDays: 30
    - name: "ephemeral"
      minImportance: 0.0
      halfLifeDays: 7
```

## 故障排除

### 存储路径错误

**症状**：
```
❌ Cannot access database path
```

**解决**：
```bash
# 检查路径权限
ls -la ~/.local/share/memory-mcp/

# 创建目录
mkdir -p ~/.local/share/memory-mcp/lancedb
```

### 检索配置错误

**症状**：
```
❌ Invalid retrieval configuration
```

**解决**：
```bash
# 验证配置
mem config validate

# 检查配置格式
vim ~/.config/memory-mcp/config.yaml
```

### 衰减配置错误

**症状**：
```
❌ Invalid decay configuration
```

**解决**：
```bash
# 验证配置
mem config validate

# 检查配置格式
vim ~/.config/memory-mcp/config.yaml
```

## 相关文档

- [配置总览](README.md) - 配置系统概览
- [环境变量详解](environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](embedding.md) - 嵌入 API 配置
- [重排配置](rerank.md) - 重排模型配置
