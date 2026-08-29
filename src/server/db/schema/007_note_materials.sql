-- v7：读书笔记起步（信息流体验升级反馈 6）
-- 论文正文 / 附加材料上传落库记录，文件存 data/note-materials/YYYYMM/<uuid>.<ext>
CREATE TABLE IF NOT EXISTS note_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('main', 'attachment')),
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_note_materials_user ON note_materials(user_id, created_at);
