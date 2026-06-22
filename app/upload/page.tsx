"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import {
  DeleteOutlined,
  InboxOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { message, Spin } from "antd";

interface Document {
  filename: string;
  chunk_count: number;
  uploaded_at: string;
}

async function fetchDocs(): Promise<Document[]> {
  try {
    const res = await fetch("/api/documents");
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export default function UploadPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  // 刷新文档列表
  const refresh = useCallback(() => {
    startTransition(async () => {
      const docs = await fetchDocs();
      setDocuments(docs);
      setLoaded(true);
    });
  }, []);

  // 首次加载文档列表
  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, []);

  // 上传文件
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md", "docx"].includes(ext || "")) {
      message.error("仅支持 .txt、.md、.docx 格式");
      return;
    }

    setUploading(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        message.success(data.message);
        refresh();
      } else {
        message.error(data.error || "上传失败");
      }
    } catch {
      message.error("上传失败，请检查网络连接");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  // 删除文档
  const handleDelete = async (filename: string) => {
    if (!confirm(`确定删除「${filename}」及其所有片段？`)) return;

    try {
      const res = await fetch(
        `/api/documents?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        message.success(`已删除 ${filename}`);
        refresh();
      } else {
        const data = await res.json();
        message.error(data.error || "删除失败");
      }
    } catch {
      message.error("删除失败");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between h-14 px-6 border-b border-zinc-200 bg-white shrink-0">
        <h1 className="text-base font-semibold">
          知识库管理{" "}
          <span className="text-xs font-normal text-zinc-400 ml-1">
            上传文档，构建 RAG 知识问答
          </span>
        </h1>
        <button
          onClick={refresh}
          className="text-zinc-400 hover:text-blue-500 transition-colors"
          title="刷新列表"
        >
          <ReloadOutlined />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 上传区域 */}
          <div className="border-2 border-dashed border-zinc-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors relative">
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Spin indicator={<LoadingOutlined spin />} size="large" />
                <p className="text-zinc-500">正在处理 {uploading}...</p>
                <p className="text-xs text-zinc-400">
                  首次使用会下载 Embedding 模型（约 90MB），请耐心等待
                </p>
              </div>
            ) : (
              <>
                <InboxOutlined style={{ fontSize: 48, color: "#8c8c8c" }} />
                <p className="mt-3 text-zinc-600">点击选择文件上传</p>
                <p className="text-xs text-zinc-400 mt-1">
                  支持 .txt、.md、.docx 格式
                </p>
                <input
                  type="file"
                  accept=".txt,.md,.docx"
                  onChange={handleUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </>
            )}
          </div>

          {/* 文档列表 */}
          <div>
            <h2 className="text-sm font-medium text-zinc-700 mb-3">
              已上传文档（{documents.length}）
            </h2>

            {pending && !loaded ? (
              <div className="text-center py-8">
                <Spin />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">
                <FileTextOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <p>还没有上传任何文档</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.filename}
                    className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileTextOutlined className="text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">{doc.filename}</p>
                        <p className="text-xs text-zinc-400">
                          {doc.chunk_count} 个片段 ·{" "}
                          {new Date(doc.uploaded_at).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.filename)}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                      title="删除文档"
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
