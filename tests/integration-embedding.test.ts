import { describe, it, expect } from "vitest";
import { getEmbedding, getEmbeddingDimension } from "@/lib/embedding";

// 集成测试：需要 SILICONFLOW_API_KEY 和网络连接
const hasApiKey = !!process.env.SILICONFLOW_API_KEY;
const describeOrSkip = hasApiKey ? describe : describe.skip;

describeOrSkip("Embedding API 集成测试", () => {
  it("应该返回正确维度的向量数组", async () => {
    const embedding = await getEmbedding("什么是错误码E-1001？");
    
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(getEmbeddingDimension());
    // 每个元素应该是数字
    embedding.forEach((val) => {
      expect(typeof val).toBe("number");
      expect(Number.isFinite(val)).toBe(true);
    });
  }, 30000); // 30秒超时

  it("不同文本应该返回不同的向量", async () => {
    const v1 = await getEmbedding("苹果手机");
    const v2 = await getEmbedding("香蕉牛奶");
    
    // 两个向量不应该完全相同
    const diff = v1.reduce((sum, val, i) => sum + Math.abs(val - v2[i]), 0);
    expect(diff).toBeGreaterThan(0.1);
  }, 30000);

  it("相似文本的向量相似度应该更高", async () => {
    const v1 = await getEmbedding("苹果手机很贵");
    const v2 = await getEmbedding("iPhone 价格高");
    const v3 = await getEmbedding("今天天气不错");
    
    // 计算余弦相似度
    const cosineSim = (a: number[], b: number[]) => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    };
    
    const simRelated = cosineSim(v1, v2);  // 语义相关
    const simUnrelated = cosineSim(v1, v3); // 语义无关
    
    expect(simRelated).toBeGreaterThan(simUnrelated);
  }, 30000);
});
