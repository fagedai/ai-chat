import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  saveChat,
  listChats,
  getChat,
  deleteChat,
} from "@/lib/db";

/**
 * GET /api/chats - 获取对话列表
 * GET /api/chats?id=1 - 获取单个对话详情（含完整消息）
 */
export async function GET(req: NextRequest) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const chat = await getChat(Number(id));
      if (!chat) {
        return NextResponse.json({ error: "对话不存在" }, { status: 404 });
      }
      return NextResponse.json(chat);
    }

    const chats = await listChats();
    return NextResponse.json(chats);
  } catch (error) {
    console.error("获取对话列表失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取失败" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chats - 保存对话（新建或更新）
 * Body: { id?: number, title: string, messages: UIMessage[] }
 */
export async function POST(req: NextRequest) {
  try {
    await initDb();
    const { id, title, messages } = await req.json();
    const savedId = await saveChat(id || null, title || "新对话", messages);
    return NextResponse.json({ id: savedId, success: true });
  } catch (error) {
    console.error("保存对话失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chats?id=1 - 删除对话
 */
export async function DELETE(req: NextRequest) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
    }
    await deleteChat(Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除对话失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 }
    );
  }
}
