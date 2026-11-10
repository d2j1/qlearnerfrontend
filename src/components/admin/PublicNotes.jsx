import { matchPath } from '../../lib/router'
import NoteReader from './NoteReader'
import NotesPage from './NotesPage'

// Notes are readable without logging in. Admins get the same pages plus edit controls.
function PublicNotes({ user, pathname }) {
  const isAdmin = user?.role === 'admin'
  const params = matchPath('/notes/:id', pathname)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-5 lg:px-6">
        {params ? <NoteReader key={params.id} noteId={params.id} isAdmin={isAdmin} /> : <NotesPage isAdmin={isAdmin} />}
      </div>
    </div>
  )
}

export default PublicNotes
