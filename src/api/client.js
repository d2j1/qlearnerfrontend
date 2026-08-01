const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://qlearner.onrender.com'
const DEFAULT_TIMEOUT_MS = 15000

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

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const parsedBody = await parseResponse(response)

    if (!response.ok) {
      const message =
        parsedBody?.message || parsedBody?.error || parsedBody?.detail || `Request failed with status ${response.status}.`
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

export function getTopics(options = {}) {
  return request('/api/topics', options)
}

export function getQuestions({ topic, subtopic, limit = 10, offset = 0, signal } = {}) {
  const query = buildQueryString({ topic, subtopic, limit, offset })
  return request(`/api/questions${query}`, { signal })
}

export function getTopicQuestions(topic, { limit = 10, offset = 0, signal } = {}) {
  const query = buildQueryString({ limit, offset })
  return request(`/api/topics/${encodeURIComponent(topic)}/questions${query}`, { signal })
}

export function getQuestionById(questionId, options = {}) {
  return request(`/api/questions/${encodeURIComponent(questionId)}`, options)
}

export function bulkIngestQuestions(questions, options = {}) {
  return request('/api/questions/bulk', {
    method: 'POST',
    body: questions,
    ...options,
  })
}

export function patchQuestion(questionId, fields, options = {}) {
  return request(`/api/questions/${encodeURIComponent(questionId)}`, {
    method: 'PATCH',
    body: fields,
    ...options,
  })
}

export function renameTopic(topic, nextName, options = {}) {
  return request(`/api/topics/${encodeURIComponent(topic)}/rename`, {
    method: 'PUT',
    body: { new_topic: nextName },
    ...options,
  })
}

export function renameSubtopic(topic, subtopic, nextName, options = {}) {
  return request(`/api/topics/${encodeURIComponent(topic)}/subtopics/${encodeURIComponent(subtopic)}/rename`, {
    method: 'PUT',
    body: { new_subtopic: nextName },
    ...options,
  })
}

export { API_BASE_URL }