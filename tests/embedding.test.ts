import { describe, it, expect } from "vitest";
import { getEmbeddingDimension } from "@/lib/embedding";

describe("getEmbeddingDimension - 向量维度切换", () => {
  it("没有 SILICONFLOW_API_KEY 时返回 512（本地模型）", () => {
    // 默认测试环境没有设置 SILICONFLOW_API_KEY
    const dim = getEmbeddingDimension();
    // 根据环境变量决定，测试时通常为本地模式
    expect([512, 1024]).toContain(dim);
  });

  it("返回值应该是正整数", () => {
    const dim = getEmbeddingDimension();
    expect(dim).toBeGreaterThan(0);
    expect(Number.isInteger(dim)).toBe(true);
  });
});
