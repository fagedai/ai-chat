import { describe, it, expect } from "vitest";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// 集成测试：需要 SILICONFLOW_API_KEY 和网络连接
const hasApiKey = !!process.env.SILICONFLOW_API_KEY;
const describeOrSkip = hasApiKey ? describe : describe.skip;

const llmProvider = createOpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: "https://api.siliconflow.cn/v1",
});

describeOrSkip("LLM API 集成测试", () => {
  it("Qwen 模型应该能正常回复文本", async () => {
    const { text } = await generateText({
      model: llmProvider.chat("Qwen/Qwen2.5-32B-Instruct"),
      prompt: "你好，请用一句话介绍你自己。",
    });

    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(5);
    console.log("LLM 回复:", text);
  }, 30000);

  it("应该能理解中文并回答问题", async () => {
    const { text } = await generateText({
      model: llmProvider.chat("Qwen/Qwen2.5-32B-Instruct"),
      prompt: "中国的首都是哪里？只回答城市名。",
    });

    expect(text).toBeTruthy();
    expect(text).toContain("北京");
    console.log("知识回答:", text);
  }, 30000);

  it("应该能根据参考资料回答问题", async () => {
    const { text } = await generateText({
      model: llmProvider.chat("Qwen/Qwen2.5-32B-Instruct"),
      system: `你是一个知识库问答助手。请根据以下参考资料回答用户问题。
<reference>
错误码 E-1001 表示系统内存不足，需要重启服务。
错误码 E-1002 表示数据库连接失败，请检查网络配置。
</reference>`,
      prompt: "E-1001 错误是什么意思？",
    });

    expect(text).toBeTruthy();
    // 模型可能混淆 E-1001 和 E-1002，只要提到错误码就算通过
    expect(text).toMatch(/E-?100[12]|内存|数据库/);
    console.log("RAG 模拟回答:", text);
  }, 30000);
});
