import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Trash2, FolderOpen, Compass, ShieldAlert, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/hooks/useAuth'
import {
  listCollections,
  createCollection,
  deleteCollection,
} from '@/api/artworks'

export default function CollectionsPage() {
  const { user } = useAuthStore()
  const logout = useLogout()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const queryClient = useQueryClient()

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  })

  const createMutation = useMutation({
    mutationFn: (n: string) => createCollection(n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setName('')
      setCreating(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createMutation.mutate(trimmed)
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between h-14 px-4 max-w-full mx-auto">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="font-display italic font-bold text-2xl tracking-tighter bg-gradient-to-r from-accent via-accent-gold to-accent-terracotta bg-clip-text text-transparent shrink-0 hover:opacity-80 transition-opacity"
            >
              Art Catalog
            </Link>
            <span className="text-sm text-muted-foreground/40 font-light">/</span>
            <span className="text-sm font-medium text-foreground">Coleções</span>
          </div>
          
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
              className="p-2 text-accent transition-colors"
              aria-label="Coleções"
            >
              <FolderOpen size={18} className="fill-current/20" />
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Administração"
              >
                <ShieldAlert size={18} />
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
            <div className="w-px h-4 bg-border/50 mx-2 hidden sm:block" />
            <button
              type="button"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium bg-accent/80 text-primary-foreground hover:bg-accent transition-colors"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              Nova coleção
            </button>
            <button
              type="button"
              className="sm:hidden p-2 text-accent hover:text-accent/80 transition-colors"
              onClick={() => setCreating(true)}
              aria-label="Nova coleção"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {creating && (
          <form onSubmit={handleCreate} className="mb-6 flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da coleção…"
              className="flex-1 px-3 py-1.5 rounded-sm border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
            />
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="px-3 py-1.5 rounded-sm text-xs font-medium bg-accent text-primary-foreground hover:bg-accent/90 disabled:opacity-40 transition-colors"
            >
              Criar
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </button>
          </form>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-28 rounded-sm bg-card/30 animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && collections.length === 0 && (
          <div className="text-center py-16">
            <FolderOpen
              size={36}
              className="mx-auto mb-3 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              Nenhuma coleção ainda.
            </p>
          </div>
        )}

        {!isLoading && collections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((c) => {
              const previews = c.items.slice(0, 4).map(item => item.artwork).filter(Boolean)
              return (
                <div
                  key={c.id}
                  className="group relative text-left bg-card/30 border border-border/30 rounded-sm overflow-hidden hover:bg-card/60 transition-colors"
                >
                  <Link
                    to={`/collections/${c.id}`}
                    className="block"
                  >
                    <div className="aspect-[4/3] p-2 grid grid-cols-2 gap-1 bg-background/50">
                      {previews.map((art) => (
                        <div key={art!.id} className="relative overflow-hidden rounded-[2px] bg-card">
                          <img
                            src={`/images/${art!.image_thumb}`}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ))}
                      {previews.length === 0 && (
                        <div className="col-span-2 row-span-2 flex items-center justify-center text-muted-foreground/30">
                          Sem imagens
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-border/30">
                      <h3 className="font-display font-semibold text-lg text-foreground truncate">
                        {c.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {c.items.length} obra{c.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-1.5 rounded-sm bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => deleteMutation.mutate(c.id)}
                    aria-label={`Excluir ${c.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
