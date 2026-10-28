/**
 * Next.js 16 中 middleware 已改名 proxy（middleware.ts 弃用）。
 *
 * 这里只做「乐观检查」：有 session cookie 就放行，没有就重定向到登录页。
 * 不验签、不查库——真实鉴权在 lib/dal.ts 与会话感知的 API 路由里做。
 * 无 cookie 的伪造请求最多看到空页面，拿不到任何数据（接口会返回 401）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // 只保护页面路由；/login 与 /api/* 不经过这里
  matcher: ["/", "/upload/:path*", "/usage/:path*"],
};
