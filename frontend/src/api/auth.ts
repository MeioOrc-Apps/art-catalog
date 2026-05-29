import type { User, Invite } from '@/types/api'
import { api } from './client'

export const authApi = {
  async login(email: string, password: string): Promise<void> {
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)
    await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },

  async registerWithInvite(payload: {
    code: string
    email: string
    password: string
    username: string
    display_name?: string
    locale?: string
  }): Promise<User> {
    const { data } = await api.post<User>('/auth/register-with-invite', payload)
    return data
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email })
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await api.post('/auth/reset-password', { token, password })
  },

  async updateMe(payload: {
    display_name?: string | null
    locale?: string
  }): Promise<User> {
    const { data } = await api.patch<User>('/auth/me', payload)
    return data
  },

  async listInvites(): Promise<Invite[]> {
    const { data } = await api.get<Invite[]>('/auth/admin/invites')
    return data
  },

  async listUsers(): Promise<User[]> {
    const { data } = await api.get<User[]>('/auth/admin/users')
    return data
  },

  async updateUserRole(userId: string, role: 'admin' | 'member'): Promise<User> {
    const { data } = await api.patch<User>(`/auth/admin/users/${userId}/role`, { role })
    return data
  },

  async updateUserActive(userId: string, isActive: boolean): Promise<User> {
    const { data } = await api.patch<User>(`/auth/admin/users/${userId}/active`, { is_active: isActive })
    return data
  },

  async createInvite(emailHint?: string): Promise<Invite> {
    const { data } = await api.post<Invite>('/auth/admin/invites', { email_hint: emailHint })
    return data
  },

  async revokeInvite(id: string): Promise<void> {
    await api.delete(`/auth/admin/invites/${id}`)
  },
}
