/** 读书笔记材料删除：删库同时删文件（仅本人） */
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireUser } from "@/server/api-utils";
import { dataDir } from "@/server/db/db-manager";
import { noteMaterialsRepo } from "@/server/db/repositories/note-materials";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "参数校验失败" }, { status: 422 });

  const row = noteMaterialsRepo.findById(id);
  if (!row) return NextResponse.json({ error: "材料不存在" }, { status: 404 });
  if (row.user_id !== Number(user.id)) return NextResponse.json({ error: "无权删除该材料" }, { status: 403 });

  noteMaterialsRepo.delete(id);
  // 文件删除失败不影响记录删除（可能已手动清理），仅日志
  try {
    fs.rmSync(path.join(dataDir(), "note-materials", row.stored_path), { force: true });
  } catch (e) {
    console.warn(`[notes] 删除材料文件失败 id=${id}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return NextResponse.json({ data: { id } });
}
