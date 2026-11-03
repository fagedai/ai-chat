import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { createUser, getUserByEmail, hashPassword } from "@/lib/auth";
import { validateEmail, validatePassword } from "@/lib/auth-validate";
import { SESSION_COOKIE, SESSION_MAX_AGE, encrypt } from "@/lib/session";
import { hit } from "@/lib/rate-limit";

// 同一 IP 10 分钟内最多注册 5 次，防批量建号与邮箱枚举。
// 注意：这里对「每一次请求」计数（含校验失败的），与登录接口不同——
// 登录只对「失败的密码验证」计数，因为撞库攻击正是靠大量失败尝试；
// 而注册的滥用向量是「批量创建账号」，任何请求都该计入。
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 10 * 60 * 1000;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: `注册过于频繁，请 ${Math.ceil(retryAfterSeconds / 60)} 分钟后再试` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/**
 * POST /api/auth/register
 * Body: { email, password }
 * 成功：写入 httpOnly session cookie（注册即登录）并返回用户信息
 */
export async function POST(req: NextRequest) {
  try {
    const ipKey = `register:${clientIp(req)}`;

    // 先计数再处理：保证校验失败 / 撞重复邮箱的请求也被限流，堵住绕过
    const attempt = hit(ipKey, REGISTER_LIMIT, REGISTER_WINDOW_MS);
    if (!attempt.allowed) return tooManyAttempts(attempt.retryAfterSeconds);

    await initDb();

    const body = await req.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
    }

    // 邮箱被占用：这里明确返回「已注册」，因为用户需要知道去登录而不是重试。
    // 与登录接口相反——登录对「不存在」和「密码错」给同一句模糊提示，防撞库；
    // 注册的枚举风险已由上面的 IP 限流兜住。
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已注册，请直接登录" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    // 注册即登录
    const token = await encrypt({ userId: user.id, email: user.email });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("注册失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 }
    );
  }
}
