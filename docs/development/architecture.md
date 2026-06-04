# 架构设计

本文档介绍 memory-lancedb-mcp 的系统架构和设计决策。

## 系统概览

memory-lancedb-mcp 是一个 MCP (Model Context Protocol) 服务器，为 AI 应用提供持久化长期记忆功能。

### 核心组件

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

### 设计原则

1. **零侵入**：不修改 memory-lancedb-pro 一行代码
2. **协议桥接**：通过 MCP 协议暴露功能
3. **配置驱动**：YAML 配置文件 + 环境变量
4. **多模式支持**：stdio 和 SSE 两种传输模式

## 核心模块

### 1. MCP Server 模块

**职责**：实现 MCP 协议，处理客户端请求

**主要功能**：
- 工具注册和发现
- 请求路由和处理
- 响应生成和返回

**代码位置**：`src/mcp-server.ts`

### 2. CLI 模块

**职责**：提供命令行接口

**主要功能**：
- 命令解析和执行
- 配置管理
- 记忆操作

**代码位置**：`src/cli.ts`

### 3. 配置模块

**职责**：管理配置文件

**主要功能**：
- 配置文件查找
- YAML 解析
- 环境变量扩展
- 配置验证

**代码位置**：`src/config.ts`

### 4. SSE 服务器模块

**职责**：实现 SSE 传输模式

**主要功能**：
- HTTP 服务器
- SSE 连接管理
- 鉴权处理

**代码位置**：`src/mcp-server-sse.ts`

### 5. 鉴权模块

**职责**：实现 SSE 鉴权

**主要功能**：
- Token 提取
- 鉴权策略验证
- 时序安全比较

**代码位置**：`src/sse-auth.ts`

### 6. 生命周期桥接模块

**职责**：桥接 AI 助手生命周期

**主要功能**：
- 自动召回（auto-recall）
- 自动捕获（auto-capture）
- 会话管理

**代码位置**：`src/index.ts`

## 数据流

### 1. MCP 请求处理流程

```
MCP Client → MCP Server → Tool Handler → memory-lancedb-pro → LanceDB
```

**详细流程**：
1. MCP 客户端发送请求
2. MCP 服务器解析请求
3. 工具处理器执行操作
4. memory-lancedb-pro 处理业务逻辑
5. LanceDB 存储/检索数据

### 2. CLI 命令处理流程

```
User → CLI → Command Handler → Config/DB → Response
```

**详细流程**：
1. 用户输入命令
2. CLI 解析命令参数
3. 命令处理器执行操作
4. 配置/数据库操作
5. 返回结果

### 3. SSE 请求处理流程

```
HTTP Client → SSE Server → Auth Check → MCP Server → Tool Handler
```

**详细流程**：
1. HTTP 客户端连接
2. SSE 服务器接受连接
3. 鉴权检查
4. MCP 服务器处理请求
5. 工具处理器执行操作

## 配置系统

### 配置文件结构

```yaml
# 嵌入配置
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"

# 检索配置
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  rerank: "cross-encoder"

# 自动化配置
autoCapture: true
autoRecall: false
smartExtraction: true
```

### 配置优先级

1. CLI 参数（最高优先级）
2. 环境变量直接覆盖
3. 配置文件中的 `${VAR}` 引用
4. 配置文件中的硬编码值
5. 默认值（最低优先级）

### 环境变量扩展

配置文件支持 `${VAR}` 语法引用环境变量：

```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 运行时替换为环境变量值
```

## 存储系统

### LanceDB

**职责**：向量数据库，存储记忆数据

**主要功能**：
- 向量存储和检索
- 混合检索（向量 + BM25）
- 数据持久化

**数据模型**：
```typescript
interface Memory {
  id: string;
  text: string;
  category: string;
  tags: string[];
  importance: number;
  scope: string;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Scope 隔离

**职责**：实现多项目隔离

**隔离级别**：
- 全局 scope（global）
- 项目 scope（project:xxx）
- 用户 scope（user:xxx）

**隔离机制**：
- ACL 权限控制
- 数据分区
- 查询过滤

## 检索系统

### 混合检索

**职责**：结合向量和关键词检索

**算法**：
1. 向量检索：语义相似度
2. BM25 检索：关键词匹配
3. 加权合并：向量权重 0.7，BM25 权重 0.3

### 重排系统

**职责**：对检索结果进行二次精排

**模式**：
- cross-encoder：API 重排（推荐）
- lightweight：本地余弦相似度重排
- none：关闭重排

**支持供应商**：
- Jina
- SiliconFlow
- DashScope
- Voyage
- Pinecone
- HuggingFace TEI

## 衰减系统

### Weibull 衰减

**职责**：自然淡化老旧记忆

**算法**：
- Weibull 分布衰减
- 半衰期可配置
- 重要度加权

**配置**：
```yaml
retrieval:
  recencyHalfLifeDays: 30
  recencyWeight: 0.3
