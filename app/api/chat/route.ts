import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);
  const result = streamText({
    model: deepseek.chat('deepseek-v4-flash'),
    messages: modelMessages,
  })

  return result.toUIMessageStreamResponse();
}
