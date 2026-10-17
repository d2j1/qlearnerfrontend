import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Link from '../../lib/Link'

export const inputClass =
  'w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400'
export const smallButtonClass =
  'rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60'
export const cardClass = 'rounded-3xl border border-slate-700 bg-slate-900/60 p-4'

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const BANNER_TONES = {
  error: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  info: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
}

export function Banner({ tone = 'info', children, action }) {
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${BANNER_TONES[tone]}`}>
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  )
}

export function AdminRequired() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Admin access required</h2>
        <Link to="/" className={smallButtonClass}>
          Back to practice
        </Link>
      </div>
    </div>
  )
}

// Standard loading / waking / error states for a useLoader result. Returns null when there is nothing to show.
export function LoadState({ loader, label = 'Loading…' }) {
  if (loader.error && !loader.loading) {
    return (
      <Banner
        tone="error"
        action={
          <button type="button" className={smallButtonClass} onClick={loader.reload}>
            Retry
          </button>
        }
      >
        {loader.error.message || 'Request failed.'}
      </Banner>
    )
  }
  if (!loader.loading) {
    return null
  }
  return loader.slow ? (
    <Banner tone="info">Waking the server…</Banner>
  ) : (
    <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

export function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'border-slate-600 bg-slate-800 text-slate-300',
    cyan: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
    emerald: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    amber: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    rose: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
    violet: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>
}

const STATUS_TONES = { queued: 'slate', running: 'cyan', succeeded: 'emerald', failed: 'rose' }
export function JobStatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? 'slate'}>{status}</Badge>
}

const DIFFICULTY_TONES = { EASY: 'emerald', MEDIUM: 'amber', HARD: 'rose', MIXED: 'violet' }
export function DifficultyBadge({ difficulty }) {
  return <Badge tone={DIFFICULTY_TONES[difficulty] ?? 'slate'}>{difficulty}</Badge>
}

export function TagChips({ tags }) {
  if (!tags?.length) {
    return null
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          #{tag}
        </span>
      ))}
    </div>
  )
}

// Comma/Enter separated chip input.
export function TagInput({ value, onChange }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const next = draft
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag && !value.includes(tag))
    if (next.length) {
      onChange([...value, ...next])
    }
    setDraft('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
          #{tag}
          <button type="button" aria-label={`Remove ${tag}`} className="text-slate-400 hover:text-rose-300" onClick={() => onChange(value.filter((t) => t !== tag))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent py-1 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        placeholder={value.length ? '' : 'Add tags (Enter or comma)'}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
      />
    </div>
  )
}

export function Pager({ total, limit, offset, onChange }) {
  if (total <= limit) {
    return null
  }
  const page = Math.floor(offset / limit) + 1
  const pages = Math.ceil(total / limit)
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-400">
      <button type="button" className={smallButtonClass} disabled={page <= 1} onClick={() => onChange(offset - limit)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" className={smallButtonClass} disabled={page >= pages} onClick={() => onChange(offset + limit)}>
        Next
      </button>
    </div>
  )
}
