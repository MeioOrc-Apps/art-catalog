import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockRegister = vi.fn()
const mockLogin = vi.fn()
const mockMe = vi.fn()
const mockSetUser = vi.fn()

vi.mock('@/api/auth', () => ({
  authApi: {
    registerWithInvite: (...args: unknown[]) => mockRegister(...args),
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

import RegisterWithInvitePage from '../RegisterWithInvitePage'

describe('RegisterWithInvitePage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function renderPage(code?: string) {
    const initialEntries = code
      ? [`/register?code=${code}`]
      : ['/register']
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <RegisterWithInvitePage />
      </MemoryRouter>,
    )
  }

  it('renders form with required fields', () => {
    renderPage()
    expect(screen.getByText('Art Catalog')).toBeInTheDocument()
    expect(screen.getByText('Criar conta com código-convite')).toBeInTheDocument()
    expect(screen.getByLabelText('Código-convite')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome de usuário')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
  })

  it('pre-fills code from URL query param', () => {
    renderPage('ABC123')
    const input = screen.getByLabelText('Código-convite') as HTMLInputElement
    expect(input.value).toBe('ABC123')
  })

  it('submits registration and auto-login on success', async () => {
    mockRegister.mockResolvedValue({
      id: '1',
      email: 'new@example.com',
      username: 'newuser',
      role: 'member',
    })
    mockLogin.mockResolvedValue(undefined)
    mockMe.mockResolvedValue({
      id: '1',
      email: 'new@example.com',
      username: 'newuser',
      role: 'member',
    })

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Código-convite'), 'INVITE123')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Nome de usuário'), 'newuser')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.type(screen.getByLabelText('Confirmar senha'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVITE123',
          email: 'new@example.com',
          username: 'newuser',
          password: 'password123',
        }),
      )
    })
  })

  it('shows error on invalid invite', async () => {
    mockRegister.mockRejectedValue(new Error('INVITE_INVALID'))

    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Código-convite'), 'BADCODE')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Nome de usuário'), 'newuser')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.type(screen.getByLabelText('Confirmar senha'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(
        screen.getByText('Código inválido ou já utilizado'),
      ).toBeInTheDocument()
    })
  })

  it('validates required fields', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      const errors = screen.getAllByText(/Campo obrigatório|Mínimo|Email inválido/)
      expect(errors.length).toBeGreaterThan(0)
    })
  })
})
