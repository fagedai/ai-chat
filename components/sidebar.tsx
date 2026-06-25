"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { HistoryOutlined } from "@ant-design/icons";

// ========== Context ==========
interface SidebarContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarOpen: true,
  toggleSidebar: () => {},
});

// ========== Provider ==========
export function SidebarProvider({ children }: { children: ReactNode }) {
  // 移动端默认收起侧边栏，桌面端默认展开
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

// ========== Hook ==========
export function useSidebar() {
  return useContext(SidebarContext);
}

// ========== 历史切换按钮（放在导航栏中） ==========
export function HistoryToggle({ mobile = false }: { mobile?: boolean }) {
  const { sidebarOpen, toggleSidebar } = useSidebar();

  if (mobile) {
    return (
      <button
        onClick={toggleSidebar}
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          sidebarOpen ? "text-blue-500" : "text-zinc-400"
        }`}
      >
        <HistoryOutlined style={{ fontSize: 22 }} />
        <span className="text-[10px] mt-0.5">历史</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleSidebar}
      title={sidebarOpen ? "收起历史侧边栏" : "展开历史侧边栏"}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
        sidebarOpen
          ? "bg-blue-50 text-blue-500"
          : "text-zinc-500 hover:bg-blue-50 hover:text-blue-500"
      }`}
    >
      <HistoryOutlined style={{ fontSize: 20 }} />
    </button>
  );
}
