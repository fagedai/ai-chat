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
});

/**
 * 初始化数据库：创建 pgvector 扩展 + documents 表
 * 在应用启动时或首次上传时调用
 */
export async function initDb() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  const dim = getEmbeddingDimension();

  // postgres 模板字符串不支持 DDL 动态插值，用 unsafe 拼接
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${dim}),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 向量索引（加速相似度检索）
  await sql`
    CREATE INDEX IF NOT EXISTS embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  `;

  // 工作流表
  await sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '未命名工作流',
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 对话历史表
  await sql`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新对话',
      messages JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

/**
 * 插入文档切片及其向量
 */
export async function insertChunk(
  filename: string,
  chunkIndex: number,
  content: string,
  embedding: number[]
) {
  // pgvector 要求向量格式为 "[0.1, 0.2, ...]"，需转为 JSON 字符串
  const vectorStr = JSON.stringify(embedding);
  await sql`
    INSERT INTO documents (filename, chunk_index, content, embedding)
    VALUES (${filename}, ${chunkIndex}, ${content}, ${vectorStr}::vector)
  `;
}

/**
 * 检索与查询向量最相似的文档片段
 */
export async function searchSimilar(
  queryEmbedding: number[],
  limit = 3
) {
  // pgvector 要求向量格式为 "[0.1, 0.2, ...]"
  // 注意：Supabase 上 ORDER BY embedding <=> vector 会返回空结果（ivfflat 索引兼容性问题）
  // 解决方案：去掉 ORDER BY，在应用层按 similarity 排序
  const vectorStr = JSON.stringify(queryEmbedding);
  const results = await sql`
    SELECT id, filename, chunk_index, content,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM documents
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
  limit = 10
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
      WHERE
        to_tsvector('simple', content) @@ plainto_tsquery('simple', $${keywords.length + 1})
        OR ${ilikeConditions}
    ) sub
    ORDER BY bm25_total DESC
    LIMIT ${limit}
    `,
    [...ilikeParams, tsQuery]
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
export async function listDocuments() {
  const results = await sql`
    SELECT filename, COUNT(*) as chunk_count, MIN(created_at) as uploaded_at
    FROM documents
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
export async function deleteDocument(filename: string) {
  await sql`DELETE FROM documents WHERE filename = ${filename}`;
}

// ========== 工作流 CRUD ==========

/**
 * 保存工作流（新增或更新）
 */
export async function saveWorkflow(
  id: number | null,
  name: string,
  data: unknown
): Promise<number> {
  if (id) {
    // 更新现有工作流
    const result = await sql`
      UPDATE workflows SET name = ${name}, data = ${JSON.stringify(data)}, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `;
    return (result as unknown as Array<{ id: number }>)[0].id;
  } else {
    // 新建工作流
    const result = await sql`
      INSERT INTO workflows (name, data) VALUES (${name}, ${JSON.stringify(data)})
      RETURNING id
    `;
    return (result as unknown as Array<{ id: number }>)[0].id;
  }
}

/**
 * 获取所有工作流列表
 */
export async function listWorkflows() {
  const results = await sql`
    SELECT id, name, created_at, updated_at FROM workflows ORDER BY updated_at DESC
  `;
  return results as unknown as Array<{
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
}

/**
 * 获取单个工作流详情
 */
export async function getWorkflow(id: number) {
  const results = await sql`SELECT * FROM workflows WHERE id = ${id}`;
  return (results as unknown as Array<{
    id: number;
    name: string;
    data: unknown;
    created_at: string;
    updated_at: string;
  }>)[0] || null;
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(id: number) {
  await sql`DELETE FROM workflows WHERE id = ${id}`;
}

// ========== 对话历史 CRUD ==========

/**
 * 保存对话（新建或更新）
 * messages 为 useChat 的 UIMessage[] 数组
 */
export async function saveChat(
  id: number | null,
  title: string,
  messages: unknown
): Promise<number> {
  if (id) {
    const result = await sql`
      UPDATE chats SET title = ${title}, messages = ${JSON.stringify(messages)}, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `;
    return (result as unknown as Array<{ id: number }>)[0].id;
  } else {
    const result = await sql`
      INSERT INTO chats (title, messages) VALUES (${title}, ${JSON.stringify(messages)})
      RETURNING id
    `;
    return (result as unknown as Array<{ id: number }>)[0].id;
  }
}

/**
 * 获取所有对话列表（不返回完整消息，只返回摘要）
 */
export async function listChats() {
  const results = await sql`
    SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC
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
export async function getChat(id: number) {
  const results = await sql`SELECT * FROM chats WHERE id = ${id}`;
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
export async function deleteChat(id: number) {
  await sql`DELETE FROM chats WHERE id = ${id}`;
}
