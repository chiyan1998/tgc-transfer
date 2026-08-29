/**
 * 读书笔记材料（信息流体验升级反馈 6）：论文正文 / 附加材料的上传记录仓库。
 * 文件落盘 data/note-materials/YYYYMM/<uuid>.<ext>，stored_path 存相对路径。
 */
import { getDb } from "@/server/db/db-manager";

export interface NoteMaterialRow {
  id: number;
  user_id: number;
  kind: "main" | "attachment";
  original_name: string;
  stored_path: string;
  size: number;
  created_at: string;
}

export const noteMaterialsRepo = {
  insert(input: {
    userId: number;
    kind: "main" | "attachment";
    originalName: string;
    storedPath: string;
    size: number;
  }): NoteMaterialRow {
    const info = getDb()
      .prepare(
        `INSERT INTO note_materials (user_id, kind, original_name, stored_path, size)
         VALUES (@user_id, @kind, @original_name, @stored_path, @size)`
      )
      .run({
        user_id: input.userId,
        kind: input.kind,
        original_name: input.originalName,
        stored_path: input.storedPath,
        size: input.size,
      });
    return this.findById(Number(info.lastInsertRowid))!;
  },
  findById(id: number): NoteMaterialRow | null {
    return (
      (getDb().prepare("SELECT * FROM note_materials WHERE id = ?").get(id) as NoteMaterialRow) ?? null
    );
  },
  listByUser(userId: number): NoteMaterialRow[] {
    return getDb()
      .prepare("SELECT * FROM note_materials WHERE user_id = ? ORDER BY id DESC")
      .all(userId) as NoteMaterialRow[];
  },
  delete(id: number): void {
    getDb().prepare("DELETE FROM note_materials WHERE id = ?").run(id);
  },
};
