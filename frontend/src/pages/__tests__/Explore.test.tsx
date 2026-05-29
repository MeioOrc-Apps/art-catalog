import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ExplorePage from '../Explore'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'member' } })
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn()
}))

vi.mock('@/api/artworks', () => ({
  exploreArtworks: vi.fn().mockResolvedValue({ artworks: [], total: 0, limit: 50, offset: 0 }),
  listCollections: vi.fn().mockResolvedValue([]),
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ExplorePage', () => {
  it('renders correctly', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByText('Art Catalog')).toBeInTheDocument()
    })
  })
})
