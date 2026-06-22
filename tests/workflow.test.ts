import { describe, it, expect } from "vitest";
import { topologicalSort, getParentOutput, type WorkflowNode, type WorkflowEdge } from "@/lib/workflow";

// 测试用节点
const nodes: WorkflowNode[] = [
  { id: "start", type: "startNode", position: { x: 0, y: 0 }, data: {} },
  { id: "llm", type: "llmNode", position: { x: 0, y: 100 }, data: {} },
  { id: "tool", type: "toolNode", position: { x: 0, y: 200 }, data: {} },
  { id: "end", type: "endNode", position: { x: 0, y: 300 }, data: {} },
];

describe("topologicalSort - DAG 拓扑排序", () => {
  it("线性链：start → llm → end 应按顺序输出", () => {
    const chainNodes = [nodes[0], nodes[1], nodes[3]]; // start, llm, end
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "start", target: "llm" },
      { id: "e2", source: "llm", target: "end" },
    ];
    const result = topologicalSort(chainNodes, edges);
    expect(result).toEqual(["start", "llm", "end"]);
  });

  it("分叉+合并：start → llm → end, start → tool → end", () => {
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "start", target: "llm" },
      { id: "e2", source: "start", target: "tool" },
      { id: "e3", source: "llm", target: "end" },
      { id: "e4", source: "tool", target: "end" },
    ];
    const result = topologicalSort(nodes, edges);
    // start 必须在最前
    expect(result[0]).toBe("start");
    // end 必须在最后
    expect(result[result.length - 1]).toBe("end");
    // 所有节点都在结果中
    expect(result).toHaveLength(4);
    expect(result).toContain("llm");
    expect(result).toContain("tool");
  });

  it("无连线的孤立节点：每个节点入度为 0，均可执行", () => {
    const edges: WorkflowEdge[] = [];
    const result = topologicalSort(nodes, edges);
    expect(result).toHaveLength(4);
    expect(result).toContain("start");
    expect(result).toContain("end");
  });

  it("单节点：只有一个开始节点", () => {
    const singleNode = [nodes[0]];
    const result = topologicalSort(singleNode, []);
    expect(result).toEqual(["start"]);
  });

  it("三个节点串行：A → B → C 保证执行顺序", () => {
    const chainNodes: WorkflowNode[] = [
      { id: "A", type: "startNode", position: { x: 0, y: 0 }, data: {} },
      { id: "B", type: "llmNode", position: { x: 0, y: 100 }, data: {} },
      { id: "C", type: "endNode", position: { x: 0, y: 200 }, data: {} },
    ];
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
    ];
    const result = topologicalSort(chainNodes, edges);
    expect(result).toEqual(["A", "B", "C"]);
  });
});

describe("getParentOutput - 上游数据传递", () => {
  it("应该返回上游节点的输出", () => {
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "start", target: "llm" },
    ];
    const variables = { start: "用户输入", input: "默认输入" };
    const result = getParentOutput("llm", edges, variables);
    expect(result).toBe("用户输入");
  });

  it("没有上游节点时返回 input", () => {
    const edges: WorkflowEdge[] = [];
    const variables = { input: "默认输入" };
    const result = getParentOutput("llm", edges, variables);
    expect(result).toBe("默认输入");
  });

  it("上游节点没有输出时返回 input", () => {
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "start", target: "llm" },
    ];
    const variables = { input: "默认输入" };
    const result = getParentOutput("llm", edges, variables);
    expect(result).toBe("默认输入");
  });

  it("没有上游且没有 input 时返回空字符串", () => {
    const edges: WorkflowEdge[] = [];
    const variables = {};
    const result = getParentOutput("llm", edges, variables);
    expect(result).toBe("");
  });
});
