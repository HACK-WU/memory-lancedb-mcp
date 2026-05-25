/**
 * 评分引擎
 * 
 * - calculateScore: 简化使用密度评分
 * - recordUse: 防刷分使用记录
 * - hybridPartition: 相对排名冷热分区 + 上限截断
 * - boundaryDecay: 边界衰减（纯函数）
 */

import {
  MIN_RECORD_INTERVAL_MINUTES,
  MAX_USE_COUNT,
  type PartitionConfig,
} from './constants.js';

// ─── 类型定义 ───

export interface Relation {
  id: string;
  text: string;
  score: number;
  useCount: number;
  lastUsedTime: number | null;
  keywords: string[];
  isImported: boolean;
}

// ─── 评分计算 ───

/**
 * 计算评分
 * score = useCount / (1 + hoursSinceLastUse / halfLifeHours)
 */
export function calculateScore(
  useCount: number,
  lastUsedTime: number | null,
  now: number,
  halfLifeHours: number = 24
): number {
  if (useCount === 0) return 0;

  const hoursSinceLastUse = lastUsedTime
    ? (now - lastUsedTime) / (60 * 60 * 1000)
    : 0;

  return useCount / (1 + hoursSinceLastUse / halfLifeHours);
}

// ─── 使用记录 ───

/**
 * 记录一次使用（5分钟防刷 + maxUseCount 上限）
 * 返回新对象，不修改输入
 */
export function recordUse(relation: Relation, now: number): Relation {
  // 防刷：与上次使用间隔小于 5 分钟，忽略
  if (
    relation.lastUsedTime &&
    now - relation.lastUsedTime < MIN_RECORD_INTERVAL_MINUTES * 60 * 1000
  ) {
    return relation;
  }

  return {
    ...relation,
    useCount: Math.min(relation.useCount + 1, MAX_USE_COUNT),
    lastUsedTime: now,
  };
}

// ─── 冷热分区 ───

/**
 * 相对排名冷热分区
 * - 新兴热区：最近 recentHours 内使用过，有保留席位（排除 isImported）
 * - 历史热区：按评分排序填充
 * - 常温区 + 冷区：剩余内容按比例分配
 * - 上限截断（O4 决策）
 */
export function hybridPartition(
  items: Relation[],
  now: number,
  config: PartitionConfig
): { hot: Relation[]; warm: Relation[]; cold: Relation[] } {
  const {
    hotPercent = 0.3,
    warmPercent = 0.5,
    reservedEmerging = 10,
    recentHours = 48,
    minHotCount = 1,
    halfLifeHours = 24,
    maxHotCount = 10,
    maxWarmCount = 50,
    maxColdCount = null,
  } = config;

  // 1. 计算每个内容的评分
  const itemsWithScore = items.map((item) => ({
    ...item,
    score: calculateScore(item.useCount, item.lastUsedTime, now, halfLifeHours),
  }));

  // 2. 识别新兴热门（排除 isImported）
  const recentThreshold = recentHours * 60 * 60 * 1000;
  const emergingItems = itemsWithScore.filter(
    (item) =>
      !item.isImported &&
      item.lastUsedTime &&
      now - item.lastUsedTime < recentThreshold
  );

  // 3. 按评分排序
  itemsWithScore.sort((a, b) => b.score - a.score);

  // 4. 分配热区席位
  const hot: Relation[] = [];
  const warm: Relation[] = [];
  const cold: Relation[] = [];

  // 新兴热区（保留席位）
  const emergingHotSeats = Math.min(reservedEmerging, emergingItems.length);
  for (let i = 0; i < emergingHotSeats; i++) {
    if (!hot.includes(emergingItems[i])) {
      hot.push(emergingItems[i]);
    }
  }

  // 历史热区（填充剩余席位）
  const totalHotSeats = Math.max(
    minHotCount,
    Math.ceil(itemsWithScore.length * hotPercent)
  );
  for (const item of itemsWithScore) {
    if (hot.length >= totalHotSeats) break;
    if (!hot.includes(item)) {
      hot.push(item);
    }
  }

  // 常温区 + 冷区
  const remaining = itemsWithScore.filter((item) => !hot.includes(item));
  const warmCount = Math.ceil(itemsWithScore.length * warmPercent);
  warm.push(...remaining.slice(0, warmCount));
  cold.push(...remaining.slice(warmCount));

  // 上限截断（O4 决策）
  if (maxHotCount && hot.length > maxHotCount) hot.length = maxHotCount;
  if (maxWarmCount && warm.length > maxWarmCount) warm.length = maxWarmCount;
  if (maxColdCount && cold.length > maxColdCount) cold.length = maxColdCount;

  return { hot, warm, cold };
}

// ─── 边界衰减 ───

/**
 * 边界衰减（纯函数，返回新对象，不修改输入）
 * 
 * 当新内容要进入热区时触发：
 * 1. 保存常温区最高分
 * 2. 常温区最高分 - decayStep
 * 3. 热区最低分衰减到原常温区最高分
 * 4. 热区最高分 - decayStep
 */
export function boundaryDecay(
  hotItems: Relation[],
  warmItems: Relation[],
  newScore: number,
  decayStep: number = 5
): {
  hotItems: Relation[];
  warmItems: Relation[];
  triggered: boolean;
  originMax?: number;
} {
  // 不需要触发衰减
  if (
    hotItems.length === 0 ||
    newScore <= hotItems[hotItems.length - 1].score
  ) {
    return {
      hotItems: [...hotItems],
      warmItems: [...warmItems],
      triggered: false,
    };
  }

  // 深拷贝，不修改原始数据
  const newHot = hotItems.map((item) => ({ ...item }));
  const newWarm = warmItems.map((item) => ({ ...item }));

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
    originMax,
  };
}
