import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockMe = vi.fn()
const mockSetUser = vi.fn()
const mockSetLoading = vi.fn()

let storeUser: { id: string; username: string } | null = null
let storeLoading = true

vi.mock('@/api/auth', () => ({
  authApi: {
    me: () => mockMe(),
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: storeUser,
    isLoading: storeLoading,
    setUser: mockSetUser,
    setLoading: mockSetLoading,
  }),
}))

// Need to mock the navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import App from './App'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('App (auth routing)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    storeUser = null
    storeLoading = true
  })

  it('bootstraps auth on mount and sets user when authenticated', async () => {
    mockMe.mockResolvedValue({
      id: '1',
      email: 'user@test.com',
      username: 'authtest',
      role: 'member',
    })
    storeLoading = true

    renderWithProviders(<App />)

    await waitFor(() => {
      expect(mockMe).toHaveBeenCalled()
    })
  })

  it('sets user to null when /auth/me fails', async () => {
    mockMe.mockRejectedValue(new Error('Unauthorized'))
    storeLoading = true

    renderWithProviders(<App />)

    await waitFor(() => {
      expect(mockMe).toHaveBeenCalled()
    })
  })

  it('shows search page when user is authenticated', async () => {
    storeUser = { id: '1', username: 'authtest' }
    storeLoading = false
    mockMe.mockResolvedValue(storeUser)

    renderWithProviders(<App />)

    await waitFor(() => {
      expect(screen.getByText('Art Catalog')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Buscar artista…')).toBeInTheDocument()
    })
  })

  it('redirects to login when user is null and not loading', async () => {
    storeUser = null
    storeLoading = false
    mockMe.mockResolvedValue(null)

    renderWithProviders(<App />)

    await waitFor(() => {
      expect(screen.getByText('Entrar na sua conta')).toBeInTheDocument()
    })
  })
})
