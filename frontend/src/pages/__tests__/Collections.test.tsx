import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import CollectionsPage from '../Collections'

const mockListCollections = vi.fn()
const mockCreateCollection = vi.fn()
const mockDeleteCollection = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'member', id: 'u1', username: 'test' } }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn(),
}))

vi.mock('@/api/artworks', () => ({
  listCollections: () => mockListCollections(),
  createCollection: (name: string) => mockCreateCollection(name),
  deleteCollection: (id: string) => mockDeleteCollection(id),
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const mockCol = {
  id: 'c1',
  name: 'Impressionistas',
  user_id: 'u1',
  created_at: '2024-01-01T00:00:00Z',
  items: [
    {
      id: 'i1', artwork_id: 'a1', note: null, x: 0, y: 0, width: 200, height: 150, z_index: 1, created_at: '2024-01-01T00:00:00Z',
      artwork: { id: 'a1', title: 'Sunset', image_thumb: 't1.jpg', source_image_url: 'http://img/a.jpg', source_page_url: null, image_original: null, image_large: 'l1.jpg', width: 800, height: 600, dominant_colors: [], phash: 'h1', is_downloaded: true, is_pinned: false, created_at: '2024-01-01T00:00:00Z' },
    },
  ],
}

describe('CollectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListCollections.mockResolvedValue([])
    mockCreateCollection.mockResolvedValue({ id: 'new-c', name: 'Nova', user_id: 'u1', created_at: '2024-01-01', items: [] })
    mockDeleteCollection.mockResolvedValue(undefined)
  })

  it('renders page header', async () => {
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => expect(screen.getAllByText('Coleções')[0]).toBeInTheDocument())
  })

  it('shows empty state when no collections', async () => {
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => {
      expect(screen.getByText('Nenhuma coleção ainda.')).toBeInTheDocument()
    })
  })

  it('renders collection card when collections exist', async () => {
    mockListCollections.mockResolvedValue([mockCol])
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => {
      expect(screen.getByText('Impressionistas')).toBeInTheDocument()
    })
  })

  it('shows create form when + button is clicked', async () => {
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => expect(screen.getAllByText('Coleções')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Nova coleção'))
    expect(screen.getByPlaceholderText('Nome da coleção…')).toBeInTheDocument()
  })

  it('submits new collection on form submit', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => expect(screen.getAllByText('Coleções')[0]).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Nova coleção'))
    const input = screen.getByPlaceholderText('Nome da coleção…')
    await user.type(input, 'Minimalismo')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(mockCreateCollection).toHaveBeenCalledWith('Minimalismo')
    })
  })

  it('cancels create form when cancel button is clicked', async () => {
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => expect(screen.getAllByText('Coleções')[0]).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Nova coleção'))
    expect(screen.getByPlaceholderText('Nome da coleção…')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByPlaceholderText('Nome da coleção…')).toBeNull()
  })

  it('delete button calls deleteCollection', async () => {
    mockListCollections.mockResolvedValue([mockCol])
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => expect(screen.getByText('Impressionistas')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Excluir Impressionistas'))
    await waitFor(() => {
      expect(mockDeleteCollection).toHaveBeenCalledWith('c1')
    })
  })

  it('shows artwork count chip', async () => {
    mockListCollections.mockResolvedValue([mockCol])
    renderWithQuery(<CollectionsPage />)
    await waitFor(() => {
      expect(screen.getByText('1 obra')).toBeInTheDocument()
    })
  })
})
