"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Heading1,
  Link2,
  List,
  Lock,
  Pencil,
  Plus,
  Quote,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Post } from "@/lib/domain";

type ProfileLite = {
  level: number;
  role: "admin" | "member" | "vip";
};

function isMissingAttachmentsColumn(message: string) {
  return message.toLowerCase().includes("attachments") && message.toLowerCase().includes("column");
}

type NewPostDraft = {
  title: string;
  content: string;
  min_level: number;
  is_public: boolean;
  tags: string;
  attachments: string[];
};

type UploadResult = {
  fileName: string;
  publicUrl: string;
  isImage: boolean;
};

const postCategories = [
  { label: "全部文章", keywords: [] },
  { label: "AI 基础", keywords: ["基础", "history", "llm", "概念", "模型"] },
  { label: "Prompt Engineering", keywords: ["prompt", "提示词", "推理"] },
  { label: "AI Agent", keywords: ["agent", "workflow", "tool", "自动化"] },
  { label: "企业应用", keywords: ["企业", "落地", "应用", "组织", "产品"] },
  { label: "治理与风险", keywords: ["安全", "治理", "risk", "合规", "伦理"] },
];

const emptyDraft: NewPostDraft = {
  title: "",
  content: "",
  min_level: 0,
  is_public: true,
  tags: "",
  attachments: [],
};

function stripMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, "")
    .replace(/\[[^\]]+\]\(([^\)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~\-]+/g, "")
    .replace(/\n{2,}/g, " ")
    .trim();
}

function createAttachmentMarkdown(upload: UploadResult) {
  if (upload.isImage) {
    return `![${upload.fileName}](${upload.publicUrl})`;
  }

  return `[${upload.fileName}](${upload.publicUrl})`;
}

