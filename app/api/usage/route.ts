import { NextResponse } from "next/server";
import { requireSession } from "@/lib/dal";
import { initDb } from "@/lib/db";
import { getUsageSummary } from "@/lib/usage";

/**
 * GET /api/usage - 当前用户的用量与配额
 */
export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  try {
    await initDb();
    const summary = await getUsageSummary(session.userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("获取用量失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取失败" },
      { status: 500 }
    );
  }
}
