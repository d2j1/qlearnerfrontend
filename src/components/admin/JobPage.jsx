import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Loader2, RotateCcw } from 'lucide-react'
import { createJob, pollJob } from '../../api/client'
import { notifyDraftsChanged } from '../../lib/events'
import Link from '../../lib/Link'
import { navigate } from '../../lib/router'
import { Banner, JobStatusBadge, PageHeader, cardClass, primaryButtonClass, smallButtonClass } from './ui'

const STEPS = [
  ['queued', 'Queued'],
  ['running', 'Generating'],
  ['done', 'Done'],
]

// Same parameters as the original job; a failed job is never retried in place.
function retryBody(job) {
  return {
    topic: job.topic,
    subtopic: job.subtopic,
    count: job.count,
    difficulty: job.difficulty,
    allow_outside_knowledge: job.allow_outside_knowledge,
    llm_config_id: job.llm_config_id,
    prompt_template_id: job.prompt_template_id,
    ...(job.note_ids?.length ? { note_ids: job.note_ids } : {}),
    ...(job.focus ? { focus: job.focus } : {}),
    ...(job.extra_instructions ? { extra_instructions: job.extra_instructions } : {}),
  }
}

function Stepper({ status }) {
  const current = status === 'queued' ? 0 : status === 'running' ? 1 : 2
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map(([key, label], index) => (
        <li key={key} className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
              index < current
                ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                : index === current
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                  : 'border-slate-700 text-slate-500'
            }`}
          >
            {index < current ? <Check className="h-3.5 w-3.5" /> : index === current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index + 1}
          </span>
          <span className={index <= current ? 'text-slate-100' : 'text-slate-500'}>{label}</span>
          {index < STEPS.length - 1 ? <span className="mx-1 h-px w-8 bg-slate-700" /> : null}
        </li>
      ))}
    </ol>
  )
}

function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span>{Math.max(0, Math.round((now - new Date(since).getTime()) / 1000))} s elapsed</span>
}

function JobPage({ jobId }) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let wasActive = false
    pollJob(
      jobId,
      (next) => {
        if (next.status === 'queued' || next.status === 'running') {
          wasActive = true
        }
        setJob(next)
      },
      controller.signal,
    )
      .then((finished) => {
        if (finished && wasActive) {
          notifyDraftsChanged()
        }
      })
      .catch((pollError) => {
        if (!controller.signal.aborted) {
          setError(pollError)
        }
      })
    return () => controller.abort()
  }, [jobId])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const next = await createJob(retryBody(job))
      navigate(`/admin/jobs/${encodeURIComponent(next.id)}`)
    } catch (retryError) {
      setError(retryError)
    } finally {
      setRetrying(false)
    }
  }

  const back = (
    <Link to="/admin/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-200">
      <ArrowLeft className="h-4 w-4" /> All jobs
    </Link>
  )

  if (!job) {
    return (
      <>
        {back}
        {error ? (
          <Banner tone="error">{error.status === 404 ? 'This job does not exist.' : error.message}</Banner>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading job…
          </div>
        )}
      </>
    )
  }

  const active = job.status === 'queued' || job.status === 'running'
  const retryButton = (
    <button type="button" className={primaryButtonClass} disabled={retrying} onClick={handleRetry}>
      {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {job.status === 'failed' ? 'Retry' : 'Try again'}
    </button>
  )

  return (
    <>
      {back}
      <PageHeader
        eyebrow="Generation job"
        title={`${job.topic} / ${job.subtopic}`}
        subtitle={`${job.count} question${job.count === 1 ? '' : 's'} · ${job.difficulty.toLowerCase()} · ${job.llm_model}`}
        actions={<JobStatusBadge status={job.status} />}
      />

      {error ? <Banner tone="error">{error.message}</Banner> : null}

      <div className={`${cardClass} space-y-4`}>
        <Stepper status={job.status} />

        {active ? (
          <div className="space-y-1 text-sm text-slate-300">
            <p className="font-mono text-cyan-200">
              <Elapsed since={job.created_at} />
            </p>
            <p className="text-slate-400">Usually 20–60 s. You can leave this page; the job keeps running.</p>
          </div>
        ) : null}

        {job.status === 'succeeded' ? (
          <div className="space-y-4">
            {job.created_count > 0 ? (
              <p className="text-lg font-semibold text-white">
                Created {job.created_count} question{job.created_count === 1 ? '' : 's'}
                {job.duplicates_skipped > 0 ? <span className="text-sm font-normal text-slate-400"> ({job.duplicates_skipped} duplicates skipped)</span> : null}
              </p>
            ) : (
              <p className="text-lg font-semibold text-amber-200">No new questions (all duplicates or empty reply)</p>
            )}
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Model</dt>
                <dd className="font-mono text-slate-200">{job.llm_model}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Prompt version</dt>
                <dd className="text-slate-200">v{job.prompt_template_version}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Tokens</dt>
                <dd className="text-slate-200">
                  {job.input_tokens} in / {job.output_tokens} out
                </dd>
              </div>
            </dl>
            {job.created_count > 0 ? (
              <button type="button" className={primaryButtonClass} onClick={() => navigate(`/admin/drafts?job_id=${encodeURIComponent(job.id)}`)}>
                Review drafts
              </button>
            ) : (
              retryButton
            )}
          </div>
        ) : null}

        {job.status === 'failed' ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="mb-1 text-sm font-semibold text-rose-200">Generation failed</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-rose-100">{job.error}</pre>
            </div>
            {job.raw_output ? (
              <div>
                <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1`} onClick={() => setShowRaw((previous) => !previous)}>
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showRaw ? 'rotate-180' : ''}`} /> Model output
                </button>
                {showRaw ? (
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-300">
                    {job.raw_output}
                  </pre>
                ) : null}
              </div>
            ) : null}
            {retryButton}
          </div>
        ) : null}
      </div>
    </>
  )
}

export default JobPage
