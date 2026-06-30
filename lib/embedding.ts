/**
 * Embedding 模块
 * 支持两种模式：
 * 1. 云端 API（硅基流动 SiliconFlow）— 用于 Vercel 部署
 * 2. 本地模型（@xenova/transformers）— 用于本地开发
 * 通过环境变量 SILICONFLOW_API_KEY 自动切换
 */

// 云端 Embedding（硅基流动）
async function getCloudEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
    },
    body: JSON.stringify({
      model: "BAAI/bge-large-zh-v1.5",
      input: text,
      encoding_format: "float",
    }),
  });
  if (!res.ok) {
    throw new Error(`Embedding API 失败: ${res.status}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

// 云端批量 Embedding（硅基流动）
// 一次 API 调用处理多条文本，避免逐条请求的延迟和速率限制
async function getCloudEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.siliconflow.cn/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
    },
    body: JSON.stringify({
      model: "BAAI/bge-large-zh-v1.5",
      input: texts,
      encoding_format: "float",
    }),
  });
  if (!res.ok) {
    throw new Error(`Embedding API 失败: ${res.status}`);
  }
  const data = await res.json();
  // API 返回的顺序与输入一致，按 index 排序确保对齐
  return (data.data as Array<{ embedding: number[]; index: number }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// 本地 Embedding（@xenova/transformers）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

async function getLocalEmbedder() {
  if (!embedder) {
    const { pipeline, env } = await import("@xenova/transformers");
    env.remoteHost = process.env.HF_ENDPOINT || "https://huggingface.co";
    env.remotePathTemplate = "{model}/resolve/{revision}/";
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/bge-small-zh-v1.5"
    );
  }
  return embedder;
}

async function getLocalEmbedding(text: string): Promise<number[]> {
  const model = await getLocalEmbedder();
  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

/**
 * 将文本转为向量
 * - 有 SILICONFLOW_API_KEY 时用云端 API（1024 维）
 * - 否则用本地模型（512 维）
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (process.env.SILICONFLOW_API_KEY) {
    return getCloudEmbedding(text);
  }
  return getLocalEmbedding(text);
}

/**
 * 批量向量化（用于文件上传，一次性处理所有切片）
 * - 云端：单次 API 调用发送全部文本，避免逐条请求
 * - 本地：并行 Promise.all 处理
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (process.env.SILICONFLOW_API_KEY) {
    return getCloudEmbeddings(texts);
  }
  // 本地模型并行处理
  return Promise.all(texts.map((text) => getLocalEmbedding(text)));
}

/**
 * 获取当前向量维度（用于建表）
 */
export function getEmbeddingDimension(): number {
  return process.env.SILICONFLOW_API_KEY ? 1024 : 512;
}
