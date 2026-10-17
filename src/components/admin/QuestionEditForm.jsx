import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { patchQuestion } from '../../api/client'
import Markdown from './Markdown'
import { TagInput, inputClass, primaryButtonClass, smallButtonClass } from './ui'

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD']

// Read-only question body: text, options with the correct ones ticked, explanation.
export function QuestionPreview({ question }) {
  const correct = new Set(question.correct_option_indices)
  return (
    <>
      <Markdown className="text-[0.95rem] text-slate-100">{question.question_text}</Markdown>
      <ul className="mt-3 space-y-2">
        {question.options.map((option) => (
          <li
            key={option.index}
            className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm ${
              correct.has(option.index) ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 text-slate-300'
            }`}
          >
            <span className="mt-0.5 w-4 shrink-0">{correct.has(option.index) ? <Check className="h-4 w-4 text-emerald-300" /> : null}</span>
            <Markdown className="min-w-0 flex-1">{option.text}</Markdown>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
        <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Explanation</p>
        <Markdown>{question.explanation}</Markdown>
      </div>
    </>
  )
}

// Edits every field of a question and PATCHes only what changed.
export function QuestionEditForm({ question, saveLabel = 'Save', onCancel, onSaved }) {
  const [form, setForm] = useState(() => ({
    question_text: question.question_text,
    options: question.options.map((option) => ({ ...option })),
    correct_option_indices: [...question.correct_option_indices],
    explanation: question.explanation,
    difficulty: question.difficulty,
    tags: question.tags ?? [],
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const handleSave = async () => {
    if (!form.correct_option_indices.length) {
      setError('Mark at least one correct option.')
      return
    }
    if (!form.question_text.trim() || form.options.some((option) => !option.text.trim())) {
      setError('Question text and every option need text.')
      return
    }

    const patch = {}
    if (form.question_text !== question.question_text) patch.question_text = form.question_text
    if (form.explanation !== question.explanation) patch.explanation = form.explanation
    if (form.difficulty !== question.difficulty) patch.difficulty = form.difficulty
    if (JSON.stringify(form.tags) !== JSON.stringify(question.tags ?? [])) patch.tags = form.tags
    if (JSON.stringify(form.options) !== JSON.stringify(question.options)) patch.options = form.options
    const sortedCorrect = [...form.correct_option_indices].sort((a, b) => a - b)
    if (JSON.stringify(sortedCorrect) !== JSON.stringify([...question.correct_option_indices].sort((a, b) => a - b))) {
      // The backend validates options and correct indices together.
      patch.correct_option_indices = sortedCorrect
      patch.options = form.options
    }
    if (!Object.keys(patch).length) {
      onCancel()
      return
    }

    setSaving(true)
    setError('')
    try {
      onSaved(await patchQuestion(question.id, patch))
    } catch (saveError) {
      setError(saveError.message || 'Saving failed.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-slate-300">
        Question (markdown)
        <textarea
          className={`${inputClass} mt-1 min-h-28 font-mono`}
          value={form.question_text}
          onChange={(event) => setField('question_text', event.target.value)}
        />
      </label>
      <div className="space-y-2 text-sm text-slate-300">
        Options <span className="text-xs text-slate-500">(tick the correct ones)</span>
        {form.options.map((option, position) => (
          <div key={option.index} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Option ${position + 1} is correct`}
              checked={form.correct_option_indices.includes(option.index)}
              onChange={(event) =>
                setField(
                  'correct_option_indices',
                  event.target.checked
                    ? [...form.correct_option_indices, option.index]
                    : form.correct_option_indices.filter((index) => index !== option.index),
                )
              }
            />
            <input
              className={`${inputClass} py-2`}
              value={option.text}
              onChange={(event) =>
                setField(
                  'options',
                  form.options.map((item) => (item.index === option.index ? { ...item, text: event.target.value } : item)),
                )
              }
            />
          </div>
        ))}
      </div>
      <label className="block text-sm text-slate-300">
        Explanation (markdown)
        <textarea className={`${inputClass} mt-1 min-h-24 font-mono`} value={form.explanation} onChange={(event) => setField('explanation', event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="block text-sm text-slate-300">
          Difficulty
          <select className={`${inputClass} mt-1`} value={form.difficulty} onChange={(event) => setField('difficulty', event.target.value)}>
            {DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-slate-300">
          Tags
          <div className="mt-1">
            <TagInput value={form.tags} onChange={(tags) => setField('tags', tags)} />
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={primaryButtonClass} disabled={saving} onClick={handleSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {saveLabel}
        </button>
        <button type="button" className={smallButtonClass} disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
