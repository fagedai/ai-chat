import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { ensureDemoUser, getUserByEmail, verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, encrypt } from "@/lib/session";
import { hit, isLimited, reset } from "@/lib/rate-limit";

// 同一 IP 10 分钟内最多失败 5 次，防止撞库
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: `尝试次数过多，请 ${Math.ceil(retryAfterSeconds / 60)} 分钟后再试` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * 成功：写入 httpOnly session cookie 并返回用户信息
 */
export async function POST(req: NextRequest) {
  try {
    const ipKey = `login:${clientIp(req)}`;
    const precheck = isLimited(ipKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!precheck.allowed) return tooManyAttempts(precheck.retryAfterSeconds);

    await initDb();

    const body = await req.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    // 本版只开放演示账号：首次登录时按需播种
    await ensureDemoUser();

    const user = await getUserByEmail(email);
    // 用户不存在与密码错误返回同一句，避免暴露账号是否存在
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      const attempt = hit(ipKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
      if (!attempt.allowed) return tooManyAttempts(attempt.retryAfterSeconds);
      return NextResponse.json(
        { error: "邮箱或密码错误", remainingAttempts: attempt.remaining },
        { status: 401 }
      );
    }

    // 登录成功，清空该 IP 的失败计数
    reset(ipKey);

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
    console.error("登录失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登录失败" },
      { status: 500 }
    );
  }
}
