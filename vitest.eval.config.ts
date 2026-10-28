import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// RAG 评测需要真实数据库与 Embedding Key
dotenv.config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.eval.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
