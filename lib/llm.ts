/**
 * LLM Provider 工厂（懒加载）
 *
 * 不在模块顶层读取环境变量：Next.js 构建阶段通常没有 API Key，
 * 顶层调用 createOpenAI 可能直接抛错导致镜像构建失败。
 * 改为每次请求时调用，运行时再读取容器环境变量。
 */

import { createOpenAI } from "@ai-sdk/openai";

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const SILICONFLOW_MODEL = "Qwen/Qwen2.5-32B-Instruct";
const DEEPSEEK_MODEL = "deepseek-chat";

export interface LLMConfig {
  provider: ReturnType<typeof createOpenAI>;
  model: string;
}

/**
 * 有 SILICONFLOW_API_KEY 时用免费模型，否则回退到 DeepSeek。
 */
export function getLLM(): LLMConfig {
  if (process.env.SILICONFLOW_API_KEY) {
    return {
      provider: createOpenAI({
        apiKey: process.env.SILICONFLOW_API_KEY,
        baseURL: SILICONFLOW_BASE_URL,
      }),
      model: SILICONFLOW_MODEL,
    };
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("缺少 SILICONFLOW_API_KEY 或 DEEPSEEK_API_KEY，无法调用 LLM");
  }

  return {
    provider: createOpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_BASE_URL,
    }),
    model: DEEPSEEK_MODEL,
  };
}
