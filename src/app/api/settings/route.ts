import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { settingsRepo } from "@/server/db/repositories/settings";
import { usersRepo } from "@/server/db/repositories/users";

/** GET 当前用户设置（账号体系升级后同时返回账号信息，供设置页账号区使用） */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const row = settingsRepo.get(Number(user.id));
  const account = usersRepo.findById(Number(user.id));
  return NextResponse.json({
    data: {
      autoRefreshOnLogin: !!row.auto_refresh_on_login,
      refreshIntervalMin: row.refresh_interval_min,
      defaultLang: row.default_lang,
      obsidianVaultPath: row.obsidian_vault_path,
      account: {
        name: account?.name ?? "",
        email: account?.email ?? "",
        role: account?.role ?? "user",
        verified: !!account?.email_verified_at,
      },
    },
  });
}

const patchSchema = z.object({
  autoRefreshOnLogin: z.boolean().optional(),
  refreshIntervalMin: z.number().int().min(15).max(24 * 60).optional(),
  defaultLang: z.enum(["zh", "en"]).optional(),
  obsidianVaultPath: z.union([z.string().max(500), z.null()]).optional(),
});

/** PATCH 更新用户设置（登录自动刷新 / 刷新频率 / 语言 / Obsidian 目录预留） */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  const row = settingsRepo.update(Number(user.id), parsed.data);
  return NextResponse.json({
    data: {
      autoRefreshOnLogin: !!row.auto_refresh_on_login,
      refreshIntervalMin: row.refresh_interval_min,
      defaultLang: row.default_lang,
      obsidianVaultPath: row.obsidian_vault_path,
    },
  });
}
