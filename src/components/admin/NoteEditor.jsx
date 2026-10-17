import { useState } from 'react'
import { ArrowLeft, BookOpen, Loader2, Sparkles } from 'lucide-react'
import { createNote, deleteNote, getNote, getSubtopics, getTopics, listNotes, updateNote } from '../../api/client'
import Link from '../../lib/Link'
import { navigate, useNavigationBlocker } from '../../lib/router'
import Combobox from './Combobox'
import Markdown from './Markdown'
import { generateFromNoteHref, useLoader } from './helpers'
import { Banner, LoadState, PageHeader, TagInput, inputClass, primaryButtonClass, smallButtonClass } from './ui'

const MAX_CONTENT = 200000
const CHUNK_WARNING = 12000
const EMPTY_NOTE = { topic: '', subtopic: '', title: '', content: '', tags: [] }
const FIELDS = ['topic', 'subtopic', 'title', 'content', 'tags']

function toForm(note) {
  return { topic: note.topic, subtopic: note.subtopic, title: note.title, content: note.content, tags: note.tags ?? [] }
}

function sameValue(a, b) {
  return Array.isArray(a) ? a.length === b.length && a.every((item, index) => item === b[index]) : a === b
}

function NoteEditorForm({ note }) {
  const isNew = !note
  const [saved, setSaved] = useState(() => (note ? toForm(note) : EMPTY_NOTE))
  const [form, setForm] = useState(saved)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  // Split view needs a wide screen; phones start on Write.
  const [view, setView] = useState(() => (window.matchMedia?.('(min-width: 1024px)').matches ? 'split' : 'write')) // 'write' | 'split' | 'preview'
  // Existing topics/subtopics from questions and other notes, so new notes can join them.
  const taxonomy = useLoader(async () => {
    const [topics, notes] = await Promise.all([getTopics(), listNotes({ limit: 200 })])
    const noteSubtopics = {}
    notes.items.forEach((item) => {
      noteSubtopics[item.topic] = [...new Set([...(noteSubtopics[item.topic] ?? []), item.subtopic])]
    })
    return { topics: [...new Set([...(topics.topics ?? []), ...Object.keys(noteSubtopics)])].sort((a, b) => a.localeCompare(b)), noteSubtopics }
  }, [])
  const topicKey = form.topic.trim()
  const knownTopic = Boolean(taxonomy.data?.topics.includes(topicKey))
  const questionSubtopics = useLoader(
    () => (knownTopic ? getSubtopics(topicKey).then((page) => page.subtopics.map((item) => item.subtopic)).catch(() => []) : Promise.resolve([])),
    [topicKey, knownTopic],
  )
  const subtopicOptions = [...new Set([...(questionSubtopics.data ?? []), ...(taxonomy.data?.noteSubtopics[topicKey] ?? [])])].sort((a, b) =>
    a.localeCompare(b),
  )

  const changedFields = FIELDS.filter((field) => !sameValue(form[field], saved[field]))
  const dirty = changedFields.length > 0
  useNavigationBlocker(dirty ? 'You have unsaved changes. Leave without saving?' : null)

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setNotice('')
  }

  const validate = () => {
    const next = {}
    ;['topic', 'subtopic', 'title'].forEach((field) => {
      const value = form[field].trim()
      if (!value) next[field] = 'Required.'
      else if (value.length > 200) next[field] = 'Must be 200 characters or fewer.'
    })
    if (!form.content.trim()) next.content = 'Content is required.'
    else if (form.content.length > MAX_CONTENT) next.content = `Content must be ${MAX_CONTENT.toLocaleString()} characters or fewer.`
    return next
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const clientErrors = validate()
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      return
    }

    const payload = {
      topic: form.topic.trim(),
      subtopic: form.subtopic.trim(),
      title: form.title.trim(),
      content: form.content,
      tags: form.tags,
    }
    setSaving(true)
    try {
      if (isNew) {
        const created = await createNote(payload)
        setSaved(toForm(created))
        setForm(toForm(created))
        navigate(`/admin/notes/${encodeURIComponent(created.id)}`, { replace: true, force: true })
      } else {
        const patch = Object.fromEntries(changedFields.map((field) => [field, payload[field]]))
        const updated = await updateNote(note.id, patch)
        setSaved(toForm(updated))
        setForm(toForm(updated))
        setNotice('Saved.')
      }
    } catch (saveError) {
      if (saveError.status === 422 && Array.isArray(saveError.details?.detail)) {
        const fieldErrors = {}
        saveError.details.detail.forEach((item) => {
          const field = FIELDS.includes(item.loc?.[1]) ? item.loc[1] : 'form'
          fieldErrors[field] = item.msg
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ form: saveError.message || 'Saving failed.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${saved.title}"? Questions already generated from it keep working.`)) {
      return
    }
    try {
      await deleteNote(note.id)
      navigate('/admin/notes', { replace: true, force: true })
    } catch (deleteError) {
      setErrors({ form: deleteError.message || 'Delete failed.' })
    }
  }

  const length = form.content.length
  const fieldError = (field) => (errors[field] ? <p className="mt-1 text-xs text-rose-300">{errors[field]}</p> : null)

  return (
    <form onSubmit={handleSave} noValidate>
      <Link
        to={isNew ? '/admin/notes' : `/admin/notes/${encodeURIComponent(note.id)}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-200"
      >
        <ArrowLeft className="h-4 w-4" /> {isNew ? 'All notes' : 'Back to note'}
      </Link>
      <PageHeader
        eyebrow="Notes"
        title={isNew ? 'New note' : saved.title}
        actions={
          <>
            {!isNew ? (
              <>
                <button
                  type="button"
                  className={`${smallButtonClass} inline-flex items-center gap-1`}
                  onClick={() => navigate(`/admin/notes/${encodeURIComponent(note.id)}`)}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Read
                </button>
                <button
                  type="button"
                  className={`${smallButtonClass} inline-flex items-center gap-1`}
                  onClick={() => navigate(generateFromNoteHref(note))}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate
                </button>
                <button type="button" className={`${smallButtonClass} hover:border-rose-400 hover:text-rose-200`} onClick={handleDelete}>
                  Delete
                </button>
              </>
            ) : null}
            <button type="submit" className={primaryButtonClass} disabled={saving || (!isNew && !dirty)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isNew ? 'Create note' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </>
        }
      />

      {errors.form ? <Banner tone="error">{errors.form}</Banner> : null}
      {notice && !dirty ? <Banner tone="success">{notice}</Banner> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm text-slate-300">
          Topic
          <Combobox
            value={form.topic}
            options={taxonomy.data?.topics ?? []}
            loading={taxonomy.loading}
            placeholder="Pick a topic or type a new one"
            newLabel="New topic"
            onChange={(topic) => setField('topic', topic)}
          />
          {fieldError('topic')}
        </label>
        <label className="block text-sm text-slate-300">
          Subtopic
          <Combobox
            value={form.subtopic}
            options={subtopicOptions}
            loading={questionSubtopics.loading}
            placeholder={topicKey ? 'Pick a subtopic or type a new one' : 'Pick a topic first'}
            newLabel="New subtopic"
            onChange={(subtopic) => setField('subtopic', subtopic)}
          />
          {fieldError('subtopic')}
        </label>
        <label className="block text-sm text-slate-300">
          Title
          <input className={`${inputClass} mt-1`} value={form.title} onChange={(event) => setField('title', event.target.value)} />
          {fieldError('title')}
        </label>
      </div>

      <div className="mb-4 text-sm text-slate-300">
        Tags
        <div className="mt-1">
          <TagInput value={form.tags} onChange={(tags) => setField('tags', tags)} />
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-700 p-0.5 text-xs">
          {['write', 'split', 'preview'].map((mode) => (
            // Split only makes sense side by side, so it is hidden on small screens.
            <button
              key={mode}
              type="button"
              className={`rounded-lg px-3 py-1 capitalize ${mode === 'split' ? 'hidden lg:inline-block' : ''} ${view === mode ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setView(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <span className={`text-xs ${length > MAX_CONTENT ? 'text-rose-300' : length > CHUNK_WARNING ? 'text-amber-200' : 'text-slate-500'}`}>
          {length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
          {length > CHUNK_WARNING && length <= MAX_CONTENT ? ' · Long notes are split into several LLM calls' : ''}
        </span>
      </div>

      <div className={`grid gap-3 ${view === 'split' ? 'lg:grid-cols-2' : ''}`}>
        {view !== 'preview' ? (
          <textarea
            className={`${inputClass} min-h-[60vh] font-mono lg:min-h-[28rem]`}
            placeholder="Write your notes in markdown…"
            value={form.content}
            onChange={(event) => setField('content', event.target.value)}
          />
        ) : null}
        {view !== 'write' ? (
          <div className="min-h-[60vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200 lg:min-h-[28rem]">
            {form.content.trim() ? <Markdown>{form.content}</Markdown> : <p className="text-slate-500">Nothing to preview.</p>}
          </div>
        ) : null}
      </div>
      {fieldError('content')}
    </form>
  )
}

function NoteEditor({ noteId }) {
  const note = useLoader(() => (noteId ? getNote(noteId) : Promise.resolve(null)), [noteId])

  if (noteId && !note.data) {
    if (note.error?.status === 404) {
      return <Banner tone="error">This note no longer exists.</Banner>
    }
    return <LoadState loader={note} label="Loading note…" />
  }
  // Remount when switching notes (or after "new" becomes an id) so the form resets.
  return <NoteEditorForm key={note.data?.id ?? 'new'} note={note.data} />
}

export default NoteEditor
