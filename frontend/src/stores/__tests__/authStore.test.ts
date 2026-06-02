import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

const reset = () =>
  useAuthStore.setState({ user: null, isLoading: true })

describe('authStore', () => {
  beforeEach(reset)

  it('initial state has null user and isLoading=true', () => {
    const { user, isLoading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(isLoading).toBe(true)
  })

  it('setUser updates user and sets isLoading to false', () => {
    const user = { id: '1', email: 'a@b.com', username: 'test', role: 'member' as const, display_name: null, locale: 'pt-BR', is_active: true, is_superuser: false, is_verified: true, created_at: '2024-01-01T00:00:00Z', last_login_at: null }
    useAuthStore.getState().setUser(user)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.isLoading).toBe(false)
  })

  it('setUser with null clears user and stops loading', () => {
    useAuthStore.setState({ user: { id: '1', email: 'a@b.com', username: 'u', role: 'member', display_name: null, locale: 'pt-BR', is_active: true, is_superuser: false, is_verified: true, created_at: '2024-01-01T00:00:00Z', last_login_at: null }, isLoading: false })
    useAuthStore.getState().setUser(null)
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
  })
})
