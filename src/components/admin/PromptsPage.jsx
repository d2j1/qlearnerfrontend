import { useState } from 'react'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
import { createPrompt, getPromptPlaceholders, listPrompts, setDefaultPrompt } from '../../api/client'
import { navigate, useNavigationBlocker } from '../../lib/router'
import { useLoader } from './helpers'
import { Badge, Banner, LoadState, PageHeader, cardClass, inputClass, primaryButtonClass, smallButtonClass } from './ui'

const MAX_SYSTEM = 20000
const MAX_USER = 50000
const TOKEN_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g

function findTokens(text) {
  return [...new Set([...text.matchAll(TOKEN_PATTERN)].map((match) => match[1]))]
}

function TokenSummary({ text, placeholders }) {
  const tokens = findTokens(text)
  if (!tokens.length) {
    return <p className="mt-1 text-xs text-slate-500">No placeholders.</p>
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tokens.map((token) =>
        token in placeholders ? (
          <Badge key={token} tone="cyan">{`{{${token}}}`}</Badge>
        ) : (
          <Badge key={token} tone="amber">{`{{${token}}} unknown`}</Badge>
        ),
      )}
    </div>
  )
}

function PromptEditor({ template, placeholders, onSaved, onCancel }) {
  const isNew = !template
  const [form, setForm] = useState({
    name: template?.name ?? '',
    system_prompt: template?.system_prompt ?? '',
    user_prompt: template?.user_prompt ?? '',
    is_default: false,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)

  const dirty = isNew
    ? Boolean(form.name || form.system_prompt || form.user_prompt)
    : form.system_prompt !== template.system_prompt || form.user_prompt !== template.user_prompt
  useNavigationBlocker(dirty ? 'You have unsaved prompt changes. Leave without saving?' : null)

  const setField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const allText = `${form.system_prompt}\n${form.user_prompt}`
  const unknownTokens = findTokens(allText).filter((token) => !(token in placeholders))
  const missing = ['schema', 'count'].filter((token) => !findTokens(allText).includes(token))

  const handleSave = async () => {
    if (!form.name.trim() || !form.system_prompt.trim() || !form.user_prompt.trim()) {
      setError('Name, system prompt and user prompt are required.')
      return
    }
    if (form.system_prompt.length > MAX_SYSTEM || form.user_prompt.length > MAX_USER) {
      setError('A prompt is over its length limit.')
      return
    }
    const warnings = []
    if (missing.includes('schema')) warnings.push("{{schema}} is missing: the model won't know the required JSON format.")
    if (missing.includes('count')) warnings.push("{{count}} is missing: the model won't know how many questions to write.")
    if (unknownTokens.length) warnings.push(`Unknown placeholders will be sent literally: ${unknownTokens.map((t) => `{{${t}}}`).join(', ')}.`)
    if (warnings.length && !window.confirm(`${warnings.join('\n')}\n\nSave anyway?`)) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const saved = await createPrompt({
        name: form.name.trim(),
        system_prompt: form.system_prompt,
        user_prompt: form.user_prompt,
        is_default: form.is_default,
      })
      onSaved(saved)
    } catch (saveError) {
      setError(saveError.message || 'Saving failed.')
      setSaving(false)
    }
  }

  const handleSetDefault = async () => {
    setSettingDefault(true)
    try {
      onSaved(await setDefaultPrompt(template.id))
    } catch (defaultError) {
      setError(defaultError.message || 'Could not set the default.')
    } finally {
      setSettingDefault(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
      <div className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isNew ? (
              <input className={`${inputClass} w-64 py-2`} placeholder="Template name" value={form.name} onChange={(event) => setField('name', event.target.value)} />
            ) : (
              <>
                <span className="text-lg font-semibold text-white">{template.name}</span>
                <Badge>v{template.version}</Badge>
                {template.is_default ? <Badge tone="cyan">Default</Badge> : null}
              </>
            )}
          </div>
          <div className="flex gap-2">
            {!isNew && !template.is_default ? (
              <button type="button" className={smallButtonClass} disabled={settingDefault} onClick={handleSetDefault}>
                {settingDefault ? 'Setting…' : `Set v${template.version} as default`}
              </button>
            ) : null}
            <button type="button" className={smallButtonClass} onClick={onCancel}>
              Close
            </button>
          </div>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}
        {missing.length ? (
          <Banner tone="warning">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Missing {missing.map((token) => `{{${token}}}`).join(' and ')}. The model won't know the required JSON format / how many questions to write.
            </span>
          </Banner>
        ) : null}

        <label className="block text-sm text-slate-300">
          System prompt
          <textarea className={`${inputClass} mt-1 min-h-40 font-mono text-xs`} value={form.system_prompt} onChange={(event) => setField('system_prompt', event.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">
            {form.system_prompt.length.toLocaleString()} / {MAX_SYSTEM.toLocaleString()}
          </span>
          <TokenSummary text={form.system_prompt} placeholders={placeholders} />
        </label>

        <label className="block text-sm text-slate-300">
          User prompt
          <textarea className={`${inputClass} mt-1 min-h-72 font-mono text-xs`} value={form.user_prompt} onChange={(event) => setField('user_prompt', event.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">
            {form.user_prompt.length.toLocaleString()} / {MAX_USER.toLocaleString()}
          </span>
          <TokenSummary text={form.user_prompt} placeholders={placeholders} />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.is_default} onChange={(event) => setField('is_default', event.target.checked)} />
            Make this the default
          </label>
          <button type="button" className={primaryButtonClass} disabled={saving || (!isNew && !dirty && !form.is_default)} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isNew ? 'Create template' : `Save as v${template.version + 1}`}
          </button>
        </div>
        {!isNew ? <p className="text-xs text-slate-500">Templates are never edited in place. Saving creates a new version; older versions stay available.</p> : null}
      </div>

      <aside className={`${cardClass} h-fit space-y-3 text-xs`}>
        <p className="text-xs uppercase tracking-wider text-slate-500">Placeholders</p>
        {Object.entries(placeholders).map(([name, description]) => (
          <div key={name}>
            <code className="text-cyan-200">{`{{${name}}}`}</code>
            <p className="text-slate-400">{description}</p>
          </div>
        ))}
      </aside>
    </div>
  )
}

function PromptsPage({ selectedId }) {
  const [allVersions, setAllVersions] = useState(false)
  const [creating, setCreating] = useState(false)
  const prompts = useLoader(() => listPrompts(allVersions), [allVersions])
  const placeholders = useLoader(() => getPromptPlaceholders(), [])

  const items = prompts.data ?? []
  const selected = items.find((prompt) => prompt.id === selectedId) ?? null
  const select = (id) => {
    setCreating(false)
    navigate(id ? `/settings/prompts?id=${encodeURIComponent(id)}` : '/settings/prompts')
  }

  const handleSaved = async (saved) => {
    setCreating(false)
    // A new version may be hidden behind "latest only"; reload then open it.
    await prompts.reload()
    navigate(`/settings/prompts?id=${encodeURIComponent(saved.id)}`, { force: true })
  }

  const editorOpen = creating || selected
  // selectedId may point at an older version not in the "latest" list.
  const needsAllVersions = selectedId && prompts.data && !selected && !allVersions

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Prompt templates"
        subtitle="What the LLM receives. Templates are versioned and never edited in place."
        actions={
          <>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={allVersions} onChange={(event) => setAllVersions(event.target.checked)} />
              Show all versions
            </label>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                select(null)
                setCreating(true)
              }}
            >
              <Plus className="h-4 w-4" /> New template
            </button>
          </>
        }
      />

      <LoadState loader={prompts} label="Loading templates…" />
      {needsAllVersions ? (
        <Banner
          tone="info"
          action={
            <button type="button" className={smallButtonClass} onClick={() => setAllVersions(true)}>
              Show all versions
            </button>
          }
        >
          That version isn't the latest. Show all versions to open it.
        </Banner>
      ) : null}

      {editorOpen && placeholders.data ? (
        <div className="mb-6">
          <PromptEditor
            key={creating ? 'new' : selected.id}
            template={creating ? null : selected}
            placeholders={placeholders.data.placeholders ?? {}}
            onSaved={handleSaved}
            onCancel={() => select(null)}
          />
        </div>
      ) : null}

      {items.length ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/60">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((prompt) => (
                <tr
                  key={prompt.id}
                  className={`cursor-pointer border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 ${prompt.id === selectedId ? 'bg-cyan-500/10' : ''}`}
                  onClick={() => select(prompt.id)}
                >
                  <td className="px-4 py-3 text-slate-100">
                    <span className="mr-2">{prompt.name}</span>
                    {prompt.is_default ? <Badge tone="cyan">Default</Badge> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-300">v{prompt.version}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(prompt.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}

export default PromptsPage
