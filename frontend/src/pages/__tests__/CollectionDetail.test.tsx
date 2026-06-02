import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Collection, DominantColor } from '@/types/artwork'

const mockLogout = vi.fn()
const mockListCollections = vi.fn()
const mockAddToCollection = vi.fn()
const mockRemoveFromCollection = vi.fn()
const mockCreateCollection = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => mockLogout,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', role: 'member', username: 'test' } }),
}))

vi.mock('@/api/artworks', () => ({
  listCollections: () => mockListCollections(),
  addToCollection: (colId: string, artworkId: string) => mockAddToCollection(colId, artworkId),
  removeFromCollection: (colId: string, artworkId: string) => mockRemoveFromCollection(colId, artworkId),
  createCollection: (name: string) => mockCreateCollection(name),
}))

vi.mock('@/components/Moodboard', () => ({
  default: vi.fn(() => <div data-testid="moodboard-mock">Moodboard</div>),
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 3,
}))

import CollectionDetailPage from '@/pages/CollectionDetail'

const artwork1 = {
  id: 'a1',
  title: 'Artwork One',
  source_image_url: 'http://img/a1.jpg',
  source_page_url: null,
  image_original: null,
  image_large: 'a1_large.jpg',
  image_thumb: 'a1_thumb.jpg',
  width: 1200,
  height: 900,
  dominant_colors: [[255, 0, 0]] as DominantColor[],
  phash: 'h1',
  is_downloaded: true,
  is_pinned: false,
  created_at: '2024-01-01T00:00:00Z',
}

const mockCollection: Collection = {
  id: 'col-abc',
  name: 'Favorites',
  user_id: 'u1',
  created_at: '2024-01-01T00:00:00Z',
  items: [{ id: 'i1', artwork_id: 'a1', artwork: artwork1, note: null, x: 0, y: 0, width: 200, height: 150, z_index: 1, created_at: '2024-01-01T00:00:00Z' }],
}

function renderWithRoute(collectionId: string, collections: Collection[]) {
  mockListCollections.mockResolvedValue(collections)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/collections/${collectionId}`]}>
        <Routes>
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/collections" element={<div>Collections page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CollectionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockListCollections.mockReturnValue(new Promise(() => {}))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/collections/col-abc']}>
          <Routes>
            <Route path="/collections/:id" element={<CollectionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
  })

  it('shows "not found" message when collection does not exist', async () => {
    renderWithRoute('nonexistent', [mockCollection])
    await waitFor(() => {
      expect(screen.getByText('Coleção não encontrada.')).toBeInTheDocument()
    })
  })

  it('shows "empty" message when collection has no artworks', async () => {
    const emptyCol: Collection = { ...mockCollection, id: 'empty-col', items: [] }
    renderWithRoute('empty-col', [emptyCol])
    await waitFor(() => {
      expect(screen.getByText('Esta coleção está vazia.')).toBeInTheDocument()
    })
  })

  it('renders gallery mode with artworks', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => {
      expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument()
      expect(screen.getByText('1 obra')).toBeInTheDocument()
    })
  })

  it('shows Art Catalog header link', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => {
      expect(screen.getAllByText('Art Catalog')[0]).toBeInTheDocument()
    })
  })

  it('shows collection name in breadcrumb', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => {
      expect(screen.getAllByText('Favorites').length).toBeGreaterThan(0)
    })
  })

  it('logout button calls logout', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Sair'))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('toggles to moodboard view', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Painel Livre'))
    await waitFor(() => {
      expect(screen.getByTestId('moodboard-mock')).toBeInTheDocument()
    })
  })

  it('shows plural obra label for multiple artworks', async () => {
    const twoItemsCol: Collection = {
      ...mockCollection,
      id: 'two-col',
      items: [
        { ...mockCollection.items[0], id: 'i1', created_at: '2024-01-01T00:00:00Z' },
        { ...mockCollection.items[0], id: 'i2', artwork_id: 'a2', artwork: { ...artwork1, id: 'a2', title: 'Artwork Two' }, created_at: '2024-01-01T00:00:00Z' },
      ],
    }
    renderWithRoute('two-col', [twoItemsCol])
    await waitFor(() => {
      expect(screen.getByText('2 obras')).toBeInTheDocument()
    })
  })

  it('shows admin link for admin users', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
  })

  it('opens lightbox when artwork card is clicked', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    const artworkCard = screen.getByRole('article')
    fireEvent.click(artworkCard)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('closes lightbox on Escape', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('article'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('shows collection management modal when add-to-collection clicked in lightbox', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('article'))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(within(dialog).getByText('Coleções'))
    await waitFor(() => {
      expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument()
    })
  })

  it('shows collection in management modal', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('article'))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(within(dialog).getByText('Coleções'))
    await waitFor(() => {
      expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument()
    })
  })

  it('shows Remover when artwork already in collection', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('article'))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(within(dialog).getByText('Coleções'))
    await waitFor(() => {
      expect(screen.getByText('Remover')).toBeInTheDocument()
    })
  })

  it('removes artwork from collection when Remover is clicked', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('article'))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(within(dialog).getByText('Coleções'))
    await waitFor(() => expect(screen.getByText('Remover')).toBeInTheDocument())
    // Click the "Remover" text (which is inside the collection button)
    fireEvent.click(screen.getByText('Remover'))
    await waitFor(() => {
      expect(mockRemoveFromCollection).toHaveBeenCalledWith('col-abc', 'a1')
    })
  })

  it('shows new collection input in management modal', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByRole('article'))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(within(dialog).getByText('Coleções'))
    await waitFor(() => expect(screen.getByText('Gerenciar coleções')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Nova coleção…')).toBeInTheDocument()
  })

  it('switches back to gallery view', async () => {
    renderWithRoute('col-abc', [mockCollection])
    await waitFor(() => expect(screen.getAllByText('Favorites')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Painel Livre'))
    await waitFor(() => expect(screen.getByTestId('moodboard-mock')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Visão em Grade'))
    await waitFor(() => {
      expect(screen.queryByTestId('moodboard-mock')).toBeNull()
    })
  })
})
