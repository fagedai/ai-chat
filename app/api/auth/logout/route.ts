import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * POST /api/auth/logout - 清除会话 cookie
 */
export async function POST() {
  const cookieStore = await cookies();
  // 用 set + maxAge:0 清理，确保 path 与写入时一致
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return NextResponse.json({ success: true });
}
