# 文档索引

memory-lancedb-mcp 项目文档索引。

## 核心文档

### 📚 主文档
- [项目主页](../README.md) - 项目概览、快速开始、文档导航

### 🚀 快速开始
- [快速开始指南](guides/quick-start.md) - 安装、配置、首次使用

## 参考文档

### 📖 CLI 参考
- [CLI 总览](cli/README.md) - 命令行工具概览
- [serve 命令](cli/serve.md) - 启动 MCP 服务
- [config 命令](cli/config.md) - 配置管理
- [store 命令](cli/store.md) - 存储记忆
- [bulk-store 命令](cli/bulk-store.md) - 批量存储记忆（推荐大数据量使用）
- [search 命令](cli/search.md) - 语义搜索
- [list 命令](cli/list.md) - 列表查看
- [stats 命令](cli/stats.md) - 统计信息
- [delete 命令](cli/delete.md) - 删除记忆
- [scope 命令](cli/scope.md) - Scope 管理
- [doctor 命令](cli/doctor.md) - 健康检查

### ⚙️ 配置指南
- [配置总览](config/README.md) - 配置系统概览
- [环境变量详解](config/environment-variables.md) - 环境变量与配置文件交互
- [嵌入配置](config/embedding.md) - 嵌入 API 配置
- [重排配置](config/rerank.md) - 重排模型配置
- [高级配置](config/advanced.md) - 高级配置选项

### 🔧 MCP 工具
- [MCP 工具总览](mcp/README.md) - MCP 工具概览
- [记忆管理工具](mcp/memory-tools.md) - 核心记忆操作
- [治理工具](mcp/governance-tools.md) - 记忆治理功能
- [自我改进工具](mcp/self-improvement.md) - 自我改进功能
- [生命周期工具](mcp/lifecycle-tools.md) - 生命周期管理

## 使用指南

### 📖 使用场景
- [快速开始](guides/quick-start.md) - 快速上手指南
- [多项目隔离](guides/multi-project.md) - 多项目配置
- [故障排除](guides/troubleshooting.md) - 常见问题解决

## 开发文档

### 🛠️ 开发指南
- [开发总览](development/README.md) - 开发指南
- [架构设计](development/architecture.md) - 系统架构
- [贡献指南](development/contributing.md) - 如何贡献
- [SSE 鉴权设计](development/sse-auth-design.md) - SSE 鉴权机制
- [代码审查报告](development/code-review.md) - 代码审查

## 设计文档

### 📋 设计文档
- [README 重构设计](design/README-refactor-design.md) - README 重构设计文档

## 知识索引

### 📚 知识索引文档
- [知识索引文档](knowledge-index/) - 知识索引相关文档

## 文档结构

```
docs/
├── README.md                    # 本文档索引
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
├── development/                 # 开发文档
│   ├── README.md               # 开发总览
│   ├── architecture.md         # 架构设计
│   ├── contributing.md         # 贡献指南
│   ├── sse-auth-design.md      # SSE 鉴权设计
│   └── code-review.md          # 代码审查报告
├── design/                      # 设计文档
│   └── README-refactor-design.md # README 重构设计
└── knowledge-index/             # 知识索引文档
    ├── README.md               # 知识索引概览
    └── ...                     # 其他知识索引文档
```

## 文档维护

### 添加新文档

1. 在相应目录创建 `.md` 文件
2. 更新本索引文档
3. 更新相关文档的链接

### 文档规范

- 使用 Markdown 格式
- 遵循现有文档结构
- 保持链接一致性
- 定期更新内容

### 文档审查

- 检查链接有效性
- 验证代码示例
- 确保内容准确性
- 更新过时信息

## 相关链接

- [项目主页](https://github.com/HACK-WU/memory-lancedb-mcp)
- [GitHub Issues](https://github.com/HACK-WU/memory-lancedb-mcp/issues)
- [GitHub Discussions](https://github.com/HACK-WU/memory-lancedb-mcp/discussions)

## 许可证

本项目基于 [MIT 许可证](../LICENSE) 开源。
