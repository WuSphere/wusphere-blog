"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Post, UserRole } from "@/lib/domain";

type ProfileLite = {
  level: number;
  role: UserRole;
};

function isMissingAttachmentsColumn(message: string) {
  return message.toLowerCase().includes("attachments") && message.toLowerCase().includes("column");
}

export default function PostDetailPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const params = useParams<{ id: string }>();
  const postId = params?.id;

  const [post, setPost] = useState<Post | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!supabase || !postId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: profileData } = await supabase
          .from("users")
          .select("level, role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData as ProfileLite);
        }
      }

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("id, title, content, min_level, is_public, tags, attachments, author_id, created_at")
        .eq("id", postId)
        .maybeSingle();

      if (postError) {
        if (isMissingAttachmentsColumn(postError.message)) {
          setAttachmentsEnabled(false);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("posts")
            .select("id, title, content, min_level, is_public, tags, author_id, created_at")
            .eq("id", postId)
            .maybeSingle();

          if (fallbackError) {
            setError(fallbackError.message);
            setLoading(false);
            return;
          }

          setPost(
            fallbackData
              ? ({
                  ...(fallbackData as Omit<Post, "attachments">),
                  attachments: null,
                } as Post)
              : null
          );
          setLoading(false);
          return;
        }

        setError(postError.message);
      }

      setPost((postData as Post) ?? null);
      setLoading(false);
    };

    void load();
  }, [postId, supabase]);

  if (!supabase) {
    return <main className="app-shell p-8 text-rose-300">Supabase 环境变量未配置。</main>;
  }

  if (loading) {
    return <main className="app-shell p-8 text-slate-200">加载中...</main>;
  }

  if (error) {
    return <main className="app-shell p-8 text-rose-300">{error}</main>;
  }

  if (!post) {
    return <main className="app-shell p-8 text-rose-300">文章不存在或已删除。</main>;
  }

  const viewerLevel = profile?.role === "admin" ? 999 : (profile?.level ?? 0);
  const unlocked = post.is_public || viewerLevel >= post.min_level;

  return (
    <main className="app-shell mx-auto w-full max-w-4xl px-5 py-8 sm:px-10">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 scanlines" />

      <article className="glass-card relative rounded-3xl p-6 sm:p-8">
        <p className="section-label">文章详情</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{post.title}</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
          {post.min_level === 0 ? "公开内容" : `需 Lv${post.min_level}`} · {post.is_public ? "所有人可见" : "需登录"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs sm:text-sm">
          <Link href="/posts" className="ghost-button rounded-lg px-3 py-1.5">
            返回文章列表
          </Link>
          <Link href="/dashboard" className="ghost-button rounded-lg px-3 py-1.5">
            控制台
          </Link>
        </div>

        {!unlocked ? (
          <div className="mt-6 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-amber-100">
            当前账号权限不足，达到 Lv{post.min_level} 后可阅读全文。
          </div>
        ) : (
          <>
            <article className="markdown-body mt-6 text-slate-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
            </article>

            {!attachmentsEnabled ? (
              <p className="mt-6 text-xs text-amber-200">当前数据库未迁移 attachments 字段，附件列表暂不可用。</p>
            ) : null}

            {post.attachments && post.attachments.length > 0 ? (
              <section className="mt-8 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">附件</p>
                <ul className="mt-3 space-y-2">
                  {post.attachments.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-cyan-200 underline underline-offset-2"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </article>
    </main>
  );
}
