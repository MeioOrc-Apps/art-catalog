import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from '../Admin'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'admin' } })
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn()
}))

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AdminPage', () => {
  it('renders correctly', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Administração')).toBeInTheDocument()
    })
  })
})
