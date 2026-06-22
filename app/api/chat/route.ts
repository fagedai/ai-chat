import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type ModelMessage } from "ai";
import { getEmbedding } from "@/lib/embedding";
import { searchSimilar } from "@/lib/db";

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages: ModelMessage[] = await convertToModelMessages(messages);

  // 1. 尝试从知识库检索相关内容
  let systemPrompt = "你是一个知识库问答助手。";

  try {
    const lastUserMsg = modelMessages.filter((m) => m.role === "user").pop();
    // AI SDK v6: content 是数组 [{type:"text", text:"..."}], 需提取文本
    let userQuestion = "";
    if (lastUserMsg) {
      if (typeof lastUserMsg.content === "string") {
        userQuestion = lastUserMsg.content;
      } else if (Array.isArray(lastUserMsg.content)) {
        userQuestion = (lastUserMsg.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
      }
    }

    if (userQuestion) {
      const questionEmbedding = await getEmbedding(userQuestion);
      const relevantChunks = await searchSimilar(questionEmbedding, 3);

      if (relevantChunks.length > 0) {
        const context = relevantChunks
          .map(
            (c, i) =>
              `[${i + 1}] 来源：${c.filename}（第${c.chunk_index + 1}段，相似度：${(c.similarity * 100).toFixed(1)}%）\n${c.content}`
          )
          .join("\n\n");

        systemPrompt = `你是一个知识库问答助手。请根据以下参考资料回答用户问题。
规则：
1. 优先使用参考资料中的信息来回答
2. 如果资料不足以回答，可以结合你自己的知识补充，但要说明哪些来自资料、哪些是你的推断
3. 在回答末尾标注引用来源，格式如：[来源1] 文件名

参考资料：
${context}`;
      }
    }
  } catch (error) {
    // 如果数据库不可用，降级为普通对话（不阻断用户）
    console.warn("知识库检索失败，使用普通对话模式:", error);
  }

  // 2. 流式回答
  const result = streamText({
    model: deepseek.chat("deepseek-v4-flash"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
