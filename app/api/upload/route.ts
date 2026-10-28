import { NextRequest, NextResponse } from "next/server";
import { initDb, insertChunks, listDocuments } from "@/lib/db";
import { getEmbeddings } from "@/lib/embedding";
import { chunkText } from "@/lib/chunker";
import { sanitizeContent } from "@/lib/sanitizer";
import mammoth from "mammoth";
import { requireSession } from "@/lib/dal";

/** 单个文件大小上限（5MB），在解析 multipart 之前就要挡住 */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** multipart 边界、表单字段等额外开销的余量 */
const MULTIPART_OVERHEAD = 512 * 1024;
/** 单篇文档切片数量上限，防止一次性向 Embedding API 发送过大请求 */
const MAX_CHUNKS = 500;

/**
 * POST /api/upload
 * 接收文件 → 解析文本 → 切片 → 向量化 → 存入数据库
 * 支持格式：.txt, .md, .docx
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof Response) return session;

  try {
    // 1. 初始化数据库（进程内只执行一次）
    await initDb();

    // 2. 先看 Content-Length：超大请求不应进入 multipart 解析（否则整个文件先被读进内存）
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES + MULTIPART_OVERHEAD) {
      return NextResponse.json(
        { error: `文件过大，单个文件不能超过 ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // 3. 解析上传的文件
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "没有上传文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `文件过大，单个文件不能超过 ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // 4. 提取文件文本内容
    const text = await extractText(file);

    if (!text.trim()) {
      return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
    }

    // 安全检查：拦截 Prompt 注入攻击和超大文档
    const check = sanitizeContent(text);
    if (!check.safe) {
      return NextResponse.json({ error: check.reason }, { status: 403 });
    }

    // 5. 检查同名文件是否已存在（仅限当前用户的知识库）
    const existingDocs = await listDocuments(session.userId);
    if (existingDocs.some((d) => d.filename === file.name)) {
      return NextResponse.json(
        { error: `已存在同名文件「${file.name}」，请先删除同名文件再上传` },
        { status: 409 }
      );
    }

    // 6. 切片
    const chunks = chunkText(text);
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json(
        { error: `文档切片过多（${chunks.length}），请拆分后再上传` },
        { status: 413 }
      );
    }

    // 7. 一次批量向量化 + 事务写入
    // 写入放在事务里：任一切片失败整篇回滚，避免留下半篇文档占住文件名
    const embeddings = await getEmbeddings(chunks);
    await insertChunks(file.name, chunks, embeddings, session.userId);

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunks: chunks.length,
      message: `已处理 ${file.name}，共 ${chunks.length} 个片段`,
    });
  } catch (error) {
    console.error("上传处理失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "处理失败" },
      { status: 500 }
    );
  }
}

/**
 * 从文件中提取纯文本
 */
async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "txt":
    case "md":
      return await file.text();

    case "docx": {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    default:
      throw new Error(`不支持的文件格式: .${ext}（支持 .txt, .md, .docx）`);
  }
}
