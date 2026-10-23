/**
 * 把流式 Markdown 切成「可以独立渲染」的语义块
 *
 * 渲染层按空行切块 + memo 冻结已完成的块，避免每个 token 都全量解析。
 * 但直接 `content.split(/\n\n+/)` 会把代码块切开：
 *
 *   ```js
 *   const a = 1;
 *
 *   const b = 2;   // ← 这个空行不该成为分块点
 *   ```
 *
 * 所以这里做一次 fence 感知：只要还在 ``` / ~~~ 内部，空行不切块。
 */
export function splitMarkdownBlocks(content: string): string[] {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let fenceMarker: string | null = null;

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
  };

  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);

    if (fence) {
      const marker = fence[1][0];
      if (fenceMarker === null) {
        fenceMarker = marker; // 进入代码块
      } else if (marker === fenceMarker) {
        fenceMarker = null; // 闭合代码块
      }
      current.push(line);
      continue;
    }

    // 代码块内部的空行属于代码，不能当分隔符
    if (fenceMarker === null && line.trim() === "") {
      flush();
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks.length > 0 ? blocks : [""];
}
