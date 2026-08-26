"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MODULES } from "@/lib/modules";

/** 应用壳：左侧导航（由模块注册表驱动）+ 内容区 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 p-4">
          <Image src="/tgc-mascot.png" alt="虎妞" width={44} height={44} className="rounded-xl" />
          <div>
            <p className="font-bold leading-tight">虎妞中转站</p>
            <p className="text-xs text-stone-500">TGC Transfer</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {MODULES.map((m) => {
            const active = pathname === m.route || pathname.startsWith(m.route + "/");
            return (
              <Link
                key={m.key}
                href={m.route}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-amber-100 font-medium text-amber-800" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <span>{m.label}</span>
                {m.status === "planned" && (
                  <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">规划中</span>
                )}
              </Link>
            );
          })}
          <Link
            href="/sources"
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              pathname.startsWith("/sources") ? "bg-amber-100 font-medium text-amber-800" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <span>订阅中心</span>
          </Link>
          <Link
            href="/settings"
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              pathname.startsWith("/settings") ? "bg-amber-100 font-medium text-amber-800" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <span>设置</span>
          </Link>
          <Link
            href="/about"
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              pathname.startsWith("/about") ? "bg-amber-100 font-medium text-amber-800" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <span>关于</span>
          </Link>
        </nav>
        <div className="border-t border-stone-200 p-4 text-sm">
          <p className="truncate text-stone-600">{session?.user?.email ?? ""}</p>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="mt-2 w-full rounded-lg border border-stone-300 py-1.5 text-stone-600 hover:bg-stone-100"
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
