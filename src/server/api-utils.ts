import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

/** 取当前登录用户 id；未登录返回 null */
export async function requireUser(): Promise<{ id: number; role: string } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return { id: Number(session.user.id), role: session.user.role };
}

/** 取当前管理员；未登录 401、非 admin 403 */
export async function requireAdmin(): Promise<{ id: number; role: string } | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
  }
  return user;
}
