import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { getTaxonomy, renameSubtopic, renameTopic } from '../api/client'

const sectionClass = 'space-y-3 rounded-3xl border border-slate-700 bg-slate-900/60 p-4'
const fieldClass =
  'w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50'
const submitClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50'

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// "12 questions · 2 drafts · 3 notes", skipping zero counts.
function usage(item) {
  const parts = []
  if (item.question_count) parts.push(plural(item.question_count, 'question'))
  if (item.draft_count) parts.push(plural(item.draft_count, 'draft'))
  if (item.note_count) parts.push(plural(item.note_count, 'note'))
  return parts.join(' · ') || 'unused'
}

function resultMessage(kind, from, to, result) {
  const parts = [plural(result.modified_count, 'question')]
  if (result.notes_modified) parts.push(plural(result.notes_modified, 'note'))
  if (result.jobs_modified) parts.push(plural(result.jobs_modified, 'generation job'))
  return `Renamed ${kind} "${from}" to "${to}" on ${parts.join(', ')}.${result.merged ? ` "${to}" already existed, so they are now merged.` : ''}`
}

function Feedback({ message }) {
  if (!message) {
    return null
  }
  const tone = message.error ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
  return <p className={`rounded-2xl border px-3 py-2 text-sm ${tone}`}>{message.text}</p>
}

