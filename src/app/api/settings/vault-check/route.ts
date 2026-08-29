/**
 * Obsidian vault 目录校验（信息流体验升级反馈 6）：
 * 服务端真实校验：目录存在 + 是目录 + 含 .obsidian 子目录。
 * 注意：仅在应用运行于用户本机时有效；云端部署无法访问用户本地目录。
 */
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";

const body = z.object({
  path: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数校验失败" }, { status: 422 });

  const p = parsed.data.path.trim();
  let stat: fs.Stats;
  try {
    stat = fs.statSync(p);
  } catch {
    return NextResponse.json({ data: { ok: false, reason: "目录不存在，请检查路径是否正确" } });
  }
  if (!stat.isDirectory()) {
    return NextResponse.json({ data: { ok: false, reason: "该路径不是目录，请选择 Obsidian 仓库所在的文件夹" } });
  }
  if (!fs.existsSync(path.join(p, ".obsidian"))) {
    return NextResponse.json({
      data: { ok: false, reason: "该目录下没有 .obsidian 文件夹，似乎不是一个 Obsidian 仓库（请选择仓库根目录）" },
    });
  }
  return NextResponse.json({ data: { ok: true, reason: "" } });
}
