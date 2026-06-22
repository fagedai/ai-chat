/**
 * 工作流核心算法（从 route.ts 提取，便于单元测试）
 */

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

/**
 * 拓扑排序：按依赖关系确定执行顺序（BFS + 入度法）
 * @returns 节点 ID 的有序数组
 */
export function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
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

/**
 * 获取上游节点的输出
 * @param nodeId 当前节点 ID
 * @param edges 所有连线
 * @param variables 变量存储（节点 ID → 输出）
 * @returns 上游节点的输出，没有则返回 input
 */
export function getParentOutput(
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

export type { WorkflowNode, WorkflowEdge };
