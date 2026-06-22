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

  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${dim}),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

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
  const vectorStr = JSON.stringify(queryEmbedding);
  const results = await sql`
    SELECT id, filename, chunk_index, content,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM documents
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
  return results as unknown as Array<{
    id: number;
    filename: string;
    chunk_index: number;
    content: string;
    similarity: number;
  }>;
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
