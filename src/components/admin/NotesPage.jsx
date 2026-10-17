import { useState } from 'react'
import { Pencil, Plus, Sparkles } from 'lucide-react'
import { getTopics, listNotes } from '../../api/client'
import Link from '../../lib/Link'
import { navigate } from '../../lib/router'
import { formatRelative, formatSize, generateFromNoteHref, useLoader } from './helpers'
import { Badge, LoadState, PageHeader, Pager, TagChips, cardClass, inputClass, primaryButtonClass, smallButtonClass } from './ui'

const PAGE_SIZE = 50

function NotesPage() {
  const [topic, setTopic] = useState('')
  const [subtopic, setSubtopic] = useState('')
  const [offset, setOffset] = useState(0)

  const notes = useLoader(
    () => listNotes({ topic: topic.trim() || undefined, subtopic: subtopic.trim() || undefined, limit: PAGE_SIZE, offset }),
    [topic, subtopic, offset],
  )
  const topics = useLoader(() => getTopics(), [])

  const items = notes.data?.items ?? []
  const topicOptions = [...new Set([...(topics.data?.topics ?? []), ...items.map((note) => note.topic)])].sort()
  const subtopicOptions = [...new Set(items.filter((note) => !topic || note.topic === topic).map((note) => note.subtopic))].sort()

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Notes"
        subtitle="Study notes the LLM turns into questions."
        actions={
          <button type="button" className={primaryButtonClass} onClick={() => navigate('/admin/notes/new')}>
            <Plus className="h-4 w-4" /> New note
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          list="notes-topic-options"
          placeholder="Filter by topic"
          value={topic}
          onChange={(event) => {
            setTopic(event.target.value)
            setOffset(0)
          }}
        />
        <input
          className={inputClass}
          list="notes-subtopic-options"
          placeholder="Filter by subtopic"
          value={subtopic}
          onChange={(event) => {
            setSubtopic(event.target.value)
            setOffset(0)
          }}
        />
        <datalist id="notes-topic-options">
          {topicOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <datalist id="notes-subtopic-options">
          {subtopicOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>

      <LoadState loader={notes} label="Loading notes…" />

      {!notes.loading && !notes.error && !items.length ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">
          {topic || subtopic ? 'No notes match these filters.' : 'No notes yet. Write one to start generating questions.'}
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((note) => (
          <li key={note.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link to={`/admin/notes/${encodeURIComponent(note.id)}`} className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-full font-semibold text-white hover:text-cyan-200 sm:w-auto">{note.title}</span>
                  <Badge tone="cyan">
                    {note.topic} / {note.subtopic}
                  </Badge>
                  <Badge>{formatSize(note.content_length)}</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-slate-400">{note.preview}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <TagChips tags={note.tags} />
                  <span className="text-xs text-slate-500">Edited {formatRelative(note.updated_at)}</span>
                </div>
              </Link>
              <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
                <button
                  type="button"
                  className={`${smallButtonClass} inline-flex flex-1 items-center justify-center gap-1 py-2 sm:flex-none`}
                  onClick={() => navigate(`/admin/notes/${encodeURIComponent(note.id)}/edit`)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  className={`${smallButtonClass} inline-flex flex-1 items-center justify-center gap-1 py-2 sm:flex-none`}
                  onClick={() => navigate(generateFromNoteHref(note))}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {notes.data ? <Pager total={notes.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} /> : null}
    </>
  )
}

export default NotesPage
