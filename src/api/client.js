const API_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://qlearner.onrender.com'
const DEFAULT_TIMEOUT_MS = 15000
const TOKEN_KEY = 'mcq_token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // storage unavailable; session lasts until reload
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
  },
}

let onUnauthorized = () => {}
export function setOnUnauthorized(handler) {
  onUnauthorized = handler
}

// Backend errors are { detail: string | [{ loc, msg, type }] }
function getErrorMessage(body, status) {
  const detail = body?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => `${item.loc?.slice(1).join('.') || 'request'}: ${item.msg}`).join('; ')
  }
  return body?.message || body?.error || `Request failed with status ${status}.`
}

export class ApiError extends Error {
  constructor(message, { status = 0, details = null, isTimeout = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.isTimeout = isTimeout
  }
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function request(path, { method = 'GET', body, headers = {}, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs)

  const abortExternalSignal = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId)
      throw new ApiError('Request was aborted.', { isTimeout: false })
    }

    signal.addEventListener('abort', abortExternalSignal, { once: true })
  }

  const token = tokenStore.get()

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const parsedBody = await parseResponse(response)

    if (!response.ok) {
      const message = getErrorMessage(parsedBody, response.status)
      if (response.status === 401 && token) {
        tokenStore.clear()
        onUnauthorized()
      }
      const apiError = new ApiError(message, { status: response.status, details: parsedBody })
      console.error('API Request Failed:', {
        path,
        status: response.status,
        message,
        details: parsedBody,
      })
      throw apiError
    }

    return parsedBody
  } catch (error) {
    if (error?.name === 'AbortError') {
      const apiError = new ApiError('The request timed out. Please try again.', { isTimeout: true })
      console.error('API Request Timed Out:', { path, error: apiError })
      throw apiError
    }

    if (error instanceof ApiError) {
      throw error
    }

    const apiError = new ApiError(error?.message || 'Network request failed.')
    console.error('Network Request Failed:', { path, error: apiError })
    throw apiError
  } finally {
    clearTimeout(timeoutId)

    if (signal) {
      signal.removeEventListener('abort', abortExternalSignal)
    }
  }
}

const enc = encodeURIComponent

// Auth
export async function register({ email, name, password }, options = {}) {
  const payload = await request('/api/auth/register', { method: 'POST', body: { email, name, password }, ...options })
  tokenStore.set(payload.access_token)
  return payload.user
}

export async function login({ email, password }, options = {}) {
  const payload = await request('/api/auth/login', { method: 'POST', body: { email, password }, ...options })
  tokenStore.set(payload.access_token)
  return payload.user
}

export function getMe(options = {}) {
  return request('/api/auth/me', options)
}

export function logout() {
  tokenStore.clear()
}

// Practice flow
export function getTopics(options = {}) {
  return request('/api/topics', options)
}

export function getSubtopics(topic, options = {}) {
  return request(`/api/topics/${enc(topic)}/subtopics`, options)
}

export function getSubtopicQuestions(topic, subtopic, { limit = 20, offset = 0, signal } = {}) {
  const query = buildQueryString({ limit, offset })
  return request(`/api/topics/${enc(topic)}/subtopics/${enc(subtopic)}/questions${query}`, { signal })
}

export function getQuestions({ topic, subtopic, limit = 20, offset = 0, signal } = {}) {
  const query = buildQueryString({ topic, subtopic, limit, offset })
  return request(`/api/questions${query}`, { signal })
}

export function getTopicQuestions(topic, { limit = 20, offset = 0, signal } = {}) {
  const query = buildQueryString({ limit, offset })
  return request(`/api/topics/${enc(topic)}/questions${query}`, { signal })
}

export function getQuestionById(questionId, options = {}) {
  return request(`/api/questions/${enc(questionId)}`, options)
}

// Admin
export function bulkIngestQuestions(questions, options = {}) {
  return request('/api/questions/bulk', {
    method: 'POST',
    body: questions,
    ...options,
  })
}

export function patchQuestion(questionId, fields, options = {}) {
  return request(`/api/questions/${enc(questionId)}`, {
    method: 'PATCH',
    body: fields,
    ...options,
  })
}

export function deleteQuestion(questionId, options = {}) {
  return request(`/api/questions/${enc(questionId)}`, { method: 'DELETE', ...options })
}

export function renameTopic(topic, nextName, options = {}) {
  return request(`/api/topics/${enc(topic)}/rename`, {
    method: 'PUT',
    body: { new_topic: nextName },
    ...options,
  })
}

