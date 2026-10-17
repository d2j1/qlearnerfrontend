import { BookOpen, LogIn, LogOut } from 'lucide-react'

function Navbar({
  onHome,
  onOpenAdmin,
  onToggleFocus,
  isFocusMode,
  user,
  onLogin,
  onLogout,
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <button type="button" className="flex min-w-0 items-center gap-3 rounded-2xl text-left" aria-label="QLearner home" onClick={onHome}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-200 shadow-lg shadow-cyan-950/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">QLearner</p>
            <span className="block truncate text-sm font-medium text-white">MCQ practice platform</span>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
            onClick={onToggleFocus}
          >
            {isFocusMode ? 'Exit Focus' : 'Focus'}
          </button>
          {user?.role === 'admin' ? (
            <button
              type="button"
              className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
              onClick={onOpenAdmin}
            >
              Admin
            </button>
          ) : null}
          {user ? (
            <button
              type="button"
              title={`Signed in as ${user.email}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:border-rose-400 hover:text-rose-200"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
              onClick={onLogin}
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Log in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar