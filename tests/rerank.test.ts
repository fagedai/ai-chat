import { describe, it, expect } from "vitest";
import { rerank, type RerankChunk } from "@/lib/rerank";

// 构造测试数据
function makeChunk(
  id: number,
  similarity: number,
  content: string,
  filename = "test.md",
  chunk_index = 0
): RerankChunk {
  return { id, similarity, content, filename, chunk_index };
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
      makeChunk(1, 0.9, "香蕉是黄色的水果"),      // 向量高但无关键词命中
      makeChunk(2, 0.6, "苹果手机是科技产品"),     // 向量低但关键词命中
    ];
    const result = rerank(chunks, "苹果手机");
    // chunk2 命中2个关键词，得分 = 0.6*0.7 + 1.0*0.3 = 0.72
    // chunk1 命中0个关键词，得分 = 0.9*0.7 + 0*0.3 = 0.63
    expect(result[0].id).toBe(2); // 关键词命中后反超
    expect(result[1].id).toBe(1);
  });

  it("综合得分应该按向量70%+关键词30%计算", () => {
    const chunks = [
      makeChunk(1, 0.8, "错误码 E-1001 表示系统错误"),
    ];
    const result = rerank(chunks, "E-1001 错误");
    // 关键词：["E-1001", "错误"]，命中2个
    // 得分 = 0.8*0.7 + 1.0*0.3 = 0.56 + 0.3 = 0.86
    expect(result[0].score).toBeCloseTo(0.86, 2);
  });

  it("空查询时应该只按向量相似度排序", () => {
    const chunks = [
      makeChunk(1, 0.5, "内容A"),
      makeChunk(2, 0.9, "内容B"),
    ];
    const result = rerank(chunks, "");
    expect(result[0].id).toBe(2);
    expect(result[0].score).toBeCloseTo(0.63, 2); // 0.9*0.7
  });

  it("空数组输入应该返回空数组", () => {
    const result = rerank([], "测试");
    expect(result).toEqual([]);
  });

  it("结果应该包含 score 字段", () => {
    const chunks = [makeChunk(1, 0.8, "测试内容")];
    const result = rerank(chunks, "测试");
    expect(result[0]).toHaveProperty("score");
    expect(typeof result[0].score).toBe("number");
  });

  it("中文标点应该被正确分词", () => {
    const chunks = [
      makeChunk(1, 0.5, "系统错误码E-1001"),
      makeChunk(2, 0.5, "这是另一段无关内容"),
    ];
    const result = rerank(chunks, "错误码E-1001是什么？");
    // "错误码E-1001" 和 "是什么" 是关键词
    expect(result[0].id).toBe(1);
  });
});
