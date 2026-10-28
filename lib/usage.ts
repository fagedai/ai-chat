/**
 * 用量记录与配额
 *
 * 每次真正调用 LLM 后落一条 usage_events，
 * 既用于每日配额判断，也用于用量看板与成本估算。
 * 按 Asia/Shanghai 自然日统计，避免北京时间早上 8 点才算新的一天。
 */
import { sql } from "./db";

/** 每个用户每天能发起的 LLM 调用次数 */
export const DAILY_LIMIT_PER_USER = Number(
  process.env.CHAT_DAILY_LIMIT_PER_USER || 300
);
/** 全站每天总调用上限，防止被刷爆额度 */
export const DAILY_LIMIT_GLOBAL = Number(
  process.env.CHAT_DAILY_LIMIT_GLOBAL || 1000
);

/** 价格（元 / 百万 token），不配置则看板只显示 token 数不显示金额 */
const PRICE_INPUT_PER_M = Number(process.env.LLM_PRICE_INPUT_PER_M || 0);
const PRICE_OUTPUT_PER_M = Number(process.env.LLM_PRICE_OUTPUT_PER_M || 0);

export type UsageKind = "chat";

export interface UsageRecord {
  userId: number;
  kind: UsageKind;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

/** 创建用量表（幂等），由 initDb 调用 */
export async function initUsageTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS usage_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat',
      input_tokens INTEGER,
      output_tokens INTEGER,
      latency_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS usage_events_user_time_idx
    ON usage_events (user_id, created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS usage_events_time_idx
    ON usage_events (created_at)
  `;
}

/**
 * 记录一次调用。失败只打日志——用量统计不该影响正常问答。
 */
export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    await sql`
      INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens, latency_ms)
      VALUES (
        ${record.userId},
        ${record.kind},
        ${record.inputTokens ?? null},
        ${record.outputTokens ?? null},
        ${record.latencyMs ?? null}
      )
    `;
  } catch (error) {
    console.warn("记录用量失败:", error);
  }
}

export interface QuotaState {
  allowed: boolean;
  /** 超额原因：user=个人额度用尽，global=全站预算熔断 */
  reason?: "user" | "global";
  used: number;
  limit: number;
  globalUsed: number;
  globalLimit: number;
}

/** 调用前的配额检查：个人额度 + 全站每日预算 */
export async function checkQuota(userId: number): Promise<QuotaState> {
  const [userRows, globalRows] = await Promise.all([
    sql`
      SELECT count(*)::int AS n FROM usage_events
      WHERE user_id = ${userId}
        AND (created_at AT TIME ZONE 'Asia/Shanghai')::date
          = (now() AT TIME ZONE 'Asia/Shanghai')::date
    `,
    sql`
      SELECT count(*)::int AS n FROM usage_events
      WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::date
          = (now() AT TIME ZONE 'Asia/Shanghai')::date
    `,
  ]);

  const used = (userRows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
  const globalUsed = (globalRows as unknown as Array<{ n: number }>)[0]?.n ?? 0;

  if (used >= DAILY_LIMIT_PER_USER) {
    return {
      allowed: false,
      reason: "user",
      used,
      limit: DAILY_LIMIT_PER_USER,
      globalUsed,
      globalLimit: DAILY_LIMIT_GLOBAL,
    };
  }
  if (globalUsed >= DAILY_LIMIT_GLOBAL) {
    return {
      allowed: false,
      reason: "global",
      used,
      limit: DAILY_LIMIT_PER_USER,
      globalUsed,
      globalLimit: DAILY_LIMIT_GLOBAL,
    };
  }
  return {
    allowed: true,
    used,
    limit: DAILY_LIMIT_PER_USER,
    globalUsed,
    globalLimit: DAILY_LIMIT_GLOBAL,
  };
}

export interface DailyUsage {
  date: string;
  calls: number;
}

export interface UsageSummary {
  today: {
    calls: number;
    chatCalls: number;
    inputTokens: number;
    outputTokens: number;
    avgLatencyMs: number;
  };
  limits: { perUser: number; global: number; globalUsed: number };
  cost: { input: number; output: number; total: number } | null;
  days: DailyUsage[];
}

/** 某个用户最近 N 天的用量汇总（含今天） */
export async function getUsageSummary(
  userId: number,
  days = 7
): Promise<UsageSummary> {
  const [todayRows, globalRows, dailyRows] = await Promise.all([
    sql`
      SELECT
        count(*)::int AS calls,
        count(*) FILTER (WHERE kind = 'chat')::int AS chat_calls,
        COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COALESCE(ROUND(AVG(latency_ms)), 0)::int AS avg_latency
      FROM usage_events
      WHERE user_id = ${userId}
        AND (created_at AT TIME ZONE 'Asia/Shanghai')::date
          = (now() AT TIME ZONE 'Asia/Shanghai')::date
    `,
    sql`
      SELECT count(*)::int AS n FROM usage_events
      WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::date
          = (now() AT TIME ZONE 'Asia/Shanghai')::date
    `,
    sql`
      SELECT
        to_char((created_at AT TIME ZONE 'Asia/Shanghai')::date, 'MM-DD') AS date,
        count(*)::int AS calls
      FROM usage_events
      WHERE user_id = ${userId}
        AND created_at >= now() - make_interval(days => ${days})
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const t = (todayRows as unknown as Array<{
    calls: number;
    chat_calls: number;
    input_tokens: number;
    output_tokens: number;
    avg_latency: number;
  }>)[0];

  const globalUsed =
    (globalRows as unknown as Array<{ n: number }>)[0]?.n ?? 0;

  const inputTokens = t?.input_tokens ?? 0;
  const outputTokens = t?.output_tokens ?? 0;

  return {
    today: {
      calls: t?.calls ?? 0,
      chatCalls: t?.chat_calls ?? 0,
      inputTokens,
      outputTokens,
      avgLatencyMs: t?.avg_latency ?? 0,
    },
    limits: {
      perUser: DAILY_LIMIT_PER_USER,
      global: DAILY_LIMIT_GLOBAL,
      globalUsed,
    },
    cost:
      PRICE_INPUT_PER_M > 0 || PRICE_OUTPUT_PER_M > 0
        ? {
            input: (inputTokens / 1_000_000) * PRICE_INPUT_PER_M,
            output: (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M,
            total:
              (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
              (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M,
          }
        : null,
    days: dailyRows as unknown as DailyUsage[],
  };
}
