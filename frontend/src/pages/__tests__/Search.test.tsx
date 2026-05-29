import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSearchArtworks = vi.fn()
const mockListArtists = vi.fn()
const mockGetArtist = vi.fn()
const mockDeleteArtist = vi.fn()
const mockListCollections = vi.fn()
const mockCreateCollection = vi.fn()
const mockAddToCollection = vi.fn()
const mockLogout = vi.fn()

vi.mock('@/api/artworks', () => ({
  searchArtworks: (body: { artist: string; limit?: number; refresh?: boolean }) =>
    mockSearchArtworks(body),
  listArtists: () => mockListArtists(),
  getArtist: (slug: string, pageParam?: number) => mockGetArtist(slug, pageParam),
  deleteArtist: (slug: string) => mockDeleteArtist(slug),
  listCollections: () => mockListCollections(),
  createCollection: (name: string) => mockCreateCollection(name),
  addToCollection: (colId: string, artworkId: string) =>
    mockAddToCollection(colId, artworkId),
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => mockLogout,
}))

import SearchPage from '@/pages/Search'

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}


describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListArtists.mockResolvedValue([])
    mockListCollections.mockResolvedValue([])
  })

  it('renders the search form', async () => {
    renderWithQuery(<SearchPage />)
    expect(screen.getByText('Art Catalog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Buscar artista…')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument()
  })

  it('button is disabled when input is empty', () => {
    renderWithQuery(<SearchPage />)
    const btn = screen.getByLabelText('Buscar')
    expect(btn).toBeDisabled()
  })

  it('shows empty state initially', async () => {
    renderWithQuery(<SearchPage />)
    await waitFor(() => {
      expect(screen.getByText('Busque um artista para começar')).toBeInTheDocument()
    })
  })

  it('lists cached artists as chips when available', async () => {
    mockListArtists.mockResolvedValue([
      { id: '1', slug: 'van-gogh', canonical_name: 'Van Gogh', last_searched_at: '2024-01-01', artworks: [] },
    ])

    renderWithQuery(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Van Gogh')).toBeInTheDocument()
    })
  })

  it('shows error state when search fails', async () => {
    mockSearchArtworks.mockRejectedValue(new Error('Server error'))
    mockListArtists.mockResolvedValue([])

    const user = userEvent.setup()
    renderWithQuery(<SearchPage />)

    const input = screen.getByPlaceholderText('Buscar artista…')
    await user.type(input, 'Test')
    await user.click(screen.getByLabelText('Buscar'))

    await waitFor(() => {
      expect(
        screen.getByText('Não foi possível buscar as obras. Tente novamente.')
      ).toBeInTheDocument()
    })
  })

  it('shows dedup suggestion when server returns mismatched', async () => {
    mockSearchArtworks.mockResolvedValue({
      matched: false,
      suggestion: 'Vincent van Gogh',
      suggestions: ['Vincent van Gogh'],
      artist: null,
    })
    mockListArtists.mockResolvedValue([])

    const user = userEvent.setup()
    renderWithQuery(<SearchPage />)

    await user.type(screen.getByPlaceholderText('Buscar artista…'), 'van')
    await user.click(screen.getByLabelText('Buscar'))

    await waitFor(() => {
      expect(screen.getByText('Vincent van Gogh')).toBeInTheDocument()
      expect(screen.getByText('Sim, usar esse')).toBeInTheDocument()
    })
  })

  it('shows delete confirmation when clicking X on chip', async () => {
    mockListArtists.mockResolvedValue([
      { id: '1', slug: 'removable', canonical_name: 'Removable', last_searched_at: '2024-01-01', artworks: [] },
    ])

    renderWithQuery(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Removable')).toBeInTheDocument()
    })

    const delBtn = screen.getByLabelText('Excluir Removable')
    fireEvent.click(delBtn)

    await waitFor(() => {
      expect(screen.getByText(/serão removidos permanentemente/)).toBeInTheDocument()
    })
  })
})
