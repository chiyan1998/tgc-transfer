import { getDb } from "../db-manager";

export interface UserSettingsRow {
  user_id: number;
  auto_refresh_on_login: number;
  refresh_interval_min: number;
  default_lang: string;
  obsidian_vault_path: string | null;
}

export const settingsRepo = {
  get(userId: number): UserSettingsRow {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)").run(userId);
    return db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId) as UserSettingsRow;
  },
  update(
    userId: number,
    patch: Partial<{
      autoRefreshOnLogin: boolean;
      refreshIntervalMin: number;
      defaultLang: string;
      obsidianVaultPath: string | null;
    }>
  ): UserSettingsRow {
    const db = getDb();
    this.get(userId);
    if (patch.autoRefreshOnLogin !== undefined)
      db.prepare("UPDATE user_settings SET auto_refresh_on_login = ? WHERE user_id = ?").run(
        patch.autoRefreshOnLogin ? 1 : 0,
        userId
      );
    if (patch.refreshIntervalMin !== undefined)
      db.prepare("UPDATE user_settings SET refresh_interval_min = ? WHERE user_id = ?").run(
        patch.refreshIntervalMin,
        userId
      );
    if (patch.defaultLang !== undefined)
      db.prepare("UPDATE user_settings SET default_lang = ? WHERE user_id = ?").run(patch.defaultLang, userId);
    if (patch.obsidianVaultPath !== undefined)
      db.prepare("UPDATE user_settings SET obsidian_vault_path = ? WHERE user_id = ?").run(
        patch.obsidianVaultPath,
        userId
      );
    return this.get(userId);
  },
};
