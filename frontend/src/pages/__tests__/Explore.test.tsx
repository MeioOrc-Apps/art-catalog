import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ExplorePage from '../Explore'
import type { Artwork } from '@/types/artwork'

const mockExploreArtworks = vi.fn()
const mockListCollections = vi.fn()
const mockAddToCollection = vi.fn()
const mockRemoveFromCollection = vi.fn()
const mockTogglePinArtwork = vi.fn()
const mockDeleteArtwork = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', role: 'member', username: 'test' } }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn(),
}))

vi.mock('@/api/artworks', () => ({
  exploreArtworks: (...args: unknown[]) => mockExploreArtworks(...args),
  listCollections: () => mockListCollections(),
  addToCollection: (...args: unknown[]) => mockAddToCollection(...args),
  removeFromCollection: (...args: unknown[]) => mockRemoveFromCollection(...args),
  togglePinArtwork: (id: string) => mockTogglePinArtwork(id),
  deleteArtwork: (id: string) => mockDeleteArtwork(id),
}))

const mockArtwork: Artwork = {
  id: 'a1',
  title: 'Sunset',
  source_image_url: 'http://img/a1.jpg',
  source_page_url: null,
  image_original: null,
  image_large: 'a1_large.jpg',
  image_thumb: 'a1_thumb.jpg',
  width: 800,
  height: 600,
  dominant_colors: [[255, 100, 0]],
  phash: 'h1',
  is_downloaded: true,
  is_pinned: false,
  created_at: '2024-01-01T00:00:00Z',
}

const emptyPage = { artworks: [], total: 0, limit: 50, offset: 0 }
const onePage = { artworks: [mockArtwork], total: 1, limit: 50, offset: 0 }

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ExplorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExploreArtworks.mockResolvedValue(emptyPage)
    mockListCollections.mockResolvedValue([])
    mockAddToCollection.mockResolvedValue({ id: 'item1' })
    mockTogglePinArtwork.mockResolvedValue({ ...mockArtwork, is_pinned: true })
    mockDeleteArtwork.mockResolvedValue(undefined)
  })

  it('renders Art Catalog header', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getAllByText('Art Catalog')[0]).toBeInTheDocument()
    })
  })

  it('shows color filter palette', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByText('Vermelho')).toBeInTheDocument()
      expect(screen.getByText('Azul')).toBeInTheDocument()
    })
  })

  it('shows empty state when no artworks', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByText(/nenhuma obra/i)).toBeInTheDocument()
    })
  })

  it('renders gallery when artworks exist', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument()
    })
  })

  it('filters by color when color chip is clicked', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByText('Vermelho')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Vermelho'))
    await waitFor(() => {
      expect(mockExploreArtworks).toHaveBeenCalledWith(expect.stringContaining('ef4444'), 0, 50)
    })
  })

  it('deactivates filter by clicking Todas button', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByText('Azul')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Azul'))
    fireEvent.click(screen.getByText('Todas'))
    await waitFor(() => {
      const calls = mockExploreArtworks.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toBeUndefined()
    })
  })

  it('shows "Todas" filter button initially', async () => {
    renderWithQuery(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByText('Todas')).toBeInTheDocument()
    })
  })

  it('opens lightbox when artwork is clicked', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('closes lightbox when Escape is pressed', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('shows add-to-collection from lightbox in Explore', async () => {
    mockListCollections.mockResolvedValue([{ id: 'c1', name: 'Ref', user_id: 'u1', created_at: '2024-01-01', items: [] }])
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const { within } = await import('@testing-library/react')
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Coleções'))
    await waitFor(() => {
      expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument()
    })
    // Click the collection to add artwork
    fireEvent.click(screen.getByText('Ref'))
    await waitFor(() => {
      expect(mockAddToCollection).toHaveBeenCalledWith('c1', 'a1')
    })
  })

  it('shows pin button in Explore lightbox', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Fixar no topo'))
    await waitFor(() => {
      expect(mockTogglePinArtwork).toHaveBeenCalledWith('a1')
    })
  })

  it('shows delete artwork confirmation in Explore lightbox', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Excluir'))
    await waitFor(() => {
      expect(screen.getByText(/permanentemente/i)).toBeInTheDocument()
    })
  })

  it('confirms artwork deletion', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Excluir'))
    await waitFor(() => expect(screen.getByText(/permanentemente/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Deletar'))
    await waitFor(() => {
      expect(mockDeleteArtwork).toHaveBeenCalledWith('a1')
    })
  })

  it('removes artwork from collection when already in it', async () => {
    const colWithArtwork = {
      id: 'c1', name: 'Minha Col', user_id: 'u1', created_at: '2024-01-01',
      items: [{ id: 'i1', artwork_id: 'a1', note: null, x: 0, y: 0, width: 200, height: 150, z_index: 1, created_at: '2024-01-01', artwork: mockArtwork }],
    }
    mockListCollections.mockResolvedValue([colWithArtwork])
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const { within } = await import('@testing-library/react')
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Coleções'))
    await waitFor(() => expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument())
    // Collection already has artwork, click shows "Remover"
    expect(screen.getByText('Remover')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Minha Col'))
    await waitFor(() => {
      expect(mockRemoveFromCollection).toHaveBeenCalledWith('c1', 'a1')
    })
  })

  it('shows criar nova coleção link in collection modal', async () => {
    mockListCollections.mockResolvedValue([])
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const { within } = await import('@testing-library/react')
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Coleções'))
    await waitFor(() => expect(screen.getByText('Criar nova coleção')).toBeInTheDocument())
    // Click the link to navigate and close modal
    fireEvent.click(screen.getByText('Criar nova coleção'))
    await waitFor(() => {
      expect(screen.queryByText('Gerenciar coleções')).toBeNull()
    })
  })

  it('cancels artwork deletion', async () => {
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Excluir'))
    await waitFor(() => expect(screen.getByText(/permanentemente/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.queryByText(/permanentemente/i)).toBeNull()
    })
  })

  it('stops propagation when clicking inside collection modal', async () => {
    mockListCollections.mockResolvedValue([{ id: 'c1', name: 'Test', user_id: 'u1', created_at: '2024-01-01', items: [] }])
    mockExploreArtworks.mockResolvedValue(onePage)
    renderWithQuery(<ExplorePage />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('img'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const { within } = await import('@testing-library/react')
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Coleções'))
    await waitFor(() => expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument())
    // Click inside the modal card - should NOT close the modal
    const modalCard = document.querySelector('.bg-card.border.border-border.rounded-sm.p-5')!
    fireEvent.click(modalCard)
    expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument()
  })
})
