import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockLogin = vi.fn()
const mockMe = vi.fn()
const mockSetUser = vi.fn()

vi.mock('@/api/auth', () => ({
  authApi: {
    login: (...args: unknown[]) => mockLogin(...args),
    me: (...args: unknown[]) => mockMe(...args),
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: null,
    isLoading: false,
    setUser: mockSetUser,
    setLoading: vi.fn(),
  }),
}))

import LoginPage from '../LoginPage'

describe('LoginPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )
  }

  it('renders login form with email and password fields', () => {
    renderPage()
    expect(screen.getByText('Art Catalog')).toBeInTheDocument()
    expect(screen.getByText('Entrar na sua conta')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('submits form with credentials and redirects on success', async () => {
    mockLogin.mockResolvedValue(undefined)
    mockMe.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      role: 'member',
    })

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Senha'), 'my-password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'my-password')
    })
    await waitFor(() => {
      expect(mockMe).toHaveBeenCalled()
    })
  })

  it('shows error on bad credentials', async () => {
    mockLogin.mockRejectedValue(new Error('LOGIN_BAD_CREDENTIALS'))

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'wrong@x.com')
    await user.type(screen.getByLabelText('Senha'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByText('Email ou senha inválidos')).toBeInTheDocument()
    })
  })

  it('has link to register page', () => {
    renderPage()
    const link = screen.getByText('Usar código-convite')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/register')
  })
})
