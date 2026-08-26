import { NextResponse } from "next/server";
import { MODULES } from "@/lib/modules";

/** GET 模块注册表（导航由前端直接引用，预留模块前端可见入口但接口未开放） */
export async function GET() {
  return NextResponse.json({ data: MODULES });
}
