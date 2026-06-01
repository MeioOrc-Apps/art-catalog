import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPost = vi.fn()
const mockGet = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

import { authApi } from '@/api/auth'

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login posts form-encoded credentials', async () => {
    mockPost.mockResolvedValue({})
    await authApi.login('user@test.com', 'secret')
    expect(mockPost).toHaveBeenCalledWith(
      '/auth/login',
      expect.any(URLSearchParams),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
  })

  it('logout posts to /auth/logout', async () => {
    mockPost.mockResolvedValue({})
    await authApi.logout()
    expect(mockPost).toHaveBeenCalledWith('/auth/logout')
  })

  it('me gets current user', async () => {
    const user = { id: '1', email: 'a@b.com', username: 'a', role: 'member' }
    mockGet.mockResolvedValue({ data: user })
    const result = await authApi.me()
    expect(result).toEqual(user)
    expect(mockGet).toHaveBeenCalledWith('/auth/me')
  })

  it('registerWithInvite posts invite payload', async () => {
    const user = { id: '2', email: 'new@test.com', username: 'newu', role: 'member' }
    mockPost.mockResolvedValue({ data: user })
    const payload = { code: 'abc', email: 'new@test.com', password: 'pw', username: 'newu' }
    const result = await authApi.registerWithInvite(payload)
    expect(result).toEqual(user)
    expect(mockPost).toHaveBeenCalledWith('/auth/register-with-invite', payload)
  })

  it('forgotPassword posts email', async () => {
    mockPost.mockResolvedValue({})
    await authApi.forgotPassword('reset@test.com')
    expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'reset@test.com' })
  })

  it('resetPassword posts token and password', async () => {
    mockPost.mockResolvedValue({})
    await authApi.resetPassword('reset-token', 'newpass')
    expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', { token: 'reset-token', password: 'newpass' })
  })

  it('updateMe patches profile', async () => {
    const updated = { id: '1', display_name: 'New Name' }
    mockPatch.mockResolvedValue({ data: updated })
    const result = await authApi.updateMe({ display_name: 'New Name' })
    expect(result).toEqual(updated)
    expect(mockPatch).toHaveBeenCalledWith('/auth/me', { display_name: 'New Name' })
  })

  it('listInvites gets admin invites', async () => {
    const invites = [{ id: 'i1', code: 'abc123' }]
    mockGet.mockResolvedValue({ data: invites })
    const result = await authApi.listInvites()
    expect(result).toEqual(invites)
    expect(mockGet).toHaveBeenCalledWith('/auth/admin/invites')
  })

  it('listUsers gets admin users', async () => {
    const users = [{ id: 'u1', email: 'a@b.com' }]
    mockGet.mockResolvedValue({ data: users })
    const result = await authApi.listUsers()
    expect(result).toEqual(users)
    expect(mockGet).toHaveBeenCalledWith('/auth/admin/users')
  })

  it('updateUserRole patches role', async () => {
    const user = { id: 'u1', role: 'admin' }
    mockPatch.mockResolvedValue({ data: user })
    const result = await authApi.updateUserRole('u1', 'admin')
    expect(result).toEqual(user)
    expect(mockPatch).toHaveBeenCalledWith('/auth/admin/users/u1/role', { role: 'admin' })
  })

  it('updateUserActive patches is_active', async () => {
    const user = { id: 'u1', is_active: false }
    mockPatch.mockResolvedValue({ data: user })
    const result = await authApi.updateUserActive('u1', false)
    expect(result).toEqual(user)
    expect(mockPatch).toHaveBeenCalledWith('/auth/admin/users/u1/active', { is_active: false })
  })

  it('createInvite posts invite with optional email hint', async () => {
    const invite = { id: 'i1', code: 'xyz' }
    mockPost.mockResolvedValue({ data: invite })
    const result = await authApi.createInvite('hint@test.com')
    expect(result).toEqual(invite)
    expect(mockPost).toHaveBeenCalledWith('/auth/admin/invites', { email_hint: 'hint@test.com' })
  })

  it('revokeInvite deletes invite by id', async () => {
    mockDelete.mockResolvedValue({})
    await authApi.revokeInvite('inv-id')
    expect(mockDelete).toHaveBeenCalledWith('/auth/admin/invites/inv-id')
  })
})
