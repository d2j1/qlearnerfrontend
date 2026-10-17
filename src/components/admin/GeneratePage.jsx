import { useState } from 'react'
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { createJob, getNote, getTopics, listJobs, listModels, listNotes, listPrompts } from '../../api/client'
import Link from '../../lib/Link'
import { navigate } from '../../lib/router'
import { formatSize, useLoader } from './helpers'
import { Badge, Banner, LoadState, PageHeader, cardClass, inputClass, primaryButtonClass } from './ui'

const DIFFICULTIES = [
  ['MIXED', 'Mixed'],
  ['EASY', 'Easy'],
  ['MEDIUM', 'Medium'],
  ['HARD', 'Hard'],
]
const MAX_NOTES = 50
const MAX_FOCUS = 2000
const MAX_EXTRA = 4000

function GenerateForm({ initialNote, models, prompts, topicOptions }) {
  const defaultModel = models.find((model) => model.is_default) ?? null
  const defaultPrompt = prompts.find((prompt) => prompt.is_default) ?? null

  const [form, setForm] = useState({
    topic: initialNote?.topic ?? '',
    subtopic: initialNote?.subtopic ?? '',
    note_ids: initialNote ? [initialNote.id] : [],
    focus: '',
    count: 10,
    difficulty: 'MIXED',
    allow_outside_knowledge: false,
    extra_instructions: '',
    llm_config_id: defaultModel?.id ?? '',
    prompt_template_id: defaultPrompt?.id ?? '',
  })
  // Summaries of picked notes, so they stay listed when the topic filter changes.
  const [pickedNotes, setPickedNotes] = useState(() =>
    initialNote ? { [initialNote.id]: { ...initialNote, content_length: initialNote.content.length } } : {},
  )
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const setField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  // Notes filtered by the chosen topic/subtopic; selected notes stay visible even if filtered out.
  const notes = useLoader(
    () => listNotes({ topic: form.topic.trim() || undefined, subtopic: form.subtopic.trim() || undefined, limit: 200 }),
    [form.topic, form.subtopic],
  )
  const activeJobs = useLoader(async () => {
    const [running, queued] = await Promise.all([listJobs({ status: 'running', limit: 1 }), listJobs({ status: 'queued', limit: 1 })])
    return running.total + queued.total
  }, [])

  const noteItems = notes.data?.items ?? []
  const selectedModel = models.find((model) => model.id === form.llm_config_id) ?? defaultModel
  const selectedPrompt = prompts.find((prompt) => prompt.id === form.prompt_template_id)
  const hasNotes = form.note_ids.length > 0
  const jobInFlight = (activeJobs.data ?? 0) > 0

  const toggleNote = (note) => {
    setPickedNotes((previous) => {
      const next = { ...previous }
      if (next[note.id]) delete next[note.id]
      else next[note.id] = note
      return next
    })
    setForm((previous) => {
      const selected = previous.note_ids.includes(note.id)
      const note_ids = selected ? previous.note_ids.filter((id) => id !== note.id) : [...previous.note_ids, note.id]
      return {
        ...previous,
        note_ids,
        // Pre-fill topic/subtopic from the first note picked.
        topic: previous.topic || note.topic,
        subtopic: previous.subtopic || note.subtopic,
        allow_outside_knowledge: note_ids.length ? previous.allow_outside_knowledge : false,
      }
    })
  }

  const validate = () => {
    const next = {}
    if (!form.topic.trim()) next.topic = 'Topic is required.'
    if (!form.subtopic.trim()) next.subtopic = 'Subtopic is required.'
    if (!hasNotes && !form.focus.trim()) next.focus = 'Provide note_ids, a focus description, or both.'
    if (form.note_ids.length > MAX_NOTES) next.note_ids = `Select at most ${MAX_NOTES} notes.`
    if (form.focus.length > MAX_FOCUS) next.focus = `Focus must be ${MAX_FOCUS} characters or fewer.`
    if (form.extra_instructions.length > MAX_EXTRA) next.extra_instructions = `Must be ${MAX_EXTRA} characters or fewer.`
    if (!Number.isInteger(form.count) || form.count < 1 || form.count > 50) next.count = 'Count must be between 1 and 50.'
    return next
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const clientErrors = validate()
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      return
    }

    const body = {
      topic: form.topic.trim(),
      subtopic: form.subtopic.trim(),
      count: form.count,
      difficulty: form.difficulty,
      allow_outside_knowledge: hasNotes && form.allow_outside_knowledge,
      ...(hasNotes ? { note_ids: form.note_ids } : {}),
      ...(form.focus.trim() ? { focus: form.focus.trim() } : {}),
      ...(form.extra_instructions.trim() ? { extra_instructions: form.extra_instructions.trim() } : {}),
      ...(form.llm_config_id ? { llm_config_id: form.llm_config_id } : {}),
      ...(form.prompt_template_id ? { prompt_template_id: form.prompt_template_id } : {}),
    }

    setSubmitting(true)
    try {
      const job = await createJob(body)
      navigate(`/admin/jobs/${encodeURIComponent(job.id)}`)
    } catch (jobError) {
      if (jobError.status === 409) {
        setErrors({ llm_config_id: jobError.message })
      } else if (jobError.status === 404) {
        setErrors({ form: jobError.message || 'A selected note, model or template no longer exists.' })
      } else if (jobError.status === 422 && Array.isArray(jobError.details?.detail)) {
        const fieldErrors = {}
        jobError.details.detail.forEach((item) => {
          const field = item.loc?.[1] && item.loc[1] in form ? item.loc[1] : 'form'
          fieldErrors[field] = item.msg.replace(/^Value error, /, '')
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ form: jobError.message || 'Could not start the job.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (field) => (errors[field] ? <p className="mt-1 text-xs text-rose-300">{errors[field]}</p> : null)
  const visibleNotes = [
    ...Object.values(pickedNotes).filter((picked) => !noteItems.some((note) => note.id === picked.id)),
    ...noteItems,
  ]

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {errors.form ? <Banner tone="error">{errors.form}</Banner> : null}
      {jobInFlight ? (
        <Banner
          tone="warning"
          action={
            <Link to="/admin/jobs" className="text-xs underline">
              View jobs
            </Link>
          }
        >
          A job is already running. Wait for it to finish to stay inside free-tier rate limits.
        </Banner>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Topic
          <input className={`${inputClass} mt-1`} list="generate-topic-options" value={form.topic} onChange={(event) => setField('topic', event.target.value)} />
          {fieldError('topic')}
        </label>
        <label className="block text-sm text-slate-300">
          Subtopic
          <input
            className={`${inputClass} mt-1`}
            list="generate-subtopic-options"
            value={form.subtopic}
            onChange={(event) => setField('subtopic', event.target.value)}
          />
          {fieldError('subtopic')}
        </label>
        <datalist id="generate-topic-options">
          {topicOptions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <datalist id="generate-subtopic-options">
          {[...new Set(noteItems.map((note) => note.subtopic))].map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>

      <div className="text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>
            Notes <span className="text-slate-500">(optional, {form.note_ids.length} selected)</span>
          </span>
          <Link to="/admin/notes/new" className="text-xs text-cyan-300 hover:underline">
            New note
          </Link>
        </div>
        <div className="mt-1 max-h-64 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950">
          <LoadState loader={notes} label="Loading notes…" />
          {!notes.loading && !visibleNotes.length ? (
            <p className="p-4 text-slate-500">No notes for this topic/subtopic. Use a focus description instead, or write a note.</p>
          ) : null}
          {visibleNotes.map((note) => (
            <label key={note.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-800 px-4 py-2.5 last:border-b-0 hover:bg-slate-900">
              <input type="checkbox" checked={form.note_ids.includes(note.id)} onChange={() => toggleNote(note)} />
              <span className="min-w-0 flex-1 truncate text-slate-200">{note.title}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {note.topic} / {note.subtopic}
              </span>
              <Badge>{formatSize(note.content_length)}</Badge>
            </label>
          ))}
        </div>
        {fieldError('note_ids')}
      </div>

      <label className="block text-sm text-slate-300">
        Focus <span className="text-slate-500">{hasNotes ? '(optional)' : '(required without notes)'}</span>
        <textarea
          className={`${inputClass} mt-1 min-h-20`}
          placeholder="What should the questions cover?"
          value={form.focus}
          onChange={(event) => setField('focus', event.target.value)}
        />
        <span className={`mt-1 block text-xs ${form.focus.length > MAX_FOCUS ? 'text-rose-300' : 'text-slate-500'}`}>
          {form.focus.length} / {MAX_FOCUS}
        </span>
        {fieldError('focus')}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Count
          <input
            className={`${inputClass} mt-1`}
            type="number"
            min={1}
            max={50}
            value={form.count}
            onChange={(event) => setField('count', Number(event.target.value))}
          />
          {fieldError('count')}
        </label>
        <div className="text-sm text-slate-300">
          Difficulty
          <div className="mt-1 grid grid-cols-4 rounded-2xl border border-slate-700 bg-slate-950 p-1">
            {DIFFICULTIES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-xl py-2 text-xs font-medium ${form.difficulty === value ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setField('difficulty', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className={`flex items-start gap-3 text-sm ${hasNotes ? 'text-slate-300' : 'text-slate-500'}`}>
        <input
          type="checkbox"
          className="mt-1"
          disabled={!hasNotes}
          checked={form.allow_outside_knowledge}
          onChange={(event) => setField('allow_outside_knowledge', event.target.checked)}
        />
        <span>
          Allow outside knowledge
          <span className="block text-xs text-slate-500">Off = questions use only facts in your notes.</span>
        </span>
      </label>

      <label className="block text-sm text-slate-300">
        Extra instructions <span className="text-slate-500">(optional)</span>
        <textarea
          className={`${inputClass} mt-1 min-h-20`}
          placeholder="e.g. Interview style, include code snippets, tricky edge cases"
          value={form.extra_instructions}
          onChange={(event) => setField('extra_instructions', event.target.value)}
        />
        {fieldError('extra_instructions')}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Model
          <select className={`${inputClass} mt-1`} value={form.llm_config_id} onChange={(event) => setField('llm_config_id', event.target.value)}>
            {!defaultModel ? <option value="">Server default</option> : null}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
                {model.is_free ? ' · Free' : ''}
                {model.is_default ? ' · Default' : ''}
              </option>
            ))}
          </select>
          {selectedModel && !selectedModel.api_key_set ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" /> {selectedModel.api_key_env} is not set on the server; this job will fail.
            </p>
          ) : null}
          {!models.length ? (
            <p className="mt-1 text-xs text-amber-200">
              No enabled models. <Link to="/settings/models" className="underline">Add one in Settings → Models</Link>.
            </p>
          ) : null}
          {fieldError('llm_config_id')}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="flex items-center justify-between">
            Prompt template
            {selectedPrompt ? (
              <Link to={`/settings/prompts?id=${encodeURIComponent(selectedPrompt.id)}`} className="text-xs text-cyan-300 hover:underline">
                View
              </Link>
            ) : null}
          </span>
          <select className={`${inputClass} mt-1`} value={form.prompt_template_id} onChange={(event) => setField('prompt_template_id', event.target.value)}>
            {!defaultPrompt ? <option value="">Server default</option> : null}
            {prompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.name} v{prompt.version}
                {prompt.is_default ? ' · Default' : ''}
              </option>
            ))}
          </select>
          {fieldError('prompt_template_id')}
        </label>
      </div>

      <button type="submit" className={`${primaryButtonClass} w-full py-3`} disabled={submitting || jobInFlight}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate {form.count} question{form.count === 1 ? '' : 's'}
      </button>
    </form>
  )
}

function GeneratePage({ noteId }) {
  const setup = useLoader(async () => {
    const [models, prompts, topics, note] = await Promise.all([
      listModels(),
      listPrompts(),
      getTopics(),
      noteId ? getNote(noteId).catch(() => null) : null,
    ])
    return { models: models.filter((model) => model.enabled), prompts, topics: topics.topics ?? [], note }
  }, [noteId])

  return (
    <>
      <PageHeader eyebrow="Admin" title="Generate questions" subtitle="Questions are created as drafts. Nothing reaches practice until you approve it." />
      {setup.data ? (
        <div className={cardClass}>
          <GenerateForm
            key={noteId ?? 'blank'}
            initialNote={setup.data.note}
            models={setup.data.models}
            prompts={setup.data.prompts}
            topicOptions={setup.data.topics}
          />
        </div>
      ) : (
        <LoadState loader={setup} />
      )}
    </>
  )
}

export default GeneratePage
