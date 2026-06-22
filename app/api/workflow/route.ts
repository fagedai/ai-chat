import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  saveWorkflow,
  listWorkflows,
  getWorkflow,
  deleteWorkflow,
} from "@/lib/db";

/**
 * GET /api/workflow - 获取工作流列表
 * GET /api/workflow?id=1 - 获取单个工作流详情
 */
export async function GET(req: NextRequest) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const workflow = await getWorkflow(Number(id));
      if (!workflow) {
        return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
      }
      return NextResponse.json(workflow);
    }

    const workflows = await listWorkflows();
    return NextResponse.json(workflows);
  } catch (error) {
    console.error("获取工作流失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取失败" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow - 保存工作流（新增或更新）
 * Body: { id?: number, name: string, data: { nodes, edges } }
 */
export async function POST(req: NextRequest) {
  try {
    await initDb();
    const { id, name, data } = await req.json();
    const savedId = await saveWorkflow(id || null, name || "未命名工作流", data);
    return NextResponse.json({ id: savedId, success: true });
  } catch (error) {
    console.error("保存工作流失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflow?id=1 - 删除工作流
 */
export async function DELETE(req: NextRequest) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
    }
    await deleteWorkflow(Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除工作流失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 }
    );
  }
}
