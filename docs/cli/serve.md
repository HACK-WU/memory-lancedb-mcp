# mem serve 命令

`mem serve` 命令用于启动 memory-lancedb-mcp 的 MCP 服务。

## 语法

```bash
mem serve [options]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-c, --config <path>` | 配置文件路径 | 自动查找 |
| `-s, --scope <scope>` | 项目隔离 scope | 无 |
| `--sse` | 切换为 SSE 模式 | stdio |
| `-p, --port <n>` | SSE 端口 | 3100 |
| `--host <host>` | SSE 绑定地址 | 127.0.0.1 |
| `--auth-token <token>` | SSE Bearer token | 无 |
| `--no-auth` | 显式关闭 SSE 鉴权 | 无 |
| `--dry-run` | 验证配置并列出工具，不启动服务 | 无 |
| `-q, --quiet` | 抑制调试日志 | 无 |

## 使用示例

### stdio 模式（默认）

```bash
# 基本启动
mem serve

# 指定配置文件
mem serve --config /path/to/config.yaml

# 指定项目 scope
mem serve --scope project:myapp

# 预览注册的工具
mem serve --dry-run
```

### SSE 模式

```bash
# 本地访问（免 token）
mem serve --sse --port 3100

# 远程访问（需要 token）
MEM_MCP_AUTH_TOKEN=$(openssl rand -hex 24) \
  mem serve --sse --port 3100 --host 0.0.0.0

# 显式传入 token
mem serve --sse --port 3100 --host 0.0.0.0 --auth-token "<token>"
```

### 多项目隔离

```bash
# 锁定 scope 模式
mem serve --scope project:myapp

# 跨 scope 模式
mem serve
```

## 输出示例

### 正常启动

```
[mem] MCP server started (stdio mode)
[mem] Config: ~/.config/memory-mcp/config.yaml
[mem] Embedding: text-embedding-3-small
[mem] DB path: ~/.local/share/memory-mcp/lancedb
[mem] Scope: project:myapp (locked)
```

### 预览模式

```
Registered MCP tools:
  - memory_store
  - memory_recall
  - memory_list
  - memory_forget
  - memory_update
  - memory_stats
  - memory_debug
  - memory_promote
  - memory_archive
  - memory_compact
  - memory_explain_rank
  - self_improvement_log
  - self_improvement_extract_skill
  - self_improvement_review
```

## 鉴权配置

### 启动方式 vs 鉴权要求对照表

| 启动方式 | host | token | 行为 |
|---------|------|-------|------|
| `mem serve --sse` | `127.0.0.1` | 无 | ✅ 启动，免鉴权 |
| `mem serve --sse --auth-token xxx` | `127.0.0.1` | 有 | ✅ 启动，启用鉴权 |
| `mem serve --sse --host 0.0.0.0 --auth-token xxx` | `0.0.0.0` | 有 | ✅ 启动，启用鉴权 |
| `mem serve --sse --host 0.0.0.0` | `0.0.0.0` | 无 | ❌ 拒绝启动 |
| `mem serve --sse --host 0.0.0.0 --no-auth` | `0.0.0.0` | — | ❌ 拒绝启动 |

### 鉴权保护范围

启用鉴权后，**所有 HTTP 路径默认受保护**（白名单模式），仅以下请求豁免：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/health` | `GET` | 健康检查 |
| 任意路径 | `OPTIONS` | CORS 预检请求 |

### 鉴权配置优先级

1. CLI `--auth-token <token>` （最高优先级）
2. 环境变量 `MEM_MCP_AUTH_TOKEN`
3. `--no-auth` （显式关闭，**仅在回环监听时允许**）

## 客户端配置

### Claude Desktop / Cursor（stdio 模式）

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

### SSE 远程模式（无鉴权，本地）

```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3100/sse"
    }
  }
}
```

### SSE 远程模式（有鉴权，远程）

通过 `Authorization` Header 传入 Bearer Token：

```json
{
  "mcpServers": {
    "memory": {
      "url": "http://your-server:3100/sse",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

部分客户端不支持自定义 headers，可通过 URL Query 参数传递：

```
http://your-server:3100/sse?token=<your-token>
```

> 客户端 token 提取优先级：`Authorization: Bearer xxx` Header > `?token=xxx` Query 参数

## 故障排除

### 服务启动失败

**症状**：
```
Failed to start MCP server
```

**解决**：
```bash
# 健康检查
mem doctor

# 验证配置
mem config validate

# 查看详细日志
mem serve --verbose
```

### 端口占用

**症状**：
```
EADDRINUSE: address already in use :::3100
```

**解决**：
```bash
# 检查端口占用
lsof -i :3100

# 杀死占用进程
kill -9 <PID>

# 或使用其他端口
mem serve --sse --port 3101
```

### 鉴权失败

**症状**：
```
401 Unauthorized
```

**服务端日志**：
```
[mem][auth] 2026-01-01T00:00:00.000Z ip=1.2.3.4 path=/sse reason=missing_token
[mem][auth] 2026-01-01T00:00:00.000Z ip=1.2.3.4 path=/sse reason=invalid_token
```

**排查步骤**：
```bash
# 1. 确认服务端 token 设置
echo $MEM_MCP_AUTH_TOKEN

# 2. 手动测试鉴权
curl -H "Authorization: Bearer <your-token>" http://your-server:3100/health

# 3. 检查客户端配置中的 token 是否与服务端一致
```

**常见原因**：
1. 客户端未配置 `headers.Authorization`（missing_token）
2. 客户端 token 与服务端不一致（invalid_token）
3. 客户端使用了错误的鉴权方案（只识别 `Bearer`）

### 非本地监听拒绝启动

**症状**：
```
[mem][auth] 非本地监听必须配置鉴权 token（当前 host=0.0.0.0）。
请通过 --auth-token <token> 或环境变量 MEM_MCP_AUTH_TOKEN 设置；
若仅本地访问，请将 --host 设为 127.0.0.1。
```

**解决**：
```bash
# 方式 1：添加 token
mem serve --sse --host 0.0.0.0 --auth-token "your-secret-token"

# 方式 2：通过环境变量
export MEM_MCP_AUTH_TOKEN="your-secret-token"
mem serve --sse --host 0.0.0.0

# 方式 3：仅本地访问（改为绑定 127.0.0.1）
mem serve --sse --host 127.0.0.1
```

### Scope 不匹配

**症状**：
```
Scope mismatch: expected project:myapp, got global
```

**解决**：
```bash
# 检查当前 scope
mem config show

# 使用正确的 scope
mem serve --scope project:myapp
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [配置指南](../config/README.md) - 配置系统
- [多项目隔离](../guides/multi-project.md) - 多项目配置
- [故障排除](../guides/troubleshooting.md) - 常见问题解决
