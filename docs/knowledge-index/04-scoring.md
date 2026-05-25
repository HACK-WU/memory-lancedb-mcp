# 04 评分机制

> - 状态：修订版 v2（大幅简化）
> - 起草时间：2026-05-25
> - 关联文件：[03-data-model.md](03-data-model.md)、[06-display.md](06-display.md)
> - 评审改进：P0-统一阈值、P1-边界衰减纯函数、P1-冷启动优化、P1-新兴热区过滤导入、P2-衰减值可配置

## 1. 设计目标

1. **经常用的评分高**：使用次数越多，评分越高
2. **不经常用的评分低**：长时间不用，评分自动衰减
3. **防止刷分**：短时间内频繁调用不重复计分
4. **快速响应新兴热门**：最近频繁使用的内容能快速进入热区
5. **冷启动友好**：新内容首次使用评分不会出现巨大跳跃

## 2. 简化评分公式

### 2.1 核心公式

```
score = useCount / (1 + hoursSinceLastUse / halfLifeHours)
```

**参数说明**：

| 参数 | 含义 | 默认值 | 可配置 |
|------|------|--------|--------|
| `useCount` | 有效使用次数（5分钟防刷间隔，最多记录10次） | — | 否 |
| `hoursSinceLastUse` | 距上次使用的小时数 | — | 否 |
| `halfLifeHours` | 半衰期（小时） | 24（O1 决策） | 是（partition_config.halfLifeHours） |

### 2.2 评分特性

| 使用模式 | useCount | hoursSinceLastUse | score | 说明 |
|---------|----------|-------------------|-------|------|
| 高频使用（刚用过） | 10 | 0.1 | **9.6** | 近乎 useCount，天然高分 |
| 高频使用（1小时前） | 10 | 1 | **9.6** | 半衰期内衰减很小 |
| 中频使用（刚用过） | 5 | 0.1 | **4.8** | |
| 中频使用（1天前） | 5 | 24 | **2.5** | 半衰期点，评分减半 |
| 低频使用（刚用过） | 2 | 0.1 | **1.9** | |
| 低频使用（2天前） | 2 | 48 | **0.7** | |
| 新内容（首次使用） | 1 | 0 | **1.0** | 冷启动友好 |
| 新内容（1天后） | 1 | 24 | **0.5** | |
| 长时间未用 | 3 | 168（7天） | **0.2** | 自然衰减 |

### 2.3 与旧公式对比

| 对比项 | 旧公式 | 新公式 |
|--------|--------|--------|
| 冷启动跳跃 | 1次→score=2，2次→score可能172（86倍） | 1次→1.0，2次→1.9（1.9倍） |
| 衰减方式 | 阶梯函数（1.0/1.2/1.5/1.8/2.0） | 连续衰减（hoursSinceLastUse/halfLife） |
| 额外衰减机制 | 边界衰减固定-10分 | 边界衰减可配置 decayStep |
| 时间戳存储 | 10个时间戳数组 | 仅 useCount + lastUsedTime |
| 计算复杂度 | 加权平均间隔+活跃度加成 | 一次除法 |

### 2.4 防刷分机制

```javascript
const CONFIG = {
  minRecordIntervalMinutes: 5,  // 最小记录间隔（分钟）
  maxUseCount: 10               // 最大使用次数
};

function recordUse(relation, now) {
  // 与上次使用间隔小于5分钟，忽略
  if (relation.lastUsedTime && (now - relation.lastUsedTime) < CONFIG.minRecordIntervalMinutes * 60 * 1000) {
    return relation;
  }
  return {
    ...relation,
    useCount: Math.min(relation.useCount + 1, CONFIG.maxUseCount),
    lastUsedTime: now
  };
}
```

### 2.5 评分计算

```javascript
function calculateScore(useCount, lastUsedTime, now, halfLifeHours = 24) {
  if (useCount === 0) return 0;
  const hoursSinceLastUse = lastUsedTime
    ? (now - lastUsedTime) / (60 * 60 * 1000)
    : 0;
  return useCount / (1 + hoursSinceLastUse / halfLifeHours);
}
```

## 3. 冷热分区机制

### 3.1 三区设计

分区基于 `partition_config` 中的相对排名，**不使用硬编码阈值**（评审 P0 改进）。

| 分区 | 配置 | 说明 |
|------|------|------|
| 热区 | `hotPercent`（默认0.3） | 前 30% 的内容 |
| 常温区 | `warmPercent`（默认0.5） | 中间 50% 的内容 |
| 冷区 | 剩余 | 最后 20% 的内容 |

**热区细分为**：
1. **新兴热区**：最近 `recentHours`（默认48小时）内使用过的内容，有保留席位（默认10个，O2 决策）
2. **历史热区**：评分高的历史内容，按相对排名分配

### 3.2 分区算法