// Rename a topic, or a subtopic within a topic, picked from dropdowns. Renames
// apply to questions (incl. drafts), notes and generation jobs on the server.
function RenameTaxonomyPanel({ onRenamed }) {
  const [topics, setTopics] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [topicFrom, setTopicFrom] = useState('')
  const [topicTo, setTopicTo] = useState('')
  const [topicBusy, setTopicBusy] = useState(false)
  const [topicMessage, setTopicMessage] = useState(null)

  const [subParent, setSubParent] = useState('')
  const [subFrom, setSubFrom] = useState('')
  const [subTo, setSubTo] = useState('')
  const [subBusy, setSubBusy] = useState(false)
  const [subMessage, setSubMessage] = useState(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const data = await getTaxonomy()
      setTopics(data.topics)
      return data.topics
    } catch (error) {
      setLoadError(error.message || 'Could not load topics.')
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getTaxonomy()
      .then((data) => !cancelled && setTopics(data.topics))
      .catch((error) => !cancelled && setLoadError(error.message || 'Could not load topics.'))
    return () => {
      cancelled = true
    }
  }, [])

  const topicNames = (topics ?? []).map((item) => item.topic)
  const selectedTopic = topics?.find((item) => item.topic === topicFrom)
  const parent = topics?.find((item) => item.topic === subParent)
  const selectedSub = parent?.subtopics.find((item) => item.subtopic === subFrom)

  const topicTarget = topicTo.trim()
  const topicMerges = Boolean(topicTarget && topicTarget !== topicFrom && topicNames.includes(topicTarget))
  const subTarget = subTo.trim()
  const subMerges = Boolean(subTarget && subTarget !== subFrom && parent?.subtopics.some((item) => item.subtopic === subTarget))

  const submitTopic = async (event) => {
    event.preventDefault()
    if (!topicFrom || !topicTarget || topicTarget === topicFrom) {
      return
    }
    setTopicBusy(true)
    setTopicMessage(null)
    try {
      const result = await renameTopic(topicFrom, topicTarget)
      setTopicMessage({ text: resultMessage('topic', topicFrom, topicTarget, result) })
      onRenamed?.({ kind: 'topic', from: topicFrom, to: topicTarget })
      if (subParent === topicFrom) {
        setSubParent(topicTarget)
      }
      setTopicFrom(topicTarget)
      setTopicTo('')
      await load()
    } catch (error) {
      setTopicMessage({ error: true, text: error.message || 'Topic rename failed.' })
    } finally {
      setTopicBusy(false)
    }
  }

  const submitSubtopic = async (event) => {
    event.preventDefault()
    if (!subParent || !subFrom || !subTarget || subTarget === subFrom) {
      return
    }
    setSubBusy(true)
    setSubMessage(null)
    try {
      const result = await renameSubtopic(subParent, subFrom, subTarget)
      setSubMessage({ text: resultMessage('subtopic', subFrom, subTarget, result) })
      onRenamed?.({ kind: 'subtopic', topic: subParent, from: subFrom, to: subTarget })
      setSubFrom(subTarget)
      setSubTo('')
      await load()
    } catch (error) {
      setSubMessage({ error: true, text: error.message || 'Subtopic rename failed.' })
    } finally {
      setSubBusy(false)
    }
  }

  if (loadError && !topics) {
    return (
      <div className={sectionClass}>
        <p className="text-sm text-rose-200">{loadError}</p>
        <button type="button" className={submitClass} onClick={load}>
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    )
  }

  if (!topics) {
    return (
      <div className={`${sectionClass} flex items-center gap-2 text-sm text-slate-400`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading topics…
      </div>
    )
  }

  if (!topics.length) {
    return <div className={`${sectionClass} text-sm text-slate-400`}>No topics yet. Add questions or notes first.</div>
  }

  return (
    <div className="space-y-4">
      <form className={sectionClass} onSubmit={submitTopic}>
        <div>
          <h3 className="text-lg font-semibold text-white">Rename topic</h3>
          <p className="mt-1 text-sm text-slate-400">Applies to every question, draft and note in the topic.</p>
        </div>
        <select
          className={fieldClass}
          aria-label="Topic to rename"
          value={topicFrom}
          onChange={(event) => {
            setTopicFrom(event.target.value)
            setTopicMessage(null)
          }}
        >
          <option value="">Choose a topic…</option>
          {topics.map((item) => (
            <option key={item.topic} value={item.topic}>
              {item.topic} ({usage(item)})
            </option>
          ))}
        </select>
        <input
          className={fieldClass}
          placeholder={selectedTopic ? `New name for "${selectedTopic.topic}"` : 'New topic name'}
          value={topicTo}
          maxLength={200}
          disabled={!topicFrom}
          onChange={(event) => setTopicTo(event.target.value)}
        />
        {topicMerges ? (
          <p className="text-sm text-amber-200">"{topicTarget}" already exists. Its subtopics and "{topicFrom}" will be merged into one topic.</p>
        ) : null}
        <Feedback message={topicMessage} />
        <button type="submit" className={submitClass} disabled={topicBusy || !topicFrom || !topicTarget || topicTarget === topicFrom}>
          {topicBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {topicMerges ? 'Merge topics' : 'Rename topic'}
        </button>
      </form>

      <form className={sectionClass} onSubmit={submitSubtopic}>
        <div>
          <h3 className="text-lg font-semibold text-white">Rename subtopic</h3>
          <p className="mt-1 text-sm text-slate-400">Applies to every question, draft and note in the subtopic.</p>
        </div>
        <select
          className={fieldClass}
          aria-label="Topic of the subtopic"
          value={subParent}
          onChange={(event) => {
            setSubParent(event.target.value)
            setSubFrom('')
            setSubMessage(null)
          }}
        >
          <option value="">Choose a topic…</option>
          {topics.map((item) => (
            <option key={item.topic} value={item.topic}>
              {item.topic}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          aria-label="Subtopic to rename"
          value={subFrom}
          disabled={!parent}
          onChange={(event) => {
            setSubFrom(event.target.value)
            setSubMessage(null)
          }}
        >
          <option value="">{parent ? 'Choose a subtopic…' : 'Pick a topic first'}</option>
          {(parent?.subtopics ?? []).map((item) => (
            <option key={item.subtopic} value={item.subtopic}>
              {item.subtopic} ({usage(item)})
            </option>
          ))}
        </select>
        <input
          className={fieldClass}
          placeholder={selectedSub ? `New name for "${selectedSub.subtopic}"` : 'New subtopic name'}
          value={subTo}
          maxLength={200}
          disabled={!subFrom}
          onChange={(event) => setSubTo(event.target.value)}
        />
        {subMerges ? (
          <p className="text-sm text-amber-200">"{subTarget}" already exists in {subParent}. The two subtopics will be merged.</p>
        ) : null}
        <Feedback message={subMessage} />
        <button type="submit" className={submitClass} disabled={subBusy || !subFrom || !subTarget || subTarget === subFrom}>
          {subBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {subMerges ? 'Merge subtopics' : 'Rename subtopic'}
        </button>
      </form>
    </div>
  )
}

export default RenameTaxonomyPanel