```

## 智能提取系统

### 自动捕获

**职责**：从对话中提取记忆

**触发条件**：
- agent_end 生命周期事件
- 对话结束

**处理流程**：
1. 分析对话内容
2. 提取关键信息
3. 分类和存储

### 自动召回

**职责**：在 prompt 构建前注入上下文

**触发条件**：
- before_prompt_build 生命周期事件
- 新对话开始

**处理流程**：
1. 分析当前上下文
2. 检索相关记忆
3. 注入到 prompt

## 扩展点

### 1. 自定义工具

**方式**：通过 MCP 协议注册新工具

**示例**：
```typescript
server.tool("custom_tool", async (params) => {
  // 自定义逻辑
  return { result: "..." };
});
```

### 2. 自定义存储

**方式**：替换 LanceDB 实现

**接口**：
```typescript
interface StorageAdapter {
  store(memory: Memory): Promise<void>;
  search(query: string): Promise<Memory[]>;
  delete(id: string): Promise<void>;
}
```

### 3. 自定义检索

**方式**：替换检索算法

**接口**：
```typescript
interface RetrievalAdapter {
  search(query: string, options: SearchOptions): Promise<Memory[]>;
  rerank(candidates: Memory[], query: string): Promise<Memory[]>;
}
```

## 性能优化

### 1. 连接池

**优化**：复用数据库连接

**配置**：
```yaml
storage:
  poolSize: 10
```

### 2. 缓存

**优化**：缓存频繁查询结果

**配置**：
```yaml
cache:
  enabled: true
  maxSize: 1000
  ttl: 300
```

### 3. 索引

**优化**：优化数据库索引

**配置**：
```yaml
storage:
  indexType: "IVF"
  indexParams:
    nlist: 1024
```

## 安全设计

### 1. 鉴权

**机制**：Bearer Token 鉴权

**配置**：
```bash
MEM_MCP_AUTH_TOKEN=$(openssl rand -hex 24)
mem serve --sse --host 0.0.0.0 --auth-token $MEM_MCP_AUTH_TOKEN
```

### 2. 权限控制

**机制**：Scope ACL 权限控制

**配置**：
```yaml
scopes:
  default: "global"
  agentAccess:
    agent:main: ["global", "project:*"]
```

### 3. 数据加密

**机制**：配置文件敏感信息加密

**配置**：
```yaml
encryption:
  enabled: true
  key: "${ENCRYPTION_KEY}"
```

## 监控和日志

### 1. 健康检查

**端点**：`GET /health`

**检查项**：
- 配置文件有效性
- 数据库连接
- API 密钥有效性

### 2. 日志系统

**级别**：
- error：错误日志
- warn：警告日志
- info：信息日志
- debug：调试日志

**配置**：
```yaml
logging:
  level: "info"
  file: "/var/log/memory-mcp.log"
```

### 3. 指标收集

**指标**：
- 请求计数
- 响应时间
- 错误率
- 内存使用

## 部署架构

### 1. 单机部署

```
┌─────────────────┐
│  memory-mcp     │
│  (stdio mode)   │
└─────────────────┘
```

### 2. 容器部署

```
┌─────────────────┐
│  Docker         │
│  ┌─────────────┐ │
│  │ memory-mcp  │ │
│  │ (SSE mode)  │ │
│  └─────────────┘ │
└─────────────────┘
```

### 3. 集群部署

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
┌────────▼────────┐
│  memory-mcp     │
│  (SSE mode)     │
└────────┬────────┘
         │
┌────────▼────────┐
│  LanceDB        │
│  (Shared)       │
└─────────────────┘
```

## 未来规划

### 1. 功能扩展

- 支持更多向量数据库
- 支持更多重排供应商
- 支持更多嵌入模型

### 2. 性能优化

- 分布式部署支持
- 更高效的检索算法
- 更智能的缓存策略

### 3. 生态集成

- 更多 MCP 客户端支持
- 更多 AI 框架集成
- 更多云服务集成

## 相关文档

- [项目主页](../../README.md) - 项目概览
- [CLI 参考](../cli/README.md) - 命令行工具
- [配置指南](../config/README.md) - 配置系统
- [MCP 工具](../mcp/README.md) - MCP 工具参考