export default function PostsPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<NewPostDraft>(emptyDraft);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部文章");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const isConfigured = Boolean(supabase);

  const loadPosts = async () => {
    if (!supabase) return;
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select("id, title, content, min_level, is_public, tags, attachments, author_id, created_at")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (postError) {
      if (isMissingAttachmentsColumn(postError.message)) {
        setAttachmentsEnabled(false);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("posts")
          .select("id, title, content, min_level, is_public, tags, author_id, created_at")
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false });

        if (fallbackError) {
          setError(fallbackError.message);
          return;
        }

        setPosts(
          ((fallbackData ?? []) as Omit<Post, "attachments">[]).map((item) => ({
            ...item,
            attachments: null,
          }))
        );
        setSubmitMsg("检测到数据库尚未添加 attachments 字段，已自动切换兼容模式。请执行一次 SQL 迁移后即可恢复附件保存。");
        return;
      }

      setError(postError.message);
      return;
    }

    setAttachmentsEnabled(true);
    setPosts((postData ?? []) as Post[]);
  };

  useEffect(() => {
    if (!supabase) return;

    const load = async () => {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsLoggedIn(Boolean(session));
      setCurrentUserId(session?.user.id ?? null);

      if (session) {
        const { data: profileData } = await supabase
          .from("users")
          .select("level, role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profileData) setProfile(profileData as ProfileLite);
      }

      await loadPosts();
      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const viewerLevel = profile?.role === "admin" ? 999 : (profile?.level ?? 0);
  const isAdmin = profile?.role === "admin";
  const canWritePost = isLoggedIn;

  const filteredPosts = posts.filter((post) => {
    const tags = post.tags ?? [];
    const selectedCategory = postCategories.find((category) => category.label === activeCategory);
    const categoryMatches =
      !selectedCategory ||
      selectedCategory.keywords.length === 0 ||
      selectedCategory.keywords.some((keyword) => {
        const lowerKeyword = keyword.toLowerCase();
        return (
          post.title.toLowerCase().includes(lowerKeyword) ||
          post.content.toLowerCase().includes(lowerKeyword) ||
          tags.some((tag) => tag.toLowerCase().includes(lowerKeyword))
        );
      });

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchMatches =
      normalizedQuery.length === 0 ||
      post.title.toLowerCase().includes(normalizedQuery) ||
      post.content.toLowerCase().includes(normalizedQuery) ||
      tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

    return categoryMatches && searchMatches;
  });

  const resetEditor = () => {
    setDraft(emptyDraft);
    setEditingPostId(null);
    setEditingAuthorId(null);
  };

  const applyMarkdown = (builder: (selected: string) => string, fallback = "文本") => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.content.slice(start, end) || fallback;
    const replacement = builder(selected);
    const nextContent = `${draft.content.slice(0, start)}${replacement}${draft.content.slice(end)}`;

    setDraft((current) => ({
      ...current,
      content: nextContent,
    }));

    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + replacement.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const startCreatePost = () => {
    resetEditor();
    setSubmitMsg("");
    setShowForm(true);
  };

  const startEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditingAuthorId(post.author_id);
    setDraft({
      title: post.title,
      content: post.content,
      min_level: post.min_level,
      is_public: post.is_public,
      tags: (post.tags ?? []).join(", "),
      attachments: post.attachments ?? [],
    });
    setSubmitMsg("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditor = () => {
    resetEditor();
    setShowForm(false);
    setSubmitMsg("");
  };

  const handleUploadAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!attachmentsEnabled) {
      setSubmitMsg("当前数据库未完成 attachments 字段迁移，暂时无法保存附件地址。");
      return;
    }

    if (!supabase || !currentUserId) {
      setSubmitMsg("请先登录后再上传附件。");
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    setSubmitMsg("");

    const uploads: UploadResult[] = [];

    for (const file of Array.from(files)) {
      const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const safeExt = extension?.toLowerCase() ?? "bin";
      const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-post-images")
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) {
        setSubmitMsg(`附件上传失败：${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: publicData } = supabase.storage.from("blog-post-images").getPublicUrl(filePath);
      if (publicData.publicUrl) {
        uploads.push({
          fileName: file.name,
          publicUrl: publicData.publicUrl,
          isImage: file.type.startsWith("image/"),
        });
      }
    }

    const uploadedUrls = uploads.map((upload) => upload.publicUrl);
    const markdownAppend = uploads.map(createAttachmentMarkdown).join("\n\n");

    setDraft((current) => ({
      ...current,
      attachments: [...current.attachments, ...uploadedUrls],
      content: current.content
        ? `${current.content.trim()}\n\n${markdownAppend}`.trim()
        : markdownAppend,
    }));

    setUploading(false);
    setSubmitMsg("附件上传成功，已自动插入 Markdown 链接。")
    event.target.value = "";
  };

  const handleDeletePost = async (postId: string, title: string) => {
    if (!supabase) {
      return;
    }

    const confirmed = window.confirm(`确认删除《${title}》吗？删除后无法恢复。`);
    if (!confirmed) {
      return;
    }

    setSubmitMsg("");
    const { error: deleteError } = await supabase.from("posts").delete().eq("id", postId);

    if (deleteError) {
      setSubmitMsg(`删除失败：${deleteError.message}`);
      return;
    }

    if (editingPostId === postId) {
      cancelEditor();
    }

    setSubmitMsg("文章已删除。");
    await loadPosts();
  };

  const handleSubmit = async () => {
    if (!supabase || !draft.title.trim() || !draft.content.trim() || !currentUserId) {
      setSubmitMsg("标题和正文不能为空。");
      return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    const tagsArray = draft.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      min_level: draft.min_level,
      is_public: draft.is_public,
      tags: tagsArray,
      attachments: draft.attachments,
      author_id: editingAuthorId ?? currentUserId,
    };

    const saveQuery = editingPostId
      ? supabase.from("posts").update(payload).eq("id", editingPostId)
      : supabase.from("posts").insert(payload);

    const { error: saveError } = await saveQuery;
    if (saveError) {
      if (isMissingAttachmentsColumn(saveError.message)) {
        setAttachmentsEnabled(false);
        const fallbackPayload = {
          title: payload.title,
          content: payload.content,
          min_level: payload.min_level,
          is_public: payload.is_public,
          tags: payload.tags,
          author_id: payload.author_id,
        };

        const fallbackQuery = editingPostId
          ? supabase.from("posts").update(fallbackPayload).eq("id", editingPostId)
          : supabase.from("posts").insert(fallbackPayload);

        const { error: fallbackSaveError } = await fallbackQuery;

        if (fallbackSaveError) {
          setSubmitMsg(`保存失败：${fallbackSaveError.message}`);
        } else {
          setSubmitMsg(editingPostId ? "更新成功（兼容模式：附件URL未写入）。" : "发布成功（兼容模式：附件URL未写入）。");
          resetEditor();
          setShowForm(false);
          await loadPosts();
        }
      } else {
        setSubmitMsg(`保存失败：${saveError.message}`);
      }
    } else {
      setSubmitMsg(editingPostId ? "文章更新成功！" : "发布成功！");
      resetEditor();
      setShowForm(false);
      await loadPosts();
    }
    setSubmitting(false);
  };

  if (!isConfigured) {
    return <main className="app-shell p-8 text-rose-300">Supabase 环境变量未配置。</main>;
  }

  return (
    <main className="app-shell mx-auto w-full max-w-6xl px-5 py-8 sm:px-10">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 scanlines" />

      <header className="relative glass-card rounded-3xl p-6 sm:p-8">
        <p className="section-label">权限驱动知识库</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">知识文章</h1>
        <p className="mt-3 text-sm text-slate-300">
          当前权限：
          <span className="font-semibold text-cyan-200">
            {viewerLevel === 999 ? "管理员" : isLoggedIn ? `Lv${viewerLevel}` : "游客"}
          </span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          已登录作者可编辑/删除自己的文章，admin 可编辑/删除所有文章。
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="ghost-button rounded-xl px-4 py-2">
            首页
          </Link>
          <Link href="/dashboard" className="ghost-button rounded-xl px-4 py-2">
            控制台
          </Link>
          {canWritePost && (
            <button
              type="button"
              onClick={() => {
                if (showForm && !editingPostId) {
                  cancelEditor();
                  return;
                }
                startCreatePost();
              }}
              className="neon-button inline-flex items-center gap-1.5 rounded-xl px-4 py-2"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm && !editingPostId ? "取消" : "写文章"}
            </button>
          )}
        </div>
      </header>

      {!isLoggedIn && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-cyan-200/20 bg-cyan-300/5 px-6 py-4 text-sm text-cyan-100"
        >
          <p className="font-semibold">你还未登录</p>
          <p className="mt-1 text-slate-300">
            登录后可解锁更多层级内容。
            <Link href="/" className="ml-2 underline underline-offset-2 text-cyan-200">
              前往登录 →
            </Link>
          </p>
        </motion.div>
      )}

      {canWritePost && showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 glass-card rounded-2xl p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-cyan-100">{editingPostId ? "编辑文章" : "发布新文章"}</h2>
            {editingPostId ? (
              <button type="button" onClick={cancelEditor} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                取消编辑
              </button>
            ) : null}
          </div>
          <div className="grid gap-3">
            <input
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
              placeholder="文章标题"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <button type="button" onClick={() => applyMarkdown((text) => `# ${text}`)} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                <Heading1 className="mr-1 inline h-3.5 w-3.5" /> 标题
              </button>
              <button type="button" onClick={() => applyMarkdown((text) => `**${text}**`)} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                <Bold className="mr-1 inline h-3.5 w-3.5" /> 加粗
              </button>
              <button type="button" onClick={() => applyMarkdown((text) => `[${text}](https://)`)} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                <Link2 className="mr-1 inline h-3.5 w-3.5" /> 链接
              </button>
              <button type="button" onClick={() => applyMarkdown((text) => `\`${text}\``)} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                <Code2 className="mr-1 inline h-3.5 w-3.5" /> 行内代码
              </button>
              <button type="button" onClick={() => applyMarkdown((text) => `- ${text}`)} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                <List className="mr-1 inline h-3.5 w-3.5" /> 列表
              </button>
              <button type="button" onClick={() => applyMarkdown((text) => `> ${text}`)} className="ghost-button rounded-lg px-3 py-1.5 text-xs">
                <Quote className="mr-1 inline h-3.5 w-3.5" /> 引用
              </button>
            </div>
            <textarea
              ref={editorRef}
              rows={10}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
              placeholder="支持 Markdown。可用上方工具按钮快速插入标题、加粗、链接、代码、列表、引用。"
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            />
            <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.14em] text-cyan-200">Markdown 预览</p>
              <article className="markdown-body text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {draft.content || "_这里会显示 Markdown 预览_"}
                </ReactMarkdown>
              </article>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">最低等级 (0=公开)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="w-24 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
                  value={draft.min_level}
                  onChange={(e) => setDraft((d) => ({ ...d, min_level: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">公开可见</label>
                <select
                  className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
                  value={draft.is_public ? "true" : "false"}
                  onChange={(e) => setDraft((d) => ({ ...d, is_public: e.target.value === "true" }))}
                >
                  <option value="true">是</option>
                  <option value="false">否（需登录）</option>
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs text-slate-400">标签（逗号分隔）</label>
                <input
                  className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
                  placeholder="ai, tool, workflow"
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
              <label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-cyan-200">
                <Upload className="h-3.5 w-3.5" /> 附件上传（文件存 Supabase Storage，DB 只存地址）
              </label>
              {!attachmentsEnabled ? (
                <p className="mb-2 text-xs text-amber-200">当前为兼容模式：数据库缺少 attachments 字段，附件URL暂不可入库。</p>
              ) : null}
              <input
                type="file"
                multiple
                onChange={handleUploadAttachments}
                disabled={!attachmentsEnabled}
                className="block w-full text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-300/20 file:px-3 file:py-2 file:text-cyan-100"
              />
              {uploading ? <p className="mt-2 text-xs text-cyan-300">附件上传中...</p> : null}
              {draft.attachments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {draft.attachments.map((url, index) => (
                    <div key={url} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <a href={url} target="_blank" rel="noreferrer" className="truncate text-cyan-200 underline underline-offset-2">
                        {url}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            attachments: current.attachments.filter((_, currentIndex) => currentIndex !== index),
                          }))
                        }
                        className="rounded-md border border-rose-300/50 px-2 py-1 text-rose-200"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {submitMsg && (
              <p className={`text-sm ${submitMsg.startsWith("发布失败") ? "text-rose-300" : "text-cyan-300"}`}>
                {submitMsg}
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="neon-button self-start rounded-xl px-6 py-2.5 text-sm disabled:opacity-60"
            >
              {submitting ? (editingPostId ? "更新中..." : "发布中...") : uploading ? "上传中..." : editingPostId ? "保存修改" : "确认发布"}
            </button>
          </div>
        </motion.div>
      )}

      {loading ? <p className="mt-6 text-slate-300">加载中...</p> : null}
      {error ? <p className="mt-6 text-rose-300">{error}</p> : null}

      <section className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="glass-card h-fit rounded-2xl p-4 lg:sticky lg:top-24">
          <p className="section-label">文章目录</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">常用分类</h2>
          <div className="mt-4 space-y-2">
            {postCategories.map((category) => {
              const isActive = category.label === activeCategory;
              return (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => setActiveCategory(category.label)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "border border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                      : "border border-white/8 bg-slate-950/30 text-slate-300"
                  }`}
                >
                  <span>{category.label}</span>
                  {isActive ? <span className="text-xs">当前</span> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-6 rounded-xl border border-white/8 bg-slate-950/30 p-3 text-xs text-slate-400">
            当前显示 {filteredPosts.length} 篇文章。可按分类浏览，也可用右侧关键字检索标题、正文和标签。
          </div>
        </aside>

        <div>
          <div className="glass-card rounded-2xl p-4">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <Search className="h-4 w-4 text-cyan-200" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索关键字：如 agent、prompt、企业、治理"
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
        {filteredPosts.map((post, index) => {
          const unlocked = post.is_public || viewerLevel >= post.min_level;
          const isOwner = Boolean(currentUserId) && post.author_id === currentUserId;
          const canManagePost = isAdmin || isOwner;
          return (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
              className="glass-card rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{post.title}</h2>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                    {post.min_level === 0 ? "公开内容" : `需 Lv${post.min_level}`} ·{" "}
                    {post.is_public ? "所有人可见" : "需登录"}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {post.author_id ? (isOwner ? "你是作者" : `作者 ID: ${post.author_id.slice(0, 8)}...`) : "系统预置文章"}
                  </p>
                </div>
                {unlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/35 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                    <Shield className="h-3.5 w-3.5" />
                    已解锁
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">
                    <Lock className="h-3.5 w-3.5" />
                    已锁定
                  </span>
                )}
              </div>

              {unlocked ? (
                <div className="mt-4 rounded-xl border border-cyan-200/15 bg-slate-950/40 p-4">
                  <p className="text-sm leading-relaxed text-slate-200">
                    {stripMarkdown(post.content).slice(0, 220)}
                    {stripMarkdown(post.content).length > 220 ? "..." : ""}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    已获得访问权限
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/posts/${post.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs text-cyan-200"
                    >
                      <Eye className="h-3.5 w-3.5" /> 点击阅读全文
                    </Link>
                    {post.attachments && post.attachments.length > 0 ? (
                      <span className="text-xs text-slate-400">附件 {post.attachments.length} 个</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-300/15 bg-slate-950/45 p-4">
                  <p className="select-none font-mono text-sm text-slate-500 blur-[2px]">
                    ████████████████████████
                    <br />
                    ███ 隐藏内容 ███
                    <br />
                    ████████████████████████
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-amber-200">
                    达到 Lv{post.min_level} 后解锁
                  </p>
                </div>
              )}

              {canManagePost ? (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEditPost(post)}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/45 px-3 py-1.5 text-xs text-cyan-200"
                  >
                    <Pencil className="h-3.5 w-3.5" /> 编辑文章
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id, post.title)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300/45 px-3 py-1.5 text-xs text-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除文章
                  </button>
                </div>
              ) : null}

              {post.tags && post.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.article>
          );
        })}

        {!loading && filteredPosts.length === 0 ? (
          <article className="glass-card rounded-2xl p-5 text-sm text-slate-300">
            没有匹配结果。可以切换左侧分类，或重新输入关键字。
          </article>
        ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
