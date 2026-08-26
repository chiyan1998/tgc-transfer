import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";

/**
 * POST 深度阅读（预留，见 product-design §4.2）：
 * 待用户上传阅读技能后接入，与阅读笔记平台共用 ReaderSkill 契约。
 */
export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(
    { error: "深度阅读功能尚未开放（等待阅读技能接入）" },
    { status: 501 }
  );
}