```javascript
function hybridPartition(items, now, config) {
  const {
    hotPercent = 0.3,
    warmPercent = 0.5,
    reservedEmerging = 10,
    recentHours = 48,
    minHotCount = 1,
    decayStep = 5,
    halfLifeHours = 24,
    maxHotCount = 10,
    maxWarmCount = 50,
    maxColdCount = null,
    maxKeywordCount = 50
  } = config;

  // 1. 计算每个内容的评分
  const itemsWithScore = items.map(item => ({
    ...item,
    score: calculateScore(item.useCount, item.lastUsedTime, now, halfLifeHours)
  }));

  // 2. 识别新兴热门（排除 isImported，评审 P1 改进）
  const recentThreshold = recentHours * 60 * 60 * 1000;
  const emergingItems = itemsWithScore.filter(
    item => !item.isImported && item.lastUsedTime && (now - item.lastUsedTime) < recentThreshold
  );

  // 3. 按评分排序
  itemsWithScore.sort((a, b) => b.score - a.score);

  // 4. 分配热区席位
  const hot = [];
  const warm = [];
  const cold = [];

  // 新兴热区（保留席位）
  const emergingHotSeats = Math.min(reservedEmerging, emergingItems.length);
  for (let i = 0; i < emergingHotSeats; i++) {
    if (!hot.includes(emergingItems[i])) {
      hot.push(emergingItems[i]);
    }
  }

  // 历史热区（填充剩余席位）
  const totalHotSeats = Math.max(minHotCount, Math.ceil(itemsWithScore.length * hotPercent));
  for (const item of itemsWithScore) {
    if (hot.length >= totalHotSeats) break;
    if (!hot.includes(item)) {
      hot.push(item);
    }
  }

  // 常温区 + 冷区
  const remaining = itemsWithScore.filter(item => !hot.includes(item));
  const warmCount = Math.ceil(itemsWithScore.length * warmPercent);
  warm.push(...remaining.slice(0, warmCount));
  cold.push(...remaining.slice(warmCount));

  // 上限截断（O4 决策）
  if (maxHotCount && hot.length > maxHotCount) hot.length = maxHotCount;
  if (maxWarmCount && warm.length > maxWarmCount) warm.length = maxWarmCount;
  if (maxColdCount && cold.length > maxColdCount) cold.length = maxColdCount;

  return { hot, warm, cold };
}
```

### 3.3 分区配置

分区配置统一存储在 `relations-cache.json` 的 `partition_config` 中（详见 [03-data-model.md](03-data-model.md)）。

### 3.4 分区标识

| 分区 | Emoji | 文字 | 说明 |
|------|-------|------|------|
| 历史热区 | 🔥 | [热] | 评分排名前 hotPercent |
| 新兴热区 | 🔥 | [新兴热] | 48小时内使用过，有保留席位 |
| 常温区 | 🌡️ | [常温] | 中间 warmPercent |
| 冷区 | ❄️ | [冷] | 剩余内容 |
| 导入 | 📥 | [导入] | isImported=true，score=0 |

## 4. 边界衰减机制

### 4.1 纯函数设计（评审 P1 改进）

边界衰减改为纯函数，返回新对象，不修改输入数组。

```javascript
/**
 * 边界衰减：当新内容要进入热区时触发
 * 纯函数：返回新对象，不修改输入
 *
 * @param {Array} hotItems - 热区内容列表（按评分降序）
 * @param {Array} warmItems - 常温区内容列表（按评分降序）
 * @param {number} newScore - 新内容评分
 * @param {number} decayStep - 衰减步长（默认5，可配置）
 * @returns {Object} 衰减后的分区状态（新对象）
 */
function boundaryDecay(hotItems, warmItems, newScore, decayStep = 5) {
  // 不需要触发衰减
  if (hotItems.length === 0 || newScore <= hotItems[hotItems.length - 1].score) {
    return {
      hotItems: [...hotItems],
      warmItems: [...warmItems],
      triggered: false
    };
  }

  // 深拷贝，不修改原始数据
  const newHot = hotItems.map(item => ({ ...item }));
  const newWarm = warmItems.map(item => ({ ...item }));

  // 步骤1：保存常温区最高分
  const originMax = newWarm.length > 0 ? newWarm[0].score : 0;

  // 步骤2：常温区最高分 - decayStep
  if (newWarm.length > 0) {
    newWarm[0].score = Math.max(0, newWarm[0].score - decayStep);
  }

  // 步骤3：热区最低分衰减到原常温区最高分
  newHot[newHot.length - 1].score = originMax;

  // 步骤4：热区最高分 - decayStep
  if (newHot.length > 0) {
    newHot[0].score = Math.max(0, newHot[0].score - decayStep);
  }

  return {
    hotItems: newHot,
    warmItems: newWarm,
    triggered: true,
    originMax
  };
}
```

### 4.2 衰减步长可配置（评审 P2 改进）

`decayStep` 存储在 `partition_config.decayStep` 中，默认 5 分（O3 决策）。可根据项目规模调整：
- 小项目（<50 Relation）：decayStep=3
- 中项目（50-200 Relation）：decayStep=5
- 大项目（>200 Relation）：decayStep=8

> **O4 决策**：热区/常温区/冷区最大数量限制通过 `partition_config.maxHotCount` / `maxWarmCount` / `maxColdCount` 配置，不硬编码。

## 5. 评分初始化

| 场景 | useCount | lastUsedTime | score |
|------|----------|-------------|-------|
| 新建 Relation | 0 | null | 0 |
| 首次使用 | 1 | now | 1.0 |
| 导入 Relation | 0 | null | 0（isImported=true，不参与评分） |

## 6. 评分更新流程

1. AI 查询 Relation 命中 → `recordUse(relation, now)` 更新 useCount 和 lastUsedTime
2. 重新计算 score：`calculateScore(useCount, lastUsedTime, now)`
3. 检查是否需要触发边界衰减（新 score > 热区最低分）
4. 如需衰减：`boundaryDecay(hotItems, warmItems, newScore, decayStep)` → 获取新分区状态
5. WAL 写入更新后的 relations-cache.json
