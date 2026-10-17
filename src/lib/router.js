import { useEffect, useSyncExternalStore } from 'react'

// Minimal pushState router: the app has a handful of admin routes and no need for nested layouts.
const listeners = new Set()
let blocker = null

function emit() {
  listeners.forEach((listener) => listener())
}

window.addEventListener('popstate', emit)

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getHref = () => window.location.pathname + window.location.search

// `force` skips the unsaved-changes prompt (e.g. right after a save, before the guard re-renders away).
export function navigate(to, { replace = false, force = false } = {}) {
  if (blocker && !force && !window.confirm(blocker)) {
    return
  }
  blocker = null
  if (to !== getHref()) {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
  }
  emit()
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, getHref)
  const url = new URL(href, window.location.origin)
  return { pathname: url.pathname, query: url.searchParams }
}

// Matches "/admin/notes/:id" style patterns; returns params or null.
export function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) {
    return null
  }
  const params = {}
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

// While `message` is set, in-app navigation asks for confirmation and closing the tab warns.
export function useNavigationBlocker(message) {
  useEffect(() => {
    if (!message) {
      return undefined
    }
    blocker = message
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      if (blocker === message) {
        blocker = null
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [message])
}
