import { describe, it, expect, beforeEach } from 'vitest'

Object.defineProperty(document, 'cookie', {
  writable: true,
  configurable: true,
  value: '',
})

import { api } from '@/api/client'

function getRequestInterceptor() {
  return (api.interceptors.request as any).handlers.find(Boolean)
}

function getResponseInterceptor() {
  return (api.interceptors.response as any).handlers.find(Boolean)
}

describe('api client', () => {
  beforeEach(() => {
    document.cookie = ''
  })

  describe('getCsrfToken via request interceptor', () => {
    it('extracts CSRF token from document.cookie', () => {
      document.cookie = 'artref_auth_csrf=my-csrf-token; other=val'
      const interceptor = getRequestInterceptor()
      const config = { method: 'post', headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBe('my-csrf-token')
    })

    it('returns empty string when CSRF cookie is absent', () => {
      document.cookie = 'session=abc'
      const interceptor = getRequestInterceptor()
      const config = { method: 'post', headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBe('')
    })

    it('does not add X-CSRF-Token to GET requests', () => {
      document.cookie = 'artref_auth_csrf=token'
      const interceptor = getRequestInterceptor()
      const config = { method: 'get', headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBeUndefined()
    })

    it('does not add X-CSRF-Token to HEAD requests', () => {
      document.cookie = 'artref_auth_csrf=token'
      const interceptor = getRequestInterceptor()
      const config = { method: 'head', headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBeUndefined()
    })

    it('adds X-CSRF-Token to PUT requests', () => {
      document.cookie = 'artref_auth_csrf=put-token'
      const interceptor = getRequestInterceptor()
      const config = { method: 'put', headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBe('put-token')
    })

    it('adds X-CSRF-Token to DELETE requests', () => {
      document.cookie = 'artref_auth_csrf=del-token'
      const interceptor = getRequestInterceptor()
      const config = { method: 'delete', headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBe('del-token')
    })

    it('handles missing method gracefully', () => {
      const interceptor = getRequestInterceptor()
      const config = { headers: {} as Record<string, string> }
      const result = interceptor.fulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBeUndefined()
    })
  })

  describe('response error interceptor', () => {
    it('normalizes string detail into err.message', async () => {
      const interceptor = getResponseInterceptor()
      const err = { response: { data: { detail: 'Acesso negado' } }, message: 'original' }
      await expect(interceptor.rejected(err)).rejects.toMatchObject({ message: 'Acesso negado' })
    })

    it('normalizes nested detail.detail into err.message', async () => {
      const interceptor = getResponseInterceptor()
      const err = { response: { data: { detail: { detail: 'nested message' } } }, message: 'original' }
      await expect(interceptor.rejected(err)).rejects.toMatchObject({ message: 'nested message' })
    })

    it('leaves err.message unchanged when detail is absent', async () => {
      const interceptor = getResponseInterceptor()
      const err = { response: { data: {} }, message: 'network error' }
      await expect(interceptor.rejected(err)).rejects.toMatchObject({ message: 'network error' })
    })

    it('handles err without response', async () => {
      const interceptor = getResponseInterceptor()
      const err = { message: 'timeout' }
      await expect(interceptor.rejected(err)).rejects.toMatchObject({ message: 'timeout' })
    })

    it('passes through successful responses unchanged', () => {
      const interceptor = getResponseInterceptor()
      const response = { data: { ok: true }, status: 200 }
      expect(interceptor.fulfilled(response)).toBe(response)
    })
  })

  describe('axios instance config', () => {
    it('is configured with withCredentials', () => {
      expect((api.defaults as any).withCredentials).toBe(true)
    })

    it('is configured with JSON content type', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json')
    })
  })
})
