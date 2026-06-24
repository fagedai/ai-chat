/**
 * 混合检索（Hybrid Search）
 * 并行执行：
 *   1. 向量检索：理解语义，适合模糊问题
 *   2. BM25 关键词检索：精准匹配 "E-1002" 这种专有名词
 * 两路结果按 id 去重合并后返回，供 rerank 统一打分
 */

import { searchSimilar, searchBM25 } from "./db";
import { extractKeywords, type HybridChunk } from "./rerank";

export interface HybridSearchResult {
  /** 合并去重后的候选片段 */
  chunks: HybridChunk[];
  /** 诊断信息（供前端 RAG 面板展示） */
  diagnostics: {
    vectorCount: number;
    bm25Count: number;
    mergedCount: number;
    duplicatesRemoved: number;
    vectorError?: string;
    bm25Error?: string;
  };
}

/**
 * 执行混合检索
 * @param queryEmbedding  用户问题的向量
 * @param query           用户原始问题文本
 * @param vectorLimit     向量检索召回数量（默认 10）
 * @param bm25Limit       BM25 检索召回数量（默认 10）
 */
export async function hybridSearch(
  queryEmbedding: number[],
  query: string,
  vectorLimit = 10,
  bm25Limit = 10
): Promise<HybridSearchResult> {
  const keywords = extractKeywords(query);

  // 两路检索独立容错：向量挂了 BM25 照样能搜
  const [vectorResult, bm25Result] = await Promise.allSettled([
    searchSimilar(queryEmbedding, vectorLimit),
    searchBM25(query, keywords, bm25Limit),
  ]);

  const vectorResults =
    vectorResult.status === "fulfilled" ? vectorResult.value : [];
  const bm25Results =
    bm25Result.status === "fulfilled" ? bm25Result.value : [];

  // 记录错误信息供前端展示
  const vectorError =
    vectorResult.status === "rejected"
      ? String(vectorResult.reason?.message || vectorResult.reason)
      : undefined;
  const bm25Error =
    bm25Result.status === "rejected"
      ? String(bm25Result.reason?.message || bm25Result.reason)
      : undefined;

  if (vectorError) console.warn("⚠️ 向量检索失败，仅使用 BM25:", vectorError);
  if (bm25Error) console.warn("⚠️ BM25 检索失败，仅使用向量:", bm25Error);

  // 合并去重：以 id 为 key，向量结果优先（已有 similarity）
  const merged = new Map<number, HybridChunk>();

  // 先放入向量检索结果
  for (const v of vectorResults) {
    merged.set(v.id, {
      id: v.id,
      filename: v.filename,
      chunk_index: v.chunk_index,
      content: v.content,
      similarity: v.similarity,
      bm25_score: 0, // 默认 0，后面 BM25 命中时更新
    });
  }

  // 合并 BM25 结果：已存在的更新 bm25_score，不存在的追加
  for (const b of bm25Results) {
    const existing = merged.get(b.id);
    if (existing) {
      existing.bm25_score = b.bm25_score;
    } else {
      // BM25 独有结果：similarity 设为 0（无向量相似度）
      merged.set(b.id, {
        id: b.id,
        filename: b.filename,
        chunk_index: b.chunk_index,
        content: b.content,
        similarity: 0,
        bm25_score: b.bm25_score,
      });
    }
  }

  const chunks = Array.from(merged.values());

  return {
    chunks,
    diagnostics: {
      vectorCount: vectorResults.length,
      bm25Count: bm25Results.length,
      mergedCount: chunks.length,
      duplicatesRemoved:
        vectorResults.length + bm25Results.length - chunks.length,
      vectorError,
      bm25Error,
    },
  };
}
