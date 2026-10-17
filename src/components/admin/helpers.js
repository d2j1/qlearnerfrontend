import { useCallback, useEffect, useRef, useState } from 'react'

export function isAdminPath(pathname) {
  return pathname.startsWith('/admin') || pathname.startsWith('/settings')
}

export function generateFromNoteHref(note) {
  return `/admin/generate?note_id=${encodeURIComponent(note.id)}`
}

// Loads data on mount and whenever `deps` change. `slow` turns on after 5 s (Render cold start).
export function useLoader(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [slow, setSlow] = useState(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(async () => {
    const slowTimer = setTimeout(() => setSlow(true), 5000)
    try {
      const data = await fetcherRef.current()
      setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      setState((previous) => ({ ...previous, error, loading: false }))
      return null
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      await Promise.resolve()
      if (!cancelled) {
        await reload()
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ...state, slow, reload }
}

export function formatRelative(iso) {
  if (!iso) {
    return ''
  }
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

export function formatSize(chars) {
  return chars >= 1000 ? `~${(chars / 1000).toFixed(1)}k chars` : `${chars} chars`
}
