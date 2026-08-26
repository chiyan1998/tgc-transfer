export async function register() {
  // 动态导入：避免 Node 专用依赖（better-sqlite3/rss-parser）被打进 Edge 构建；
  // NEXT_PHASE 守卫：构建/静态生成阶段不启动调度器，避免构建期网络抓取与进程挂起。
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.NEXT_PHASE) {
    const { startServerRuntime } = await import("@/server/scheduler");
    startServerRuntime();
  }
}
