# CLI 参考

memory-lancedb-mcp 提供了 `mem` 命令行工具，用于管理配置、操作记忆和诊断问题。

## 命令概览

| 命令 | 说明 | 文档链接 |
|------|------|----------|
| `mem serve` | 启动 MCP 服务 | [serve.md](serve.md) |
| `mem config` | 配置管理 | [config.md](config.md) |
| `mem store` | 存储记忆 | [store.md](store.md) |
| `mem bulk-store` | 批量存储记忆 | [bulk-store.md](bulk-store.md) |
| `mem search` | 语义搜索 | [search.md](search.md) |
| `mem list` | 列表查看 | [list.md](list.md) |
| `mem stats` | 统计信息 | [stats.md](stats.md) |
| `mem delete` | 删除记忆 | [delete.md](delete.md) |
| `mem scope` | Scope 管理 | [scope.md](scope.md) |
| `mem doctor` | 健康检查 | [doctor.md](doctor.md) |

## 全局选项

所有命令都支持以下全局选项：

| 选项 | 说明 |
|------|------|
| `-c, --config <path>` | 指定配置文件路径 |
| `--help` | 显示帮助信息 |
| `--version` | 显示版本信息 |

## 使用示例

### 基本用法

```bash
# 查看帮助
mem --help

# 查看特定命令帮助
mem serve --help

# 查看版本
mem --version
```

### 配置管理

```bash
# 初始化配置文件
mem config init

# 查看当前配置
mem config show

# 验证配置有效性
mem config validate

# 显示配置文件路径
mem config path
```

### 记忆操作

```bash
# 存储记忆
mem store "用户偏好使用 pnpm" -c preference -t tech

# 批量存储记忆（推荐大数据量使用，详见 bulk-store.md）
mem bulk-store -f memories.json --scope project:myapp

# 搜索记忆
mem search "包管理器偏好"

# 列出记忆
mem list -l 10

# 查看统计信息
mem stats
```

### 服务管理

```bash
# 启动 stdio 模式服务
mem serve

# 启动 SSE 模式服务
mem serve --sse --port 3100

# 指定项目 scope
mem serve --scope project:myapp

# 预览注册的工具
mem serve --dry-run
```

### 诊断工具

```bash
# 健康检查
mem doctor

# 测试 MCP 协议握手
mem doctor --mcp
```

## 配置文件

默认配置文件路径：`~/.config/memory-mcp/config.yaml`

可以通过以下方式指定配置文件：
1. `--config` 参数
2. `MEM_CONFIG_PATH` 环境变量
3. 当前目录下的 `config.yaml`

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `MEM_CONFIG_PATH` | 配置文件路径 |
| `MEM_DB_PATH` | 数据库存储路径 |
| `MEM_MCP_AUTH_TOKEN` | SSE 鉴权 token |
| `OPENAI_API_KEY` | OpenAI API 密钥 |

## 错误处理

### 常见错误

**配置文件不存在**：
```
No config found. Run 'mem config init' first.
```
**解决**：运行 `mem config init` 创建配置文件

**API 密钥未设置**：
```
Config missing required 'embedding.apiKey'
```
**解决**：在配置文件或环境变量中设置 API 密钥

**服务启动失败**：
```
Failed to start MCP server
```
**解决**：运行 `mem doctor` 检查配置和依赖

### 调试技巧

1. **启用详细日志**：
   ```bash
   mem serve --verbose
   ```

2. **验证配置**：
   ```bash
   mem config validate
   ```

3. **健康检查**：
   ```bash
   mem doctor
   ```

4. **预览工具**：
   ```bash
   mem serve --dry-run
   ```

## 相关文档

- [配置指南](../config/README.md) - 配置系统详解
- [MCP 工具](../mcp/README.md) - MCP 工具参考
- [使用指南](../guides/README.md) - 使用场景和最佳实践
