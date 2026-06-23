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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
export function HistoryToggle() {
  const { sidebarOpen, toggleSidebar } = useSidebar();
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
