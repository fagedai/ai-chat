import { describe, it, expect } from "vitest";
import { rerank, type HybridChunk } from "@/lib/rerank";

// 构造测试数据（统一混合检索格式）
function makeChunk(
  id: number,
  similarity: number,
  content: string,
  bm25_score = 0,
  filename = "test.md",
  chunk_index = 0
): HybridChunk {
  return { id, similarity, bm25_score, content, filename, chunk_index };
}
describe("rerank - 混合检索重排序", () => {
  it("纯向量相似度排序：相似度高的排前面", () => {
    const chunks = [
      makeChunk(1, 0.6, "苹果公司是一家科技公司"),
      makeChunk(2, 0.9, "苹果是一种水果"),
      makeChunk(3, 0.75, "苹果手机很流行"),
    ];
    const result = rerank(chunks, "xyz"); // xyz 不匹配任何关键词
    // 无关键词命中时，纯靠向量相似度
    expect(result[0].id).toBe(2); // 0.9 最高
    expect(result[1].id).toBe(3); // 0.75
    expect(result[2].id).toBe(1); // 0.6 最低
  });

  it("关键词命中应该提升排名", () => {
    const chunks = [
      makeChunk(1, 0.9, "香蕉是黄色的水果"),          // 向量高但无关键词命中
      makeChunk(2, 0.6, "苹果手机是科技产品", 0.8),     // 向量低但 BM25+关键词命中
    ];
    const result = rerank(chunks, "苹果手机");
    // chunk1: 0.9*0.5 + 0*0.2 + 0*0.3 = 0.45
    // chunk2: 0.6*0.5 + 0.8*0.2 + 1.0*0.3 = 0.3 + 0.16 + 0.3 = 0.76
    expect(result[0].id).toBe(2); // 关键词命中后反超
    expect(result[1].id).toBe(1);
  });

  it("综合得分应该按向量50%+BM25 20%+关键词30%计算", () => {
    const chunks = [
      makeChunk(1, 0.8, "错误码 E-1001 表示系统错误", 0.6),
    ];
    const result = rerank(chunks, "E-1001 错误");
    // 关键词：["E-1001", "错误"]，命中2个，keywordScore=1.0
    // 得分 = 0.8*0.5 + 0.6*0.2 + 1.0*0.3 = 0.4 + 0.12 + 0.3 = 0.82
    expect(result[0].score).toBeCloseTo(0.82, 2);
  });

  it("空查询时应该只按向量和BM25得分排序", () => {
    const chunks = [
      makeChunk(1, 0.5, "内容A"),
      makeChunk(2, 0.9, "内容B", 0.3),
    ];
    const result = rerank(chunks, "");
    // chunk1: 0.5*0.5 + 0*0.2 + 0*0.3 = 0.25
    // chunk2: 0.9*0.5 + 0.3*0.2 + 0*0.3 = 0.45 + 0.06 = 0.51
    expect(result[0].id).toBe(2);
    expect(result[0].score).toBeCloseTo(0.51, 2);
  });

  it("空数组输入应该返回空数组", () => {
    const result = rerank([], "测试");
    expect(result).toEqual([]);
  });

  it("结果应该包含 score 字段", () => {
    const chunks = [makeChunk(1, 0.8, "测试内容", 0.5)];
    const result = rerank(chunks, "测试");
    expect(result[0]).toHaveProperty("score");
    expect(typeof result[0].score).toBe("number");
  });

  it("BM25独有结果也能参与排序", () => {
    const chunks = [
      makeChunk(1, 0.8, "无关内容"),
      makeChunk(2, 0, "E-1002 表示网络超时", 0.9),
    ];
    const result = rerank(chunks, "E-1002");
    // chunk1: 0.8*0.5 + 0*0.2 + 0*0.3 = 0.4
    // chunk2: 0*0.5 + 0.9*0.2 + 1.0*0.3 = 0.18 + 0.3 = 0.48
    expect(result[0].id).toBe(2); // BM25 独有结果反超
  });
});
