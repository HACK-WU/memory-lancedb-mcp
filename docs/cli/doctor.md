# mem doctor 命令

`mem doctor` 命令运行全面的连通性健康检查，验证配置、API 可达性、数据库读写和检索管线是否正常工作。

## 语法

```bash
mem doctor [options]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--config <path>` | 配置文件路径 | 自动查找 |

## 使用示例

```bash
# 运行健康检查
mem doctor

# 指定配置文件
mem doctor --config /path/to/config.yaml
```

## 输出示例

### 全部通过

```
🔍 Running health checks...

✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
✅ Embedding API key present
✅ Rerank: cross-encoder (provider=jina, apiKey=present)
✅ Plugin loaded (12 tools registered)
✅ Tools: memory_store, memory_recall, memory_forget, memory_update, ...
✅ Embedding API: OK (342ms, dim=1536)
✅ LanceDB read/write: OK (15ms) [test data cleaned up]

────────────────────────────────────────
Results: 8 passed, 0 failed
```

### 有警告

```
🔍 Running health checks...

✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
✅ Embedding API key present
⚠️  Rerank: cross-encoder (provider=jina, apiKey=not set — lightweight fallback)
✅ Plugin loaded (12 tools registered)
✅ Tools: memory_store, memory_recall, memory_forget, memory_update, ...
✅ Embedding API: OK (342ms, dim=1536)
✅ LanceDB read/write: OK (15ms) [test data cleaned up]
⚠️  LLM: timed out (>15s), service may be slow but config is likely correct

────────────────────────────────────────
Results: 6 passed, 0 failed, 2 warning(s)
```

### 检查失败

```
🔍 Running health checks...

✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
❌ Embedding API key missing
⚠️  Rerank: cross-encoder (provider=jina, apiKey=not set — lightweight fallback)

────────────────────────────────────────
Results: 2 passed, 1 failed, 1 warning(s)
```

## 检查项目

### Check 1：配置文件

**检查内容**：配置文件是否存在且可读。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `Config file: ~/.config/memory-mcp/config.yaml` |
| ❌ 失败 | `Config file not found: ...` — 运行 `mem config init` 创建 |

### Check 2：配置解析

**检查内容**：YAML 语法是否正确，必需字段是否存在。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `Config parses OK` |
| ❌ 失败 | `Config parses failed: ...` — 检查 YAML 缩进和字段名 |

### Check 3：Embedding API Key

**检查内容**：嵌入 API 密钥是否已配置，环境变量是否已设置。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `Embedding API key present` |
| ❌ 失败 | `Embedding API key missing` — 设置 `apiKey` 或对应环境变量 |

如果 `apiKey` 引用了环境变量（如 `${OPENAI_API_KEY}`），还会额外检查该环境变量是否已设置：
- ✅ `Embedding API key via env: OPENAI_API_KEY`
- ❌ `Env var OPENAI_API_KEY not set`

### Check 4：Rerank 配置

**检查内容**：重排模式是否有效，API 密钥是否已设置。

| 状态 | 输出 | 说明 |
|------|------|------|
| ✅ 通过 | `Rerank: cross-encoder (provider=jina, apiKey=present)` | API 密钥已配置 |
| ⚠️ 警告 | `Rerank: cross-encoder (provider=jina, apiKey=not set — lightweight fallback)` | 无密钥，自动降级为本地余弦相似度重排 |
| ✅ 通过 | `Rerank: disabled (none)` | 已显式关闭重排 |

> **注意**：如果 `rerankApiKey` 在 YAML 中引用了环境变量，doctor 会检查原始 YAML 文件中该变量是否已设置（而非已展开的值），以避免误报。

### Check 5：插件加载

**检查内容**：MemoryRuntime 插件是否能正常加载。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `Plugin loaded (12 tools registered)` |
| ❌ 失败 | `Plugin load failed: ...` — 检查依赖是否完整 |

### Check 6：工具注册

**检查内容**：MCP 工具是否全部注册成功。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `Tools: memory_store, memory_recall, memory_forget, ...` |
| ❌ 失败 | `No tools registered` — 插件初始化异常 |

### Check 7：Embedding API 连通性

**检查内容**：调用 Embedding API 发送一段测试文本，验证网络连通和 API Key 有效性。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `Embedding API: OK (342ms, dim=1536)` — 返回耗时和向量维度 |
| ❌ 失败 | `Embedding API: <error message>` — API Key 错误或网络不可达 |

> 此检查仅在插件加载成功（Check 5 通过）后执行。

### Check 8：LanceDB 读写

**检查内容**：向 LanceDB 写入一条测试记忆、读回验证、然后删除，验证数据库读写正常。

