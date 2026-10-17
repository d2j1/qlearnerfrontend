import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { listJobs } from '../../api/client'
import { navigate } from '../../lib/router'
import { useLoader } from './helpers'
import { JobStatusBadge, LoadState, PageHeader, Pager, inputClass, primaryButtonClass } from './ui'

const PAGE_SIZE = 20

function duration(job) {
  if (!job.started_at || !job.finished_at) {
    return '—'
  }
  return `${Math.round((new Date(job.finished_at) - new Date(job.started_at)) / 1000)} s`
}

function JobsPage() {
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const jobs = useLoader(() => listJobs({ status: status || undefined, limit: PAGE_SIZE, offset }), [status, offset])
  const items = jobs.data?.items ?? []

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Generation jobs"
        actions={
          <>
            <select
              className={`${inputClass} w-40 py-2`}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setOffset(0)
              }}
            >
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
            </select>
            <button type="button" className={primaryButtonClass} onClick={() => navigate('/admin/generate')}>
              <Sparkles className="h-4 w-4" /> Generate
            </button>
          </>
        }
      />

      <LoadState loader={jobs} label="Loading jobs…" />

      {!jobs.loading && !jobs.error && !items.length ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">No jobs yet.</div>
      ) : null}

      {items.length ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/60">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Topic / subtopic</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created / requested</th>
                <th className="px-4 py-3 font-medium">Duplicates</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {items.map((job) => (
                <tr
                  key={job.id}
                  className="cursor-pointer border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50"
                  onClick={() => navigate(`/admin/jobs/${encodeURIComponent(job.id)}`)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-100">
                    {job.topic} / {job.subtopic}
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {job.created_count} / {job.count}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{job.duplicates_skipped}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{job.llm_model}</td>
                  <td className="px-4 py-3 text-slate-300">{duration(job)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {jobs.data ? <Pager total={jobs.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} /> : null}
    </>
  )
}

export default JobsPage
