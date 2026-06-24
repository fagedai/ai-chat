/**
 * RAG 重排序算法
 * 统一混合检索打分：向量相似度 50% + BM25 得分 20% + 关键词命中 30%
 */

export interface HybridChunk {
  id: number;
  similarity: number;
  bm25_score: number;
  content: string;
  filename: string;
  chunk_index: number;
  [key: string]: unknown;
}

export interface RerankedChunk extends HybridChunk {
  score: number;
}

/**
 * 从用户问题中提取关键词
 * - 字母数字标识符（如 E-1002, API, SLA, v1.5）
 * - 中文实义词（过滤疑问词和虚词）
 */
export function extractKeywords(query: string): string[] {
  // 1. 字母数字标识符（E-1002, API, v1.5 等）
  const alphanumeric = query.match(/[A-Za-z0-9][-A-Za-z0-9.]*/g) || [];

  // 2. 中文实义词（去除疑问词和常见虚词）
  const cleaned = query
    .replace(/[A-Za-z0-9][-A-Za-z0-9.]*/g, " ") // 去掉字母数字
    .replace(
      /是什么|什么是|怎么|如何|为什么|哪些|哪个|吗|呢|的|了|是|在|有|和|与|及|或|请|告诉|我|一下|描述|解释|说明|介绍/g,
      " "
    )
    .replace(/[，。！？、；：""''（）\s]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 2);

  return [...alphanumeric, ...cleaned];
}

/**
 * 计算单个 chunk 的关键词命中率
 */
function calcKeywordHitRate(chunk: HybridChunk, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  let hitCount = 0;
  for (const kw of keywords) {
    if (chunk.content.includes(kw)) hitCount += 1;
  }
  return hitCount / keywords.length;
}

/**
 * 重排序：向量 50% + BM25 20% + 关键词命中 30%
 */
export function rerank(chunks: HybridChunk[], query: string): RerankedChunk[] {
  const keywords = extractKeywords(query);

  return chunks
    .map((chunk) => {
      const keywordScore = calcKeywordHitRate(chunk, keywords);
      const score =
        chunk.similarity * 0.5 + chunk.bm25_score * 0.2 + keywordScore * 0.3;

      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score);
}
