/**
 * 用户反馈提交（M2 迭代意见 2）：
 * multipart/formData：summary（必填）+ detail + files（图片/PDF，单文件 ≤10MB，最多 3 个）。
 * 附件落盘 data/uploads/YYYYMM/<uuid>.<ext>，相对路径数组入库。
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/api-utils";
import { dataDir } from "@/server/db/db-manager";
import { feedbacksRepo } from "@/server/db/repositories/feedbacks";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** 扩展名 → Content-Type 白名单（双保险：扩展名与 MIME 都要匹配） */
const ALLOWED: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  bmp: ["image/bmp"],
  pdf: ["application/pdf"],
};

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体必须是 multipart/form-data" }, { status: 400 });
  }

  const summary = String(form.get("summary") ?? "").trim();
  const detail = String(form.get("detail") ?? "").trim();
  if (!summary) return NextResponse.json({ error: "请填写问题概述" }, { status: 400 });
  if (summary.length > 200) return NextResponse.json({ error: "问题概述过长（≤200 字）" }, { status: 400 });
  if (detail.length > 5000) return NextResponse.json({ error: "详情描述过长（≤5000 字）" }, { status: 400 });

  const files = form.getAll("files").filter((v): v is File => v instanceof File);
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `附件最多 ${MAX_FILES} 个` }, { status: 400 });
  }

  const month = new Date().toISOString().slice(0, 7).replace("-", "");
  const uploadDir = path.join(dataDir(), "uploads", month);
  const saved: string[] = [];
  try {
    for (const f of files) {
      const ext = (f.name.split(".").pop() ?? "").toLowerCase();
      const mimes = ALLOWED[ext];
      if (!mimes || !mimes.includes(f.type)) {
        return NextResponse.json({ error: `不支持的附件类型：${f.name}（仅接受图片与 PDF）` }, { status: 400 });
      }
      if (f.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `附件过大：${f.name}（单文件 ≤10MB）` }, { status: 400 });
      }
      fs.mkdirSync(uploadDir, { recursive: true });
      const rel = `${month}/${randomUUID()}.${ext}`;
      const buf = Buffer.from(await f.arrayBuffer());
      fs.writeFileSync(path.join(dataDir(), "uploads", rel), buf);
      saved.push(rel);
    }
  } catch (e) {
    return NextResponse.json(
      { error: `附件保存失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  const id = feedbacksRepo.insert({ userId: user.id, summary, detail, attachments: saved });
  return NextResponse.json({ data: { id, attachments: saved.length } }, { status: 201 });
}
