"use client";

import Image from "next/image";
import { useState } from "react";
import { APP_NAME, AUTHOR, RELEASED_AT, VERSION } from "@/lib/version";
import { FeedbackModal } from "@/components/FeedbackModal";

/** 「关于」页（M2 迭代意见 2）：项目信息 + 作者 + 打赏占位 + 反馈入口 */
export default function AboutPage() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
        <Image
          src="/tgc-mascot.png"
          alt="虎妞小猫"
          width={160}
          height={160}
          className="mx-auto rounded-2xl shadow-sm"
        />
        <h1 className="mt-6 text-xl font-bold text-stone-800">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-stone-500">
          版本号 v{VERSION} · 上次版本更新 {RELEASED_AT}
        </p>

        <div className="mt-6 rounded-lg bg-stone-50 p-4 text-left text-sm">
          <p className="font-medium text-stone-700">作者信息</p>
          <ul className="mt-2 space-y-1 text-stone-600">
            <li>姓名：{AUTHOR.name}</li>
            <li>
              邮箱：
              <a href={`mailto:${AUTHOR.email}`} className="text-amber-700 hover:underline">
                {AUTHOR.email}
              </a>
            </li>
            <li>
              GitHub：
              <a href={AUTHOR.github} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
                {AUTHOR.github}
              </a>
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-stone-700">打赏支持</p>
          <div className="mt-3 flex items-start justify-center gap-10">
            <div>
              <Image
                src="/donate-weixin.png"
                alt="微信收款码"
                width={168}
                height={168}
                className="rounded-lg border border-stone-200 bg-white"
              />
              <p className="mt-1.5 text-xs font-medium text-green-600">微信</p>
            </div>
            <div>
              <Image
                src="/donate-alipay.png"
                alt="支付宝收款码"
                width={168}
                height={168}
                className="rounded-lg border border-stone-200 bg-white"
              />
              <p className="mt-1.5 text-xs font-medium text-blue-600">支付宝</p>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-stone-400">
            如果虎妞帮你省下了翻文献的时间，不妨 Buy me a coffee ☕️
            ——每一杯都会变成服务器的电费和摘要的 Token，让中转站跑得更久一点。
          </p>
        </div>

        <button
          onClick={() => setFeedbackOpen(true)}
          className="mt-8 rounded-lg bg-amber-500 px-6 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          我要反馈
        </button>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
