"use client";

/**
 * 设置页「用户管理」区（账号体系升级，仅 admin 可见）：
 * 用户表格（角色切换、验证状态徽标与手动标记已验证）+ 创建用户弹窗（一次性回显初始密码）。
 */
import { useCallback, useEffect, useState } from "react";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  verified: boolean;
  createdAt: string;
}

const input =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

export function AdminUsers({ selfId }: { selfId?: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [createdPassword, setCreatedPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setUsers(d?.data?.users ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function patchUser(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(String(data.error ?? "操作失败"));
      return;
    }
    load();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setCreatedPassword("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, name: newName, role: newRole }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setCreateMsg({ ok: false, text: String(data.error ?? "创建失败") });
      return;
    }
    setCreatedPassword(data.data.initialPassword);
    setCreateMsg({ ok: true, text: `账号 ${data.data.email} 创建成功` });
    setNewEmail("");
    setNewName("");
    setNewRole("user");
    load();
  }

  if (loading) return <p className="text-sm text-stone-400">加载用户列表…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">用户管理</h2>
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setCreateMsg(null);
            setCreatedPassword("");
          }}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
        >
          {showCreate ? "收起" : "创建用户"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createUser} className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <input type="email" required placeholder="邮箱" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={input} />
          <input placeholder="昵称（留空取邮箱前缀）" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={64} className={input} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "user")} className={input}>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          {createMsg && (
            <p className={`text-sm ${createMsg.ok ? "text-green-600" : "text-red-600"}`}>{createMsg.text}</p>
          )}
          {createdPassword && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              初始密码（仅显示一次，请线下告知用户，建议其登录后自行修改）：
              <code className="ml-1 select-all font-mono font-semibold">{createdPassword}</code>
            </p>
          )}
          <button disabled={creating} className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
            {creating ? "创建中…" : "创建账号（直接已验证）"}
          </button>
        </form>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
            <th className="py-2 pr-3">昵称</th>
            <th className="py-2 pr-3">邮箱</th>
            <th className="py-2 pr-3">角色</th>
            <th className="py-2 pr-3">验证状态</th>
            <th className="py-2">注册时间</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-stone-100">
              <td className="py-2 pr-3">{u.name}</td>
              <td className="py-2 pr-3 text-stone-500">{u.email}</td>
              <td className="py-2 pr-3">
                <select
                  value={u.role}
                  disabled={u.id === selfId}
                  onChange={(e) => patchUser(u.id, { role: e.target.value })}
                  className="rounded border border-stone-300 bg-white px-1.5 py-1 text-xs disabled:opacity-50"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="py-2 pr-3">
                {u.verified ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">已验证</span>
                ) : (
                  <button
                    onClick={() => patchUser(u.id, { verified: true })}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    title="点击手动标记为已验证"
                  >
                    未验证 · 标记
                  </button>
                )}
              </td>
              <td className="py-2 text-xs text-stone-400">{u.createdAt?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
