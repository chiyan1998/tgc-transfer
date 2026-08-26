import Link from "next/link";
import type { ModuleDef } from "@/lib/modules";

/** 预留模块占位页（architecture §4）：展示入口与规划说明 */
export function ReservedModule({ module }: { module: ModuleDef }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="mb-4 text-5xl">🐾</p>
      <h1 className="text-2xl font-bold">
        {module.label} · {module.labelEn}
      </h1>
      <p className="mt-3 text-stone-500">{module.description}</p>
      <p className="mt-6 inline-block rounded-full bg-stone-200 px-4 py-1.5 text-sm text-stone-600">
        模块规划中，敬请期待
      </p>
      <p className="mt-8">
        <Link href="/feed" className="text-amber-600 hover:underline">
          ← 返回文献集市
        </Link>
      </p>
    </div>
  );
}
