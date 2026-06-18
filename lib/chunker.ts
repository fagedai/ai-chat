/**
 * 文档切片工具
 * 将长文本按固定长度切片，相邻切片之间有重叠（保证语义连贯）
 */

/**
 * 将文本切片
 * @param text 原始文本
 * @param chunkSize 每片最大字符数（默认 500）
 * @param overlap 相邻切片重叠字符数（默认 100）
 * @returns 字符串数组
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 100
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    // 跳过空白切片
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // 如果已经到末尾，停止
    if (end >= text.length) break;

    start += chunkSize - overlap;
  }

  return chunks;
}
