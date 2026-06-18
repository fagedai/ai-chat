import postgres from "postgres";

// 数据库连接（pgvector 容器启动后自动连接）
export const sql = postgres({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "postgres",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

/**
 * 初始化数据库：创建 pgvector 扩展 + documents 表
 * 在应用启动时或首次上传时调用
 */
export async function initDb() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(512),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 向量索引（加速相似度检索）
  await sql`
    CREATE INDEX IF NOT EXISTS embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
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
  await sql`
    INSERT INTO documents (filename, chunk_index, content, embedding)
    VALUES (${filename}, ${chunkIndex}, ${content}, ${embedding}::vector)
  `;
}

/**
 * 检索与查询向量最相似的文档片段
 */
export async function searchSimilar(
  queryEmbedding: number[],
  limit = 3
) {
  const results = await sql`
    SELECT id, filename, chunk_index, content,
           1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM documents
    ORDER BY embedding <=> ${queryEmbedding}::vector
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
