import { NextResponse } from "next/server";
// Edge 环境仅用无数据库依赖的基础配置做会话解析（见 auth.base.ts）
import { baseAuth } from "@/server/auth.base";

const PUBLIC_PREFIXES = ["/login", "/register", "/verify-email", "/api/auth"];

export default baseAuth.auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const session = req.auth;

  if (!session && !isPublic && pathname !== "/") {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  if (session && (pathname === "/login" || pathname === "/register" || pathname === "/")) {
    return NextResponse.redirect(new URL("/feed", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
