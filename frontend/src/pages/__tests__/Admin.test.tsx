import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from '../Admin'

const mockListInvites = vi.fn()
const mockListUsers = vi.fn()
const mockCreateInvite = vi.fn()
const mockRevokeInvite = vi.fn()
const mockUpdateUserRole = vi.fn()
const mockUpdateUserActive = vi.fn()

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'admin1', role: 'admin', username: 'admin' } }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    listInvites: () => mockListInvites(),
    listUsers: () => mockListUsers(),
    createInvite: (hint: string) => mockCreateInvite(hint),
    revokeInvite: (id: string) => mockRevokeInvite(id),
    updateUserRole: (id: string, role: string) => mockUpdateUserRole(id, role),
    updateUserActive: (id: string, isActive: boolean) => mockUpdateUserActive(id, isActive),
  },
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const mockInvite = { id: 'inv-1', code: 'ABC123', email_hint: 'test@test.com', is_used: false, created_at: '2024-01-01' }
const mockUser = { id: 'u1', email: 'member@test.com', username: 'member', display_name: 'Member User', role: 'member', is_active: true }
const adminUser = { id: 'admin1', email: 'admin@test.com', username: 'admin', display_name: 'Admin User', role: 'admin', is_active: true }

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListInvites.mockResolvedValue([])
    mockListUsers.mockResolvedValue([])
    mockCreateInvite.mockResolvedValue(mockInvite)
    mockRevokeInvite.mockResolvedValue(undefined)
    mockUpdateUserRole.mockResolvedValue({ ...mockUser, role: 'admin' })
    mockUpdateUserActive.mockResolvedValue({ ...mockUser, is_active: false })
  })

  it('renders correctly', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Administração')).toBeInTheDocument()
    })
  })

  it('shows invites tab by default', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Convites')).toBeInTheDocument()
    })
  })

  it('shows users tab button', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Usuários')).toBeInTheDocument()
    })
  })

  it('shows empty invites state', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText(/nenhum convite/i)).toBeInTheDocument()
    })
  })

  it('shows invite list when invites exist', async () => {
    mockListInvites.mockResolvedValue([mockInvite])
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument()
    })
  })

  it('creates invite when form is submitted', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Convites')).toBeInTheDocument())
    const input = screen.getByPlaceholderText('Email ou nome (opcional, apenas para seu controle)')
    await user.type(input, 'new@test.com')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(mockCreateInvite).toHaveBeenCalledWith('new@test.com')
    })
  })

  it('revokes invite when delete button is clicked', async () => {
    mockListInvites.mockResolvedValue([mockInvite])
    renderWithQuery(<AdminPage />)
    await waitFor(() => expect(screen.getByText('ABC123')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Revogar convite'))
    await waitFor(() => {
      expect(mockRevokeInvite).toHaveBeenCalledWith('inv-1')
    })
  })

  it('switches to users tab', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Usuários')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Usuários'))
    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalled()
    })
  })

  it('shows user list when users exist', async () => {
    mockListUsers.mockResolvedValue([mockUser, adminUser])
    renderWithQuery(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Usuários')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Usuários'))
    await waitFor(() => {
      expect(screen.getByText('member@test.com')).toBeInTheDocument()
    })
  })

  it('updates user role when role button is clicked', async () => {
    mockListUsers.mockResolvedValue([mockUser, adminUser])
    renderWithQuery(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Usuários')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Usuários'))
    await waitFor(() => expect(screen.getByText('member@test.com')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Promover a Admin'))
    await waitFor(() => {
      expect(mockUpdateUserRole).toHaveBeenCalledWith('u1', 'admin')
    })
  })

  it('deactivates user when deactivate button is clicked', async () => {
    mockListUsers.mockResolvedValue([mockUser, adminUser])
    renderWithQuery(<AdminPage />)
    await waitFor(() => expect(screen.getByText('Usuários')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Usuários'))
    await waitFor(() => expect(screen.getByText('member@test.com')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Desativar usuário'))
    await waitFor(() => {
      expect(mockUpdateUserActive).toHaveBeenCalledWith('u1', false)
    })
  })

  it('shows "Art Catalog" header link', async () => {
    renderWithQuery(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Art Catalog')[0]).toBeInTheDocument()
    })
  })
})
