# 09 测试方案

> - 状态：修订版 v2
> - 起草时间：2026-05-25
> - 关联文件：[04-scoring.md](04-scoring.md)、[05-scripts.md](05-scripts.md)、[08-error-handling.md](08-error-handling.md)
> - 测试工具：Node.js test runner

## 1. 测试范围

**在测试范围内**：
- 评分计算（简化公式）
- 冷热分区算法
- 边界衰减（纯函数）
- Group 树操作
- Relations 缓存淘汰逻辑
- 6 个脚本的 CLI 参数解析与行为
- WAL 写入机制
- 数据版本控制
- 外部知识库导入流程
- 预扫描与向量化流程
- 展示格式化
- Scope 隔离

**不在测试范围内**：
- memory-lancedb-pro 内部检索正确性
- MCP 协议传输正确性
- LLM 生成的摘要质量

## 2. 单元测试

### 2.1 评分计算

| 测试点 | 输入 | 预期 |
|--------|------|------|
| 高频使用（刚用过） | useCount=10, hoursSinceLastUse=0.1 | score ≈ 9.6 |
| 高频使用（1小时前） | useCount=10, hoursSinceLastUse=1 | score ≈ 9.6 |
| 中频使用（半衰期点） | useCount=5, hoursSinceLastUse=24 | score = 2.5 |
| 低频使用（刚用过） | useCount=2, hoursSinceLastUse=0.1 | score ≈ 1.9 |
| 首次使用 | useCount=1, hoursSinceLastUse=0 | score = 1.0 |
| 未使用 | useCount=0 | score = 0 |
| 长时间未用 | useCount=3, hoursSinceLastUse=168 | score ≈ 0.2 |
| 自定义半衰期 | useCount=5, halfLifeHours=48, hoursSinceLastUse=48 | score = 2.5 |

### 2.2 防刷分机制

| 测试点 | 输入 | 预期 |
|--------|------|------|
| 5分钟内重复调用 | lastUsedTime = now - 3min | useCount 不变 |
| 5分钟后调用 | lastUsedTime = now - 6min | useCount + 1 |
| 达到最大次数 | useCount = 10 | 不再增加，仍为 10 |

### 2.3 边界衰减（纯函数）

| 测试点 | 输入 | 预期 |
|--------|------|------|
| 不需要触发衰减 | newScore ≤ 热区最低分 | 返回原数组拷贝，triggered=false |
| 触发衰减 | newScore > 热区最低分 | 返回新对象，原数组不变 |
| 常温区为空 | warmItems=[], newScore > 热区最低分 | originMax=0，热区最低分设为0 |
| 验证纯函数 | 调用前后对比原数组 | 原数组未被修改 |
| 自定义 decayStep | decayStep=3 | 各步骤衰减3分 |

### 2.4 冷热分区算法

| 测试点 | 输入 | 预期 |
|--------|------|------|
| 正常分布 | 20 条数据 | 热区6（30%），常温区10（50%），冷区4 |
| 新兴热区保护 | 2条48小时内使用的数据 | 占据新兴热区席位 |
| isImported 过滤 | isImported=true 的数据 | 不参与新兴热区席位分配 |
| 数据量很少 | 3 条数据 | 至少 minHotCount=1 条在热区 |
| 空数据 | [] | 返回空分区 |

### 2.5 Group 树操作

| 测试点 | 输入 | 预期 |
|--------|------|------|
| 创建根节点 | parent=null, name="项目根" | 创建成功 |
| 创建子节点 | parent="项目根", name="部署" | 创建成功 |
| 创建已存在节点 | 重复创建 | 报错 |
| 删除叶子节点 | 删除无子节点的节点 | 成功 |
| 删除含子节点的节点 | 删除有子节点的节点 | 报错 |
| 路径校验 | 非法路径字符 | 报错 |

## 3. 集成测试

### 3.1 快速路径（Relation 命中）

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | query-group --scope test --groups 部署/前端 | 返回 hot_relations 列表 |
| 2 | get-module-info --scope test --relation rel_001 | 返回 Markdown 文本 |
| 3 | 检查 useCount | useCount 增加 1 |

### 3.2 检索路径（Relation 未命中 → 语义检索 → 回写）

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | query-group 获取词云 | 返回 word_cloud_keywords |
| 2 | AI 组装关键词调用 memory_recall | 需要 MCP 服务可用 |
| 3 | sync-relation 回写 | Relation 写入缓存 + 本地 KB |

### 3.3 知识缺失路径

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | 本地 KB + 记忆系统均未命中 | AI 应暂停请求用户 |
| 2 | 用户提供线索后扫描总结 | 新 Relation 创建成功 |
| 3 | 验证双写 | 本地 KB + memory_store 均有写入 |

### 3.4 外部知识库导入（约定模式）

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | 创建临时 docs/ 目录结构 | — |
| 2 | scan-kb scan --scope test --source ./docs --root-name wiki | scan-index.json 生成 |
| 3 | scan-kb vectorize --scope test | 摘要向量化完成 |
| 4 | import-kb --scope test --source ./docs --root-name wiki --scan-index scan-index.json | Group 树 + Relations + KB 内容正确 |
| 5 | 验证 Group 路径 | wiki/部署/前端 等路径存在 |
| 6 | 验证关键词 | 从 scan-index 复用 |
| 7 | 验证 isImported | 所有导入 Relation 的 isImported=true |

### 3.5 外部知识库导入（配置模式）

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | 创建 import-mapping.json | 自定义映射 |
| 2 | 执行导入 | 按映射创建 Group 和 Relation |
| 3 | 验证 | 自定义 Group 路径和 Relation 名称正确 |