| 状态 | 输出 |
|------|------|
| ✅ 通过 | `LanceDB read/write: OK (15ms) [test data cleaned up]` |
| ❌ 失败 | `LanceDB: write succeeded but read-back verification failed` — 数据库异常 |
| ❌ 失败 | `LanceDB: <error message>` — 数据库不可访问 |

> **安全保证**：测试数据写入 `_doctor_test_` scope，使用 `try/finally` 确保即使读回验证抛异常，测试数据也会被清理，不会残留。

### Check 9：LLM 连通性（条件执行）

**检查内容**：当 `smartExtraction` 启用且配置了 LLM 模型时，调用 LLM API 验证连通性。

| 状态 | 输出 |
|------|------|
| ⏭️ 跳过 | `LLM: skipped (smartExtraction disabled or no llm model)` |
| ✅ 通过 | `LLM: OK (1.2s)` |
| ⚠️ 超时 | `LLM: timed out (>15s), service may be slow but config is likely correct` |
| ❌ 失败 | `LLM: <error message>` |

> 超时不会计入 `failed`，而是计入 `warning`，因为 LLM 仅用于智能提取，服务慢不等于配置错误。

### Check 10：Rerank API（条件执行）

**检查内容**：当配置了 cross-encoder 重排时，通过 `memory_recall` 端到端验证检索管线（embedding → 向量搜索 → 可选 rerank）。

| 状态 | 输出 |
|------|------|
| ⏭️ 跳过 | `Rerank: skipped (rerank not configured or lightweight mode)` |
| ✅ 通过 | `Rerank: recall with rerank OK (245ms)` |
| ⚠️ 降级 | `Rerank: recall OK but rerank was disabled/fallback (lightweight)` — 检查 rerankApiKey |
| ❌ 失败 | `Rerank recall: <error message>` |

> **限制**：此检查通过 `memory_recall` 间接验证 rerank，如果 rerank 静默降级到 lightweight 模式但向量搜索仍返回结果，测试仍会通过。如需验证 rerank 是否真正生效，请检查运行日志。

## 结果计数

| 计数器 | 含义 |
|--------|------|
| `passed` | 检查通过 |
| `failed` | 检查失败（需要修复） |
| `warned` | 检查有警告（配置可能正确，但需要关注） |

退出码：有 `failed` 时返回 `1`，否则返回 `0`。

## 使用场景

### 安装后验证

```bash
mem init && mem doctor
```

### 修改配置后验证

```bash
mem config validate && mem doctor
```

### CI/CD 集成

```bash
mem doctor || exit 1
```

### 问题诊断

```bash
# 遇到检索问题时，先跑 doctor 确认基础服务可用
mem doctor

# 查看详细服务日志
mem serve --verbose
```

## 故障排除

### 配置文件不存在

```
❌ Config file not found: ~/.config/memory-mcp/config.yaml
```

**解决**：
```bash
mem config init
```

### Embedding API Key 缺失

```
❌ Embedding API key missing
```

**解决**：
```bash
export OPENAI_API_KEY="sk-..."
# 或编辑配置文件
vim ~/.config/memory-mcp/config.yaml
```

### Embedding API 连通失败

```
❌ Embedding API: Connection refused
```

**可能原因**：
1. API 地址（`baseURL`）配置错误
2. API Key 无效
3. 网络不通

**解决**：
```bash
# 验证配置
mem config validate

# 测试 API 连通性
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

### LanceDB 读写失败

```
❌ LanceDB: Cannot access database path
```

**解决**：
```bash
# 检查目录权限
ls -la ~/.local/share/memory-mcp/

# 创建目录
mkdir -p ~/.local/share/memory-mcp/lancedb
```

### LLM 超时

```
⚠️  LLM: timed out (>15s), service may be slow but config is likely correct
```

**说明**：这不一定是错误，可能只是 LLM 服务响应慢。如果持续出现：
1. 检查 `llm.baseURL` 是否正确
2. 检查网络连通性
3. 考虑禁用 `smartExtraction` 以减少对 LLM 的依赖

### Rerank 降级到 lightweight

```
⚠️  Rerank: cross-encoder (provider=jina, apiKey=not set — lightweight fallback)
```

**说明**：未配置 rerank API 密钥，系统自动使用本地余弦相似度重排。精度略低但功能正常。

**如需启用 cross-encoder 重排**：
```bash
# 设置 rerank API 密钥
export JINA_API_KEY="jina_..."

# 或编辑配置文件
vim ~/.config/memory-mcp/config.yaml
```

## 相关文档

- [CLI 参考](README.md) - 命令行工具概览
- [config 命令](config.md) - 配置管理
- [配置总览](../config/README.md) - 配置文件详解
- [故障排除](../guides/troubleshooting.md) - 常见问题解决
