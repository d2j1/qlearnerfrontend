import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Pencil, RefreshCw, X } from 'lucide-react'
import { approveQuestions, listDrafts, regenerateQuestion, rejectQuestions } from '../../api/client'
import { notifyDraftsChanged } from '../../lib/events'
import Link from '../../lib/Link'
import { navigate } from '../../lib/router'
import { QuestionEditForm, QuestionPreview } from './QuestionEditForm'
import { useLoader } from './helpers'
import { Banner, DifficultyBadge, LoadState, PageHeader, TagChips, inputClass, smallButtonClass } from './ui'

const LOAD_LIMIT = 500
const UNDO_MS = 5000

function DraftCard({ question, active, selected, editing, regenerating, error, onToggleSelect, onFocus, onApprove, onReject, onEdit, onRegenerate, onCancelEdit, onSaved }) {
  const ref = useRef(null)
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [active])


  return (
    <li
      ref={ref}
      onClick={onFocus}
      className={`relative rounded-3xl border bg-slate-900/60 p-4 transition ${active ? 'border-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]' : 'border-slate-700'}`}
    >
      {regenerating ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-3xl bg-slate-950/80 text-sm text-cyan-100">
          <Loader2 className="h-4 w-4 animate-spin" /> Regenerating… this takes 10–20 s
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} onClick={(event) => event.stopPropagation()} />
          Select
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={question.difficulty} />
          <TagChips tags={question.tags} />
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {editing ? (
        <QuestionEditForm question={question} saveLabel="Save draft" onCancel={onCancelEdit} onSaved={onSaved} />
      ) : (
        <>
          <QuestionPreview question={question} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1 hover:border-emerald-400 hover:text-emerald-200`} onClick={onApprove}>
              <Check className="h-3.5 w-3.5" /> Approve <kbd className="text-slate-500">A</kbd>
            </button>
            <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1`} onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit <kbd className="text-slate-500">E</kbd>
            </button>
            <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1 hover:border-rose-400 hover:text-rose-200`} onClick={onReject}>
              <X className="h-3.5 w-3.5" /> Reject <kbd className="text-slate-500">R</kbd>
            </button>
            <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1`} disabled={regenerating} onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate <kbd className="text-slate-500">G</kbd>
            </button>
          </div>
        </>
      )}
    </li>
  )
}