### 3.6 预扫描渐进式读取

| 测试点 | 验证 |
|--------|------|
| 文件名信息充足的文件 | enriched=false |
| 文件名信息不足的文件 | enriched=true（读取了内容头部） |
| enriched 标记正确 | scan-index.json 中 enriched 字段与实际一致 |

### 3.7 摘要向量化

| 测试点 | 验证 |
|--------|------|
| 向量化内容格式 | 含 `[摘要]`、`[路径]`、`[关键词]` 标记 |
| 增量向量化 | 仅处理 vectorized=false 的条目 |
| 向量化状态更新 | 成功后 vectorized=true + memoryId 非空 |
| 单条失败 | 记入 errors，其余继续 |
| M 类变更覆盖写入 | 有 memoryId 的条目覆盖写入，vectorized=true，memoryId 不变 |

### 3.8 增量扫描

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | git 仓库内执行 scan（有 lastScannedCommit） | mode=incremental，changes 字段正确 |
| 2 | 新增文件（A 类） | scan-index 新增条目，vectorized=false |
| 3 | 修改文件（M 类） | scan-index 重置 summary，保留 memoryId，vectorized=false |
| 4 | 删除文件（D 类） | scan-index 移除条目，memory_forget 调用成功，本地 KB 清理 |
| 5 | 非 git 仓库执行 scan | mode=full，lastScannedCommit 不更新 |
| 6 | lastScannedCommit 不存在（rebase 后） | 退化为全量扫描，输出 warning |
| 7 | 增量扫描完成后 | lastScannedCommit 更新为当前 HEAD |

## 4. 边界测试

| 测试点 | 方法 | 预期 |
|--------|------|------|
| scope 未指定 | 省略 --scope | 报错退出 |
| scope 含非法字符 | --scope "../hack" | 报错退出 |
| 损坏 JSON 降级 | 手动损坏 relations-cache.json | 自动降级到检索路径 |
| 空 Group 查询 | 查询不存在的 Group | 返回空列表 |
| 重复导入幂等性 | 同一目录导入两次 | Relation 不重复，覆盖更新 |
| 空 .md 文件 | 内容为空的 Markdown | 跳过，记入 errors |
| 映射引用不存在文件 | mapping 中引用不存在的路径 | 跳过，记入 errors |
| 超大文件 | >10MB 的 .md 文件 | 跳过，记录警告 |
| 特殊字符 | 文件含 emoji、中文标点等 | 删除特殊字符后导入 |
| useCount 溢出 | 手动设置 useCount=999 | 限制为 maxUseCount=10 |
| 未来时间戳 | lastUsedTime 设为未来 | 视为当前时间处理 |

## 5. 隔离测试

| 测试点 | 方法 | 预期 |
|--------|------|------|
| scope-a 查询不到 scope-b 的数据 | 两个 scope 各写入数据后交叉查询 | 返回空或仅本 scope 数据 |
| scope-a 的导入不影响 scope-b | scope-a 导入后检查 scope-b | scope-b 无变化 |
| 不同 scope 的文件物理隔离 | 检查 kb/ 目录结构 | kb/scope-a/ 和 kb/scope-b/ 独立 |

## 6. WAL 写入测试

| 测试点 | 方法 | 预期 |
|--------|------|------|
| 正常写入 | 修改数据后读取 | 数据一致 |
| 临时文件残留 | 手动创建 .tmp 文件后启动 | 自动清理 |
| 写入中断模拟 | rename 前终止进程 | 原文件不变，临时文件残留 |
| 并发写入 | 快速连续调用两次写入 | 后写入覆盖前写入，数据完整 |

## 7. 数据版本控制测试

| 测试点 | 方法 | 预期 |
|--------|------|------|
| 新建文件 version 字段 | 创建新 JSON 文件 | version=1 |
| 旧版本读取 | 手动设置 version=0 | 脚本检测到版本不匹配，报错或适配 |
| 新增字段兼容 | 旧版本数据缺少新字段 | 读取时使用默认值，不报错 |

## 8. 展示格式测试

| 测试点 | 验证 |
|--------|------|
| 完整模式 | 含热门索引 + 树结构 + 帮助信息 + 统计 |
| 热门模式 | 仅热门索引 + 简要统计 |
| 精简模式 | 仅树结构，无评分无帮助 |
| 帮助模式 | 仅帮助信息 |
| 分区标识 | 🔥[热]、🌡️[常温]、❄️[冷]、📥[导入] 正确显示 |
| 层级控制 | --depth 限制正确截断 |
| Token 预算 | 各模式 Token 消耗在预期范围内 |

## 9. 性能基准

| 场景 | 数据规模 | 指标 | 预期 |
|------|----------|------|------|
| 评分计算 | 1000 条 | 延迟 | < 10ms |
| 分区重算 | 10000 条 | 延迟 | < 100ms |
| 快速路径端到端 | 100 条 Relation | 延迟 | < 10ms |
| 格式化输出 | 500 条索引 | 延迟 | < 5ms |
| 预扫描 | 100 个 .md 文件 | 耗时 | 约 2~5 分钟（含 AI 摘要） |
| 摘要向量化 | 100 个条目 | 耗时 | 约 1~2 分钟 |

## 10. 测试环境要求

- **无需 MCP 服务**：单元测试、边界测试、隔离测试、WAL 测试、版本控制测试、展示格式测试
- **需 MCP 服务可用**：检索路径集成测试、知识缺失路径集成测试
- **需 mock MCP**：摘要向量化集成测试（mock `memory_store`）
- **临时目录**：所有文件操作测试使用 `os.tmpdir()` + 随机前缀，测试后清理
