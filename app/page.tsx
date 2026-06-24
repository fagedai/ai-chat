"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Bubble, Sender, Welcome } from "@ant-design/x";
import {
  UserOutlined,
  RobotOutlined,
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  BookOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm, Empty, Spin } from "antd";
import { useSidebar } from "@/components/sidebar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

interface ChatSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

// RAG 检索数据类型
interface RagData {
  steps: Array<{ label: string; detail?: string }>;
  sources: Array<{
    index: number;
    filename: string;
    similarity: string;
    chunkIndex: number;
  }>;
  fallback: boolean;
}

// RAG 检索折叠面板（类似 thinking 模式）
// 受控组件：展开/折叠状态由父组件管理，避免组件重建时丢失状态
function RagRetrievalPanel({
  data,
  expanded,
  onToggle,
}: {
  data: RagData;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden text-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 transition-colors"
      >
        <span className="text-zinc-500">
          {data.fallback ? <FileSearchOutlined /> : <BookOutlined />}
        </span>
        <span className="font-medium text-zinc-600">
          {data.fallback ? "知识库检索（未命中）" : "知识库检索"}
        </span>
        <span className="ml-auto text-zinc-400 text-xs flex items-center gap-1">
          {expanded ? "收起" : "展开"}
          {expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-zinc-200 space-y-1">
          {data.steps.map((step, i) => (
            <div key={i} className="text-zinc-500 text-xs flex items-start gap-1">
              <CheckCircleOutlined className="text-green-500 shrink-0 mt-0.5" style={{ fontSize: 12 }} />
              <span>{step.label}</span>
            </div>
          ))}
          {data.sources.length > 0 && (
            <div className="pt-1">
              <div className="text-zinc-400 text-xs mb-1 flex items-center gap-1">
                <FileTextOutlined style={{ fontSize: 12 }} />
                参考来源：
              </div>
              {data.sources.map((src) => (
                <div key={src.index} className="text-zinc-500 text-xs pl-2">
                  [{src.index}] {src.filename} · 第{src.chunkIndex}段 · {src.similarity}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const { messages, sendMessage, status, setMessages } = useChat();
  const [input, setInput] = useState("");
  const [chatList, setChatList] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  // RAG 面板展开状态：记录用户手动操作过的消息 ID
  // 未记录的消息使用默认逻辑：streaming 时展开，否则折叠
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});

  const { sidebarOpen } = useSidebar();

  const isLoading = status === "submitted" || status === "streaming";

  // 自动保存用的 ref
  const prevStatusRef = useRef(status);
  const currentChatIdRef = useRef(currentChatId);

  // 保持 ref 与 state 同步
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // 获取对话列表
  const fetchChatList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChatList(data);
      }
    } catch (e) {
      console.error("获取对话列表失败:", e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // 保存当前对话到数据库
  const saveCurrentChat = useCallback(async () => {
    try {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("")
            .slice(0, 20)
        : "新对话";

      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentChatIdRef.current,
          title,
          messages,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!currentChatIdRef.current) {
          setCurrentChatId(data.id);
        }
        fetchChatList();
      }
    } catch (e) {
      console.error("保存对话失败:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, fetchChatList]);

  // 页面加载时获取对话列表
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchChatList();
  }, []);

  // 自动保存：检测 AI 回复完成（streaming → ready）
  useEffect(() => {
    if (
      prevStatusRef.current === "streaming" &&
      status === "ready" &&
      messages.length > 0
    ) {
      saveCurrentChat();
    }
    prevStatusRef.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, saveCurrentChat]);

  // 新建对话
  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setInput("");
  };

  // 加载历史对话
  const handleSelectChat = async (id: number) => {
    if (isLoading) return;
    setLoadingChat(true);
    try {
      const res = await fetch(`/api/chats?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        // JSONB 可能返回字符串，需手动 parse
        let rawMessages = data.messages;
        if (typeof rawMessages === "string") {
          rawMessages = JSON.parse(rawMessages);
        }
        // 确保每条消息都有 parts 字段，同时保留 metadata（RAG 检索数据）
        const safeMessages = (rawMessages || []).map((m: { id?: string; role?: string; parts?: unknown[]; content?: string; metadata?: unknown }, i: number) => ({
          id: m.id || `msg-${Date.now()}-${i}`,
          role: m.role || "user",
          parts: Array.isArray(m.parts) ? m.parts : (m.content ? [{ type: "text", text: m.content }] : []),
          // 保留 metadata（包含 RAG 检索过程数据）
          ...(m.metadata ? { metadata: m.metadata } : {}),
        }));
        setMessages(safeMessages);
        setCurrentChatId(id);
      }
    } catch (e) {
      console.error("加载对话失败:", e);
    } finally {
      setLoadingChat(false);
    }
  };

  // 删除对话
  const handleDeleteChat = async (id: number) => {
    try {
      await fetch(`/api/chats?id=${id}`, { method: "DELETE" });
      if (currentChatId === id) {
        handleNewChat();
      }
      fetchChatList();
    } catch (e) {
      console.error("删除对话失败:", e);
    }
  };

  const onSubmit = (content: string) => {
    if (!content.trim()) return;
    sendMessage({ text: content });
    setInput("");
  };

  // 把 useChat 的消息映射成 Bubble.List 需要的 items 格式
  // parts 可能在从数据库恢复时为 undefined，需做防御性检查
  const bubbleItems = messages.map((m) => {
    const isLastAssistant =
      m.role === "assistant" &&
      m.id === messages[messages.length - 1]?.id;
    // 面板展开逻辑：用户手动操作过用用户值，否则 streaming 时展开、否则折叠
    const panelExpanded =
      m.id in expandedPanels
        ? expandedPanels[m.id]
        : isLastAssistant && status === "streaming";
    return {
      key: m.id,
      role: m.role,
      content: (m.parts || [])
        .filter((p: { type: string }) => p.type === "text")
        .map((p: { type: string; text?: string }) => p.text || "")
        .join(""),
      streaming: isLastAssistant && status === "streaming",
      // RAG 检索数据（来自后端 messageMetadata）
      ragRetrieval: (m as { metadata?: { ragRetrieval?: RagData } }).metadata
        ?.ragRetrieval,
      panelExpanded,
    };
  });

  // 发送后、AI 开始回复前，显示加载动画
  if (status === "submitted") {
    bubbleItems.push({
      key: "loading",
      role: "assistant",
      content: "",
      streaming: false,
      ragRetrieval: undefined,
      panelExpanded: false,
    });
  }

  return (
    <div className="flex h-screen">
      {/* 左侧对话历史侧边栏（可收缩） */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* 新建对话按钮 */}
        <div className="p-3 border-b border-zinc-200">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={handleNewChat}
          >
            新建对话
          </Button>
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Spin />
            </div>
          ) : chatList.length === 0 ? (
            <Empty
              description="暂无对话"
              className="mt-8"
            />
          ) : (
            <div className="py-1">
              {chatList.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center justify-between cursor-pointer transition-colors hover:bg-zinc-100 px-3 py-2.5 ${
                    currentChatId === chat.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <MessageOutlined className="text-zinc-400 shrink-0" />
                    <span className="truncate text-sm">{chat.title}</span>
                  </div>
                  <Popconfirm
                    title="确定删除这个对话？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* 右侧聊天区域 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 顶部标题栏 */}
        <header className="flex items-center justify-center h-14 border-b border-zinc-200 bg-white shrink-0">
          <h1 className="text-base font-semibold">
            知识库问答{" "}
            <span className="text-xs font-normal text-zinc-400 ml-1">
              RAG + Qwen2.5-32B
            </span>
          </h1>
        </header>

        {/* 消息列表 */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            {loadingChat ? (
              <div className="flex justify-center items-center h-[60vh]">
                <Spin size="large" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-[60vh]">
                <Welcome
                  icon={
                    <RobotOutlined style={{ fontSize: 48, color: "#1677ff" }} />
                  }
                  title="知识库问答"
                  description="上传文档后提问，AI 会基于你的知识库回答。先去左侧「知识库」上传文档吧！"
                />
              </div>
            ) : (
              <Bubble.List
                autoScroll
                role={{
                  user: {
                    placement: "end",
                    variant: "filled",
                    avatar: <UserOutlined />,
                    shape: "round",
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  assistant: (item: {
                    key: string | number;
                    streaming?: boolean;
                    ragRetrieval?: RagData;
                    panelExpanded?: boolean;
                  }) => ({
                    placement: "start",
                    avatar: <RobotOutlined />,
                    loading: item.key === "loading",
                    typing:
                      item.key !== "loading"
                        ? { effect: "typing", step: 5, interval: 50 }
                        : undefined,
                    contentRender: (content: React.ReactNode) => (
                      <>
                        {/* RAG 检索折叠面板 */}
                        {item.ragRetrieval && (
                          <RagRetrievalPanel
                            data={item.ragRetrieval}
                            expanded={!!item.panelExpanded}
                            onToggle={() =>
                              setExpandedPanels((prev) => ({
                                ...prev,
                                [item.key]: !item.panelExpanded,
                              }))
                            }
                          />
                        )}
                        <div className="markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-2">
                                  {children}
                                </div>
                              ),
                            }}
                          >
                            {typeof content === "string" ? content : ""}
                          </ReactMarkdown>
                        </div>
                      </>
                    ),
                  }),
                }}
                items={bubbleItems}
              />
            )}
          </div>
        </main>

        {/* 底部输入区 */}
        <footer className="border-t border-zinc-200 bg-white p-4 shrink-0">
          <div className="max-w-2xl mx-auto">
            <Sender
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              loading={isLoading}
              placeholder="输入消息，按 Enter 发送..."
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
