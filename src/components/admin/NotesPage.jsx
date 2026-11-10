import { useState } from 'react'
import { Pencil, Plus, Sparkles } from 'lucide-react'
import { listNotes } from '../../api/client'
import Link from '../../lib/Link'
import { navigate } from '../../lib/router'
import { formatRelative, formatSize, generateFromNoteHref, useLoader } from './helpers'
import { Badge, Banner, LoadState, PageHeader, Pager, TagChips, cardClass, inputClass, primaryButtonClass, smallButtonClass } from './ui'

const PAGE_SIZE = 50

// Used both for the public reading list (/notes) and the admin Notes tab (/admin/notes).
// Create/edit/generate controls only render for admins; the backend enforces it too.
function NotesPage({ isAdmin = false, basePath = '/notes' }) {
  const [topic, setTopic] = useState('')
  const [subtopic, setSubtopic] = useState('')
  const [offset, setOffset] = useState(0)

  const notes = useLoader(
    () => listNotes({ topic: topic || undefined, subtopic: subtopic || undefined, limit: PAGE_SIZE, offset }),
    [topic, subtopic, offset],
  )
  // Filter options come from the notes themselves (public), so they only list values that have notes.
  const taxonomy = useLoader(async () => {
    const all = await listNotes({ limit: 200 })
    const byTopic = {}
    all.items.forEach((note) => {
      byTopic[note.topic] = [...new Set([...(byTopic[note.topic] ?? []), note.subtopic])]
    })
    return byTopic
  }, [])

  const items = notes.data?.items ?? []
  const byTopic = taxonomy.data ?? {}
  const sortText = (a, b) => a.localeCompare(b)
  const topicOptions = Object.keys(byTopic).sort(sortText)
  const subtopicOptions = topic ? [...(byTopic[topic] ?? [])].sort(sortText) : [...new Set(Object.values(byTopic).flat())].sort(sortText)

  return (
    <>
      <PageHeader
        eyebrow={isAdmin && basePath.startsWith('/admin') ? 'Admin' : 'Study'}
        title="Notes"
        subtitle={isAdmin ? 'Study notes the LLM turns into questions.' : 'Read and revise study notes by topic.'}
        actions={
          isAdmin ? (
            <button type="button" className={primaryButtonClass} onClick={() => navigate('/admin/notes/new')}>
              <Plus className="h-4 w-4" /> New note
            </button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <select
          className={inputClass}
          aria-label="Filter by topic"
          value={topic}
          onChange={(event) => {
            setTopic(event.target.value)
            setSubtopic('')
            setOffset(0)
          }}
        >
          <option value="">All topics</option>
          {topicOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          aria-label="Filter by subtopic"
          value={subtopic}
          onChange={(event) => {
            setSubtopic(event.target.value)
            setOffset(0)
          }}
        >
          <option value="">{topic ? `All subtopics in ${topic}` : 'All subtopics'}</option>
          {subtopicOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {notes.error && [401, 403].includes(notes.error.status) ? (
        <Banner tone="warning">Reading notes without logging in isn't available on this server yet.</Banner>
      ) : (
        <LoadState loader={notes} label="Loading notes…" />
      )}

      {!notes.loading && !notes.error && !items.length ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">
          {topic || subtopic ? 'No notes match these filters.' : isAdmin ? 'No notes yet. Write one to start generating questions.' : 'No notes yet.'}
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((note) => (
          <li key={note.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link to={`${basePath}/${encodeURIComponent(note.id)}`} className="min-w-0 flex-1 space-y-2">
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
              {isAdmin ? (
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
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {notes.data ? <Pager total={notes.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} /> : null}
    </>
  )
}

export default NotesPage
