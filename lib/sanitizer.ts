/**
 * 内容安全过滤器
 * 检测并拦截上传文档中的 Prompt 注入攻击
 */

// 危险模式列表（正则）：匹配常见的 Prompt 注入攻击
const DANGEROUS_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
  /忽略\s*(所有|之前|上面|以上)\s*(指令|提示|规则|设定)/,
  /you\s+are\s+now\s+a/i,
  /你现在\s*(是|变成|扮演)/,
  /disregard\s+(everything|all)/i,
  /forget\s+(everything|all|your)/i,
  /system\s*prompt/i,
  /repeat\s+(the\s+)?(system|initial)\s+(prompt|message)/i,
  /输出\s*(系统|初始)\s*(提示|设定|Prompt)/i,
  /\b(DAN|jailbreak|越狱)\b/i,
  /<script[^>]*>/i,                    // XSS 注入
  /javascript\s*:/i,                   // JS 协议注入
];

/**
 * 检查文本是否包含 Prompt 注入攻击
 * @returns 安全结果：{ safe: boolean, reason?: string }
 */
export function sanitizeContent(text: string): { safe: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: `检测到可疑内容（匹配规则：${pattern.source}），可能包含 Prompt 注入攻击`,
      };
    }
  }

  // 文件大小限制（防止超大文档导致 Token 爆炸）
  if (text.length > 100_000) {
    return {
      safe: false,
      reason: `文档过大（${text.length} 字符），单次上传限制 10 万字`,
    };
  }

  return { safe: true };
}
