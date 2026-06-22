import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// 加载 .env.local 环境变量
dotenv.config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
