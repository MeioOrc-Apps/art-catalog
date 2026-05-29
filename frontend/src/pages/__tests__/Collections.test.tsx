import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import CollectionsPage from '../Collections'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'member' } })
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn()
}))

vi.mock('@/api/artworks', () => ({
  listCollections: vi.fn().mockResolvedValue([]),
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CollectionsPage', () => {
  it('renders correctly', async () => {
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Coleções')[0]).toBeInTheDocument()
    })
  })
})
