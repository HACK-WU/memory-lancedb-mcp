# mem doctor 命令

`mem doctor` 命令用于运行健康检查。

## 语法

```bash
mem doctor [options]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--config <path>` | 配置文件路径 | 自动查找 |
| `--mcp` | 测试 MCP 协议握手 | 无 |

## 使用示例

### 基本用法

```bash
# 运行健康检查
mem doctor

# 指定配置文件
mem doctor --config /path/to/config.yaml

# 测试 MCP 协议握手
mem doctor --mcp
```

## 输出示例

### 健康检查通过

```
🔍 Running health checks...

✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
✅ Embedding API key present
✅ Rerank: cross-encoder (provider=jina, apiKey=present)

Health checks passed: 4/4
```

### 健康检查失败

```
🔍 Running health checks...

✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
❌ Embedding API key missing
⚠️  Rerank: cross-encoder (provider=jina, apiKey=not set (lightweight fallback))

Health checks passed: 2/4
```

### MCP 协议测试

```
🔍 Running health checks...

✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
✅ Embedding API key present
✅ Rerank: cross-encoder (provider=jina, apiKey=present)
✅ MCP protocol handshake successful

Health checks passed: 5/5
```

## 检查项目

### 1. 配置文件检查

**检查内容**：
- 配置文件是否存在
- 配置文件是否可读

**成功**：
```
✅ Config file: ~/.config/memory-mcp/config.yaml
```

**失败**：
```
❌ Config file not found: ~/.config/memory-mcp/config.yaml
   Run 'mem config init' to create one.
```

### 2. 配置解析检查

**检查内容**：
- YAML 语法是否正确
- 必需字段是否存在

**成功**：
```
✅ Config parses OK
```

**失败**：
```
❌ Config parses failed: ...
```

### 3. API 密钥检查

**检查内容**：
- 嵌入 API 密钥是否存在
- 环境变量是否已设置

**成功**：
```
✅ Embedding API key present
✅ Embedding API key via env: OPENAI_API_KEY
```

**失败**：
```
❌ Embedding API key missing
❌ Env var OPENAI_API_KEY not set
```

### 4. 重排配置检查

**检查内容**：
- 重排模式是否有效
- 重排 API 密钥是否已设置

**成功**：
```
✅ Rerank: cross-encoder (provider=jina, apiKey=present)
```

**警告**：
```
⚠️  Rerank: cross-encoder (provider=jina, apiKey=not set (lightweight fallback))
```

**禁用**：
```
✅ Rerank: disabled (none)
```

### 5. MCP 协议握手测试

**检查内容**：
- MCP 服务器是否可启动
- 工具注册是否成功

**成功**：
```
✅ MCP protocol handshake successful
```

**失败**：
```
❌ MCP protocol handshake failed: ...
```

## 使用场景

### 1. 安装后验证

```bash
# 安装后运行健康检查
mem doctor

# 测试 MCP 协议
mem doctor --mcp
```

### 2. 配置验证

```bash
# 修改配置后验证
mem config validate
mem doctor
```

### 3. 问题诊断

```bash
# 遇到问题时运行健康检查
mem doctor

# 检查 MCP 协议
mem doctor --mcp
```

### 4. CI/CD 集成

```bash
# 在 CI/CD 中运行健康检查
mem doctor || exit 1

# 测试 MCP 协议
mem doctor --mcp || exit 1
```

## 最佳实践

### 1. 定期检查

**推荐**：
```bash
# 每周运行健康检查
mem doctor

# 部署前运行健康检查
mem doctor --mcp
```

### 2. 配置验证

**推荐**：
```bash
# 修改配置后验证
mem config validate
mem doctor
```

### 3. 问题诊断

**推荐**：
```bash
# 遇到问题时运行健康检查
mem doctor

# 检查详细日志
mem serve --verbose
```

## 故障排除

### 配置文件不存在

**症状**：
```
❌ Config file not found: ~/.config/memory-mcp/config.yaml
```

**解决**：
```bash
# 初始化配置
mem config init

# 验证配置
mem config validate
```

### API 密钥缺失

**症状**：
```
❌ Embedding API key missing
```

**解决**：
```bash
# 设置环境变量
export OPENAI_API_KEY="sk-..."

# 或编辑配置文件
vim ~/.config/memory-mcp/config.yaml
```

### MCP 协议握手失败

**症状**：
```
❌ MCP protocol handshake failed: ...
```

**可能原因**：
1. 配置错误
2. 依赖缺失
3. 端口占用

**解决**：
```bash
# 检查配置
mem config validate

# 检查依赖
npm doctor

# 检查端口
lsof -i :3100
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [config 命令](config.md) - 配置管理
- [故障排除](../guides/troubleshooting.md) - 常见问题解决
