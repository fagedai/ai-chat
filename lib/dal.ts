/**
 * 数据访问层（Data Access Layer）中的会话校验
 *
 * 用 React cache() 记忆化：同一次请求内多次调用只读一次 cookie、验一次签。
 * 注意：未登录时返回 null 而不是 redirect，
 * 因为 API 路由需要返回 401 JSON，不能把 fetch 请求 302 到登录页。
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decrypt, type SessionPayload } from "./session";

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  // Next 16：cookies() 是异步的
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return (await decrypt(token)) ?? null;
});

/**
 * API 路由用：拿不到会话时直接返回 401 响应。
 * 用法：const session = await requireSession(); if (!session) return session;
 */
export async function requireSession(): Promise<SessionPayload | Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "未登录或登录已过期" }, { status: 401 });
  }
  return session;
}
