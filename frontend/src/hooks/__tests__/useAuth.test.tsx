import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockMe = vi.fn()
const mockLogoutApi = vi.fn()
const mockSetUser = vi.fn()
const mockSetLoading = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/api/auth', () => ({
  authApi: {
    me: () => mockMe(),
    logout: () => mockLogoutApi(),
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let storeUser: { id: string } | null = null
let storeIsLoading = true

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: storeUser,
    isLoading: storeIsLoading,
    setUser: mockSetUser,
    setLoading: mockSetLoading,
  }),
}))

import { useAuthInit, useRequireAuth, useLogout } from '@/hooks/useAuth'

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useAuthInit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls authApi.me and sets user on success', async () => {
    const user = { id: '1', email: 'a@b.com' }
    mockMe.mockResolvedValue(user)

    renderHook(() => useAuthInit(), { wrapper })

    await vi.waitFor(() => {
      expect(mockMe).toHaveBeenCalled()
      expect(mockSetUser).toHaveBeenCalledWith(user)
      expect(mockSetLoading).toHaveBeenCalledWith(false)
    })
  })

  it('sets user to null when me() rejects', async () => {
    mockMe.mockRejectedValue(new Error('Unauthorized'))

    renderHook(() => useAuthInit(), { wrapper })

    await vi.waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith(null)
      expect(mockSetLoading).toHaveBeenCalledWith(false)
    })
  })
})

describe('useRequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeUser = null
    storeIsLoading = false
  })

  it('navigates to /login when user is null and not loading', () => {
    storeUser = null
    storeIsLoading = false
    renderHook(() => useRequireAuth(), { wrapper })
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('does not navigate when user is set', () => {
    storeUser = { id: '1' }
    storeIsLoading = false
    renderHook(() => useRequireAuth(), { wrapper })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate while loading', () => {
    storeUser = null
    storeIsLoading = true
    renderHook(() => useRequireAuth(), { wrapper })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('returns user and isLoading', () => {
    storeUser = { id: '42' }
    storeIsLoading = false
    const { result } = renderHook(() => useRequireAuth(), { wrapper })
    expect(result.current.user).toEqual({ id: '42' })
    expect(result.current.isLoading).toBe(false)
  })
})

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls logout API, clears user, and navigates to /login', async () => {
    mockLogoutApi.mockResolvedValue(undefined)
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(async () => {
      await result.current()
    })

    expect(mockLogoutApi).toHaveBeenCalled()
    expect(mockSetUser).toHaveBeenCalledWith(null)
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})
