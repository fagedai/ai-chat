/**
 * 递归语义化分块工具
 * 按优先级逐层降级切分，保证语义完整性：
 *   1. Markdown 标题（## ）  → .md 文件
 *   2. 空行段落（\n\n）      → .txt / .docx 文件
 *   3. 句号断句（。/ . ）    → 长段落
 *   4. 固定长度（兜底）       → 最后保底
 */

// BGE 系列模型的输入窗口是 512 token，中文约 1 字 1 token。
// 实测超过 512 字会被 Embedding API 直接拒绝（400），因此上限取 400 留出余量。
// 详见 docs/rag-eval-report.md 的评测结论。
const MAX_SIZE = 400; // 单个 chunk 最大字符数（默认值）
const MIN_SIZE = 50; // 单个 chunk 最小字符数（太短则合并）
const OVERLAP = 50; // 固定长度兜底时的重叠字符数

/** 分块参数，可在评测中对比不同取值 */
export interface ChunkOptions {
  maxSize?: number;
  minSize?: number;
  overlap?: number;
}

/**
 * 主入口：将文本递归切分为语义完整的 chunk
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxSize = options.maxSize ?? MAX_SIZE;
  const minSize = options.minSize ?? MIN_SIZE;
  const overlap = options.overlap ?? OVERLAP;

  // 第 1 层：按 Markdown 标题切
  let chunks = splitByMarkdownHeaders(text);

  // 第 2 层：超长 chunk 按空行段落切
  chunks = furtherSplit(chunks, maxSize, (s) => splitByParagraphs(s, minSize));

  // 第 3 层：仍然超长按句号切
  chunks = furtherSplit(chunks, maxSize, (s) => splitBySentences(s, minSize));

  // 第 4 层：仍然超长用固定长度兜底
  chunks = furtherSplit(chunks, maxSize, (s) =>
    fixedSizeSplit(s, maxSize, overlap)
  );

  // 合并过短的 chunk
  chunks = mergeShortChunks(chunks, minSize);

  // 过滤空 chunk
  return chunks.map((c) => c.trim()).filter((c) => c.length > 0);
}

// ============ 第 1 层：Markdown 标题分块 ============

/**
 * 按 ## 标题切分，标题保留在对应 chunk 开头
 * 如果没有 ## 标题，返回原文（交给下一层处理）
 */
function splitByMarkdownHeaders(text: string): string[] {
  // 匹配行首的 ## （不匹配 # 和 ###）
  const headerRegex = /^#{2}\s+/m;
  if (!headerRegex.test(text)) {
    return [text];
  }

  // 按 ## 标题分割，保留分隔符
  const parts = text.split(/(?=^#{2}\s+)/m);

  // 如果只有一个部分（没有标题），返回原文
  if (parts.length <= 1) {
    return [text];
  }

  // 第一个部分可能是文档标题（# 标题）或前言，合并到第一个 ## chunk
  const result: string[] = [];
  let preamble = "";

  for (const part of parts) {
    if (part.trim().length === 0) continue;

    // 如果不以 ## 开头，说明是前言部分
    if (!/^#{2}\s/.test(part.trim())) {
      preamble = part;
    } else {
      // 把前言附加到第一个 ## chunk 前面
      if (preamble) {
        result.push(preamble + part);
        preamble = "";
      } else {
        result.push(part);
      }
    }
  }

  // 如果前言没有后续标题，单独保留
  if (preamble && result.length === 0) {
    result.push(preamble);
  }

  return result.length > 0 ? result : [text];
}

// ============ 第 2 层：空行段落分块 ============

/**
 * 按空行（\n\n）切分段落
 */
function splitByParagraphs(text: string, minSize: number): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  // 合并相邻短段落，避免过度碎片化
  return mergeShortChunks(
    paragraphs.filter((p) => p.trim().length > 0),
    minSize
  );
}

// ============ 第 3 层：句号断句 ============

/**
 * 按句号（。或 . ）切分句子
 */
function splitBySentences(text: string, minSize: number): string[] {
  // 按。或. 切分，保留句号
  const sentences = text.split(/(?<=[。.])\s*/);
  return mergeShortChunks(
    sentences.filter((s) => s.trim().length > 0),
    minSize
  );
}

// ============ 第 4 层：固定长度兜底 ============

/**
 * 固定长度切分（带重叠），作为最后兜底
 */
function fixedSizeSplit(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

// ============ 工具函数 ============

/**
 * 对 chunks 中超过 MAX_SIZE 的部分用 splitFn 进一步切分
 * 不超过的保持原样
 */
function furtherSplit(
  chunks: string[],
  maxSize: number,
  splitFn: (text: string) => string[]
): string[] {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > maxSize) {
      result.push(...splitFn(chunk));
    } else {
      result.push(chunk);
    }
  }
  return result;
}

/**
 * 合并过短的 chunk 到上一个 chunk
 */
function mergeShortChunks(chunks: string[], minSize: number): string[] {
  if (chunks.length <= 1) return chunks;

  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.trim().length === 0) continue;

    if (result.length > 0 && chunk.trim().length < minSize) {
      // 太短，合并到上一个
      result[result.length - 1] += "\n\n" + chunk;
    } else {
      result.push(chunk);
    }
  }

  // 检查最后一个 chunk 是否太短
  if (result.length > 1 && result[result.length - 1].trim().length < minSize) {
    result[result.length - 2] += "\n\n" + result[result.length - 1];
    result.pop();
  }

  return result;
}
