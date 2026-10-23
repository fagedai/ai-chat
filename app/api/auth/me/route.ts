import { NextResponse } from "next/server";
import { getSession } from "@/lib/dal";

/**
 * GET /api/auth/me - 返回当前登录用户，未登录返回 401
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.userId, email: session.email },
  });
}
