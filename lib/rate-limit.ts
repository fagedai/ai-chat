/**
 * 进程内滑动窗口限流
 *
 * 用于登录接口防撞库：同一 IP 连续失败 N 次后锁一段时间。
 * 单实例部署（云托管 max=1）足够；将来多实例需要换成 Redis。
 */

const buckets = new Map<string, number[]>();

/** 定期清理过期的 key，避免内存无限增长 */
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => now - t < windowMs);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * 记录一次「失败」并判断是否超限
 * @param key       限流维度，如 `login:1.2.3.4`
 * @param limit     窗口内允许的失败次数
 * @param windowMs  窗口长度（毫秒）
 */
export function hit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  sweep(windowMs);
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryMs = windowMs - (now - hits[0]);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, hits);
  return {
    allowed: true,
    remaining: limit - hits.length,
    retryAfterSeconds: 0,
  };
}

/** 只检查当前是否已被限流，不计数 */
export function isLimited(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryMs = windowMs - (now - hits[0]);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
    };
  }
  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

/** 登录成功后清空该 key 的失败记录 */
export function reset(key: string) {
  buckets.delete(key);
}
