import { useState, useCallback, useRef, useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Compass, FolderOpen, ShieldAlert, LogOut } from 'lucide-react'
import { exploreArtworks, addToCollection, removeFromCollection, listCollections, togglePinArtwork, deleteArtwork } from '@/api/artworks'
import Gallery from '@/components/Gallery'
import Lightbox from '@/components/Lightbox'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Artwork } from '@/types/artwork'
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useGalleryQuality } from '@/hooks/useGalleryQuality'

const COLORS = [
  { name: 'Vermelho', hex: 'ef4444' },
  { name: 'Laranja', hex: 'f97316' },
  { name: 'Amarelo', hex: 'eab308' },
  { name: 'Verde', hex: '22c55e' },
  { name: 'Azul', hex: '3b82f6' },
  { name: 'Roxo', hex: 'a855f7' },
  { name: 'Rosa', hex: 'ec4899' },
  { name: 'Marrom', hex: '78350f' },
  { name: 'Preto', hex: '000000' },
  { name: 'Cinza', hex: '71717a' },
  { name: 'Branco', hex: 'ffffff' },
]

export default function ExplorePage() {
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [collectionTarget, setCollectionTarget] = useState<Artwork | null>(null)
  const [deleteArtworkTarget, setDeleteArtworkTarget] = useState<Artwork | null>(null)
  
  const queryClient = useQueryClient()
  const logout = useLogout()
  const { user } = useAuthStore()
  const { quality, toggleQuality } = useGalleryQuality()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const pagesQuery = useInfiniteQuery({
    queryKey: ['explore', activeColor],
    queryFn: async ({ pageParam = 0 }) => {
      return exploreArtworks(activeColor || undefined, pageParam, 50)
    },
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit
      return nextOffset < lastPage.total ? nextOffset : undefined
    },
    initialPageParam: 0,
  })

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  })

  const addColMutation = useMutation({
    mutationFn: ({ colId, artworkId }: { colId: string; artworkId: string }) =>
      addToCollection(colId, artworkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })

  const removeColMutation = useMutation({
    mutationFn: ({ colId, artworkId }: { colId: string; artworkId: string }) =>
      removeFromCollection(colId, artworkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })

  const togglePinMutation = useMutation({
    mutationFn: (id: string) => togglePinArtwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explore'] })
      queryClient.invalidateQueries({ queryKey: ['artist-pages'] })
      queryClient.invalidateQueries({ queryKey: ['artists'] })
    },
  })

  const deleteArtworkMutation = useMutation({
    mutationFn: (id: string) => deleteArtwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explore'] })
      queryClient.invalidateQueries({ queryKey: ['artist-pages'] })
      queryClient.invalidateQueries({ queryKey: ['artists'] })
    },
  })

  const handleLightboxOpen = useCallback((_artwork: Artwork, index: number) => {
    setLightboxIndex(index)
  }, [])

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const handleAddToCollection = useCallback((artwork: Artwork) => {
    setCollectionTarget(artwork)
  }, [])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && pagesQuery.hasNextPage && !pagesQuery.isFetchingNextPage) {
          pagesQuery.fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [pagesQuery])

  const allArtworks: Artwork[] = pagesQuery.data?.pages.flatMap((p) => p.artworks) ?? []

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center h-14 gap-2 sm:gap-4 px-4 max-w-full mx-auto">
          <Link
            to="/"
            className="font-display italic font-bold text-2xl tracking-tighter bg-gradient-to-r from-accent via-accent-gold to-accent-terracotta bg-clip-text text-transparent shrink-0 hover:opacity-80 transition-opacity"
          >
            Art Catalog
          </Link>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <Link
              to="/explore"
              className="p-2 text-accent transition-colors"
              aria-label="Explorar"
            >
              <Compass size={18} className="fill-current/20" />
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
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <span className="text-sm font-medium text-muted-foreground shrink-0 mr-2">Cores:</span>
            <button
              onClick={toggleQuality}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors border ${
                quality === 'large'
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              title={quality === 'large' ? 'Qualidade alta (clique para SD)' : 'Qualidade baixa (clique para HD)'}
            >
              {quality === 'large' ? 'HD' : 'SD'}
            </button>
            <button
              onClick={() => setActiveColor(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeColor === null 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Todas
            </button>
            {COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setActiveColor(c.hex)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  activeColor === c.hex 
                    ? 'bg-card border-accent text-foreground shadow-[0_0_10px_rgba(212,165,116,0.15)]' 
                    : 'bg-card/50 border-border/30 text-muted-foreground hover:bg-card hover:border-border/50'
                }`}
              >
                <span 
                  className="w-3 h-3 rounded-full border border-border/50 shadow-sm" 
                  style={{ backgroundColor: `#${c.hex}` }} 
                />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-3 md:p-4 max-w-[2000px] mx-auto w-full">
          {pagesQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-muted-foreground">Carregando catálogo...</span>
            </div>
          ) : allArtworks.length > 0 ? (
            <>
              <Gallery artworks={allArtworks} onArtworkClick={handleLightboxOpen} quality={quality} />
              {pagesQuery.hasNextPage && (
                <div ref={loadMoreRef} className="h-12 flex items-center justify-center mt-4">
                  {pagesQuery.isFetchingNextPage && (
                    <span className="text-sm text-muted-foreground">Carregando mais...</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Compass size={48} className="text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-display font-medium text-foreground mb-2">
                Nenhuma obra encontrada
              </h2>
              <p className="text-muted-foreground">
                {activeColor 
                  ? "Não encontramos obras com essa cor predominante."
                  : "Seu catálogo está vazio. Busque por artistas na página inicial."}
              </p>
            </div>
          )}
        </div>
      </main>

      <Lightbox
        open={lightboxIndex !== null}
        artworks={allArtworks}
        index={lightboxIndex ?? 0}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
        onAddToCollection={handleAddToCollection}
        onDelete={(artwork) => setDeleteArtworkTarget(artwork)}
        onTogglePin={(artwork) => togglePinMutation.mutate(artwork.id)}
      />

      <ConfirmDialog
        open={deleteArtworkTarget !== null}
        title="Deletar imagem?"
        message="Esta imagem será removida permanentemente do acervo."
        confirmLabel="Deletar"
        onConfirm={() => {
          if (deleteArtworkTarget) {
            deleteArtworkMutation.mutate(deleteArtworkTarget.id)
            setDeleteArtworkTarget(null)
            handleLightboxClose()
          }
        }}
        onCancel={() => setDeleteArtworkTarget(null)}
      />

      {collectionTarget && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setCollectionTarget(null)}>
          <div className="bg-card border border-border rounded-sm p-5 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg text-foreground mb-3">Gerenciar coleções</h3>
            {collections.length > 0 && (
              <ul className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                {collections.map((c) => {
                  const isAlreadyIn = c.items.some(item => item.artwork_id === collectionTarget.id)
                  return (
                    <li key={c.id}>
                      <button 
                        type="button" 
                        className={`w-full text-left px-3 py-2 rounded-sm text-base transition-colors flex items-center justify-between ${
                          isAlreadyIn 
                            ? 'text-accent bg-accent/10 hover:bg-accent/20' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                        }`} 
                        onClick={() => {
                          if (isAlreadyIn) {
                            removeColMutation.mutate({ colId: c.id, artworkId: collectionTarget.id })
                          } else {
                            addColMutation.mutate({ colId: c.id, artworkId: collectionTarget.id })
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen size={14} className={isAlreadyIn ? 'fill-current' : ''} />
                          {c.name}
                        </div>
                        {isAlreadyIn && <span className="text-xs font-medium">Remover</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Link
              to="/collections"
              className="block w-full text-center py-2 text-sm text-accent hover:underline"
              onClick={() => setCollectionTarget(null)}
            >
              Criar nova coleção
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
