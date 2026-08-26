import { NextResponse } from "next/server";

/** 预留模块统一 501（architecture §4）：入口可见，接口待启动 */
export function moduleNotImplemented(moduleLabel: string) {
  return NextResponse.json(
    { error: `${moduleLabel}模块尚在规划中，敬请期待` },
    { status: 501 }
  );
}
