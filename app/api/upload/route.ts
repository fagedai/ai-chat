import { NextRequest, NextResponse } from "next/server";
import { initDb, insertChunk } from "@/lib/db";
import { getEmbedding } from "@/lib/embedding";
import { chunkText } from "@/lib/chunker";
import mammoth from "mammoth";

/**
 * POST /api/upload
 * 接收文件 → 解析文本 → 切片 → 向量化 → 存入数据库
 * 支持格式：.txt, .md, .docx
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 初始化数据库（首次调用会建表）
    await initDb();

    // 2. 解析上传的文件
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "没有上传文件" }, { status: 400 });
    }

    // 3. 提取文件文本内容
    const text = await extractText(file);

    if (!text.trim()) {
      return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
    }

    // 4. 切片
    const chunks = chunkText(text);

    // 5. 逐片向量化并存入数据库
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      await insertChunk(file.name, i, chunks[i], embedding);
    }

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