export function renameSubtopic(topic, subtopic, nextName, options = {}) {
  return request(`/api/topics/${enc(topic)}/subtopics/${enc(subtopic)}/rename`, {
    method: 'PUT',
    body: { new_subtopic: nextName },
    ...options,
  })
}

// LLM configs (admin)
export function listModels(options = {}) {
  return request('/api/llm-configs', options)
}

export function createModel(body, options = {}) {
  return request('/api/llm-configs', { method: 'POST', body, ...options })
}

export function updateModel(id, patch, options = {}) {
  return request(`/api/llm-configs/${enc(id)}`, { method: 'PATCH', body: patch, ...options })
}

export function deleteModel(id, options = {}) {
  return request(`/api/llm-configs/${enc(id)}`, { method: 'DELETE', ...options })
}

// A model call takes ~7-15 s, so allow well beyond the default timeout.
export function testModel(id, prompt, options = {}) {
  return request(`/api/llm-configs/${enc(id)}/test`, {
    method: 'POST',
    body: prompt ? { prompt } : {},
    timeoutMs: 60000,
    ...options,
  })
}

// Notes (admin)
export function listNotes({ topic, subtopic, limit, offset } = {}, options = {}) {
  return request(`/api/notes${buildQueryString({ topic, subtopic, limit, offset })}`, options)
}

export function getNote(id, options = {}) {
  return request(`/api/notes/${enc(id)}`, options)
}

export function createNote(body, options = {}) {
  return request('/api/notes', { method: 'POST', body, ...options })
}

export function updateNote(id, patch, options = {}) {
  return request(`/api/notes/${enc(id)}`, { method: 'PATCH', body: patch, ...options })
}

export function deleteNote(id, options = {}) {
  return request(`/api/notes/${enc(id)}`, { method: 'DELETE', ...options })
}

// Prompt templates (admin); append-only, versioned per name
export function listPrompts(allVersions = false, options = {}) {
  return request(`/api/prompts${buildQueryString({ all_versions: allVersions })}`, options)
}

export function getPrompt(id, options = {}) {
  return request(`/api/prompts/${enc(id)}`, options)
}

export function createPrompt(body, options = {}) {
  return request('/api/prompts', { method: 'POST', body, ...options })
}

export function setDefaultPrompt(id, options = {}) {
  return request(`/api/prompts/${enc(id)}/default`, { method: 'POST', ...options })
}

export function getPromptPlaceholders(options = {}) {
  return request('/api/prompts/placeholders', options)
}

// Generation jobs (admin)
export function createJob(body, options = {}) {
  return request('/api/generation/jobs', { method: 'POST', body, ...options })
}

export function getJob(id, options = {}) {
  return request(`/api/generation/jobs/${enc(id)}`, options)
}

export function listJobs({ status, limit, offset } = {}, options = {}) {
  return request(`/api/generation/jobs${buildQueryString({ status, limit, offset })}`, options)
}

// Polls 2s, 3s, 4s, then every 5s until the job finishes or the signal aborts.
export async function pollJob(id, onUpdate, signal) {
  let delay = 2000
  for (;;) {
    if (signal?.aborted) {
      return null
    }
    const job = await getJob(id, { signal })
    onUpdate(job)
    if (job.status === 'succeeded' || job.status === 'failed') {
      return job
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay + 1000, 5000)
  }
}

// Draft review (admin)
export function listDrafts({ job_id, topic, subtopic, limit, offset } = {}, options = {}) {
  return request(`/api/questions/drafts${buildQueryString({ job_id, topic, subtopic, limit, offset })}`, options)
}

export function approveQuestion(id, options = {}) {
  return request(`/api/questions/${enc(id)}/approve`, { method: 'POST', ...options })
}

export function rejectQuestion(id, options = {}) {
  return request(`/api/questions/${enc(id)}/reject`, { method: 'POST', ...options })
}

// Waits for the LLM (~10-20 s); returns a new draft with a new id.
export function regenerateQuestion(id, options = {}) {
  return request(`/api/questions/${enc(id)}/regenerate`, { method: 'POST', timeoutMs: 90000, ...options })
}

export function approveQuestions(ids, options = {}) {
  return request('/api/questions/approve', { method: 'POST', body: { ids }, ...options })
}

export function rejectQuestions(ids, options = {}) {
  return request('/api/questions/reject', { method: 'POST', body: { ids }, ...options })
}

export { API_BASE_URL }
