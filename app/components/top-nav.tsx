import Link from "next/link";

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-10">
        <Link href="/" className="text-sm font-semibold tracking-wide text-cyan-100">
          WuSphere
        </Link>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Link href="/" className="ghost-button rounded-full px-3 py-1.5">
            首页
          </Link>
          <Link href="/posts" className="ghost-button rounded-full px-3 py-1.5">
            文章
          </Link>
          <Link href="/dashboard" className="ghost-button rounded-full px-3 py-1.5">
            控制台
          </Link>
          <Link href="/admin/users" className="ghost-button rounded-full px-3 py-1.5">
            管理
          </Link>
        </div>
      </nav>
    </header>
  );
}
