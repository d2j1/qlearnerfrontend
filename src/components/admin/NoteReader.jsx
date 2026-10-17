import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock, Maximize2, Minus, Pencil, Plus, Sparkles, X } from 'lucide-react'
import { getNote } from '../../api/client'
import Link from '../../lib/Link'
import { navigate } from '../../lib/router'
import Markdown from './Markdown'
import { formatRelative, generateFromNoteHref, useLoader } from './helpers'
import { Badge, Banner, LoadState, TagChips, smallButtonClass } from './ui'

const FONT_SIZES = [15, 16, 17, 18, 20, 22]
const DEFAULT_FONT_INDEX = 2
const FONT_KEY = 'qlearner:note-font-size'

function readingMinutes(content) {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// Per-viewer preference only; falls back to the default when storage is unavailable.
function loadFontIndex() {
  try {
    const stored = Number(localStorage.getItem(FONT_KEY))
    return Number.isInteger(stored) && stored >= 0 && stored < FONT_SIZES.length ? stored : DEFAULT_FONT_INDEX
  } catch {
    return DEFAULT_FONT_INDEX
  }
}

function saveFontIndex(index) {
  try {
    localStorage.setItem(FONT_KEY, String(index))
  } catch {
    // ignore
  }
}

function FocusReader({ note, onClose }) {
  const [fontIndex, setFontIndex] = useState(loadFontIndex)
  const [progress, setProgress] = useState(0)
  const scrollRef = useRef(null)

  const changeFont = (delta) => {
    setFontIndex((current) => {
      const next = Math.min(FONT_SIZES.length - 1, Math.max(0, current + delta))
      saveFontIndex(next)
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    // Stop the page behind the overlay from scrolling (matters on mobile).
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const handleScroll = () => {
    const element = scrollRef.current
    if (!element) return
    const max = element.scrollHeight - element.clientHeight
    setProgress(max > 0 ? element.scrollTop / max : 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]" role="dialog" aria-modal="true" aria-label={`Reading ${note.title}`}>
      <div className="h-0.5 w-full bg-slate-800">
        <div className="h-full bg-cyan-400 transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <header className="flex items-center gap-2 border-b border-slate-800/80 px-3 py-2 sm:px-6">
        <p className="min-w-0 flex-1 truncate text-sm text-slate-400">{note.title}</p>
        <div className="flex items-center rounded-xl border border-slate-700">
          <button
            type="button"
            aria-label="Smaller text"
            className="flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white disabled:opacity-40"
            disabled={fontIndex === 0}
            onClick={() => changeFont(-1)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-xs text-slate-400">{FONT_SIZES[fontIndex]}</span>
          <button
            type="button"
            aria-label="Larger text"
            className="flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white disabled:opacity-40"
            disabled={fontIndex === FONT_SIZES.length - 1}
            onClick={() => changeFont(1)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          aria-label="Exit focus mode"
          className="flex h-9 items-center gap-1 rounded-xl border border-slate-700 px-3 text-sm text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </header>
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto w-full max-w-[70ch] px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
          <h1 className="mb-6 text-2xl font-semibold leading-tight text-white sm:text-3xl">{note.title}</h1>
          <Markdown className="note-prose text-slate-200" style={{ fontSize: `${FONT_SIZES[fontIndex]}px` }}>
            {note.content}
          </Markdown>
        </article>
      </div>
    </div>
  )
}

function NoteReader({ noteId }) {
  const loader = useLoader(() => getNote(noteId), [noteId])
  const [focus, setFocus] = useState(false)
  // Stable so the focus overlay doesn't re-subscribe on every scroll re-render.
  const closeFocus = useCallback(() => setFocus(false), [])
  const note = loader.data

  if (!note) {
    if (loader.error?.status === 404) {
      return <Banner tone="error">This note no longer exists.</Banner>
    }
    return <LoadState loader={loader} label="Loading note…" />
  }

  const editHref = `/admin/notes/${encodeURIComponent(note.id)}/edit`

  return (
    <>
      <Link to="/admin/notes" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-200">
        <ArrowLeft className="h-4 w-4" /> All notes
      </Link>

      <header className="mb-5 space-y-3">
        <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">{note.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Badge tone="cyan">
            {note.topic} / {note.subtopic}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {readingMinutes(note.content)} min read
          </span>
          <span>· Edited {formatRelative(note.updated_at)}</span>
        </div>
        <TagChips tags={note.tags} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            onClick={() => setFocus(true)}
          >
            <Maximize2 className="h-4 w-4" /> Focus mode
          </button>
          <button type="button" className={`${smallButtonClass} inline-flex items-center gap-1 py-2 text-sm`} onClick={() => navigate(editHref)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            className={`${smallButtonClass} inline-flex items-center gap-1 py-2 text-sm`}
            onClick={() => navigate(generateFromNoteHref(note))}
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate questions
          </button>
        </div>
      </header>

      <article className="rounded-3xl border border-slate-700 bg-slate-900/60 px-4 py-5 sm:px-8 sm:py-7">
        <Markdown className="note-prose mx-auto max-w-[70ch] text-[15px] text-slate-200 sm:text-base">{note.content}</Markdown>
      </article>

      {focus ? <FocusReader note={note} onClose={closeFocus} /> : null}
    </>
  )
}

export default NoteReader
