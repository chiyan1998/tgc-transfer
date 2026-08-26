"use client";

/**
 * 设置页「账号」卡片（账号体系升级）：
 * 昵称修改、邮箱（只读）+ 验证状态徽标、修改密码（旧密码校验）、退出登录。
 */
import { useState } from "react";
import { signOut } from "next-auth/react";

export interface AccountInfo {
  name: string;
  email: string;
  role: string;
  verified: boolean;
}

const input =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

export function AccountSettings({ account }: { account: AccountInfo }) {
  const [name, setName] = useState(account.name);
  const [nameMsg, setNameMsg] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const strongEnough = newPassword.length >= 8 && /[a-zA-Z]/.test(newPassword) && /\d/.test(newPassword);

  async function saveName() {
    setNameMsg("");
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    setNameMsg(res.ok ? "已保存" : String(data.error ?? "保存失败"));
    setTimeout(() => setNameMsg(""), 3000);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword !== confirmPassword) {
      setPwdMsg({ ok: false, text: "两次输入的新密码不一致" });
      return;
    }
    if (!strongEnough) {
      setPwdMsg({ ok: false, text: "新密码需至少 8 位，且同时包含字母与数字" });
      return;
    }
    setPwdLoading(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setPwdLoading(false);
    if (!res.ok) {
      setPwdMsg({ ok: false, text: String(data.error ?? "修改失败") });
      return;
    }
    setPwdMsg({ ok: true, text: "密码已更新" });
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPwdMsg(null), 3000);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">账号</h2>

      <div>
        <p className="mb-1.5 text-sm text-stone-600">邮箱</p>
        <div className="flex items-center gap-2">
          <input value={account.email} readOnly className={`${input} max-w-xs bg-stone-50 text-stone-500`} />
          {account.verified ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">已验证</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">未验证</span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm text-stone-600">昵称</p>
        <div className="flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} className={`${input} max-w-xs`} />
          <button
            onClick={saveName}
            disabled={!name.trim() || name.trim() === account.name}
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40"
          >
            保存
          </button>
          {nameMsg && <span className="text-xs text-stone-500">{nameMsg}</span>}
        </div>
      </div>

      <form onSubmit={changePassword} className="space-y-2">
        <p className="text-sm text-stone-600">修改密码</p>
        <input type="password" required placeholder="当前密码" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={input} />
        <input type="password" required placeholder="新密码（至少 8 位，含字母与数字）" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} />
        <input type="password" required placeholder="确认新密码" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={input} />
        {pwdMsg && (
          <p className={`text-sm ${pwdMsg.ok ? "text-green-600" : "text-red-600"}`}>{pwdMsg.text}</p>
        )}
        <button disabled={pwdLoading} className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
          {pwdLoading ? "提交中…" : "更新密码"}
        </button>
      </form>

      <div className="border-t border-stone-200 pt-4">
        <button
          onClick={() => signOut({ redirectTo: "/login" })}
          className="rounded-lg border border-stone-300 px-5 py-2 text-sm text-stone-600 hover:bg-stone-100"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
