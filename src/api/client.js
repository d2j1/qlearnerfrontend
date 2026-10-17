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

export { API_BASE_URL }
