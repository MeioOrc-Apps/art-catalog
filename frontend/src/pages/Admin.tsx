import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { Plus, Trash2, ShieldAlert, CheckCircle2, XCircle, Users, UserCog, UserX, UserCheck, Compass, FolderOpen, LogOut } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/hooks/useAuth'

export default function AdminPage() {
  const { user } = useAuthStore()
  const logout = useLogout()
  const queryClient = useQueryClient()
  const [emailHint, setEmailHint] = useState('')
  const [activeTab, setActiveTab] = useState<'invites' | 'users'>('invites')

  const { data: invites = [], isLoading: isLoadingInvites } = useQuery({
    queryKey: ['admin-invites'],
    queryFn: () => authApi.listInvites(),
    enabled: user?.role === 'admin' && activeTab === 'invites',
  })

  const { data: usersList = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.listUsers(),
    enabled: user?.role === 'admin' && activeTab === 'users',
  })

  const createMutation = useMutation({
    mutationFn: (hint: string) => authApi.createInvite(hint || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] })
      setEmailHint('')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] })
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string, role: 'admin' | 'member' }) => authApi.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string, isActive: boolean }) => authApi.updateUserActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(emailHint.trim())
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center h-14 gap-2 sm:gap-4 px-4 max-w-full mx-auto">
          <Link
            to="/"
            className="font-display italic font-bold text-2xl tracking-tighter bg-gradient-to-r from-accent via-accent-gold to-accent-terracotta bg-clip-text text-transparent shrink-0 hover:opacity-80 transition-opacity"
          >
            Art Catalog
          </Link>
          <span className="text-sm text-muted-foreground/40 font-light hidden sm:inline">/</span>
          <span className="text-sm font-medium text-foreground hidden sm:inline">Administração</span>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <Link
              to="/explore"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Explorar"
            >
              <Compass size={18} />
            </Link>
            <Link
              to="/collections"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Coleções"
            >
              <FolderOpen size={18} />
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="p-2 text-accent transition-colors"
                aria-label="Administração"
              >
                <ShieldAlert size={18} className="fill-current/20" />
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display font-semibold text-2xl text-foreground flex items-center gap-2">
              <ShieldAlert className="text-accent" size={24} />
              Painel de Controle
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie convites e usuários do sistema.
            </p>
          </div>
          
          <div className="flex bg-card/50 p-1 rounded-sm border border-border/30">
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                activeTab === 'invites' ? 'bg-accent text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Convites
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                activeTab === 'users' ? 'bg-accent text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Usuários
            </button>
          </div>
        </div>

        {activeTab === 'invites' && (
          <div className="animate-fade-in">
            <div className="bg-card/50 border border-border/40 rounded-sm p-5 mb-8">
              <h2 className="text-base font-medium text-foreground mb-4">Gerar novo convite</h2>
              <form onSubmit={handleCreate} className="flex gap-3 max-w-md">
                <input
                  type="text"
                  value={emailHint}
                  onChange={(e) => setEmailHint(e.target.value)}
                  placeholder="Email ou nome (opcional, apenas para seu controle)"
                  className="flex-1 px-3 py-2 rounded-sm border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-medium bg-accent text-primary-foreground hover:brightness-110 disabled:opacity-50 transition-colors"
                >
                  <Plus size={16} />
                  Gerar
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-base font-medium text-foreground mb-4">Convites gerados</h2>
              
              {isLoadingInvites ? (
                <div className="space-y-2">
                  <div className="h-12 bg-card/30 animate-pulse rounded-sm" />
                  <div className="h-12 bg-card/30 animate-pulse rounded-sm" />
                </div>
              ) : invites.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum convite gerado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 text-xs text-muted-foreground">
                        <th className="py-2 px-3 font-medium">Código</th>
                        <th className="py-2 px-3 font-medium">Nota / Email</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 font-medium">Criado em</th>
                        <th className="py-2 px-3 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {invites.map((invite) => {
                        const isUsed = !!invite.used_at
                        const isExpired = !isUsed && new Date(invite.expires_at) < new Date()
                        
                        return (
                          <tr key={invite.id} className="border-b border-border/20 hover:bg-card/30 transition-colors">
                            <td className="py-3 px-3 font-mono text-accent">{invite.code}</td>
                            <td className="py-3 px-3 text-muted-foreground">{invite.email_hint || '-'}</td>
                            <td className="py-3 px-3">
                              {isUsed ? (
                                <span className="inline-flex items-center gap-1 text-success text-xs">
                                  <CheckCircle2 size={14} /> Usado
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                                  <XCircle size={14} /> Expirado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-warning text-xs">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground">
                              {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {!isUsed ? (
                                <button
                                  type="button"
                                  onClick={() => revokeMutation.mutate(invite.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors inline-block"
                                  title="Revogar convite"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground/50 italic px-2">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="animate-fade-in">
            <h2 className="text-base font-medium text-foreground mb-4">Usuários do sistema</h2>
            
            {isLoadingUsers ? (
              <div className="space-y-2">
                <div className="h-12 bg-card/30 animate-pulse rounded-sm" />
                <div className="h-12 bg-card/30 animate-pulse rounded-sm" />
              </div>
            ) : usersList.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum usuário encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 text-xs text-muted-foreground">
                      <th className="py-2 px-3 font-medium">Usuário</th>
                      <th className="py-2 px-3 font-medium">Email</th>
                      <th className="py-2 px-3 font-medium">Cargo</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Criado em</th>
                      <th className="py-2 px-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {usersList.map((u) => (
                      <tr key={u.id} className={`border-b border-border/20 transition-colors ${!u.is_active ? 'bg-destructive/5' : 'hover:bg-card/30'}`}>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-muted-foreground" />
                            <span className={!u.is_active ? 'text-muted-foreground line-through' : 'text-foreground'}>
                              {u.username}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{u.email}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-card border border-border/50 text-muted-foreground'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : 'Membro'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-success text-xs">
                              <CheckCircle2 size={14} /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive text-xs">
                              <XCircle size={14} /> Inativo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {u.id !== user?.id && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => roleMutation.mutate({ id: u.id, role: u.role === 'admin' ? 'member' : 'admin' })}
                                  className="p-1.5 text-muted-foreground hover:text-accent transition-colors"
                                  title={u.role === 'admin' ? "Rebaixar para Membro" : "Promover a Admin"}
                                >
                                  <UserCog size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => activeMutation.mutate({ id: u.id, isActive: !u.is_active })}
                                  className={`p-1.5 transition-colors ${u.is_active ? 'text-muted-foreground hover:text-destructive' : 'text-destructive hover:text-success'}`}
                                  title={u.is_active ? "Desativar usuário" : "Reativar usuário"}
                                >
                                  {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                                </button>
                              </>
                            )}
                            {u.id === user?.id && (
                              <span className="text-xs text-muted-foreground/50 italic px-2">Você</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
