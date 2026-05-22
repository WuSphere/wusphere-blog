"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { UserRole } from "@/lib/domain";

type AdminUserRow = {
  id: string;
  email: string;
  role: UserRole;
  level: number;
  exp: number;
  created_at: string;
};

type UserDraft = {
  role: UserRole;
  level: number;
};

export default function AdminUsersPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!supabase) {
      return;
    }

    setError("");
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(sessionError.message);
      setIsLoading(false);
      return;
    }

    if (!session) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (meError) {
      setError(meError.message);
      setIsLoading(false);
      return;
    }

    if (me?.role !== "admin") {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error: listError } = await supabase
      .from("users")
      .select("id, email, role, level, exp, created_at")
      .order("created_at", { ascending: false });

    if (listError) {
      setError(listError.message);
      setIsLoading(false);
      return;
    }

    const users = (data ?? []) as AdminUserRow[];
    setRows(users);
    setDrafts(
      Object.fromEntries(
        users.map((user) => [
          user.id,
          {
            role: user.role,
            level: user.level,
          },
        ])
      )
    );
    setIsLoading(false);
  };

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(task);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const updateDraft = (id: string, patch: Partial<UserDraft>) => {
    setDrafts((current) => {
      const previous = current[id] ?? { role: "member" as const, level: 1 };
      return {
        ...current,
        [id]: {
          ...previous,
          ...patch,
        },
      };
    });
  };

  const saveUser = async (id: string) => {
    if (!supabase) {
      return;
    }

    const draft = drafts[id];
    if (!draft) {
      return;
    }

    const nextLevel = Number.isFinite(draft.level) ? Math.max(1, Math.floor(draft.level)) : 1;

    setSavingId(id);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("users")
      .update({
        role: draft.role,
        level: nextLevel,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSavingId(null);
      return;
    }

    setMessage("用户权限已更新。");
    await loadUsers();
    setSavingId(null);
  };

  if (!supabase) {
    return <main className="app-shell p-8 text-rose-300">Supabase 环境变量未配置。</main>;
  }

  if (isLoading) {
    return <main className="app-shell p-8 text-slate-200">加载中...</main>;
  }

  if (!isAdmin) {
    return (
      <main className="app-shell mx-auto w-full max-w-3xl p-6 sm:p-10">
        <div className="glass-card rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-semibold">仅管理员可访问</h1>
          <p className="mt-3 text-slate-300">你当前不是 admin，无法编辑其他用户权限。</p>
          <div className="mt-6 flex justify-center gap-3 text-sm">
            <Link href="/dashboard" className="ghost-button rounded-xl px-4 py-2">返回控制台</Link>
            <Link href="/" className="neon-button rounded-xl px-4 py-2">回到首页</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell mx-auto w-full max-w-6xl px-5 py-8 sm:px-10">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 scanlines" />

      <header className="glass-card relative rounded-3xl p-6 sm:p-8">
        <p className="section-label">Admin Console</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold sm:text-4xl">
          <Users className="h-7 w-7 text-cyan-300" /> 用户权限管理
        </h1>
        <p className="mt-3 text-sm text-slate-300">可编辑 role 与 level，保存后即时生效。</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard" className="ghost-button rounded-xl px-4 py-2">控制台</Link>
          <Link href="/posts" className="ghost-button rounded-xl px-4 py-2">文章</Link>
        </div>
      </header>

      {error ? (
        <p className="mt-5 rounded-xl border border-rose-300/40 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-5 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{message}</p>
      ) : null}

      <section className="mt-6 space-y-3">
        {rows.map((user) => {
          const draft = drafts[user.id] ?? { role: user.role, level: user.level };
          return (
            <article key={user.id} className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-100">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-400">{user.id}</p>
                </div>
                <div className="hud-pill flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs uppercase tracking-[0.12em]">
                  <ShieldCheck className="h-3.5 w-3.5" /> EXP {user.exp}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[200px_160px_auto] sm:items-end">
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  角色 Role
                  <select
                    value={draft.role}
                    onChange={(event) => updateDraft(user.id, { role: event.target.value as UserRole })}
                    className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
                  >
                    <option value="member">member</option>
                    <option value="vip">vip</option>
                    <option value="admin">admin</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  等级 Level
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={draft.level}
                    onChange={(event) =>
                      updateDraft(user.id, {
                        level: Number(event.target.value),
                      })
                    }
                    className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
                  />
                </label>

                <button
                  type="button"
                  disabled={savingId === user.id}
                  onClick={() => saveUser(user.id)}
                  className="neon-button h-10 rounded-xl px-4 text-sm disabled:opacity-60"
                >
                  {savingId === user.id ? "保存中..." : "保存修改"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
