import { BookOpen, RefreshCw } from 'lucide-react'

function Navbar({ currentSelection, isBusy, isWarmup, onRefresh, onToggleAdmin, onToggleFocus, isFocusMode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-200 shadow-lg shadow-cyan-950/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">QLearner</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="truncate font-medium text-white">MCQ practice platform</span>
              <span className="hidden text-slate-500 sm:inline">/</span>
              <span className="truncate text-slate-400">{currentSelection}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 sm:inline-flex">
            {isWarmup ? 'Spinning up backend' : isBusy ? 'Syncing content' : 'Ready'}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
            onClick={onToggleFocus}
          >
            {isFocusMode ? 'Exit Focus' : 'Focus'}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
            onClick={onToggleAdmin}
          >
            Admin
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar