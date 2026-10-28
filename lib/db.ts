import postgres from "postgres";
import { getEmbeddingDimension } from "./embedding";

// 数据库连接（支持 Supabase 云数据库 + 本地 Docker）
export const sql = postgres({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "postgres",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: process.env.DB_HOST?.includes("supabase") ? "require" : false,
  // Supabase 事务模式连接池（6543）不支持会话级 prepared statement
  prepare: false,
});

/**
 * 初始化数据库：创建 pgvector 扩展 + documents 表
 * 在应用启动时或首次上传时调用
 */
let initPromise: Promise<void> | null = null;

/**
 * 初始化数据库（进程内只执行一次）
 * 失败时清空缓存，允许下次请求重试，避免一次网络抖动就让进程永久不可用。
 */
export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = runInitDb().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function runInitDb() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  const dim = getEmbeddingDimension();

  // 用户表（邮箱 + bcrypt 哈希）
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // postgres 模板字符串不支持 DDL 动态插值，用 unsafe 拼接
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${dim}),
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 存量表补列（幂等）：老数据 user_id 为 NULL，对任何用户都不可见
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id)`;

  // 向量索引（加速相似度检索）
  await sql`
    CREATE INDEX IF NOT EXISTS embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  `;

  // 对话历史表
  await sql`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新对话',
      messages JSONB NOT NULL DEFAULT '[]',
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 存量表补列（幂等）
  await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`CREATE INDEX IF NOT EXISTS chats_user_idx ON chats (user_id)`;

  // 用量表（配额判断 + 成本看板）
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
 * 批量插入文档切片及其向量
 *
 * 在一个事务内写入：任一切片失败则整篇回滚，
 * 避免留下「半篇文档」——否则同名文件会被占用且无法重新上传。
 */
export async function insertChunks(
  filename: string,
  chunks: string[],
  embeddings: number[][],
  userId: number
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error("切片数量与向量数量不一致");
  }

  await sql.begin(async (tx) => {
    for (let i = 0; i < chunks.length; i++) {
      // pgvector 要求向量格式为 "[0.1, 0.2, ...]"，需转为 JSON 字符串
      const vectorStr = JSON.stringify(embeddings[i]);
      await tx`
        INSERT INTO documents (filename, chunk_index, content, embedding, user_id)
        VALUES (${filename}, ${i}, ${chunks[i]}, ${vectorStr}::vector, ${userId})
      `;
    }
  });
}

/**
 * 检索与查询向量最相似的文档片段
 */
export async function searchSimilar(
  queryEmbedding: number[],
  limit = 3,
  userId: number
) {
  // pgvector 要求向量格式为 "[0.1, 0.2, ...]"
  // 注意：Supabase 上 ORDER BY embedding <=> vector 会返回空结果（ivfflat 索引兼容性问题）
  // 解决方案：去掉 ORDER BY，在应用层按 similarity 排序
  const vectorStr = JSON.stringify(queryEmbedding);
  const results = await sql`
    SELECT * FROM (
      SELECT id, filename, chunk_index, content,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM documents
      WHERE user_id = ${userId}
    ) AS sub
    WHERE similarity >= 0.1
  `;
  const typed = results as unknown as Array<{
    id: number;
    filename: string;
    chunk_index: number;
    content: string;
    similarity: number;
  }>;
  // 应用层排序 + 截取 top-K
  return typed
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * BM25 关键词检索：基于 PostgreSQL ts_rank 实现 BM25 评分
 * 用于混合检索，精准匹配专有名词（如 E-1002、SLA）
 * - 使用 simple 配置做大小写不敏感匹配
 * - 对中文内容额外用 ILIKE 兜底（pg simple 配置不切分中文）
 */
export async function searchBM25(
  query: string,
  keywords: string[],
  limit = 10,
  userId: number
) {
  if (!keywords.length) return [];

  // 1. 构建 ts_query（simple 配置，按空格分词，大小写不敏感）
  const tsQuery = keywords.join(" | ");

  // 2. 同时用 ILIKE 匹配中文关键词（simple 配置无法切分中文）
  const ilikeConditions = keywords
    .map((_, i) => `content ILIKE $${i + 1}`)
    .join(" OR ");
  const ilikeParams = keywords.map((kw) => `%${kw}%`);

  // 3. 综合查询：ts_rank + ILIKE 命中数作为 BM25 近似得分
  // 注意：PostgreSQL ORDER BY 不能引用同层 SELECT 别名做运算，需用子查询包一层
  const results = await sql.unsafe(
    `
    SELECT *, (ts_score + keyword_hit_rate) AS bm25_total FROM (
      SELECT
        id, filename, chunk_index, content,
        ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $${keywords.length + 1})) AS ts_score,
        (
          ${keywords
            .map((_, i) => `CASE WHEN content ILIKE $${i + 1} THEN 1 ELSE 0 END`)
            .join(" + ")}
        )::float / ${keywords.length} AS keyword_hit_rate
      FROM documents
      WHERE (
        to_tsvector('simple', content) @@ plainto_tsquery('simple', $${keywords.length + 1})
        OR ${ilikeConditions}
      )
      AND user_id = $${keywords.length + 2}
    ) sub
    ORDER BY bm25_total DESC
    LIMIT ${limit}
    `,
    [...ilikeParams, tsQuery, userId]
  );

  // 归一化为统一格式，bm25_score = ts_score + keyword_hit_rate
  return (results as unknown as Array<{
    id: number;
    filename: string;
    chunk_index: number;
    content: string;
    ts_score: number;
    keyword_hit_rate: number;
  }>).map((r) => ({
    id: r.id,
    filename: r.filename,
    chunk_index: r.chunk_index,
    content: r.content,
    bm25_score: Math.min((r.ts_score || 0) + (r.keyword_hit_rate || 0), 1),
  }));
}

/**
 * 获取所有已上传的文档列表（按文件名分组）
 */
export async function listDocuments(userId: number) {
  const results = await sql`
    SELECT filename, COUNT(*) as chunk_count, MIN(created_at) as uploaded_at
    FROM documents
    WHERE user_id = ${userId}
    GROUP BY filename
    ORDER BY uploaded_at DESC
  `;
  return results as unknown as Array<{
    filename: string;
    chunk_count: number;
    uploaded_at: string;
  }>;
}

/**
 * 删除指定文件的所有切片
 */
/** 删除成功返回受影响行数，0 表示不存在或不属于当前用户 */
export async function deleteDocument(
  filename: string,
  userId: number
): Promise<number> {
  const result = await sql`
    DELETE FROM documents WHERE filename = ${filename} AND user_id = ${userId}
  `;
  return result.count;
}

// ========== 对话历史 CRUD ==========

/**
 * 保存对话（新建或更新）
 * messages 为 useChat 的 UIMessage[] 数组
 */
export async function saveChat(
  id: number | null,
  title: string,
  messages: unknown,
  userId: number
): Promise<number> {
  // postgres.js 对 JSONB 列自动序列化，不需要 JSON.stringify
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgJson = sql.json(messages as any);
  if (id) {
    // 更新时必须同时校验归属，防止越权改他人对话
    const result = await sql`
      UPDATE chats SET title = ${title}, messages = ${msgJson}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    const row = (result as unknown as Array<{ id: number }>)[0];
    if (!row) throw new Error("对话不存在或无权访问");
    return row.id;
  } else {
    const result = await sql`
      INSERT INTO chats (title, messages, user_id) VALUES (${title}, ${msgJson}, ${userId})
      RETURNING id
    `;
    return (result as unknown as Array<{ id: number }>)[0].id;
  }
}

/**
 * 获取所有对话列表（不返回完整消息，只返回摘要）
 */
export async function listChats(userId: number) {
  const results = await sql`
    SELECT id, title, created_at, updated_at FROM chats
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return results as unknown as Array<{
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
  }>;
}

/**
 * 获取单个对话详情（含完整消息）
 */
export async function getChat(id: number, userId: number) {
  const results = await sql`SELECT * FROM chats WHERE id = ${id} AND user_id = ${userId}`;
  return (results as unknown as Array<{
    id: number;
    title: string;
    messages: unknown;
    created_at: string;
    updated_at: string;
  }>)[0] || null;
}

/**
 * 删除对话
 */
/** 删除成功返回受影响行数，0 表示不存在或不属于当前用户 */
export async function deleteChat(
  id: number,
  userId: number
): Promise<number> {
  const result = await sql`
    DELETE FROM chats WHERE id = ${id} AND user_id = ${userId}
  `;
  return result.count;
}