function DraftsPage({ jobId, topic, subtopic }) {
  const loader = useLoader(
    () => listDrafts({ job_id: jobId || undefined, topic: topic || undefined, subtopic: subtopic || undefined, limit: LOAD_LIMIT }),
    [jobId, topic, subtopic],
  )
  const [drafts, setDrafts] = useState([])
  const [loadedFrom, setLoadedFrom] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [activeId, setActiveId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [regenerating, setRegenerating] = useState(() => new Set())
  const [cardErrors, setCardErrors] = useState({})
  const [pending, setPending] = useState([]) // [{ key, kind, ids }]
  const [message, setMessage] = useState(null)
  const timersRef = useRef(new Map()) // key -> { timer, run }
  const [filterTopic, setFilterTopic] = useState(topic ?? '')
  const [filterSubtopic, setFilterSubtopic] = useState(subtopic ?? '')

  // Copy each fresh server response into local state so cards can be removed and replaced.
  if (loader.data && loader.data !== loadedFrom) {
    setLoadedFrom(loader.data)
    setDrafts(loader.data.items)
  }

  const pendingIds = new Set(pending.flatMap((action) => action.ids))
  const visible = drafts.filter((question) => !pendingIds.has(question.id))
  const activeIndex = Math.max(
    0,
    visible.findIndex((question) => question.id === activeId),
  )
  const active = visible[activeIndex] ?? null

  const runAction = useCallback(async (key, kind, ids) => {
    timersRef.current.delete(key)
    try {
      const result = await (kind === 'approve' ? approveQuestions(ids) : rejectQuestions(ids))
      setDrafts((previous) => previous.filter((question) => !ids.includes(question.id)))
      setMessage({ tone: 'success', text: `${kind === 'approve' ? 'Approved' : 'Rejected'} ${result?.modified_count ?? ids.length}.` })
      notifyDraftsChanged()
    } catch (actionError) {
      setMessage({ tone: 'error', text: actionError.message || `${kind} failed.` })
    } finally {
      setPending((previous) => previous.filter((action) => action.key !== key))
    }
  }, [])

  // Approve/reject wait 5 s so Undo can cancel them; there is no "back to draft" endpoint.
  const schedule = (kind, ids) => {
    if (!ids.length) {
      return
    }
    const key = `${kind}-${Date.now()}-${ids[0]}`
    const run = () => runAction(key, kind, ids)
    timersRef.current.set(key, { timer: setTimeout(run, UNDO_MS), run })
    setPending((previous) => [...previous, { key, kind, ids }])
    setSelected((previous) => new Set([...previous].filter((id) => !ids.includes(id))))
    setEditingId(null)
    setMessage(null)
    // Move focus to the next card that stays visible.
    const remaining = visible.filter((question) => !ids.includes(question.id))
    const nextActive = remaining[Math.min(activeIndex, remaining.length - 1)]
    setActiveId(nextActive?.id ?? null)
  }

  const undo = (key) => {
    const entry = timersRef.current.get(key)
    if (entry) {
      clearTimeout(entry.timer)
      timersRef.current.delete(key)
    }
    setPending((previous) => previous.filter((action) => action.key !== key))
  }

  // Leaving the page commits pending actions instead of dropping them.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(({ timer, run }) => {
        clearTimeout(timer)
        void run()
      })
      timers.clear()
    }
  }, [])

  const regenerate = async (question) => {
    setRegenerating((previous) => new Set(previous).add(question.id))
    setCardErrors((previous) => ({ ...previous, [question.id]: null }))
    setEditingId(null)
    try {
      const fresh = await regenerateQuestion(question.id)
      // New id: swap the card in place.
      setDrafts((previous) => previous.map((item) => (item.id === question.id ? fresh : item)))
      setSelected((previous) => new Set([...previous].filter((id) => id !== question.id)))
      setActiveId((current) => (current === question.id ? fresh.id : current))
    } catch (regenError) {
      setCardErrors((previous) => ({
        ...previous,
        [question.id]: regenError.status === 502 ? `The model failed: ${regenError.message}` : regenError.message || 'Regenerate failed.',
      }))
    } finally {
      setRegenerating((previous) => {
        const next = new Set(previous)
        next.delete(question.id)
        return next
      })
    }
  }

  // Keyboard shortcuts: A approve, R reject, E edit, G regenerate, J/K next/previous.
  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName
      if (event.metaKey || event.ctrlKey || event.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || editingId) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'j' || key === 'k') {
        const next = visible[Math.min(visible.length - 1, Math.max(0, activeIndex + (key === 'j' ? 1 : -1)))]
        if (next) setActiveId(next.id)
      } else if (!active || regenerating.has(active.id)) {
        return
      } else if (key === 'a') {
        schedule('approve', [active.id])
      } else if (key === 'r') {
        schedule('reject', [active.id])
      } else if (key === 'e') {
        setEditingId(active.id)
      } else if (key === 'g') {
        void regenerate(active)
      } else {
        return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const toggleSelect = (id) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectedVisible = visible.filter((question) => selected.has(question.id)).map((question) => question.id)
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length
  const scope = jobId ? null : [topic, subtopic].filter(Boolean).join(' / ')
  const scopeFromDrafts = drafts[0] ? `${drafts[0].topic} / ${drafts[0].subtopic}` : ''
  const practiceTopic = topic || drafts[0]?.topic

  const applyFilters = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (filterTopic.trim()) params.set('topic', filterTopic.trim())
    if (filterSubtopic.trim()) params.set('subtopic', filterSubtopic.trim())
    const query = params.toString()
    navigate(`/admin/drafts${query ? `?${query}` : ''}`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Draft review"
        title={`${visible.length} draft${visible.length === 1 ? '' : 's'}${(scope || (jobId && scopeFromDrafts)) ? ` · ${scope || scopeFromDrafts}` : ''}`}
        subtitle={
          jobId ? (
            <>
              From <Link to={`/admin/jobs/${encodeURIComponent(jobId)}`} className="text-cyan-300 hover:underline">this job</Link> ·{' '}
              <Link to="/admin/drafts" className="text-cyan-300 hover:underline">all drafts</Link>
            </>
          ) : (
            'Keys: A approve · R reject · E edit · G regenerate · J/K next/previous'
          )
        }
      />

      {!jobId ? (
        <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={applyFilters}>
          <input className={inputClass} placeholder="Topic" value={filterTopic} onChange={(event) => setFilterTopic(event.target.value)} />
          <input className={inputClass} placeholder="Subtopic" value={filterSubtopic} onChange={(event) => setFilterSubtopic(event.target.value)} />
          <button type="submit" className={smallButtonClass}>
            Filter
          </button>
        </form>
      ) : null}

      <LoadState loader={loader} label="Loading drafts…" />
      {loader.error?.status === 422 ? <Banner tone="error">That job id is not valid.</Banner> : null}
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {loader.data && loader.data.total > LOAD_LIMIT ? (
        <Banner tone="info">Showing the oldest {LOAD_LIMIT} of {loader.data.total} drafts. Review these, then reload.</Banner>
      ) : null}

      {visible.length ? (
        <div className="sticky top-0 z-[5] mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-2.5 backdrop-blur">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((question) => question.id)))}
            />
            Select all
          </label>
          <span className="text-xs text-slate-500">{selectedVisible.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className={`${smallButtonClass} hover:border-emerald-400 hover:text-emerald-200`}
              disabled={!selectedVisible.length}
              onClick={() => schedule('approve', selectedVisible)}
            >
              Approve selected
            </button>
            <button
              type="button"
              className={`${smallButtonClass} hover:border-rose-400 hover:text-rose-200`}
              disabled={!selectedVisible.length}
              onClick={() => schedule('reject', selectedVisible)}
            >
              Reject selected
            </button>
          </div>
        </div>
      ) : null}

      {loader.data && !loader.loading && !visible.length && !pending.length ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">
          <p className="text-lg font-semibold text-white">All caught up.</p>
          <p className="mt-1">Approved questions are now in practice.</p>
          <Link to={practiceTopic ? `/?topic=${encodeURIComponent(practiceTopic)}` : '/'} className="mt-3 inline-block text-cyan-300 hover:underline">
            Go to practice{practiceTopic ? `: ${practiceTopic}` : ''}
          </Link>
        </div>
      ) : null}

      <ul className="space-y-4">
        {visible.map((question) => (
          <DraftCard
            key={question.id}
            question={question}
            active={active?.id === question.id}
            selected={selected.has(question.id)}
            editing={editingId === question.id}
            regenerating={regenerating.has(question.id)}
            error={cardErrors[question.id]}
            onFocus={() => setActiveId(question.id)}
            onToggleSelect={() => toggleSelect(question.id)}
            onApprove={() => schedule('approve', [question.id])}
            onReject={() => schedule('reject', [question.id])}
            onEdit={() => setEditingId(question.id)}
            onRegenerate={() => regenerate(question)}
            onCancelEdit={() => setEditingId(null)}
            onSaved={(updated) => {
              setDrafts((previous) => previous.map((item) => (item.id === updated.id ? updated : item)))
              setEditingId(null)
            }}
          />
        ))}
      </ul>

      {pending.length ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2">
          {pending.map((action) => (
            <div key={action.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-2xl shadow-black/50">
              <span>
                {action.kind === 'approve' ? 'Approving' : 'Rejecting'} {action.ids.length} question{action.ids.length === 1 ? '' : 's'}…
              </span>
              <button type="button" className="font-semibold text-cyan-300 hover:text-cyan-200" onClick={() => undo(action.key)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

export default DraftsPage
