# 评分机制设计文档

> - 状态：草案
> - 起草时间：2026-05-23
> - 关联文档：knowledge-index-skill_DESIGN.md
> - 实施范围：索引、Relation、关键词的评分机制与冷热分区

## 1. 需求背景 & 目标

### 1.1 背景

知识索引系统需要判断哪些索引、Relation、关键词是热门的，以便优先返回给 AI Agent。当前设计缺乏系统化的评分机制，无法准确反映使用频率。

### 1.2 目标

- 目标 1：建立基于使用频率的评分机制，准确反映数据的热门程度
- 目标 2：实现冷热分区机制，优化查询效率
- 目标 3：支持索引、Relation、关键词的统一评分管理
- 目标 4：提供热门索引优先返回机制

---

## 2. 名词术语表

| 术语 | 含义 | 易混淆点 |
|------|------|---------|
| **评分** | 数据的使用频率指标，值越大表示越常被命中 | 不是简单的计数，是基于频率的动态评分 |
| **冷热分区** | 根据评分将数据分为热区、常温区、冷区三个等级 | 不是物理分区，是逻辑分区 |
| **热区** | 评分最高的数据，优先返回给 Agent | 不是固定数量，根据评分动态调整 |
| **常温区** | 评分中等的数据，次优先返回 | 不是永久存储，可能被转移到冷区 |
| **冷区** | 评分最低的数据，最后返回或可能被删除 | 不是归档，可能被直接删除 |
| **评分衰减** | 长时间未使用的数据评分下降 | 不是重置，是逐渐衰减 |

---

## 3. 评分机制设计

### 3.1 评分算法

评分基于使用频率，采用时间衰减机制：

```javascript
function calculateScore(currentScore, lastUsedTime, currentTime) {
  const timeDiff = currentTime - lastUsedTime;
  const FIVE_MINUTES = 5 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  // 5分钟内多次调用不上调
  if (timeDiff < FIVE_MINUTES) {
    return currentScore;
  }
  
  // 5分钟外上调
  if (timeDiff < ONE_DAY) {
    return currentScore + 1;
  }
  
  // 1天前下调
  return Math.max(0, currentScore - 1);
}
```

### 3.2 评分规则

| 时间间隔 | 评分变化 | 说明 |
|---------|---------|------|
| < 5分钟 | 不变 | 防止短时间内频繁调用导致评分虚高 |
| 5分钟 ~ 1天 | +1 | 正常使用频率，评分上调 |
| > 1天 | -1 | 长时间未使用，评分下调 |

### 3.3 评分应用范围

- **索引（Group）**：Group 节点评分，反映该知识域的使用频率
- **Relation**：Relation 评分，反映该知识条目的使用频率
- **关键词**：关键词评分，反映该关键词的使用频率

### 3.4 评分初始化

- **新建数据**：评分初始化为 0
- **导入数据**：评分初始化为 0
- **手动设置**：可通过管理脚本手动设置评分

---

## 4. 冷热分区机制

### 4.1 分区定义

| 分区 | 评分范围 | 数量限制 | 处理策略 |
|------|---------|---------|---------|
| 热区 | 高评分 | 可配置（默认 10） | 优先返回给 Agent |
| 常温区 | 中评分 | 可配置（默认 50） | 次优先返回 |
| 冷区 | 低评分 | 可配置（默认 100） | 最后返回，超限删除 |

### 4.2 分区规则

```javascript
function getPartition(score, thresholds) {
  if (score >= thresholds.hot) return 'hot';
  if (score >= thresholds.warm) return 'warm';
  return 'cold';
}

function managePartition(data, maxCounts) {
  // 按评分降序排序
  const sorted = data.sort((a, b) => b.score - a.score);
  
  // 分配到各分区
  const hot = sorted.slice(0, maxCounts.hot);
  const warm = sorted.slice(maxCounts.hot, maxCounts.hot + maxCounts.warm);
  const cold = sorted.slice(maxCounts.hot + maxCounts.warm);
  
  // 冷区超限处理
  if (cold.length > maxCounts.cold) {
    // 删除最低评分的数据
    cold.splice(maxCounts.cold);
  }
  
  return { hot, warm, cold };
}
```

### 4.3 分区转移规则

- **升级**：评分增加后，数据从常温区转移到热区
- **降级**：评分减少后，数据从热区转移到常温区，或从常温区转移到冷区
- **删除**：冷区超限时，删除最低评分的数据

### 4.4 分区配置

```json
{
  "partition_config": {
    "hot_threshold": 50,
    "warm_threshold": 20,
    "max_counts": {
      "hot": 10,
      "warm": 50,
      "cold": 100
    }
  }
}
```

---

## 5. 热门索引机制

### 5.1 热门索引定义

热门索引是评分最高的索引，优先返回给 Agent 查询。

### 5.2 热门索引返回规则

1. Agent 查询索引时，首先返回热区索引
2. 如果热区索引不足，补充常温区索引
3. 如果常温区索引不足，补充冷区索引
4. 返回时按评分降序排列

### 5.3 热门索引更新机制

- **实时更新**：每次使用后更新评分
- **定期重算**：定期重新计算所有索引的分区
- **手动调整**：可通过管理脚本手动调整热门索引

---

## 6. 数据模型

### 6.1 评分数据结构

```json
{
  "id": "rel_001",
  "text": "告警规则CRUD流程",
  "score": 25,
  "lastUsedTime": "2026-05-23T10:30:00Z",
  "partition": "hot",
  "keywords": ["规则", "阈值", "触发条件"],
  "isImported": false
}
```

### 6.2 分区配置数据结构

```json
{
  "scope": "project-a",
  "partition_config": {
    "hot_threshold": 50,
    "warm_threshold": 20,
    "max_counts": {
      "hot": 10,
      "warm": 50,
      "cold": 100
    }
  },
  "updatedAt": "2026-05-23T10:00:00Z"
}
```

### 6.3 评分统计数据结构

```json
{
  "scope": "project-a",
  "stats": {
    "total_items": 150,
    "hot_count": 8,
    "warm_count": 42,
    "cold_count": 100,
    "avg_score": 15.5,
    "max_score": 85,
    "min_score": 0
  },
  "updatedAt": "2026-05-23T10:00:00Z"
}
```

---

## 7. 接口设计

### 7.1 评分更新接口

```
用法: npx jiti scripts/update-score.ts --scope <scope> --type <type>
       --id <id> [--score <score>]

输入:
  --scope   项目隔离标识（必填）
  --type    数据类型：relation | keyword | index（必填）
  --id      数据 ID（必填）
  --score   手动设置评分（可选，不指定则自动计算）

行为:
  1. 读取当前评分和最后使用时间
  2. 根据算法计算新评分
  3. 更新评分和最后使用时间
  4. 重新计算分区

输出 (JSON):
{
  "ok": true,
  "id": "rel_001",
  "old_score": 20,
  "new_score": 21,
  "partition": "hot",
  "lastUsedTime": "2026-05-23T10:30:00Z"
}
```

### 7.2 热门索引查询接口

```
用法: npx jiti scripts/query-hot-indexes.ts --scope <scope>
       [--limit <limit>] [--partition <partition>]

输入:
  --scope      项目隔离标识（必填）
  --limit      返回数量限制（可选，默认 10）
  --partition  分区过滤：hot | warm | cold | all（可选，默认 all）

行为:
  1. 读取所有索引数据
  2. 按分区过滤（如果指定）
  3. 按评分降序排序
  4. 返回指定数量的索引

输出 (JSON):
{
  "ok": true,
  "indexes": [
    {
      "id": "idx_001",
      "path": "监控/告警中心",
      "score": 85,
      "partition": "hot",
      "lastUsedTime": "2026-05-23T10:30:00Z"
    }
  ],
  "total": 10,
  "partition_stats": {
    "hot": 8,
    "warm": 42,
    "cold": 100
  }
}
```

### 7.3 分区管理接口

```
用法: npx jiti scripts/manage-partition.ts --scope <scope>
       [--action rebalance|config|stats]

输入:
  --scope   项目隔离标识（必填）
  --action  操作：rebalance（重新平衡）| config（查看配置）| stats（查看统计）

行为:
  - rebalance: 重新计算所有数据的分区
  - config: 查看当前分区配置
  - stats: 查看分区统计信息

输出 (JSON):
{
  "ok": true,
  "action": "rebalance",
  "result": {
    "total_items": 150,
    "hot_count": 8,
    "warm_count": 42,
    "cold_count": 100,
    "rebalanced": 15
  }
}
```

---

## 8. 异常处理

| 场景 | 行为 | 是否对外暴露 |
|------|------|-------------|
| 评分计算溢出 | 限制最大评分（如 9999），超过则不再增加 | 否 |
| 分区配置错误 | 使用默认配置，记录警告 | 是（警告） |
| 冷区超限 | 删除最低评分数据，记录删除数量 | 否（自动处理） |
| 评分数据损坏 | 重置评分为 0，记录警告 | 是（警告） |
| 并发评分更新 | 使用乐观锁机制，冲突时重试 | 是（错误） |
| 分区转移失败 | 记录错误，不影响正常使用 | 是（错误） |

---

## 9. 性能考虑

- **评分计算延迟**：< 1ms（简单数学计算）
- **分区重算延迟**：取决于数据量，1000 条数据约 10ms
- **热门索引查询延迟**：< 5ms（内存排序）
- **并发性能**：乐观锁机制，冲突时重试，最多重试 3 次

---

## 10. 测试方案

| 类型 | 范围 | 工具 |
|------|------|------|
| 单元测试 | 评分算法、分区规则、边界条件 | Node.js test runner |
| 集成测试 | 完整评分流程：使用 → 更新评分 → 分区转移 → 热门索引查询 | Node.js test runner |
| 边界测试 | 评分溢出、分区超限、并发更新 | Node.js test runner |
| 性能测试 | 大规模数据下的评分计算和分区重算性能 | 基准测试工具 |

---

## 11. 实施计划

| 批次 | 主题 | 主要产出 | 依赖 |
|------|------|---------|------|
| Batch 1 | 评分算法 | 评分计算函数、评分更新接口 | 无 |
| Batch 2 | 冷热分区 | 分区规则、分区管理接口、热门索引查询接口 | Batch 1 |
| Batch 3 | 测试与文档 | 单元测试、集成测试、使用文档 | Batch 1, 2 |