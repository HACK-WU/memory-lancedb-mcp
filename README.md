# memory-lancedb-mcp

为 AI 应用提供**持久化长期记忆**的 MCP Server。支持语义检索、多项目隔离、自动分类与衰减，让 AI 助手记住用户偏好、项目架构、历史决策等关键信息，实现越用越懂你的个性化体验。

**核心能力来自** [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) — 一个由 [CortexReach](https://github.com/CortexReach) 团队开源的 LanceDB 向量记忆引擎，提供混合检索（向量 + BM25）、Weibull 衰减、智能提取等企业级记忆管理功能。

> 感谢 CortexReach 团队开源 memory-lancedb-pro，本项目基于其核心能力进行 MCP 协议桥接与扩展。

## 快速开始

### 安装

```bash
# 下载安装脚本
curl -fsSL https://raw.githubusercontent.com/HACK-WU/memory-lancedb-mcp/master/scripts/install-latest.sh -o install-latest.sh

# 执行安装
bash install-latest.sh
```

### 配置

```bash
# 初始化配置文件
mem config init

# 编辑配置文件，填入 API 密钥
vim ~/.config/memory-mcp/config.yaml
```

**配置示例**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536
```

### 启动服务

```bash
# 启动 MCP 服务（stdio 模式）
mem serve

# 或使用 SSE 模式
mem serve --sse --port 3100
```

### 验证安装

```bash
# 检查配置有效性
mem config validate

# 健康检查
mem doctor

# 存储测试记忆
mem store "用户偏好使用 pnpm" -c preference -t tech

# 搜索记忆
mem search "包管理器偏好"
```

## 核心功能

- **17 个记忆工具**暴露为 MCP tools（recall, store, forget, update, stats, list, debug, promote, archive, compact, explain_rank, self-improvement, 以及 3 个生命周期工具）
- **多项目隔离** — `--scope` 参数按 project 隔离记忆，互不干扰
- **智能生命周期桥接** — `before_prompt_build`（auto-recall）和 `agent_end`（auto-capture）
- **双传输模式** — stdio（默认，本地 MCP 客户端）和 SSE（HTTP，远程/多客户端）
- **YAML 配置** — 支持 `${ENV_VAR}` 环境变量扩展
- **CLI 管理工具** — `mem` 命令行，支持配置管理、记忆查看、健康诊断
- **多供应商 Embedding** — OpenAI, SiliconFlow, Ollama 等

## 文档导航

### 📚 CLI 参考
- [CLI 总览](docs/cli/README.md) - 命令行工具概览
- [serve 命令](docs/cli/serve.md) - 启动 MCP 服务
- [config 命令](docs/cli/config.md) - 配置管理
- [store 命令](docs/cli/store.md) - 存储记忆
- [search 命令](docs/cli/search.md) - 语义搜索
- [list 命令](docs/cli/list.md) - 列表查看
- [stats 命令](docs/cli/stats.md) - 统计信息
- [delete 命令](docs/cli/delete.md) - 删除记忆
- [scope 命令](docs/cli/scope.md) - Scope 管理
- [doctor 命令](docs/cli/doctor.md) - 健康检查

### ⚙️ 配置指南
- [配置总览](docs/config/README.md) - 配置系统概览
- [环境变量详解](docs/config/environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](docs/config/embedding.md) - 嵌入 API 配置
- [重排配置](docs/config/rerank.md) - 重排模型配置
- [高级配置](docs/config/advanced.md) - 高级配置选项

### 🔧 MCP 工具
- [MCP 工具总览](docs/mcp/README.md) - MCP 工具概览
- [记忆管理工具](docs/mcp/memory-tools.md) - 核心记忆操作
- [治理工具](docs/mcp/governance-tools.md) - 记忆治理功能
- [自我改进工具](docs/mcp/self-improvement.md) - 自我改进功能
- [生命周期工具](docs/mcp/lifecycle-tools.md) - 生命周期管理

### 📖 使用指南
- [快速开始](docs/guides/quick-start.md) - 详细快速开始指南
- [多项目隔离](docs/guides/multi-project.md) - 多项目配置
- [故障排除](docs/guides/troubleshooting.md) - 常见问题解决

### 🛠️ 开发文档
- [开发总览](docs/development/README.md) - 开发指南
- [架构设计](docs/development/architecture.md) - 系统架构
- [贡献指南](docs/development/contributing.md) - 如何贡献

## 适用场景

memory-lancedb-mcp 适合需要**持久化长期记忆**的 AI 应用：

- **AI 代码助手** — 记住项目架构、编码偏好、常见 Bug 模式
- **AI 写作/创作** — 记住写作风格、人物设定、读者偏好
- **AI 客服** — 记住用户画像、历史诉求、解决方案
- **AI 研究助理** — 记住研究方向、文献摘要、关键结论
- **AI 个人助理** — 记住日程偏好、饮食禁忌、旅行习惯
- **AI 游戏 NPC** — 记住玩家行为、剧情走向、角色关系

## 贡献与许可

欢迎贡献！请查看 [贡献指南](docs/development/contributing.md)。

本项目基于 [MIT 许可证](LICENSE) 开源。

---

本项目基于 [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) 构建，感谢 CortexReach 团队的开源贡献。
