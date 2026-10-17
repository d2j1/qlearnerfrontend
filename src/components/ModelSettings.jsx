import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plus, XCircle } from 'lucide-react'
import { createModel, deleteModel, listModels, testModel, updateModel } from '../api/client'

const inputClass =
  'w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400'
const smallButtonClass =
  'rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'

const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/
const MAX_TEST_PROMPT = 2000
const ENV_HINT = 'Add it in the server environment (Render → Environment) and redeploy.'

const PRESETS = {
  gemini: {
    label: 'Gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: 'gemini-flash-latest',
    api_key_env: 'GEMINI_API_KEY',
    is_free: true,
  },
  groq: {
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    api_key_env: 'GROQ_API_KEY',
    is_free: true,
  },
  openrouter: {
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    model: '',
    api_key_env: 'OPENROUTER_API_KEY',
    is_free: true,
  },
  custom: { label: 'Custom', base_url: '', model: '', api_key_env: '', is_free: false },
}

const EMPTY_FORM = {
  name: '',
  base_url: '',
  model: '',
  api_key_env: '',
  is_free: false,
  enabled: true,
  is_default: false,
}

function hostnameOf(baseUrl) {
  if (!baseUrl) {
    return 'OpenAI default'
  }
  try {
    return new URL(baseUrl).hostname
  } catch {
    return baseUrl
  }
}

function toFormState(model) {
  return {
    name: model.name,
    base_url: model.base_url ?? '',
    model: model.model,
    api_key_env: model.api_key_env,
    is_free: model.is_free,
    enabled: model.enabled,
    is_default: model.is_default,
  }
}

// Form values -> API body; blank base URL is sent as null.
function toPayload(form) {
  return {
    name: form.name.trim(),
    base_url: form.base_url.trim() || null,
    model: form.model.trim(),
    api_key_env: form.api_key_env.trim(),
    is_free: form.is_free,
    enabled: form.enabled,
    is_default: form.is_default,
  }
}

function validate(form) {
  const errors = {}
  const name = form.name.trim()
  if (!name) {
    errors.name = 'Name is required.'
  } else if (name.length > 100) {
    errors.name = 'Name must be 100 characters or fewer.'
  }
  if (!form.model.trim()) {
    errors.model = 'Model is required.'
  }
  if (!form.api_key_env.trim()) {
    errors.api_key_env = 'Env var name is required.'
  } else if (!ENV_VAR_PATTERN.test(form.api_key_env.trim())) {
    errors.api_key_env = 'Use A-Z, 0-9 and _, starting with a letter.'
  }
  return errors
}

