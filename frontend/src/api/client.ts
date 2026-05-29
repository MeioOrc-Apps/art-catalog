import axios from 'axios'

const COOKIE_NAME = 'artref_auth_csrf'

function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((r) => r.startsWith(COOKIE_NAME + '='))
      ?.split('=')[1] ?? ''
  )
}

export const api = axios.create({
  baseURL: '/',
  withCredentials: true, // send cookies on all requests
  headers: { 'Content-Type': 'application/json' },
})

// Attach CSRF token to all mutating requests
api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase() ?? 'get'
  if (!['get', 'head', 'options', 'trace'].includes(method)) {
    config.headers['X-CSRF-Token'] = getCsrfToken()
  }
  return config
})

// Normalize error shape
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') {
      err.message = detail
    } else if (detail?.detail) {
      err.message = detail.detail
    }
    return Promise.reject(err)
  },
)
