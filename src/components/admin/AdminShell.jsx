import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { listDrafts } from '../../api/client'
import { onDraftsChanged } from '../../lib/events'
import Link from '../../lib/Link'
import { matchPath } from '../../lib/router'
import ModelSettings from '../ModelSettings'
import DraftsPage from './DraftsPage'
import GeneratePage from './GeneratePage'
import JobPage from './JobPage'
import JobsPage from './JobsPage'
import NoteEditor from './NoteEditor'
import NotesPage from './NotesPage'
import PromptsPage from './PromptsPage'
import { AdminRequired } from './ui'

const ADMIN_TABS = [
  ['/admin/notes', 'Notes'],
  ['/admin/generate', 'Generate'],
  ['/admin/jobs', 'Jobs'],
  ['/admin/drafts', 'Drafts'],
  ['/settings/prompts', 'Prompts'],
  ['/settings/models', 'Models'],
]

function renderPage(pathname, query) {
  let params
  if (matchPath('/admin/notes', pathname)) return <NotesPage />
  if (matchPath('/admin/notes/new', pathname)) return <NoteEditor key="new" noteId={null} />
  if ((params = matchPath('/admin/notes/:id', pathname))) return <NoteEditor key={params.id} noteId={params.id} />
  if (matchPath('/admin/generate', pathname)) return <GeneratePage noteId={query.get('note_id')} />
  if (matchPath('/admin/jobs', pathname)) return <JobsPage />
  if ((params = matchPath('/admin/jobs/:id', pathname))) return <JobPage key={params.id} jobId={params.id} />
  if (matchPath('/admin/drafts', pathname)) {
    const jobId = query.get('job_id')
    const topic = query.get('topic')
    const subtopic = query.get('subtopic')
    return <DraftsPage key={`${jobId}|${topic}|${subtopic}`} jobId={jobId} topic={topic} subtopic={subtopic} />
  }
  if (matchPath('/settings/prompts', pathname)) return <PromptsPage selectedId={query.get('id')} />
  if (matchPath('/settings/models', pathname)) return <ModelSettings />
  return <p className="text-slate-400">Page not found.</p>
}

function useDraftsCount(enabled) {
  const [count, setCount] = useState(null)
  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    let cancelled = false
    const refresh = () =>
      listDrafts({ limit: 1 })
        .then((page) => !cancelled && setCount(page.total))
        .catch(() => {})
    void refresh()
    const unsubscribe = onDraftsChanged(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [enabled])
  return count
}

function AdminShell({ user, pathname, query }) {
  const isAdmin = user?.role === 'admin'
  const draftsCount = useDraftsCount(isAdmin)

  if (!isAdmin) {
    return <AdminRequired />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav className="border-b border-slate-800/80 bg-slate-950/60">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 lg:px-6">
          <Link to="/" className="mr-2 inline-flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-sm text-slate-400 hover:text-cyan-200">
            <ArrowLeft className="h-4 w-4" /> Practice
          </Link>
          {ADMIN_TABS.map(([href, label]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                to={href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition ${
                  active ? 'bg-cyan-500/15 text-cyan-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
                {href === '/admin/drafts' && draftsCount ? (
                  <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-slate-950">{draftsCount}</span>
                ) : null}
              </Link>
            )
          })}
        </div>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 lg:px-6">{renderPage(pathname, query)}</div>
      </div>
    </div>
  )
}

export default AdminShell
