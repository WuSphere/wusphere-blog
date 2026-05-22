"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  LogIn,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const levelRows = [
  { name: "游客", access: "公开内容" },
  { name: "Lv1", access: "核心文章" },
  { name: "Lv2", access: "AI 工具" },
  { name: "Lv3", access: "隐藏知识" },
  { name: "VIP", access: "高级资源" },
];

const terminalLines = [
  "> syncing memory...",
  "> identity verified...",
  "> EXP system online...",
];

function normalizeAuthErrorMessage(raw: string, provider: "google" | "github") {
  if (raw.includes("Unsupported provider") || raw.includes("provider is not enabled")) {
    const providerLabel = provider === "google" ? "Google" : "GitHub";
    return `${providerLabel} 登录未启用。请在 Supabase Dashboard > Authentication > Providers 中启用 ${providerLabel}。`;
  }
  return raw;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [terminalLineIndex, setTerminalLineIndex] = useState(0);
  const [terminalCharCount, setTerminalCharCount] = useState(0);
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const isDevelopment = process.env.NODE_ENV === "development";
  const envMissingMessage = "Supabase env vars are missing.";

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    };

    syncSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const currentLine = terminalLines[terminalLineIndex];
    const delay = terminalCharCount < currentLine.length ? 32 : 540;
    const timer = window.setTimeout(() => {
      if (terminalCharCount < currentLine.length) {
        setTerminalCharCount((current) => current + 1);
        return;
      }

      setTerminalLineIndex((current) => (current + 1) % terminalLines.length);
      setTerminalCharCount(0);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [terminalLineIndex, terminalCharCount]);

  const signInWithProvider = async (provider: "google" | "github") => {
    if (!supabase) {
      if (isDevelopment) {
        setMessage(envMissingMessage);
      }
      return;
    }
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      setMessage(normalizeAuthErrorMessage(error.message, provider));
      setLoading(false);
      return;
    }

    if (!data?.url) {
      setMessage("登录链接生成失败，请稍后重试。");
      setLoading(false);
      return;
    }

    window.location.assign(data.url);
    setLoading(false);
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    setMessage("已退出登录。");
  };

  return (
    <main className="app-shell px-5 py-8 sm:px-10 sm:py-10">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute inset-0 scanlines" />

      <section className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-16 py-8 sm:py-12 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="glass-card rounded-[2rem] p-5 sm:p-7 lg:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100 shadow-[0_0_30px_rgba(39,216,200,0.2)]">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-200/80">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-cyan-300" />
                  Wusphere AI 平台
                </p>
                <p className="mt-1 text-sm text-slate-400">个人 AI 宇宙 · 等级身份 · 知识访问</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Link href="/posts" className="ghost-button rounded-full px-3 py-1.5">
                知识流
              </Link>
              <Link href="/dashboard" className="neon-button rounded-full px-4 py-1.5 text-sm">
                打开控制台
              </Link>
            </div>
          </div>

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <p className="section-label">不只是个人主页</p>
              <h1 className="mt-3 max-w-lg text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl xl:text-[3.75rem]">
                构建你的 AI Identity
                <br />
                进入成长型知识宇宙
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
                这是一个更像 AI 操作系统入口的首页。成长、权限和知识访问都在这里统一呈现。
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="hud-pill rounded-full px-3 py-1.5">AI Identity</span>
                <span className="hud-pill rounded-full px-3 py-1.5">等级系统</span>
                <span className="hud-pill rounded-full px-3 py-1.5">知识访问</span>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link href="/dashboard" className="neon-button inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm shadow-[0_0_28px_rgba(41,170,255,0.34)]">
                  打开控制台 <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/posts" className="ghost-button inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm">
                  浏览知识 <ShieldCheck className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative self-start lg:pt-2">
              <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-r from-cyan-400/12 via-blue-500/10 to-indigo-400/12 blur-2xl" />
              <div className="glass-card relative overflow-hidden rounded-[1.75rem] border border-cyan-200/10 p-4 shadow-[0_18px_60px_rgba(1,7,18,0.42)] sm:p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(39,216,200,0.08),transparent_55%)]" />

                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="section-label">AI Identity Panel</p>
                    <p className="mt-1.5 text-sm text-slate-300">登录后进入你的成长空间。</p>
                  </div>
                  <div className="hud-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
                    等级 0 用户
                  </div>
                </div>

                <div className="relative mt-4 rounded-[1.4rem] border border-cyan-200/8 bg-slate-950/28 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-cyan-200">
                    <LogIn className="h-4 w-4" />
                    登录开始成长
                  </p>

                  {!session ? (
                    <div className="mt-3 space-y-3">
                      <button
                        type="button"
                        onClick={() => signInWithProvider("google")}
                        disabled={loading}
                        className="neon-button w-full rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-60"
                      >
                        使用 Google 登录
                      </button>
                      <button
                        type="button"
                        onClick={() => signInWithProvider("github")}
                        disabled={loading}
                        className="ghost-button flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                      >
                        使用 GitHub 登录
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3 text-sm text-slate-300">
                      <p>当前登录：{session.user.email}</p>
                      <Link href="/dashboard" className="neon-button block rounded-xl px-4 py-2.5 text-center">
                        打开仪表盘
                      </Link>
                      <button type="button" onClick={signOut} className="ghost-button w-full rounded-xl px-4 py-2.5">
                        退出登录
                      </button>
                    </div>
                  )}

                  {message ? <p className="mt-4 text-xs text-cyan-100/90">{message}</p> : null}

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-black/20 px-4 py-2.5 font-mono text-[11px] text-cyan-100/90">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <span>Terminal</span>
                      <span className="inline-flex items-center gap-1 text-cyan-200">
                        <Zap className="h-3 w-3" /> Live
                      </span>
                    </div>
                    <div className="mt-2 h-4 overflow-hidden">
                      <motion.div
                        key={terminalLines[terminalLineIndex]}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {terminalLines[terminalLineIndex].slice(0, terminalCharCount)}
                        <span className="ml-0.5 inline-block h-3 w-2 translate-y-[2px] animate-pulse bg-cyan-200 align-middle" />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="isolate mt-8 grid gap-14 border-t border-white/6 pt-14 lg:grid-cols-[1fr_1fr]">
          <article className="relative z-10 p-0">
            <p className="section-label">等级权限体系</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">等级权限体系</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              第二屏只展示等级轨道与平台核心能力，帮助用户快速理解这个系统如何成长和解锁。
            </p>

            <div className="mt-10 rounded-[1.75rem] bg-slate-950/24 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:gap-0 lg:divide-x lg:divide-white/8">
                {levelRows.map((row, index) => (
                  <motion.div
                    key={row.name}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative px-0 py-0 lg:px-4"
                  >
                    <div className="flex h-full min-h-[108px] flex-col justify-between rounded-2xl bg-transparent p-4 lg:p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="metric-value text-sm text-slate-100">{row.name}</span>
                        {row.name === "VIP" ? (
                          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100">
                            VIP
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 h-px w-full bg-white/8" />
                      <p className="mt-4 text-sm leading-relaxed text-slate-300">{row.access}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </article>

          <article className="relative z-10 p-0">
            <p className="section-label">平台能力</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">平台能力</h2>
            <div className="mt-10 rounded-[1.75rem] bg-slate-950/24 p-6 sm:p-8">
              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                <Activity className="h-4 w-4 text-cyan-300" /> AI Growth Loop
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
                这是首页唯一需要被记住的核心模块：阅读、互动、使用工具都会推动 EXP 增长，
                并逐步解锁更多内容与权限。
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
