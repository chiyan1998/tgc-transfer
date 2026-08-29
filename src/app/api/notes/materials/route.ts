/**
 * 读书笔记材料上传/列表（信息流体验升级反馈 6）：
 * multipart：kind=main 仅 .pdf/.epub；kind=attachment 仅 .pdf/.zip；单文件 ≤50MB。
 * 文件落盘 data/note-materials/YYYYMM/<uuid>.<ext>，记录入 note_materials。
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/api-utils";
import { dataDir } from "@/server/db/db-manager";
import { noteMaterialsRepo } from "@/server/db/repositories/note-materials";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** kind → 允许的扩展名（MIME 双保险校验） */
const ALLOWED: Record<"main" | "attachment", Record<string, string[]>> = {
  main: {
    pdf: ["application/pdf"],
    epub: ["application/epub+zip"],
  },
  attachment: {
    pdf: ["application/pdf"],
    zip: ["application/zip", "application/x-zip-compressed"],
  },
};
const KIND_LABEL: Record<string, string> = { main: "论文正文", attachment: "附加材料" };

/** GET 当前用户的笔记材料列表 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const items = noteMaterialsRepo.listByUser(Number(user.id)).map((r) => ({
    id: r.id,
    kind: r.kind,
    originalName: r.original_name,
    size: r.size,
    createdAt: r.created_at,
  }));
  return NextResponse.json({ data: { items } });
}

/** POST 上传单个材料文件（multipart：kind + file） */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体必须是 multipart/form-data" }, { status: 400 });
  }
  const kind = String(form.get("kind") ?? "");
  if (kind !== "main" && kind !== "attachment") {
    return NextResponse.json({ error: "kind 必须是 main 或 attachment" }, { status: 422 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mimes = ALLOWED[kind][ext];
  if (!mimes || !mimes.includes(file.type)) {
    return NextResponse.json(
      { error: `不支持的文件类型：${file.name}（${KIND_LABEL[kind]}仅接受 ${Object.keys(ALLOWED[kind]).map((e) => "." + e).join(" / ")}）` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `文件过大：${file.name}（单文件 ≤50MB）` }, { status: 400 });
  }

  const month = new Date().toISOString().slice(0, 7).replace("-", "");
  const dir = path.join(dataDir(), "note-materials", month);
  const rel = `${month}/${randomUUID()}.${ext}`;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dataDir(), "note-materials", rel), Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json(
      { error: `文件保存失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  const row = noteMaterialsRepo.insert({
    userId: Number(user.id),
    kind,
    originalName: file.name,
    storedPath: rel,
    size: file.size,
  });
  return NextResponse.json(
    { data: { id: row.id, kind: row.kind, originalName: row.original_name, size: row.size, createdAt: row.created_at } },
    { status: 201 }
  );
}
