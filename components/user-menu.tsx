"use client";

import { useEffect, useState } from "react";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";

/**
 * 右上角的登录态标识 + 退出按钮。
 * 自行请求 /api/auth/me 判断登录态，避免根布局调用 cookies() 导致全站动态渲染。
 */
export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setEmail(data?.user?.email ?? null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  if (!email) return null;

  return (
    <div className="hidden sm:flex fixed top-2 right-3 z-50 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs text-zinc-600 shadow-sm backdrop-blur">
      <UserOutlined />
      <span className="max-w-[160px] truncate" title={email}>
        {email}
      </span>
      <span className="text-zinc-300">|</span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-blue-500 disabled:opacity-50"
        title="退出登录"
      >
        <LogoutOutlined />
        退出
      </button>
    </div>
  );
}
