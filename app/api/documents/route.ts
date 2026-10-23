import { NextRequest, NextResponse } from "next/server";
import { initDb, listDocuments, deleteDocument } from "@/lib/db";
import { requireSession } from "@/lib/dal";

/**
 * GET /api/documents
 * 获取所有已上传的文档列表
 */
export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  try {
    await initDb();
    const docs = await listDocuments(session.userId);
    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error("获取文档列表失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents?filename=xxx
 * 删除指定文档的所有切片
 */
export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof Response) return session;

  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "缺少文件名" }, { status: 400 });
    }

    await initDb();
    const deleted = await deleteDocument(filename, session.userId);
    if (deleted === 0) {
      // 不存在与无权限返回同一结果，不泄露他人数据是否存在
      return NextResponse.json(
        { error: "文件不存在或无权访问" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已删除 ${filename}`,
    });
  } catch (error) {
    console.error("删除文档失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 }
    );
  }
}
