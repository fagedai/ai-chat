/**
 * 前端统一 fetch 包装
 *
 * 任何接口返回 401 说明会话已失效，直接跳登录页，
 * 避免页面停留在半加载状态或反复弹错误提示。
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return res;
}
