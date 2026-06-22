import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// 节点类型
interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

// 单个节点执行结果
interface NodeResult {
  nodeId: string;
  status: "running" | "success" | "error";
  output?: string;
  error?: string;
}

/**
 * POST /api/workflow/run
 * 接收工作流 JSON → 拓扑排序 → 逐节点执行 → SSE 推送状态
 */
export async function POST(req: Request) {
  const { nodes, edges, input } = await req.json() as {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    input: string;
  };

  // 1. 拓扑排序
  const sorted = topologicalSort(nodes, edges);

  // 2. 创建 SSE 流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: NodeResult) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 变量存储：在节点之间传递数据
      const variables: Record<string, string> = { input: input || "" };

      for (const nodeId of sorted) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        // 通知：节点开始执行
        send({ nodeId, status: "running" });

        try {
          const output = await executeNode(node, variables, edges, nodes);
          variables[nodeId] = output;
          send({ nodeId, status: "success", output });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "执行失败";
          send({ nodeId, status: "error", error: msg });
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * 执行单个节点
 */
async function executeNode(
  node: WorkflowNode,
  variables: Record<string, string>,
  edges: WorkflowEdge[],
  nodes: WorkflowNode[]
): Promise<string> {
  switch (node.type) {
    case "startNode":
      return variables.input || "";

    case "llmNode": {
      // 找到上游节点的输出作为输入
      const parentOutput = getParentOutput(node.id, edges, variables);
      const prompt = (node.data.prompt as string) || "请回答以下问题：";
      const model = (node.data.model as string) || "deepseek-v4-flash";

      const { text } = await generateText({
        model: deepseek.chat(model),
        prompt: `${prompt}\n\n用户输入：${parentOutput}`,
      });
      return text;
    }

    case "toolNode": {
      const parentOutput = getParentOutput(node.id, edges, variables);
      const tool = (node.data.tool as string) || "echo";

      switch (tool) {
        case "知识库检索": {
          // 简化版：调用 RAG 搜索
          const { getEmbedding } = await import("@/lib/embedding");
          const { searchSimilar } = await import("@/lib/db");
          try {
            const embedding = await getEmbedding(parentOutput);
            const results = await searchSimilar(embedding, 3);
            if (results.length > 0) {
              return results.map((r) => `[${r.filename}] ${r.content}`).join("\n\n");
            }
            return "知识库中未找到相关内容";
          } catch {
            return "知识库检索服务不可用";
          }
        }
        case "文本统计":
          return `字数: ${parentOutput.length}, 行数: ${parentOutput.split("\n").length}`;
        case "转大写":
          return parentOutput.toUpperCase();
        default:
          return `[工具: ${tool}] 输入: ${parentOutput.slice(0, 100)}`;
      }
    }

    case "endNode": {
      const parentOutput = getParentOutput(node.id, edges, variables);
      return parentOutput || "(无输出)";
    }

    default:
      return "未知节点类型";
  }
}

/**
 * 获取上游节点的输出
 */
function getParentOutput(
  nodeId: string,
  edges: WorkflowEdge[],
  variables: Record<string, string>
): string {
  const parentEdge = edges.find((e) => e.target === nodeId);
  if (parentEdge && variables[parentEdge.source]) {
    return variables[parentEdge.source];
  }
  return variables.input || "";
}

/**
 * 拓扑排序：按依赖关系确定执行顺序
 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
  }

  for (const edge of edges) {
    adjList[edge.source].push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  }

  const queue: string[] = [];
  for (const [id, deg] of Object.entries(inDegree)) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const next of adjList[current]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  return result;
}
