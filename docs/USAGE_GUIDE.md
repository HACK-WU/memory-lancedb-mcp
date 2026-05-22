# memory-lancedb-mcp 使用手册

> 版本：0.1.0 | 更新日期：2026-05-22

---

## 目录

1. [概述](#1-概述)
2. [CLI 命令参考](#2-cli-命令参考)
3. [MCP 工具参考](#3-mcp-工具参考)
4. [记忆存储最佳实践](#4-记忆存储最佳实践)
5. [记忆召回最佳实践](#5-记忆召回最佳实践)
6. [标签（Tags）系统详解](#6-标签tags系统详解)
7. [Scope 多项目隔离](#7-scope-多项目隔离)
8. [注意事项与常见问题](#8-注意事项与常见问题)
9. [故障排除](#9-故障排除)

---

## 1. 概述

memory-lancedb-mcp 是 [memory-lancedb-pro](https://github.com/HACK-WU/memory-lancedb-pro) 的 MCP 包装器，通过 `mem` CLI 命令和 MCP 协议对外提供长期记忆服务。核心能力：

| 能力 | 说明 |
|---|---|
| **混合检索** | 向量语义搜索 + BM25 全文检索，RRF 结果融合，召回多条记忆 |
| **智能提取** | LLM 驱动的自动记忆提取与去重，写入即分析和归类 |
| **标签系统** | 自定义多标签分类，通过文本前缀 `【标签:x,y】` 嵌入，不修改父项目 schema |
| **生命周期管理** | Weibull 衰减模型、三级晋升系统、自动清理 |
| **Scope 隔离** | 通过 `--scope` 参数实现多项目记忆完全隔离 |

---

## 2. CLI 命令参考

所有命令均以 `mem` 开头。

### 2.1 启动服务

```bash
mem serve                        # stdio 模式（默认）
mem serve --sse                  # SSE HTTP 模式
mem serve --sse -p 3100          # 指定端口
mem serve --scope project:myapp  # 启用 scope 隔离
mem serve --dry-run              # 验证配置并列出工具（不启动服务）
```

参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `-c, --config <path>` | string | 指定配置文件路径 |
| `-s, --scope <scope>` | string | 默认 scope（如 `project:myapp`） |
| `--dry-run` | flag | 验证配置并列出已注册工具 |
| `--sse` | flag | 使用 SSE (HTTP) 传输 |
| `-p, --port <n>` | number | SSE 端口（默认 3100） |
| `--host <host>` | string | SSE 监听地址（默认 127.0.0.1） |
| `-q, --quiet` | flag | 抑制调试日志 |

### 2.2 存储记忆

```bash
mem store "用户王小明是全栈工程师，技术栈 TypeScript、Rust、Go" \
  --tags profile,tech \
  --category fact \
  --importance 0.9 \
  --scope project:myapp
```

参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `<text>` | string | 是 | 记忆内容 |
| `-t, --tags <tags>` | string | 否 | 逗号分隔标签（如 `profile,tech,beijing`） |
| `-c, --category <cat>` | string | 否 | 分类：`preference` / `fact` / `decision` / `entity` / `other` |
| `-i, --importance <n>` | number | 否 | 重要性 0-1（默认 0.7） |
| `-s, --scope <scope>` | string | 否 | 目标 scope |

### 2.3 搜索记忆


```bash
mem search "TypeScript Rust 全栈架构师" --limit 5 --tags tech
```

参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `<query>` | string | 是 | 搜索查询 |
| `-s, --scope <scope>` | string | 否 | 限定 scope |
| `-l, --limit <n>` | number | 否 | 最大结果数（默认 5） |
| `-t, --tags <tags>` | string | 否 | 标签过滤，逗号分隔 |
| `--json` | flag | 否 | JSON 格式输出 |

### 2.4 列表查看

```bash
mem list                              # 最近 10 条
mem list --category decision          # 仅决策类
mem list --tags profile,tech          # 标签过滤
mem list --limit 20 --offset 10       # 分页
```

参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `-s, --scope <scope>` | string | 限定 scope |
| `-c, --category <cat>` | string | 限定分类 |
| `-l, --limit <n>` | number | 最大条数（默认 10，最大 50） |
| `-t, --tags <tags>` | string | 标签过滤，逗号分隔 |
| `--offset <n>` | number | 分页偏移（默认 0） |
| `--json` | flag | JSON 格式输出 |

### 2.5 统计信息

```bash
mem stats                  # 全量统计
mem stats --scope test     # 指定 scope
mem stats --json           # JSON 输出
```

### 2.6 删除记忆

```bash
mem delete <memoryId>      # 按 ID 删除（支持 8 位前缀）
```

### 2.7 配置管理

```bash
mem config init            # 创建默认配置
mem config init --force    # 覆盖已有配置
mem config show            # 查看配置（密钥脱敏）
mem config path            # 查看配置文件路径
mem config validate        # 验证配置文件
```

### 2.8 健康检查

```bash
mem doctor                 # 运行所有检查
mem doctor --mcp           # 含 MCP 协议握手测试
```

### 2.9 Scope 管理

```bash
mem scope list                         # 列出所有 scope 及记忆数
mem scope delete <scope> --yes         # 删除指定 scope（需确认）
mem scope delete <scope> --dry-run     # 预览删除范围
```

---

## 3. MCP 工具参考

### 3.1 memory_store

存储一条新记忆。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `text` | string | 是 | 记忆内容 |
| `category` | string | 否 | `preference` / `fact` / `decision` / `entity` / `other` |
| `importance` | number | 否 | 重要性 0-1（默认 0.7） |
| `scope` | string | 否 | 目标 scope |
| `tags` | string | 否 | 逗号分隔标签 |

标签嵌入机制：传入 `tags: "profile,tech"` 后，记忆实际写入的 text 为：

```
【标签:profile,tech】 原始文本内容...
```

MCP 调用示例：

```json
{
  "text": "用户王小明是全栈架构师，base 杭州余杭",
  "category": "fact",
  "importance": 0.9,
  "tags": "用户画像,技术栈,杭州"
}
```

### 3.2 memory_recall

混合检索召回记忆（向量 + BM25）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | string | 是 | 搜索查询 |
| `limit` | number | 否 | 最大结果数（默认 3，最大 20） |
| `scope` | string | 否 | 限定 scope |
| `category` | string | 否 | 限定分类 |
| `tags` | string | 否 | 标签过滤（逗号分隔） |

MCP 调用示例：

```json
{
  "query": "王小明 蚂蚁 P8 TypeScript Rust Go",
  "limit": 5,
  "tags": "用户画像,技术栈"
}
```

### 3.3 memory_list

列出记忆（支持分页和过滤）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `limit` | number | 否 | 最大条数（默认 10，最大 50） |
| `offset` | number | 否 | 偏移量（默认 0） |
| `scope` | string | 否 | 限定 scope |
| `category` | string | 否 | 限定分类 |
| `tags` | string | 否 | 标签过滤 |

### 3.4 memory_forget

删除记忆，支持两种模式：

- **query 模式**：传入 `query`，返回匹配候选项，确认后删选定的 `memoryId`
- **memoryId 模式**：直接传入 `memoryId` 删除

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `memoryId` | string | 否 | 记忆 ID（完整 UUID 或 8+ 位前缀） |
| `query` | string | 否 | 搜索查询找到候选记忆 |
| `scope` | string | 否 | 限定 scope |

### 3.5 memory_update

更新已有记忆。修改 text 会触发重新嵌入。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `memoryId` | string | 是 | 记忆 ID |
| `text` | string | 否 | 新文本（触发重新嵌入） |
| `category` | string | 否 | 新分类 |
| `importance` | number | 否 | 新重要性 |

### 3.6 memory_stats

获取统计信息。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | string | 否 | 指定 scope |

返回 scope 分布、category 分布、检索模式状态。

---

## 4. 记忆存储最佳实践

### 4.1 内容丰富度

实测表明：内容过短（< 50 字）的记忆在语义检索中信号弱，容易被噪声淹没。建议每条记忆至少包含 100-200 字的上下文。

| 内容长度 | 召回建议 |
|---|---|
| < 50 字 | 仅适合作为精确 BM25 匹配目标，语义召回不稳定 |
| 100-200 字 | 推荐最低长度 |
| 200-400 字 | 最佳范围 — 丰富细节支撑精准语义匹配 |

### 4.2 category 分类建议

| 分类 | 适用场景 | 示例 |
|---|---|---|
| `preference` | 用户偏好、编码风格、工具选择 | "偏好 pnpm 和 Biome 格式化" |
| `fact` | 客观事实、个人信息、技术背景 | "用户 base 杭州，P8 技术专家" |
| `decision` | 架构决策、技术选型记录 | "采用 React 18 + Next.js 14" |
| `entity` | 数据模型、API 定义、表结构 | "users 表含 id, username, email 字段" |
| `other` | 无法归入上述分类的内容 | 团队协作规范、项目流程 |

### 4.3 importance 评分策略

| 分值 | 含义 | 示例 |
|---|---|---|
| 0.9-1.0 | 核心信息，不可遗忘 | 用户身份、关键技术栈 |
| 0.7-0.8 | 重要决策和偏好 | 架构选型、编码规范 |
| 0.5-0.6 | 辅助信息 | 团队流程、工具配置 |
| 0.3-0.4 | 临时或低价值记录 | 偶发性 bug 记录 |

### 4.4 标签命名规范

标签仅允许以下字符：

- 字母（a-z, A-Z）、数字（0-9）
- `_` `-` `:` `/` `.`
- CJK 中文字符（\u4e00-\u9fff）
- `,` 作为分隔符

**明确禁止**：

- `【` 和 `】` — 这是前缀语法的边界标记，使用会破坏标签结构
- 空格、emoji、其他标点符号

传入非法字符时，wrapper 和 CLI 会直接抛出 `Invalid tag value: ...` 错误，不会静默落库。

---

## 5. 记忆召回最佳实践

### 5.1 核心原则：实体名 + 技术术语 >> 纯自然疑问句

这是经过端到端测试验证的核心结论。

**实测对比数据**：

| 查询风格 | 示例 | Top-1 命中率 |
|---|---|---|
| 纯自然疑问句 | "这个项目的负责人是谁？他有什么背景和技术栈？" | **25% (1/4)** |
| 实体名 + 术语 | "王小明 蚂蚁集团 P8 TypeScript Rust Go Python 支付清算" | **100% (5/5)** |

**原因**：当前使用的嵌入模型（Qwen/Qwen3-Embedding-8B）在处理"疑问句→陈述句"的跨句式语义匹配时有显著衰减。例如：

```
❌ "数据库里有哪些表？"     → 无法匹配 "核心数据模型：users 表含 id UUID..."
✅ "users orders payments" → 直接匹配
```

### 5.2 高效 query 构造公式

```
核心实体名 + 技术术语 + 关键细节
```

| 意图 | 好 query | 差 query |
|---|---|---|
| 查用户信息 | `王小明 蚂蚁 P8 TypeScript Rust 杭州` | `这个用户是谁` |
| 查安全策略 | `SOC2 ISO27001 OAuth JWT AES-256-GCM Vault 渗透测试` | `安全方面做了什么` |
| 查数据模型 | `users orders payments 表结构 role ENUM alipay wechat` | `有哪些表` |
| 查团队流程 | `Scrum Sprint Planning Poker Linear Notion Conventional Commits` | `团队怎么工作` |
| 查性能优化 | `P99 N+1 Prisma eager Redis 缓存 复合索引 gzip CDN QPS` | `性能怎么样` |

### 5.3 关键词名单策略

**存储记忆前**：为每条记忆提取 3-5 个唯一标识性关键词，与记忆内容一起存储或在存储后记录。

**关键词提取标准**：
- **实体名**：人名、项目名、公司名（"王小明"、"蚂蚁"、"美团"）
- **技术术语/缩写**：具备唯一性的专业名词（"SOC2"、"AES-256-GCM"、"JWT"、"N+1"、"P99"）
- **英文标识符**：表名、字段名、枚举值（"users"、"orders"、"alipay"、"stripe"、"ENUM"）
- **混合中英词**：常见的跨语言技术词（"复合索引"、"令牌桶"、"负载均衡"）

**召回时**：从关键词名单中选取 3-5 个最相关的词组成 query。

> 示例工作流：
> 1. 存储记忆："王小明在蚂蚁集团 P8，支付清算 TypeScript Rust Go"
> 2. 提取关键词：`王小明` `蚂蚁` `P8` `支付清算` `Rust`
> 3. 召回时 query：`"王小明 蚂蚁 P8 支付清算 Rust"`
> 4. → Top-1 精准命中

### 5.4 query-expander 的作用与局限

项目内置了 `query-expander.ts`，会在 BM25 检索前自动对查询进行同义词扩展：

```
用户输入:  "系统挂了怎么办"
扩展后:    "系统挂了怎么办 崩溃 crash error 报错 宕机 失败"
```

**覆盖范围**：目前仅含 14 组运维/开发类同义词（崩溃、配置、部署、Docker、报错、权限等），不覆盖通用语义（人物、业务、架构决策等）。

**结论**：query-expander 对运维类查询有帮助，但**不能替代**良好的 query 构造。关键词名单策略是最可靠的召回保障。

### 5.5 标签在召回中的行为

标签过滤采用**软过滤**（通过 BM25 加权而非硬排除）。设置 `tags="安全"` 后：

- 含 `【标签:安全,...】` 的记忆会被加权到靠前位置
- 不含该标签的记忆仍可能出现，但排名较低
- 如需硬排除，请配合 `category` 参数使用

---

## 6. 标签（Tags）系统详解

### 6.1 前缀机制

标签不存储在独立的 metadata 字段中，而是通过文本前缀嵌入 `text`：

```
原始 text:    "用户是全栈工程师"
存储后 text:  "【标签:profile,tech】 用户是全栈工程师"
```

### 6.2 BM25 命中原理

召回时，query 中的 `【标签:xxx】` 前缀会通过 BM25 全文检索精确匹配。由于使用了全角中文符号 `【】` 作为边界，误匹配概率极低。

### 6.3 展示时自动剥离

`memory_recall` / `memory_list` 返回的结果中，`【标签:x,y】` 前缀会被 wrapper 自动剥离，用户和 AI 助手看到的是干净的原始文本。

### 6.4 命名约束

| 允许 | 禁止 |
|---|---|
| `profile,tech,beijing` | `test】bad`（含 `】`） |
| `用户画像,技术栈` | `foo,🎉`（含 emoji） |
| `ns:foo,ver/1.0` | `tag with space`（含空格） |

非法标签会被即时拒绝并返回错误信息，不会静默写入。

---

## 7. Scope 多项目隔离

### 7.1 启用方式

```bash
# CLI 方式
mem serve --scope project:myapp
mem store "xxx" --scope project:myapp

# MCP 方式：由 wrapper 启动时配置
```

### 7.2 隔离原理

不同 scope 的记忆存在完全独立的 agent 命名空间下，互不可见。`mem scope list` 可查看所有 scope 及其记忆数。

```
scope=project:A → agent:project:A  → 只能看到 project:A 的记忆
scope=project:B → agent:project:B  → 只能看到 project:B 的记忆
```

### 7.3 与其他过滤的组合

```bash
# 查询某项目下的安全相关记忆
mem search "OAuth JWT" --scope project:myapp --tags 安全

# 列出某项目的所有决策
mem list --scope project:myapp --category decision
```

---

## 8. 注意事项与常见问题

### 8.1 源码修改后必须重新编译 + 重启

这是最容易踩的坑。CLI 工具和 MCP 服务器都从 `dist/` 目录加载**编译后的 JavaScript**，`src/` 下的修改不会自动生效。

```bash
# 1. 编译 TypeScript
node node_modules/typescript/bin/tsc -p tsconfig.json

# 2. 重启 MCP 服务
# 先在 MCP 客户端中停止服务，再重新启动
```

> 判断是否生效：CLI 可直接用 `node bin/mem.mjs` 测试；MCP 需重启后才能验证。

### 8.2 WSL 下 `npm run build` 失败

WSL 环境中 `npm run build`（调用 `tsc`）可能因 UNC 路径问题失败。绕过方法：

```bash
node node_modules/typescript/bin/tsc -p tsconfig.json
```

### 8.3 Git 提交 GPG 签名失败

在无图形界面的终端中，GPG 签名会报 `Inappropriate ioctl for device`：

```bash
git commit --no-gpg-sign -m "your message"
```

### 8.4 memory_recall 默认返回 3 条

如果需要更多结果，显式设置 `limit` 参数（最大值 20）：

```json
{ "query": "...", "limit": 10 }
```

### 8.5 memory_list 的 tags 过滤是软过滤

与 `memory_recall` 一致，`memory_list` 中传入 `tags` 参数时，wrapper 会将请求重写为 `memory_recall` 调用以实现标签过滤。过滤效果是加权而非硬排除。

### 8.6 标签白名单校验需 MCP 重启后生效

`normalizeTags` 白名单校验在 `dist/` 重新编译后，需重启 MCP 服务进程才能生效。CLI 直接调用会即时生效。

---

## 9. 故障排除

### 9.1 服务启动失败

```bash
# 先验证配置
mem config validate

# 检查 API Key
mem config show

# 运行健康检查
mem doctor
```

常见原因：
- 配置文件中 `apiKey` 缺失或环境变量未设置
- 嵌入模型 endpoint 不可达
- LanceDB 数据目录权限不足

### 9.2 嵌入模型错误

- 确认配置中 `embedding.model` 指向有效的模型
- OpenAI 兼容接口需确认 `baseUrl` 正确
- Ollama 本地模型需确认服务已启动

### 9.3 召回结果不准确

按优先级排查：

1. **query 格式**：是否使用了"实体名 + 技术术语"格式？（参见第 5 章）
2. **内容丰富度**：记忆是否足够长（100+ 字）？
3. **关键词是否唯一**：query 中的术语是否在其他记忆中大量出现？
4. **标签辅助**：是否可以用 `tags` 参数缩小检索范围？

### 9.4 Scope 权限拒绝

如果返回 `Access denied to scope: xxx`：
- 确认启动 MCP 服务时使用了 `--scope` 参数
- 确认请求的 scope 在允许访问列表内
- 使用 `mem scope list` 查看可用 scope

---

> 本文档基于 memory-lancedb-mcp v0.1.0 端到端测试结果编写。
> 测试覆盖：18 条大数据量记忆的存储/召回/更新/删除全流程，100% 通过率。
> 所有示例和结论均有实测数据支撑。
