import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "知识库问答 - RAG + DeepSeek",
  description: "基于 Next.js + DeepSeek + Pgvector 的 RAG 知识库问答系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <AntdRegistry>
          <div className="flex h-full">
            {/* 左侧导航栏 */}
            <nav className="w-14 border-r border-zinc-200 bg-white flex flex-col items-center py-4 gap-4 shrink-0">
              <Link
                href="/"
                className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                title="对话"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </Link>
              <Link
                href="/upload"
                className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                title="知识库"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </Link>
            </nav>

            {/* 主内容区 */}
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </AntdRegistry>
      </body>
    </html>
  );
}
