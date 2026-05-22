"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, ChevronRight, Radar, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { UserProfile } from "@/lib/domain";
import { getLevelFromExp, getNextLevelExp, getProgressPercent } from "@/lib/level";

type ExpLog = {
  id: string;
  action: string;
  exp: number;
  created_at: string;
};

export default function DashboardPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ExpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isConfigured = Boolean(supabase);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      setSession(currentSession ?? null);

      if (!currentSession) {
        setLoading(false);
        return;
      }

      const userId = currentSession.user.id;
      const email = currentSession.user.email ?? "";

      const profileQuery = await supabase
        .from("users")
        .select("id, email, level, exp, role, avatar, bio")
        .eq("id", userId)
        .maybeSingle();

      let profileData = profileQuery.data;

      if (profileQuery.error) {
        setError(profileQuery.error.message);
      }

      if (!profileData) {
        const starterProfile = {
          id: userId,
          email,
          level: 1,
          exp: 0,
          role: "member" as const,
          avatar: null,
          bio: "WuSphere 新成员",
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from("users")
          .insert(starterProfile)
          .select("id, email, level, exp, role, avatar, bio")
          .single();

        if (insertError) {
          setError(insertError.message);
          setLoading(false);
          return;
        }

        profileData = insertedProfile;
      }

      const { data: logData, error: logError } = await supabase
        .from("user_exp_logs")
        .select("id, action, exp, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);

      if (logError) {
        setError(logError.message);
      }

      setProfile(profileData as UserProfile);
      setLogs((logData ?? []) as ExpLog[]);
      setLoading(false);
    };

    load();
  }, [supabase]);

  if (!isConfigured) {
    return <main className="app-shell p-8 text-rose-300">Supabase 环境变量未配置。</main>;
  }

  if (loading) {
    return <main className="app-shell p-8 text-slate-200">加载中...</main>;
  }

  if (!session) {
    return (
      <main className="app-shell mx-auto w-full max-w-4xl p-6 sm:p-10">
        <div className="glass-card rounded-3xl p-8 text-center">
          <h1 className="text-3xl font-semibold">控制台已锁定</h1>
          <p className="mt-3 text-slate-300">登录后查看你的等级、经验值和成长记录。</p>
          <Link
            href="/"
            className="neon-button mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm"
          >
            前往登录
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return <main className="app-shell p-8 text-rose-300">{error || "用户信息加载失败。"}</main>;
  }

  const level = Math.max(profile.level, getLevelFromExp(profile.exp));
  const percent = getProgressPercent(profile.exp, level);
  const nextExp = getNextLevelExp(level);
  const unlockedTiers = [
    { label: "公开内容", value: "已解锁" },
    { label: "核心文章", value: level >= 1 ? "已解锁" : "未解锁" },
    { label: "AI 工具", value: level >= 2 ? "已解锁" : "未解锁" },
    { label: "隐藏知识", value: level >= 3 ? "已解锁" : "未解锁" },
  ];

  return (
    <main className="app-shell mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-10">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 scanlines" />

      <header className="relative glass-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
          <div>
            <p className="section-label">AI 成长控制台</p>
            <p className="mt-1 text-sm text-slate-400">你的等级、经验值与权限全在这里。</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="ghost-button rounded-full px-3 py-1.5">首页</Link>
            <Link href="/posts" className="ghost-button rounded-full px-3 py-1.5">文章</Link>
            {profile.role === "admin" ? (
              <Link href="/admin/users" className="neon-button inline-flex items-center gap-1 rounded-full px-3 py-1.5">
                <Users className="h-3.5 w-3.5" /> 用户管理
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                <span className="font-semibold uppercase">{profile.role}</span>
              </div>
              <div className="hud-pill rounded-2xl px-4 py-2 text-sm">
                <span className="metric-value">EXP {profile.exp}</span> / 下一级 {nextExp}
              </div>
            </div>

            <h1 className="mt-4 text-3xl font-semibold sm:text-5xl">LEVEL {level}</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              {profile.email} · 追踪你的成长进度、权限状态与 AI 身份层级。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="hud-pill rounded-2xl px-4 py-3">
              <p className="section-label">AI 等级</p>
              <p className="mt-1 metric-value text-2xl text-cyan-100">Lv{level}</p>
            </div>
            <div className="hud-pill rounded-2xl px-4 py-3">
              <p className="section-label">访问状态</p>
              <p className="mt-1 metric-value text-2xl text-amber-100">在线</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex justify-between text-sm text-slate-300">
            <span>EXP {profile.exp}</span>
            <span>下一级 {nextExp}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-800/90">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.8 }}
              className="h-3 rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
            />
          </div>
        </div>
      </header>

      <section className="relative mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr_0.95fr]">
        <article className="glass-card rounded-2xl p-5">
          <p className="section-label">身份状态</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            身份已验证
          </h2>
          <p className="mt-2 text-sm text-slate-300">已通过 Supabase Auth 认证，权限配置生效中。</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" /> 记忆同步稳定
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5">
          <p className="section-label">成长信号</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold">
            <Activity className="h-5 w-5 text-cyan-300" />
            成长飞轮
          </h2>
          <p className="mt-2 text-sm text-slate-300">每次有效互动都可获得 EXP，逐步解锁更深层模块。</p>
        </article>

        <article className="glass-card rounded-2xl p-5">
          <p className="section-label">内容入口</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold">
            <BarChart3 className="h-5 w-5 text-cyan-300" />
            知识门控
          </h2>
          <Link href="/posts" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            进入知识文章
            <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="mt-4 rounded-xl border border-white/8 bg-slate-950/35 p-3 text-xs text-slate-400">
            AI 工具、私密笔记与未来自动化功能均在此门控后方。
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="glass-card rounded-2xl p-5">
          <p className="section-label">已解锁层级</p>
          <div className="mt-4 space-y-2">
            {unlockedTiers.map((tier) => (
              <div key={tier.label} className="flex items-center justify-between rounded-xl border border-white/8 bg-slate-950/35 px-4 py-3">
                <span className="text-sm text-slate-100">{tier.label}</span>
                <span className="text-xs uppercase tracking-[0.15em] text-cyan-200">{tier.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="section-label">最新 EXP 记录</p>
              <p className="mt-1 text-sm text-slate-400">最近行为推动成长飞轮。</p>
            </div>
            <div className="hud-pill rounded-2xl px-3 py-2 text-xs uppercase tracking-[0.18em]">
              <Radar className="mr-1 inline h-3.5 w-3.5" /> 实时
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">暂无 EXP 记录。阅读文章或使用工具后会在此显示。</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {logs.map((log, index) => (
                <motion.li
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index }}
                  className="flex items-center justify-between rounded-xl border border-slate-400/20 bg-slate-950/35 px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Star className="h-4 w-4 text-cyan-300" />
                    {log.action}
                  </div>
                  <div className="text-sm font-mono text-cyan-200">+{log.exp} EXP</div>
                </motion.li>
              ))}
            </ul>
          )}

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
