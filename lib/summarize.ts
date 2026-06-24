/**
 * 对话历史摘要器
 * 将早期消息压缩为简短摘要，注入 system prompt 以节省 LLM 上下文 token
 * 采用提取式摘要（不调用额外 LLM），零延迟零费用
 */

import type { ModelMessage } from "ai";

/** 单条消息最大截断长度（字符） */
const MAX_MSG_CHARS = 150;

/**
 * 从 ModelMessage 中提取纯文本内容
 */
function extractText(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text || "")
      .join("");
  }
  return "";
}

/**
 * 截断文本，超长时用 ... 结尾
 */
function truncate(text: string, maxLen: number): string {
  const cleaned = text.replace(/\n+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + "...";
}

/**
 * 将早期消息压缩为摘要文本
 * 格式：
 *   [第1轮] 用户问: xxx → 助手答: xxx
 *   [第2轮] 用户问: xxx → 助手答: xxx
 *   ...
 *
 * @param messages  早期的消息列表（不含最近 N 轮）
 * @returns 摘要文本字符串；若消息为空则返回空字符串
 */
export function summarizeMessages(messages: ModelMessage[]): string {
  if (messages.length === 0) return "";

  // 按顺序配对 user/assistant
  const rounds: Array<{ user: string; assistant: string }> = [];
  let currentUser = "";

  for (const msg of messages) {
    const text = extractText(msg.content);
    if (!text) continue;

    if (msg.role === "user") {
      currentUser = text;
    } else if (msg.role === "assistant" && currentUser) {
      rounds.push({
        user: truncate(currentUser, MAX_MSG_CHARS),
        assistant: truncate(text, MAX_MSG_CHARS),
      });
      currentUser = "";
    }
  }

  // 最后一条 user 消息没有配对 assistant（可能被截断了），也记录下来
  if (currentUser) {
    rounds.push({
      user: truncate(currentUser, MAX_MSG_CHARS),
      assistant: "(未回答)",
    });
  }

  if (rounds.length === 0) return "";

  const lines = rounds.map(
    (r, i) =>
      `[第${i + 1}轮] 用户: ${r.user} → 助手: ${r.assistant}`
  );

  return `以下是之前的对话摘要（共 ${rounds} 轮）：\n${lines.join("\n")}`;
}
