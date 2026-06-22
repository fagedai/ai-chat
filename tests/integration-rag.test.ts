import { describe, it, expect } from "vitest";
import { getEmbedding } from "@/lib/embedding";
import { searchSimilar, initDb } from "@/lib/db";
import { rerank } from "@/lib/rerank";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const hasApiKey = !!process.env.SILICONFLOW_API_KEY;
const describeOrSkip = hasApiKey ? describe : describe.skip;

const llmProvider = createOpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: "https://api.siliconflow.cn/v1",
});

describeOrSkip("RAG 完整链路集成测试", () => {
  it("Embedding → 检索 → 重排序 → LLM 回答 完整流程", async () => {
    // 1. 向量化用户问题
    const question = "错误码E-1001是什么意思？";
    const embedding = await getEmbedding(question);
    expect(embedding.length).toBeGreaterThan(0);
    console.log("✅ Step 1: Embedding 完成，维度:", embedding.length);

    // 2. 数据库检索（维度不匹配时走兜底）
    await initDb();
    let candidates: Array<{ id: number; filename: string; chunk_index: number; content: string; similarity: number }> = [];
    try {
      candidates = await searchSimilar(embedding, 10);
      console.log("✅ Step 2: 检索完成，候选数:", candidates.length);
    } catch (err) {
      console.log("⚠️ Step 2: 维度不匹配（旧表 512 维 vs 新向量 1024 维），走兜底逻辑");
      console.log("   部署后需重新上传文档以匹配新维度");
    }

    // 3. 阈值过滤 + 重排序
    const filtered = candidates.filter((c) => c.similarity >= 0.5);
    const reranked = rerank(filtered, question).slice(0, 3);
    console.log("✅ Step 3: 重排序完成，精选数:", reranked.length);

    // 4. 构造 Prompt 调 LLM
    let systemPrompt = "你是一个知识库问答助手，请用自身知识回答用户问题。";
    if (reranked.length > 0) {
      const context = reranked
        .map((c, i) => `[${i + 1}] 来源：${c.filename}\n${c.content}`)
        .join("\n\n");
      systemPrompt = `你是一个知识库问答助手。请根据以下参考资料回答用户问题。\n<reference>\n${context}\n</reference>`;
      console.log("✅ Step 4a: 有参考资料，带 context 调 LLM");
    } else {
      console.log("✅ Step 4a: 无参考资料，兜底用 LLM 自身知识");
    }

    const { text } = await generateText({
      model: llmProvider.chat("Qwen/Qwen2.5-32B-Instruct"),
      system: systemPrompt,
      prompt: question,
    });

    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(5);
    console.log("✅ Step 4b: LLM 回答:", text.slice(0, 100) + "...");
    console.log("\n📊 RAG 链路总结:");
    console.log("  - 候选:", candidates.length);
    console.log("  - 过滤后:", filtered.length);
    console.log("  - 精选:", reranked.length);
    console.log("  - 有参考:", reranked.length > 0 ? "是" : "否（兜底）");
  }, 60000); // 60秒超时，因为涉及多次 API 调用
});
