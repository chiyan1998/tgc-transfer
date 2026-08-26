"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * 认证页共享布局（账号体系升级）：
 * 桌面端左右分栏——左侧品牌区（吉祥物 + 平台名 + 定位），右侧白色卡片放表单；
 * 移动端单列（品牌区压缩置顶）。
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100 px-4 py-10">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-lg md:flex-row">
        {/* 品牌区 */}
        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-amber-100 to-orange-50 px-8 py-10 text-center md:w-2/5">
          <Image src="/tgc-mascot.png" alt="虎妞吉祥物" width={180} height={180} priority className="rounded-full shadow-md" />
          <h1 className="mt-5 text-xl font-bold text-stone-800">虎妞小猫学术信息中转站</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            TGC Transfer · 订阅期刊 / arXiv / NBER，
            自动聚合与中文概要，让文献追着你跑。
          </p>
          <p className="mt-4 text-xs text-stone-400">{isLogin ? "欢迎回来，继续今天的文献之旅" : "加入虎妞，让文献自己找上门"}</p>
        </div>
        {/* 表单区 */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">{children}</div>
      </div>
    </main>
  );
}
