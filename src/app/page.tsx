import Image from "next/image";
import Link from "next/link";

export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <Image src="/tgc-mascot.png" alt="虎妞" width={160} height={160} className="rounded-3xl shadow-lg" />
      <h1 className="text-3xl font-bold">虎妞小猫学术信息中转站</h1>
      <p className="text-stone-500">TGC Transfer · Tiger Girl Cat Academia Information Transfer</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-amber-500 px-6 py-2.5 font-medium text-white hover:bg-amber-600"
        >
          登录
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-stone-300 px-6 py-2.5 font-medium hover:bg-stone-100"
        >
          注册
        </Link>
      </div>
    </main>
  );
}
