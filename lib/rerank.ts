/**
 * RAG 重排序算法（从 chat/route.ts 提取，便于单元测试）
 * 向量相似度 (70%) + 关键词命中率 (30%) 综合打分
 */

export interface RerankChunk {
  similarity: number;
  content: string;
  filename: string;
  chunk_index: number;
  id: number;
  [key: string]: unknown;
}

export interface RerankedChunk extends RerankChunk {
  score: number;
}

/**
 * 重排序：向量相似度 (70%) + 关键词命中率 (30%)
 * 解决纯向量搜索 "语义近但逻辑不相关" 的问题
 */
export function rerank(chunks: RerankChunk[], query: string): RerankedChunk[] {
  // 提取用户问题的关键词（分词：按非中文字符切分 + 按空格切分）
  const keywords = query
    .replace(/[，。！？、；：""''（）\s]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 2);

  return chunks
    .map((chunk) => {
      // 关键词命中率：命中几个关键词就得几分
      let keywordScore = 0;
      for (const kw of keywords) {
        if (chunk.content.includes(kw)) {
          keywordScore += 1;
        }
      }
      // 归一化（最多命中全部关键词）
      const normalizedKeyword =
        keywords.length > 0 ? keywordScore / keywords.length : 0;

      // 综合得分 = 向量相似度 * 0.7 + 关键词命中 * 0.3
      const score = chunk.similarity * 0.7 + normalizedKeyword * 0.3;

      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score);
}
