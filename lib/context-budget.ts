/**
 * 对话上下文字符预算
 *
 * 配额是按「调用次数」计的，如果单次请求能塞进几十万字，
 * 一次调用就能烧掉大量 token。这里在发给 LLM 之前做硬性限制：
 *   - 单条消息超过上限直接拒绝（400），避免静默截断用户输入
 *   - 上下文总字符超预算时，从最早的消息开始丢弃，至少保留最后一条
 */

/** 单条消息最大字符数 */
export const MAX_SINGLE_MESSAGE_CHARS = 4000;
/** 发给 LLM 的上下文总字符预算（不含 system prompt） */
export const MAX_CONTEXT_CHARS = 20000;

interface TextPart {
  type: string;
  text?: string;
}

export type MessageContent = string | TextPart[] | undefined;

/** 提取消息中的纯文本（AI SDK v6 的 content 可能是字符串或 parts 数组） */
export function extractMessageText(content: MessageContent): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part?.type === "text")
    .map((part) => part.text || "")
    .join("");
}

/** 单条消息的字符数 */
export function messageChars(message: { content: MessageContent }): number {
  return extractMessageText(message.content).length;
}

/**
 * 从最早的消息开始丢弃，直到总字符数不超过预算。
 * 至少保留最后一条消息；且裁剪后的第一条不能是 assistant，
 * 因为部分模型要求对话以 user 开头。
 */
export function trimToCharBudget<T extends { role: string; content: MessageContent }>(
  messages: T[],
  budget: number
): T[] {
  let total = messages.reduce((sum, m) => sum + messageChars(m), 0);
  let start = 0;

  while (total > budget && start < messages.length - 1) {
    total -= messageChars(messages[start]);
    start += 1;
  }

  // 丢弃后如果以 assistant 开头，再往后挪一条
  if (start < messages.length - 1 && messages[start].role === "assistant") {
    start += 1;
  }

  return messages.slice(start);
}
