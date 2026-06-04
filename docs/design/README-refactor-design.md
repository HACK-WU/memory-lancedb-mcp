# README.md 重构设计文档

## 1. 设计目标

### 1.1 核心目标
- **简洁性**：将 937 行的 README.md 精简至 < 300 行
- **完整性**：补充缺失的 CLI 命令文档（`mem config validate`）
- **清晰性**：详细说明环境变量与配置文件的交互机制
- **可维护性**：建立清晰的文档结构，便于后续更新

### 1.2 具体指标
- [ ] README.md 长度 < 300 行
- [ ] 所有 CLI 命令完整覆盖
- [ ] 环境变量交互机制有详细说明
- [ ] 文档结构清晰，易于导航

## 2. 文档结构设计

### 2.1 目录结构

```
docs/
├── README.md                    # 主文档（精简版）
├── cli/                         # CLI 命令参考
│   ├── README.md               # CLI 总览
│   ├── serve.md                # serve 命令详解
│   ├── config.md               # config 命令详解
│   ├── store.md                # store 命令详解
│   ├── search.md               # search 命令详解
│   ├── list.md                 # list 命令详解
│   ├── stats.md                # stats 命令详解
│   ├── delete.md               # delete 命令详解
│   ├── scope.md                # scope 命令详解
│   └── doctor.md               # doctor 命令详解
├── config/                      # 配置指南
│   ├── README.md               # 配置总览
│   ├── environment-variables.md # 环境变量详解
│   ├── embedding.md            # 嵌入配置
│   ├── rerank.md               # 重排配置
│   └── advanced.md             # 高级配置
├── mcp/                         # MCP 工具参考
│   ├── README.md               # MCP 工具总览
│   ├── memory-tools.md         # 记忆管理工具
│   ├── governance-tools.md     # 治理工具
│   ├── self-improvement.md     # 自我改进工具
│   └── lifecycle-tools.md      # 生命周期工具
├── guides/                      # 使用指南
│   ├── quick-start.md          # 快速开始
│   ├── multi-project.md        # 多项目隔离
│   └── troubleshooting.md      # 故障排除
└── development/                 # 开发文档
    ├── README.md               # 开发总览
    ├── architecture.md         # 架构设计
    └── contributing.md         # 贡献指南
```

### 2.2 现有文档迁移计划

| 现有文档 | 新位置 | 说明 |
|---------|--------|------|
| `docs/knowledge-index/` | `docs/knowledge-index/` | 保持原位，独立子项目 |
| `docs/SSE_AUTH_FIX_DESIGN.md` | `docs/development/sse-auth-design.md` | 开发文档 |
| `docs/代码审查报告.md` | `docs/development/code-review.md` | 开发文档 |
| `docs/评分机制*.md` | `docs/knowledge-index/` | 知识索引相关 |
| `docs/需求挖掘报告_知识索引SKILL.md` | `docs/knowledge-index/` | 知识索引相关 |

## 3. 内容设计

### 3.1 README.md（主文档）

**目标行数**：< 300 行

**内容结构**：
```markdown
# memory-lancedb-mcp

[项目简介]

## 快速开始
- 安装
- 基本配置
- 首次使用

## 核心功能
- 功能概览
- 适用场景

## 文档导航
- CLI 参考
- 配置指南
- MCP 工具
- 使用指南
- 开发文档

## 贡献与许可
```

### 3.2 环境变量与配置文件交互详解

#### 3.2.1 交互机制

