# 故障排除

本指南帮助您解决 memory-lancedb-mcp 使用过程中的常见问题。

## 安装问题

### Q1: `mem` 命令找不到

**症状**：
```bash
$ mem --help
bash: mem: command not found
```

**可能原因**：
1. 未全局安装
2. npm 全局安装路径不在 PATH 中
3. 安装失败

**解决方案**：

**1. 检查安装状态**：
```bash
npm list -g memory-lancedb-mcp
```

**2. 重新安装**：
```bash
# 使用安装脚本
curl -fsSL https://raw.githubusercontent.com/HACK-WU/memory-lancedb-mcp/master/scripts/install-latest.sh -o install-latest.sh
bash install-latest.sh

# 或手动安装
npm install -g memory-lancedb-mcp
```

**3. 使用完整路径**：
```bash
# 查找安装路径
npm root -g

# 使用完整路径
node /usr/local/lib/node_modules/memory-lancedb-mcp/bin/mem.mjs serve
```

**4. 检查 PATH**：
```bash
echo $PATH
# 确保包含 npm 全局安装路径
```

### Q2: LanceDB 模块缺失

**症状**：
```
Error: Cannot find module '@lancedb/lancedb-linux-x64-gnu'
```

**解决方案**：

**Linux**：
```bash
npm install -g @lancedb/lancedb-linux-x64-gnu
```

**WSL**：
```bash
# 手动安装 Linux 原生模块
npm pack @lancedb/lancedb-linux-x64-gnu --pack-destination /tmp
cd $(npm root -g)/@lancedb/
mkdir -p lancedb-linux-x64-gnu
tar -xzf /tmp/lancedb-lancedb-linux-x64-gnu-*.tgz -C lancedb-linux-x64-gnu/ --strip-components=1
```

**macOS**：
```bash
npm rebuild -g @lancedb/lancedb
```

### Q3: Node.js 版本过低

**症状**：
```
Error: memory-lancedb-mcp requires Node.js >= 18
```

**解决方案**：
```bash
# 检查 Node.js 版本
node --version

# 升级 Node.js
# 使用 nvm
nvm install 18
nvm use 18

# 或使用 n
n 18
```

## 配置问题

### Q4: 配置文件不存在

**症状**：
```
No config found. Run 'mem config init' first.
```

**解决方案**：
```bash
# 初始化配置
mem config init

# 验证配置
mem config validate
```

### Q5: API 密钥未设置

**症状**：
```
Config missing required 'embedding.apiKey'
```

**解决方案**：

**1. 设置环境变量**：
```bash
export OPENAI_API_KEY="sk-..."
```

**2. 编辑配置文件**：
```yaml
embedding:
  apiKey: "${OPENAI_API_KEY}"
  # 或直接写入
  # apiKey: "sk-..."
```

**3. 验证配置**：
```bash
mem config validate
```

### Q6: 环境变量未设置

**症状**：
```
[mem:config] Warning: env var OPENAI_API_KEY is not set
```

**解决方案**：
```bash
# 设置环境变量
export OPENAI_API_KEY="sk-..."

# 验证
echo $OPENAI_API_KEY
```

### Q7: 配置文件语法错误

**症状**：
```
Failed to parse config YAML at ~/.config/memory-mcp/config.yaml: ...
```

**解决方案**：

**1. 检查 YAML 语法**：
```bash
# 安装 yamllint
pip install yamllint

# 检查语法
yamllint ~/.config/memory-mcp/config.yaml
```

**2. 重新初始化配置**：
```bash
mem config init --force
```

