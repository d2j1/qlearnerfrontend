import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Search, Trash2 } from 'lucide-react'
import { deleteQuestion, getQuestions, getSubtopics, getTopics } from '../../api/client'
import { navigate } from '../../lib/router'
import Markdown from './Markdown'
import { QuestionEditForm, QuestionPreview } from './QuestionEditForm'
import { formatRelative, useLoader } from './helpers'
import { Badge, ConfirmDialog, DifficultyBadge, LoadState, PageHeader, Pager, TagChips, cardClass, inputClass, smallButtonClass } from './ui'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

// Filters live in the URL so a filtered list can be reloaded or linked.
function setFilters(filters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value))
  const search = params.toString()
  navigate(`/admin/questions${search ? `?${search}` : ''}`, { replace: true })
}

function QuestionRow({ question, expanded, editing, onToggle, onEdit, onCancelEdit, onSaved, onDelete }) {
  return (
    <li className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 flex-1 space-y-2">
            {expanded ? null : <Markdown className="line-clamp-2 text-sm text-slate-100">{question.question_text}</Markdown>}
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">
                {question.topic} / {question.subtopic}
              </Badge>
              <DifficultyBadge difficulty={question.difficulty} />
              <TagChips tags={question.tags} />
              <span className="text-xs text-slate-500">Added {formatRelative(question.created_at)}</span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1`} disabled={editing} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            className={`${smallButtonClass} inline-flex items-center gap-1 hover:border-rose-400 hover:text-rose-200`}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4">
          <QuestionEditForm question={question} onCancel={onCancelEdit} onSaved={onSaved} />
        </div>
      ) : expanded ? (
        <div className="mt-4">
          <QuestionPreview question={question} />
        </div>
      ) : null}
    </li>
  )
}

function QuestionsPage({ topic = '', subtopic = '', q = '' }) {
  // The page offset belongs to one set of filters; changing a filter starts again at page 1.
  const filterKey = JSON.stringify([topic, subtopic, q])
  const [page, setPage] = useState({ key: filterKey, offset: 0 })
  const offset = page.key === filterKey ? page.offset : 0
  const setOffset = (next) => setPage({ key: filterKey, offset: next })

  const [search, setSearch] = useState(q)
  const [edited, setEdited] = useState({}) // id -> question saved since the page loaded
  const [deletedIds, setDeletedIds] = useState(() => new Set())
  const [expanded, setExpanded] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search.trim() === q) {
      return undefined
    }
    const timer = setTimeout(() => setFilters({ topic, subtopic, q: search.trim() }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, q, topic, subtopic])

  const questions = useLoader(
    () => getQuestions({ topic: topic || undefined, subtopic: subtopic || undefined, q, limit: PAGE_SIZE, offset }),
    [topic, subtopic, q, offset],
  )
  const topics = useLoader(() => getTopics(), [])
  const subtopics = useLoader(() => (topic ? getSubtopics(topic).catch(() => ({ subtopics: [] })) : Promise.resolve({ subtopics: [] })), [topic])

  const loaded = questions.data?.items ?? []
  const rows = loaded.filter((row) => !deletedIds.has(row.id)).map((row) => edited[row.id] ?? row)
  const total = Math.max(0, (questions.data?.total ?? 0) - (loaded.length - rows.length))

  const toggle = (id) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleSaved = (updated) => {
    setEdited((previous) => ({ ...previous, [updated.id]: updated }))
    setEditingId(null)
  }

  const handleDelete = async () => {
    const id = deleting.id
    await deleteQuestion(id)
    setDeleting(null)
    setDeletedIds((previous) => new Set(previous).add(id))
    const remaining = rows.filter((row) => row.id !== id)
    if (!remaining.length && offset > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE))
    } else {
      // Pull the next question up so the page stays full.
      void questions.reload()
    }
  }

  const filtered = Boolean(topic || subtopic || q)

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Questions"
        subtitle={questions.data ? `${total} published question${total === 1 ? '' : 's'}${filtered ? ' match' : ''}` : 'Published questions'}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        <select className={inputClass} aria-label="Topic" value={topic} onChange={(event) => setFilters({ topic: event.target.value, q })}>
          <option value="">All topics</option>
          {(topics.data?.topics ?? []).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          aria-label="Subtopic"
          value={subtopic}
          disabled={!topic}
          onChange={(event) => setFilters({ topic, subtopic: event.target.value, q })}
        >
          <option value="">{topic ? 'All subtopics' : 'Pick a topic first'}</option>
          {(subtopics.data?.subtopics ?? []).map((item) => (
            <option key={item.subtopic} value={item.subtopic}>
              {item.subtopic} ({item.question_count})
            </option>
          ))}
        </select>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className={`${inputClass} pl-10`}
            type="search"
            placeholder="Search question text"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <LoadState loader={questions} label="Loading questions…" />

      {!questions.loading && !questions.error && !rows.length ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">
          {filtered ? 'No questions match.' : 'No published questions yet. Approve drafts or bulk-ingest questions to see them here.'}
        </div>
      ) : null}

      <ul className="space-y-3">
        {rows.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            expanded={expanded.has(question.id)}
            editing={editingId === question.id}
            onToggle={() => toggle(question.id)}
            onEdit={() => setEditingId(question.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaved={handleSaved}
            onDelete={() => setDeleting(question)}
          />
        ))}
      </ul>

      <Pager total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />

      {deleting ? (
        <ConfirmDialog
          title="Delete question?"
          body="This can't be undone. The question will disappear from practice for everyone."
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </>
  )
}

export default QuestionsPage