**配置文件中的环境变量引用**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 运行时替换为环境变量值
```

**处理流程**：
1. 读取 YAML 配置文件
2. 解析 `${VAR_NAME}` 语法
3. 查找对应的环境变量
4. 替换为环境变量值（如果未设置，替换为空字符串并发出警告）

**优先级规则**：
```
1. CLI 参数（最高优先级）
2. 环境变量直接覆盖（如 MEM_DB_PATH）
3. 配置文件中的 ${VAR} 引用
4. 配置文件中的硬编码值
5. 默认值（最低优先级）
```

#### 3.2.2 环境变量分类

**配置路径类**：
- `MEM_CONFIG_PATH`：配置文件路径
- `MEM_DB_PATH`：数据库路径

**API 密钥类**：
- `OPENAI_API_KEY`：OpenAI API 密钥
- `SILICONFLOW_API_KEY`：SiliconFlow API 密钥
- `JINA_API_KEY`：Jina Rerank API 密钥
- `DASHSCOPE_API_KEY`：DashScope Rerank API 密钥
- `VOYAGE_API_KEY`：Voyage Rerank API 密钥
- `PINECONE_API_KEY`：Pinecone Rerank API 密钥

**服务配置类**：
- `MEM_MCP_AUTH_TOKEN`：SSE 鉴权 token

#### 3.2.3 使用场景示例

**场景 1：使用环境变量存储 API 密钥**
```bash
# 设置环境变量
export OPENAI_API_KEY="sk-..."

# 配置文件中使用引用
embedding:
  apiKey: "${OPENAI_API_KEY}"
```

**场景 2：完全使用环境变量（不修改配置文件）**
```bash
# 直接设置环境变量
export OPENAI_API_KEY="sk-..."
export MEM_DB_PATH="/custom/path"

# 配置文件中保留占位符
embedding:
  apiKey: "${OPENAI_API_KEY}"
dbPath: "~/.local/share/memory-mcp/lancedb"  # 会被 MEM_DB_PATH 覆盖
```

**场景 3：混合使用**
```yaml
# 配置文件
embedding:
  apiKey: "${OPENAI_API_KEY}"  # 从环境变量读取
  model: "text-embedding-3-small"  # 硬编码值
  baseURL: "https://api.openai.com/v1"  # 硬编码值
```

#### 3.2.4 错误处理

**环境变量未设置**：
- 行为：替换为空字符串
- 日志：`[mem:config] Warning: env var ${VAR_NAME} is not set`
- 影响：可能导致 API 调用失败

**配置文件语法错误**：
- 行为：抛出异常
- 日志：`Failed to parse config YAML at ${path}: ${error}`
- 影响：服务无法启动

**必需字段缺失**：
- 行为：抛出异常
- 日志：`Config missing required 'embedding.apiKey'`
- 影响：服务无法启动

### 3.3 CLI 命令文档补充

#### 3.3.1 `mem config validate` 命令

**功能**：验证配置文件的有效性

**语法**：
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
1. 配置文件语法正确
2. 必需字段存在（embedding.apiKey）
3. 环境变量已设置（如果使用 ${VAR} 引用）
4. 重排配置有效

**错误处理**：
```bash
❌ Config invalid: Config missing required 'embedding.apiKey'
```

#### 3.3.2 其他 CLI 命令文档

每个命令文档应包含：
- 功能说明
- 语法
- 参数说明
- 示例
- 错误处理

## 4. 实施计划

### 4.1 阶段 1：目录结构创建
- 创建新的目录结构
- 移动现有文档到新位置

### 4.2 阶段 2：主文档重构
- 精简 README.md
- 添加快速开始内容
- 创建文档导航

### 4.3 阶段 3：CLI 文档编写
- 编写 CLI 总览
- 编写各命令详细文档
- 补充 `mem config validate` 文档

### 4.4 阶段 4：配置指南编写
- 编写环境变量详解
- 编写嵌入配置指南
- 编写重排配置指南

### 4.5 阶段 5：MCP 工具文档
- 编写 MCP 工具总览
- 编写各工具详细文档

### 4.6 阶段 6：使用指南编写
- 编写快速开始指南
- 编写多项目隔离指南
- 编写故障排除指南

## 5. 验收标准

### 5.1 结构验收
- [ ] 目录结构符合设计
- [ ] 所有文档链接正确
- [ ] 导航清晰

### 5.2 内容验收
- [ ] README.md < 300 行
- [ ] 所有 CLI 命令完整覆盖
- [ ] 环境变量交互机制详细说明
- [ ] 快速开始内容完整

### 5.3 质量验收
- [ ] 文档清晰易读
- [ ] 示例可运行
- [ ] 错误处理完整
