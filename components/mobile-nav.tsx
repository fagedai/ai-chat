"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryToggle } from "@/components/sidebar";

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-12 border-t border-zinc-200 bg-white flex items-center justify-around z-50 shrink-0">
      <Link
        href="/"
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          isActive("/") ? "text-blue-500" : "text-zinc-400"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-[10px] mt-0.5">对话</span>
      </Link>

      <HistoryToggle mobile />

      <Link
        href="/upload"
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          isActive("/upload") ? "text-blue-500" : "text-zinc-400"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <span className="text-[10px] mt-0.5">知识库</span>
      </Link>

      <Link
        href="/workflow"
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          isActive("/workflow") ? "text-blue-500" : "text-zinc-400"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <line x1="5" y1="8" x2="12" y2="16" />
          <line x1="19" y1="8" x2="12" y2="16" />
        </svg>
        <span className="text-[10px] mt-0.5">工作流</span>
      </Link>
    </nav>
  );
}
