import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 原生模块不打进 bundle，在 Node 运行时 require（见 architecture §6）
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
};

export default nextConfig;
