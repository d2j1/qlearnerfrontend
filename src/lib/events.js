// Fired after anything that changes the number of drafts (a job finishing, review actions).
const DRAFTS_CHANGED = 'qlearner:drafts-changed'

export function notifyDraftsChanged() {
  window.dispatchEvent(new Event(DRAFTS_CHANGED))
}

export function onDraftsChanged(handler) {
  window.addEventListener(DRAFTS_CHANGED, handler)
  return () => window.removeEventListener(DRAFTS_CHANGED, handler)
}
