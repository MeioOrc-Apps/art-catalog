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
    expect(screen.getAllByPlaceholderText('Buscar artista…')[0]).toBeInTheDocument()
    expect(screen.getAllByLabelText('Buscar')[0]).toBeInTheDocument()
  })

  it('button is disabled when input is empty', () => {
    renderWithQuery(<SearchPage />)
    const btn = screen.getAllByLabelText('Buscar')[0]
    expect(btn).toBeDisabled()
  })

  it('shows empty state initially', async () => {
    renderWithQuery(<SearchPage />)
    await waitFor(() => {
      expect(screen.getByText(/Busque pelo nome de um artista/i)).toBeInTheDocument()
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

    const input = screen.getAllByPlaceholderText('Buscar artista…')[0]
    await user.type(input, 'Test')
    await user.click(screen.getAllByLabelText('Buscar')[0])

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

    await user.type(screen.getAllByPlaceholderText('Buscar artista…')[0], 'van')
    await user.click(screen.getAllByLabelText('Buscar')[0])

    await waitFor(() => {
      expect(screen.getByText('Vincent van Gogh')).toBeInTheDocument()
      expect(screen.getByText('Sim, usar esse')).toBeInTheDocument()
    })
  })

  it('shows delete confirmation when clicking delete button', async () => {
    mockListArtists.mockResolvedValue([
      { 
        id: '1', 
        slug: 'removable', 
        canonical_name: 'Removable', 
        last_searched_at: '2024-01-01', 
        artworks: [{ id: 'a1', title: 'A1', image_thumb: 't1', is_pinned: false, created_at: '2024-01-01' }] 
      },
    ])
    mockGetArtist.mockResolvedValue({
      id: '1',
      slug: 'removable',
      canonical_name: 'Removable',
      last_searched_at: '2024-01-01',
      sync_status: 'ready',
      created_at: '2024-01-01',
      artworks: [{ id: 'a1', title: 'A1', image_thumb: 't1', is_pinned: false, created_at: '2024-01-01' }],
      total: 1,
      limit: 30,
      offset: 0
    })

    renderWithQuery(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Removable')).toBeInTheDocument()
    })

    // Click the artist card to open it
    fireEvent.click(screen.getByText('Removable'))

    // Wait for the delete button to appear
    await waitFor(() => {
      expect(screen.getByTitle('Excluir Artista')).toBeInTheDocument()
    })

    const delBtn = screen.getByTitle('Excluir Artista')
    fireEvent.click(delBtn)

    await waitFor(() => {
      expect(screen.getByText(/serão removidos permanentemente/)).toBeInTheDocument()
    })
  })
})