**3. 使用在线 YAML 验证器**：
- [YAML Lint](http://www.yamllint.com/)
- [YAML Validator](https://codebeautify.org/yaml-validator)

## 服务问题

### Q8: 服务启动失败

**症状**：
```
Failed to start MCP server
```

**解决方案**：

**1. 健康检查**：
```bash
mem doctor
```

**2. 验证配置**：
```bash
mem config validate
```

**3. 查看详细日志**：
```bash
mem serve --verbose
```

**4. 检查端口占用**（SSE 模式）：
```bash
# 检查端口占用
lsof -i :3100

# 杀死占用进程
kill -9 <PID>
```

### Q9: SSE 模式连接失败

**症状**：
```
Connection refused
```

**解决方案**：

**1. 检查服务状态**：
```bash
# 检查服务是否运行
ps aux | grep mem

# 检查端口监听
netstat -tlnp | grep 3100
```

**2. 检查防火墙**：
```bash
# 允许端口
sudo ufw allow 3100
```

**3. 检查鉴权配置**：
```bash
# 启动服务时指定 token
MEM_MCP_AUTH_TOKEN=$(openssl rand -hex 24) \
  mem serve --sse --port 3100 --host 0.0.0.0
```

### Q10: 鉴权失败

**症状**：
```
401 Unauthorized
```

**解决方案**：

**1. 检查 token**：
```bash
# 确认 token 设置
echo $MEM_MCP_AUTH_TOKEN
```

**2. 使用正确的鉴权方式**：
```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3100/sse",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

**3. 本地开发免鉴权**：
```bash
# 本地访问免 token
mem serve --sse --port 3100
```

## 记忆问题

### Q11: 记忆存储失败

**症状**：
```
Failed to store memory
```

**解决方案**：

**1. 检查数据库路径**：
```bash
# 查看数据库路径
mem config show

# 检查路径权限
ls -la ~/.local/share/memory-mcp/
```

**2. 检查磁盘空间**：
```bash
df -h
```

**3. 检查数据库完整性**：
```bash
# 健康检查
mem doctor
```

### Q12: 记忆搜索无结果

**症状**：
搜索返回空结果

**解决方案**：

**1. 检查记忆是否存在**：
```bash
mem list -l 10
```

**2. 检查 scope**：
```bash
# 列出所有 scope
mem scope list

# 搜索指定 scope
mem search "查询" --scope project:myapp
```

**3. 检查标签**：
```bash
# 按标签搜索
mem search "查询" -t profile
```

**4. 调整搜索参数**：
```bash
# 增加结果数量
mem search "查询" -l 20

# 降低相似度阈值（需要修改配置）
```

### Q13: 记忆重复

**症状**：
存储了重复的记忆

**解决方案**：

**1. 使用去重功能**：
```bash
# 压缩记忆
mem compact
```

**2. 检查自动捕获设置**：
```yaml
# 配置文件
autoCapture: true  # 可能导致重复
```

**3. 手动删除重复**：
```bash
# 列出记忆
mem list -l 50

# 删除重复记忆
mem delete <uuid>
```

## 性能问题

### Q14: 搜索速度慢

**症状**：
搜索响应时间过长

**解决方案**：

**1. 检查数据库大小**：
```bash
# 查看统计信息
mem stats

# 检查数据库大小
du -sh ~/.local/share/memory-mcp/lancedb/
```

**2. 优化检索配置**：
```yaml
retrieval:
  mode: "hybrid"
  vectorWeight: 0.7
  bm25Weight: 0.3
  candidatePoolSize: 10  # 减少候选池
```

**3. 启用重排**：
```yaml
retrieval:
  rerank: "cross-encoder"
  rerankProvider: "jina"
  rerankApiKey: "${JINA_API_KEY}"
```

### Q15: 内存占用高

**症状**：
服务占用大量内存

**解决方案**：

**1. 检查记忆数量**：
```bash
mem stats
```

**2. 压缩记忆**：
```bash
mem compact
```

**3. 调整配置**：
```yaml
# 减少候选池
retrieval:
  candidatePoolSize: 10

# 禁用智能提取
smartExtraction: false
```

## 诊断工具

### 健康检查

```bash
mem doctor
```

**输出示例**：
```
✅ Config file: ~/.config/memory-mcp/config.yaml
✅ Config parses OK
✅ Embedding API key present
✅ Rerank: cross-encoder (provider=jina, apiKey=present)
```

### 配置验证

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

### 预览工具

```bash
mem serve --dry-run
```

**输出示例**：
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

## 获取帮助

### 日志收集

```bash
# 启用详细日志
mem serve --verbose 2>&1 | tee mem.log

# 收集系统信息
mem doctor > doctor.log
mem config show > config.log
```

### 报告问题

**包含信息**：
1. 操作系统和版本
2. Node.js 版本
3. memory-lancedb-mcp 版本
4. 错误信息
5. 配置文件（敏感信息已掩码）
6. 日志文件

**GitHub Issues**：
- [创建 Issue](https://github.com/HACK-WU/memory-lancedb-mcp/issues/new)

### 社区支持

- [GitHub Discussions](https://github.com/HACK-WU/memory-lancedb-mcp/discussions)
- [文档](../README.md)

## 相关文档

- [快速开始](quick-start.md) - 快速上手指南
- [CLI 参考](../cli/README.md) - 命令行工具
- [配置指南](../config/README.md) - 配置系统
- [MCP 工具](../mcp/README.md) - MCP 工具参考
