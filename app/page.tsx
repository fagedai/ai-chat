"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Bubble, Sender, Welcome } from "@ant-design/x";
import { UserOutlined, RobotOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

export default function Chat() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const isLoading = status === "submitted" || status === "streaming";

  const onSubmit = (content: string) => {
    if (!content.trim()) return;
    sendMessage({ text: content });
    setInput("");
  };

  // 把 useChat 的消息映射成 Bubble.List 需要的 items 格式
  const bubbleItems = messages.map((m) => ({
    key: m.id,
    role: m.role,
    content: m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(""),
    // 最后一条 assistant 消息且正在流式传输时标记 streaming
    streaming:
      m.role === "assistant" &&
      m.id === messages[messages.length - 1]?.id &&
      status === "streaming",
  }));

  // 发送后、AI 开始回复前，显示加载动画
  if (status === "submitted") {
    bubbleItems.push({ key: "loading", role: "assistant", content: "", streaming: false });
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 顶部标题栏 */}
      <header className="flex items-center justify-center h-14 border-b border-zinc-200 bg-white shrink-0">
        <h1 className="text-base font-semibold">
          AI Chat{" "}
          <span className="text-xs font-normal text-zinc-400 ml-1">
            DeepSeek V4 Flash
          </span>
        </h1>
      </header>

      {/* 消息列表 */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-[60vh]">
              <Welcome
                icon={<RobotOutlined style={{ fontSize: 48, color: "#1677ff" }} />}
                title="AI Chat"
                description="基于 DeepSeek V4 Flash，有什么想聊的？"
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
                assistant: (item) => ({
                  placement: "start",
                  avatar: <RobotOutlined />,
                  loading: item.key === "loading",
                  typing: item.key !== "loading" ? { effect: 'typing', step: 5, interval: 50 } : undefined,
                  contentRender: (content: React.ReactNode) => (
                    <div className="markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">{children}</div>
                          ),
                        }}
                      >
                        {typeof content === "string" ? content : ""}
                      </ReactMarkdown>
                    </div>
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
  );
}