function ModelForm({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial)
  const [preset, setPreset] = useState('custom')
  const [form, setForm] = useState(() => (initial ? toFormState(initial) : EMPTY_FORM))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const setField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const applyPreset = (key) => {
    setPreset(key)
    const { base_url, model, api_key_env, is_free } = PRESETS[key]
    setForm((previous) => ({ ...previous, base_url, model, api_key_env, is_free }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const clientErrors = validate(form)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      return
    }

    const payload = toPayload(form)
    setSubmitting(true)
    try {
      if (isEdit) {
        const original = toPayload(toFormState(initial))
        const diff = Object.fromEntries(Object.entries(payload).filter(([key, value]) => value !== original[key]))
        if (Object.keys(diff).length) {
          await updateModel(initial.id, diff)
        }
      } else {
        await createModel(payload)
      }
      onSaved()
    } catch (saveError) {
      if (saveError.status === 409) {
        setErrors({ name: 'A model with this name already exists.' })
      } else if (saveError.status === 422 && Array.isArray(saveError.details?.detail)) {
        const fieldErrors = {}
        saveError.details.detail.forEach((item) => {
          const field = item.loc?.[1]
          const key = field && field in EMPTY_FORM ? field : 'form'
          fieldErrors[key] = fieldErrors[key] ? `${fieldErrors[key]} ${item.msg}` : item.msg
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ form: saveError.message || 'Saving failed.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (field) => (errors[field] ? <p className="mt-1 text-xs text-rose-300">{errors[field]}</p> : null)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form
        className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-[2rem] border border-slate-700 bg-slate-950 p-6 shadow-2xl shadow-black/40"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Models</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{isEdit ? `Edit ${initial.name}` : 'Add model'}</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {errors.form ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errors.form}</div>
        ) : null}

        {!isEdit ? (
          <label className="block text-sm text-slate-300">
            Preset
            <select className={`${inputClass} mt-1`} value={preset} onChange={(event) => applyPreset(event.target.value)}>
              {Object.entries(PRESETS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {preset === 'openrouter' ? (
              <span className="mt-1 block text-xs text-slate-500">
                Pick a model id ending in <code>:free</code> from openrouter.ai/models; the list changes often.
              </span>
            ) : null}
          </label>
        ) : null}

        <label className="block text-sm text-slate-300">
          Name
          <input className={`${inputClass} mt-1`} value={form.name} maxLength={100} onChange={(event) => setField('name', event.target.value)} />
          {fieldError('name')}
        </label>

        <label className="block text-sm text-slate-300">
          Base URL <span className="text-slate-500">(optional)</span>
          <input
            className={`${inputClass} mt-1 font-mono`}
            type="url"
            placeholder="Blank = OpenAI default"
            value={form.base_url}
            onChange={(event) => setField('base_url', event.target.value)}
          />
          {fieldError('base_url')}
        </label>

        <label className="block text-sm text-slate-300">
          Model
          <input className={`${inputClass} mt-1 font-mono`} value={form.model} onChange={(event) => setField('model', event.target.value)} />
          {fieldError('model')}
        </label>

        <label className="block text-sm text-slate-300">
          API key env var
          <input
            className={`${inputClass} mt-1 font-mono`}
            placeholder="GEMINI_API_KEY"
            value={form.api_key_env}
            onChange={(event) => setField('api_key_env', event.target.value.toUpperCase())}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Enter the <em>name</em> of the environment variable, not the key. The key is set on the server.
          </span>
          {fieldError('api_key_env')}
        </label>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.is_free} onChange={(event) => setField('is_free', event.target.checked)} />
            Free tier
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setField('enabled', event.target.checked)} />
            Enabled
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.is_default} onChange={(event) => setField('is_default', event.target.checked)} />
            Make default
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? 'Save changes' : 'Add model'}
        </button>
      </form>
    </div>
  )
}

function TestPanel({ model }) {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const tooLong = prompt.length > MAX_TEST_PROMPT

  const runTest = async () => {
    setRunning(true)
    try {
      setResult(await testModel(model.id, prompt.trim() || undefined))
    } catch (testError) {
      setResult({ ok: false, latency_ms: null, error: testError.message || 'Test request failed.' })
    } finally {
      setRunning(false)
    }
  }

  const error = result?.error ?? ''
  const hints = []
  if (error.includes('is not set')) {
    hints.push(ENV_HINT)
  }
  if (error.includes('no longer available') || error.includes('404')) {
    hints.push('Check the model name; it may be retired.')
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <label className="block text-sm text-slate-300">
        Custom prompt (optional)
        <textarea
          className={`${inputClass} mt-1 min-h-20`}
          placeholder="Leave empty to use the server's default ping prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <span className={`mt-1 block text-xs ${tooLong ? 'text-rose-300' : 'text-slate-500'}`}>
          {prompt.length} / {MAX_TEST_PROMPT}
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={running || tooLong}
          onClick={runTest}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Run test
        </button>
        {running ? <span className="text-xs text-slate-400">Calling {model.model}… this can take up to 20 s</span> : null}
      </div>

      {result ? (
        result.ok ? (
          <div className="space-y-2 text-sm">
            <p className="inline-flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Working · {(result.latency_ms / 1000).toFixed(1)} s
            </p>
            {result.input_tokens != null && result.output_tokens != null ? (
              <p className="text-xs text-slate-400">
                Tokens: {result.input_tokens} in / {result.output_tokens} out
              </p>
            ) : null}
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200">
              {result.output}
            </pre>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="inline-flex items-center gap-2 font-semibold text-rose-300">
              <XCircle className="h-4 w-4" /> Failed
            </p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-rose-400/30 bg-slate-950 p-3 font-mono text-xs text-rose-100">
              {error}
            </pre>
            {hints.map((hint) => (
              <p key={hint} className="text-xs text-amber-200">
                {hint}
              </p>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

function ModelSettings({ onBack }) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [formState, setFormState] = useState(null) // null | { model: LLMConfig | null }
  const [testOpenId, setTestOpenId] = useState(null)

  // Refetches keep the current list visible; only the first load shows the loading state.
  const load = useCallback(async () => {
    const slowTimer = setTimeout(() => setSlow(true), 5000)
    try {
      const payload = await listModels({ timeoutMs: 75000 })
      setModels(Array.isArray(payload) ? payload : [])
      setLoadError(null)
    } catch (error) {
      setLoadError(error)
    } finally {
      clearTimeout(slowTimer)
      setLoading(false)
      setSlow(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      await Promise.resolve()
      if (!cancelled) {
        await load()
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [load])

  // Every write is followed by a refetch: setting a default clears it on other rows server-side.
  const runAction = async (id, action) => {
    setBusyId(id)
    setActionError('')
    try {
      await action()
      await load()
    } catch (error) {
      setActionError(error.message || 'Request failed.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = (model) => {
    if (!window.confirm(`Delete ${model.name}? This can't be undone.`)) {
      return
    }
    void runAction(model.id, () => deleteModel(model.id))
  }

  if (loadError?.status === 403) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Admin access required</h2>
          <button type="button" className={smallButtonClass} onClick={onBack}>
            Back to practice
          </button>
        </div>
      </div>
    )
  }

  const hasDefault = models.some((model) => model.is_default)
  const hasEnabled = models.some((model) => model.enabled)

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 pb-8 pt-4 lg:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-200" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back to practice
          </button>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Settings</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Models</h1>
          <p className="mt-1 text-sm text-slate-400">LLM configs used to generate questions.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          onClick={() => setFormState({ model: null })}
        >
          <Plus className="h-4 w-4" /> Add model
        </button>
      </div>

      {loading && slow ? (
        <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">Waking the server…</div>
      ) : null}

      {loadError ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <span>{loadError.message || 'Failed to load models.'}</span>
          <button type="button" className={smallButtonClass} onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{actionError}</div>
      ) : null}

      {!loading && !loadError && models.length ? (
        !hasEnabled ? (
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            No enabled models. Generation won't work.
          </div>
        ) : !hasDefault ? (
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            No default model. Generation will use the first enabled model.
          </div>
        ) : null
      ) : null}

      {loading && !models.length ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading models…
        </div>
      ) : null}

      {!loading && !loadError && !models.length ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">
          No models configured. Add one to start generating questions.
        </div>
      ) : null}

      <ul className="space-y-3">
        {models.map((model) => {
          const busy = busyId === model.id
          return (
            <li
              key={model.id}
              className={`rounded-3xl border border-slate-700 bg-slate-900/60 p-4 ${model.enabled ? '' : 'opacity-60'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{model.name}</span>
                    {model.is_free ? (
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">Free</span>
                    ) : null}
                    {model.is_default ? (
                      <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-200">Default</span>
                    ) : null}
                    {!model.enabled ? (
                      <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">Disabled</span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-all font-mono text-sm text-slate-300">{model.model}</p>
                  <p className="mt-1 text-xs text-slate-500">{hostnameOf(model.base_url)}</p>
                  {model.api_key_set ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Key set
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-200">
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Missing <code>{model.api_key_env}</code>
                      </span>
                      <span className="block text-slate-400">{ENV_HINT}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : null}
                  <button
                    type="button"
                    className={smallButtonClass}
                    onClick={() => setTestOpenId((current) => (current === model.id ? null : model.id))}
                  >
                    {testOpenId === model.id ? 'Hide test' : 'Test'}
                  </button>
                  <button type="button" className={smallButtonClass} disabled={busy} onClick={() => setFormState({ model })}>
                    Edit
                  </button>
                  {!model.is_default && model.enabled ? (
                    <button
                      type="button"
                      className={smallButtonClass}
                      disabled={busy}
                      onClick={() => runAction(model.id, () => updateModel(model.id, { is_default: true }))}
                    >
                      Set as default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={smallButtonClass}
                    disabled={busy}
                    onClick={() => runAction(model.id, () => updateModel(model.id, { enabled: !model.enabled }))}
                  >
                    {model.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className={`${smallButtonClass} hover:border-rose-400 hover:text-rose-200`}
                    disabled={busy}
                    onClick={() => handleDelete(model)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {testOpenId === model.id ? <TestPanel model={model} /> : null}
            </li>
          )
        })}
      </ul>

      {formState ? (
        <ModelForm
          initial={formState.model}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

export default ModelSettings
