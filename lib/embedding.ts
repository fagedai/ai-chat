/**
 * 本地 Embedding 模块
 * 使用 @xenova/transformers 在本地运行 bge-small-zh-v1.5 模型
 * 首次调用会自动下载模型（~90MB），之后缓存在本地
 */

// 单例：避免重复加载模型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    // @xenova/transformers 是 ESM 模块，需要动态 import
    const { pipeline, env } = await import("@xenova/transformers");
    // 使用国内镜像加速下载
    env.remoteHost = process.env.HF_ENDPOINT || "https://huggingface.co";
    env.remotePathTemplate = "{model}/resolve/{revision}/";
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/bge-small-zh-v1.5"
    );
  }
  return embedder;
}

/**
 * 将文本转为 512 维向量
 * @param text 输入文本
 * @returns 512 个浮点数的数组
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}
