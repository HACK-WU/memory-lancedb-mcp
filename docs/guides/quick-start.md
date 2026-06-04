# 快速开始

本指南帮助您快速安装、配置和使用 memory-lancedb-mcp。

## 前置条件

- Node.js ≥ 18
- 嵌入 API 密钥（OpenAI / SiliconFlow / Ollama 等）
- `mem` 命令（通过全局安装获得）

## 安装

### 方式 1：全局安装（推荐）

```bash
# 下载安装脚本
curl -fsSL https://raw.githubusercontent.com/HACK-WU/memory-lancedb-mcp/master/scripts/install-latest.sh -o install-latest.sh

# 执行安装
bash install-latest.sh
```

安装完成后，`mem` 命令即可全局使用：

```bash
mem --help
mem --version
```

### 方式 2：从源码安装（开发者）

```bash
git clone git@github.com:HACK-WU/memory-lancedb-mcp.git
cd memory-lancedb-mcp
npm install
npm run build
npm link   # 将 mem 命令链接到全局
```

## 配置

### 1. 初始化配置

```bash
mem config init
```

这会创建默认配置文件：`~/.config/memory-mcp/config.yaml`

### 2. 编辑配置文件

```bash
# 使用您喜欢的编辑器
vim ~/.config/memory-mcp/config.yaml
```

**配置示例**：

**OpenAI**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  model: "text-embedding-3-small"
  baseURL: "https://api.openai.com/v1"
  dimensions: 1536
```

**SiliconFlow**：
```yaml
embedding:
  apiKey: "${SILICONFLOW_API_KEY}"
  model: "Qwen/Qwen3-Embedding-8B"
  baseURL: "https://api.siliconflow.cn/v1"
  dimensions: 4096
```

**Ollama（本地）**：
```yaml
embedding:
  apiKey: ""
  model: "nomic-embed-text"
  baseURL: "http://localhost:11434"
  dimensions: 768
```

### 3. 设置环境变量

```bash
# 设置 API 密钥
export OPENAI_API_KEY="sk-..."

# 或使用 SiliconFlow
export SILICONFLOW_API_KEY="sk-..."
```

### 4. 验证配置

```bash
# 验证配置有效性
mem config validate

# 健康检查
mem doctor
```

## 启动服务

### stdio 模式（默认）

```bash
# 启动 MCP 服务
mem serve
```

### SSE 模式

```bash
# 本地访问（免 token）
mem serve --sse --port 3100

# 远程访问（需要 token）
MEM_MCP_AUTH_TOKEN=$(openssl rand -hex 24) \
  mem serve --sse --port 3100 --host 0.0.0.0
```

## MCP 客户端配置

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Cursor

在 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "memory": {
      "command": "mem",
      "args": ["serve"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Cline (VS Code)

在 Cline 的 MCP Server 设置中添加：

```json
{
  "command": "mem",
  "args": ["serve"],
  "env": {
    "OPENAI_API_KEY": "sk-..."
  }
}
```

## 基本使用

### 存储记忆

```bash
# 存储偏好
mem store "用户偏好使用 pnpm" -c preference -t tech,tools -i 0.9

# 存储项目信息
mem store "项目基于 LanceDB 存储" -c fact --scope myapp
```

### 搜索记忆

```bash
# 语义搜索
mem search "包管理器偏好"

# 按 scope 搜索
mem search "架构设计" --scope myapp

# 按标签搜索
mem search "工程师" -t profile
```

### 查看记忆

```bash
# 列出记忆
mem list -l 10

# 按 scope 列出
mem list --scope myapp

# 按标签过滤
mem list -t profile,tech
```

### 查看统计

```bash
# 查看统计信息
mem stats

# 按 scope 统计
mem stats --scope myapp
```

## 多项目隔离

### 锁定 scope 模式

```bash
# 启动服务时指定 scope
mem serve --scope project:myapp

# 所有操作自动限定在 project:myapp
mem store "项目信息"  # 写入 project:myapp
mem search "架构"    # 搜索 project:myapp
```

### 跨 scope 模式

```bash
# 不指定 scope
mem serve

# 存储到指定 scope
mem store "通用知识"  # 写入 global
mem store "项目信息" --scope project:alpha  # 写入 project:alpha

# 跨 scope 搜索
mem search "架构"  # 搜索所有 scope
mem search "架构" --scope project:alpha  # 仅搜索 project:alpha
```

## 诊断工具

### 健康检查

```bash
mem doctor
```

输出示例：
```
✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
✅ Embedding API key present
✅ Rerank: cross-encoder (provider=jina, apiKey=present)
```

### 验证配置

```bash
mem config validate
```

输出示例：
```
✅ Config valid: ~/.config/memory-mcp/config.yaml
  Embedding model: text-embedding-3-small
  DB path: ~/.local/share/memory-mcp/lancedb
  Smart extraction: true
  Auto-capture: true
  Auto-recall: false
  Rerank: cross-encoder (provider=jina, apiKey=present)
```

### 预览工具

```bash
mem serve --dry-run
```

## 常见问题

### Q1: 安装后 `mem` 命令找不到

**解决**：
```bash
# 检查 npm 全局安装路径
npm root -g

# 使用完整路径
node /usr/local/lib/node_modules/memory-lancedb-mcp/bin/mem.mjs serve

# 或重新安装
npm install -g memory-lancedb-mcp
```

### Q2: API 密钥错误

**解决**：
```bash
# 检查环境变量
echo $OPENAI_API_KEY

# 验证配置
mem config validate

# 健康检查
mem doctor
```

### Q3: LanceDB 模块缺失

**解决**：
```bash
# Linux
npm install -g @lancedb/lancedb-linux-x64-gnu

# macOS
npm rebuild -g @lancedb/lancedb
```

### Q4: 服务启动失败

**解决**：
```bash
# 检查配置
mem config validate

# 健康检查
mem doctor

# 查看详细日志
mem serve --verbose
```

## 下一步

- [CLI 参考](../cli/README.md) - 了解所有命令
- [配置指南](../config/README.md) - 深入配置选项
- [MCP 工具](../mcp/README.md) - 了解 MCP 工具
- [多项目隔离](multi-project.md) - 多项目配置
- [故障排除](troubleshooting.md) - 常见问题解决

## 获取帮助

- [GitHub Issues](https://github.com/HACK-WU/memory-lancedb-mcp/issues)
- [文档](../README.md)
- [贡献指南](../development/contributing.md)
