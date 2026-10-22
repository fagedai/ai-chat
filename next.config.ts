import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CloudBase 云托管：生成独立运行产物，镜像更小、冷启动更快
  output: "standalone",
  // 容器内不做图片优化，避免 sharp 在部署环境的运行时差异
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
