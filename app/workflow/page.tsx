"use client";

import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Button,
  Input,
  Modal,
  List,
  Popconfirm,
  Space,
  Typography,
  Divider,
} from "antd";
import {
  SaveOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  RobotOutlined,
  ToolOutlined,
  PlayCircleFilled,
  StopOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;
const { Text, Title } = Typography;

// 节点执行状态
type NodeStatus = "idle" | "running" | "success" | "error";

// 默认节点（Start + End 作为初始节点）
const initialNodes: Node[] = [
  {
    id: "start-1",
    type: "startNode",
    position: { x: 250, y: 50 },
    data: { label: "开始" },
  },
  {
    id: "end-1",
    type: "endNode",
    position: { x: 250, y: 400 },
    data: { label: "结束" },
  },
];

const initialEdges: Edge[] = [];

// 状态边框颜色映射
const statusBorder: Record<NodeStatus, string> = {
  idle: "",
  running: "ring-2 ring-yellow-400 ring-offset-2",
  success: "ring-2 ring-green-400 ring-offset-2",
  error: "ring-2 ring-red-400 ring-offset-2",
};

// 自定义节点样式组件
// Handle 公共样式（内联，避免 Tailwind v4 兼容问题）
const handleStyle = { width: 12, height: 12, border: "2px solid white" };

function StartNode({ data }: { data: { label: string; status?: NodeStatus } }) {
  const s = (data.status || "idle") as NodeStatus;
  return (
    <div className={`px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium shadow-md border-2 border-green-600 min-w-[80px] text-center transition-all ${statusBorder[s]}`}>
      {s === "running" && <span className="mr-1 animate-spin inline-block">⟳</span>}
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#15803d" }} />
    </div>
  );
}

function EndNode({ data }: { data: { label: string; status?: NodeStatus } }) {
  const s = (data.status || "idle") as NodeStatus;
  return (
    <div className={`px-4 py-2 bg-red-500 text-white rounded-full text-sm font-medium shadow-md border-2 border-red-600 min-w-[80px] text-center transition-all ${statusBorder[s]}`}>
      <Handle type="target" position={Position.Top} style={{ ...handleStyle, background: "#b91c1c" }} />
      {s === "running" && <span className="mr-1 animate-spin inline-block">⟳</span>}
      {data.label}
    </div>
  );
}

function LLMNode({ data }: { data: { label: string; model?: string; prompt?: string; status?: NodeStatus } }) {
  const s = (data.status || "idle") as NodeStatus;
  return (
    <div className={`bg-white border-2 border-blue-400 rounded-lg shadow-md min-w-[160px] transition-all ${statusBorder[s]}`}>
      <Handle type="target" position={Position.Top} style={{ ...handleStyle, background: "#3b82f6" }} />
      <div className="bg-blue-400 text-white text-xs font-medium px-3 py-1 rounded-t-md flex items-center gap-1">
        {s === "running" && <span className="animate-spin inline-block">⟳</span>}
        {s === "success" && <span>✓</span>}
        {s === "error" && <span>✗</span>}
        LLM
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-gray-800">{data.label}</div>
        {data.model && (
          <div className="text-xs text-gray-500 mt-1">{data.model}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#3b82f6" }} />
    </div>
  );
}

function ToolNode({ data }: { data: { label: string; tool?: string; status?: NodeStatus } }) {
  const s = (data.status || "idle") as NodeStatus;
  return (
    <div className={`bg-white border-2 border-purple-400 rounded-lg shadow-md min-w-[160px] transition-all ${statusBorder[s]}`}>
      <Handle type="target" position={Position.Top} style={{ ...handleStyle, background: "#a855f7" }} />
      <div className="bg-purple-400 text-white text-xs font-medium px-3 py-1 rounded-t-md flex items-center gap-1">
        {s === "running" && <span className="animate-spin inline-block">⟳</span>}
        {s === "success" && <span>✓</span>}
        {s === "error" && <span>✗</span>}
        工具
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-gray-800">{data.label}</div>
        {data.tool && (
          <div className="text-xs text-gray-500 mt-1">{data.tool}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#a855f7" }} />
    </div>
  );
}

// 节点类型注册
const nodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  llmNode: LLMNode,
  toolNode: ToolNode,
};

function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, string>>({});
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflowName, setWorkflowName] = useState("未命名工作流");
  const [savedWorkflows, setSavedWorkflows] = useState<Array<{ id: number; name: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  // 连线处理
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
          },
          eds
        )
      ),
    [setEdges]
  );

  // 节点删除处理：保护开始和结束节点
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const protectedIds = nodes
        .filter((n) => n.type === "startNode" || n.type === "endNode")
        .map((n) => n.id);
      const hasProtected = deleted.some((n) => protectedIds.includes(n.id));
      if (hasProtected) {
        alert("开始/结束节点不能删除");
        return;
      }
      setNodes((nds) => nds.filter((n) => !deleted.some((d) => d.id === n.id)));
    },
    [nodes, setNodes]
  );

  // 边删除处理
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      setEdges((eds) => eds.filter((e) => !deleted.some((d) => d.id === e.id)));
    },
    [setEdges]
  );

  // 点击节点 → 选中（后续给右侧面板用）
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // 运行工作流（SSE 实时推送状态）
  const runWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setNodeOutputs({});

    // 重置所有节点状态
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" } }))
    );

    try {
      const res = await fetch("/api/workflow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges, input: userInput }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const result = JSON.parse(data) as {
              nodeId: string;
              status: NodeStatus;
              output?: string;
              error?: string;
            };

            // 更新节点状态
            setNodes((nds) =>
              nds.map((n) =>
                n.id === result.nodeId
                  ? { ...n, data: { ...n.data, status: result.status } }
                  : n
              )
            );

            // 记录输出
            if (result.output) {
              setNodeOutputs((prev) => ({
                ...prev,
                [result.nodeId]: result.output!,
              }));
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (error) {
      console.error("工作流执行失败:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // 从左侧拖入新节点
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      // 计算放置位置
      const bounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 80,
        y: event.clientY - bounds.top - 30,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: getDefaultData(type),
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // 清空画布（新建工作流）
  const clearCanvas = () => {
    setNodes(initialNodes);
    setEdges([]);
    setSelectedNode(null);
    setNodeOutputs({});
    setWorkflowId(null);
    setWorkflowName("未命名工作流");
  };

  // 保存工作流到 Supabase 数据库
  const saveWorkflow = async () => {
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workflowId,
          name: workflowName,
          data: { nodes, edges },
        }),
      });
      const result = await res.json();
      if (result.success) {
        setWorkflowId(result.id);
        alert(`工作流已保存（ID: ${result.id}）`);
      }
    } catch (error) {
      console.error("保存失败:", error);
      alert("保存失败，请检查终端错误");
    }
  };

  // 加载已保存的工作流列表
  const loadWorkflowList = async () => {
    try {
      const res = await fetch("/api/workflow");
      const list = await res.json();
      setSavedWorkflows(list);
    } catch (error) {
      console.error("加载工作流列表失败:", error);
    }
  };

  // 加载指定工作流
  const loadWorkflow = async (id: number) => {
    try {
      const res = await fetch(`/api/workflow?id=${id}`);
      const workflow = await res.json();
      if (workflow?.data) {
        setNodes(workflow.data.nodes || []);
        setEdges(workflow.data.edges || []);
        setWorkflowId(workflow.id);
        setWorkflowName(workflow.name);
        setNodeOutputs({});
        setSelectedNode(null);
      }
    } catch (error) {
      console.error("加载工作流失败:", error);
    }
  };

  // 删除工作流
  const removeWorkflow = async (id: number) => {
    try {
      await fetch(`/api/workflow?id=${id}`, { method: "DELETE" });
      loadWorkflowList();
      if (workflowId === id) {
        clearCanvas();
      }
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  // 加载弹窗状态
  const [loadModalOpen, setLoadModalOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="h-14 border-b border-zinc-200 bg-white flex items-center px-4 gap-2 shrink-0">
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          placeholder="工作流名称"
          variant="borderless"
          className="!w-40 !text-sm !font-semibold"
        />
        {workflowId && (
          <Text type="secondary" className="!text-xs">#{workflowId}</Text>
        )}
        <Divider type="vertical" />
        <Space size={8}>
          <Button icon={<SaveOutlined />} onClick={saveWorkflow} type="primary">
            保存
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => { loadWorkflowList(); setLoadModalOpen(true); }}
          >
            加载
          </Button>
          <Button
            icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
            onClick={runWorkflow}
            disabled={isRunning}
            type={isRunning ? "default" : "primary"}
            danger={!isRunning}
          >
            {isRunning ? "运行中..." : "运行"}
          </Button>
          <Button icon={<PlusOutlined />} onClick={clearCanvas}>
            新建
          </Button>
        </Space>
        <div className="flex-1" />
        <Text type="secondary" className="!text-xs">
          {nodes.length} 个节点 · {edges.length} 条连线
        </Text>
      </div>

      {/* 加载工作流弹窗 */}
      <Modal
        title="已保存的工作流"
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={500}
      >
        {savedWorkflows.length === 0 ? (
          <div className="text-center py-8">
            <Text type="secondary">暂无已保存的工作流</Text>
          </div>
        ) : (
          <List
            dataSource={savedWorkflows}
            renderItem={(w) => (
              <List.Item
                key={w.id}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="确定删除这个工作流？"
                    onConfirm={() => removeWorkflow(w.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <a
                      onClick={() => { loadWorkflow(w.id); setLoadModalOpen(false); }}
                      className="!text-blue-600"
                    >
                      {w.name} <Text type="secondary" className="!text-xs">#{w.id}</Text>
                    </a>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      {/* 三栏布局 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧：节点库 */}
        <div className="w-48 border-r border-zinc-200 bg-white p-3 shrink-0 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-500 mb-3 uppercase">节点库</div>

          <NodeLibraryItem type="startNode" label="开始" color="green" />
          <NodeLibraryItem type="llmNode" label="LLM" color="blue" />
          <NodeLibraryItem type="toolNode" label="工具" color="purple" />
          <NodeLibraryItem type="endNode" label="结束" color="red" />

          {/* 用户输入区 */}
          <div className="mt-6 border-t border-zinc-200 pt-4">
            <div className="text-xs font-semibold text-zinc-500 mb-2 uppercase">输入数据</div>
            <textarea
              className="w-full h-24 text-xs border border-zinc-300 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="输入工作流的起始数据..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
          </div>
        </div>

        {/* 中间：画布 */}
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            selectionOnDrag
            selectNodesOnDrag
            multiSelectionKeyCode="Shift"
            deleteKeyCode={["Delete", "Backspace"]}
            fitView
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>

        {/* 右侧：属性 + 输出面板 */}
        <div className="w-64 border-l border-zinc-200 bg-white p-3 shrink-0 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-500 mb-3 uppercase">
            {selectedNode ? "属性配置" : "运行日志"}
          </div>
          {selectedNode ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-zinc-800">
                {selectedNode.data.label as string}
              </div>
              <div className="text-xs text-zinc-400">
                类型: {selectedNode.type}
              </div>
              <div className="text-xs text-zinc-400">
                ID: {selectedNode.id}
              </div>

              {/* 节点执行状态 */}
              {(selectedNode.data.status as NodeStatus) && (
                <div className={`text-xs font-medium px-2 py-1 rounded ${
                  selectedNode.data.status === "running" ? "bg-yellow-50 text-yellow-700" :
                  selectedNode.data.status === "success" ? "bg-green-50 text-green-700" :
                  selectedNode.data.status === "error" ? "bg-red-50 text-red-700" : ""
                }`}>
                  状态: {selectedNode.data.status as string}
                </div>
              )}

              {/* 节点输出 */}
              {nodeOutputs[selectedNode.id] && (
                <div className="mt-2">
                  <div className="text-xs font-medium text-zinc-600 mb-1">输出结果:</div>
                  <div className="text-xs bg-zinc-50 border border-zinc-200 rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                    {nodeOutputs[selectedNode.id]}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* 运行日志：显示所有节点的输出摘要 */}
              {Object.keys(nodeOutputs).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(nodeOutputs).map(([nodeId, output]) => {
                    const node = nodes.find((n) => n.id === nodeId);
                    return (
                      <div key={nodeId} className="text-xs border border-zinc-200 rounded p-2">
                        <div className="font-medium text-zinc-700 mb-1">
                          {node?.data.label as string || nodeId}
                        </div>
                        <div className="text-zinc-500 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
                          {output.slice(0, 200)}{output.length > 200 ? "..." : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-zinc-400 mt-8 text-center">
                  点击节点查看属性<br />或运行工作流查看结果
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 左侧节点库的单个可拖拽项
function NodeLibraryItem({
  type,
  label,
  color,
}: {
  type: string;
  label: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green: "bg-green-50 border-green-300 text-green-700",
    blue: "bg-blue-50 border-blue-300 text-blue-700",
    purple: "bg-purple-50 border-purple-300 text-purple-700",
    red: "bg-red-50 border-red-300 text-red-700",
  };

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={`px-3 py-2 mb-2 border rounded cursor-grab active:cursor-grabbing text-xs font-medium ${colorMap[color] || colorMap.blue}`}
      draggable
      onDragStart={onDragStart}
    >
      {label}
    </div>
  );
}

// 获取节点类型的默认数据
function getDefaultData(type: string): Record<string, unknown> {
  switch (type) {
    case "startNode":
      return { label: "开始" };
    case "endNode":
      return { label: "结束" };
    case "llmNode":
      return { label: "LLM 节点", model: "deepseek-v4-flash", prompt: "" };
    case "toolNode":
      return { label: "工具节点", tool: "知识库检索" };
    default:
      return { label: "未知节点" };
  }
}

export default function WorkflowPage() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
