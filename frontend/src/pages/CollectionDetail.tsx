import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LayoutGrid, Maximize, Bookmark, Plus, Compass, FolderOpen, ShieldAlert, LogOut, ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from 'lucide-react'
import { listCollections, addToCollection, removeFromCollection, createCollection } from '@/api/artworks'
import Gallery from '@/components/Gallery'
import Lightbox from '@/components/Lightbox'
import Moodboard, { type MoodboardHandle, MIN_ZOOM, MAX_ZOOM } from '@/components/Moodboard'
import { useState, useCallback, useRef } from 'react'
import type { Artwork } from '@/types/artwork'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/hooks/useAuth'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const logout = useLogout()
  const queryClient = useQueryClient()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'gallery' | 'moodboard'>('gallery')
  const [collectionTarget, setCollectionTarget] = useState<Artwork | null>(null)
  const moodboardRef = useRef<MoodboardHandle>(null)
  const [newColName, setNewColName] = useState('')
  const [errorAlert, setErrorAlert] = useState<string | null>(null)

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  })

  const addColMutation = useMutation({
    mutationFn: (vars: { colId: string; artworkId: string }) =>
      addToCollection(vars.colId, vars.artworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
    onError: (error) => {
      setErrorAlert('Erro ao adicionar à coleção: ' + (error as Error).message)
    }
  })

  const removeColMutation = useMutation({
    mutationFn: (vars: { colId: string; artworkId: string }) =>
      removeFromCollection(vars.colId, vars.artworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
    onError: (error) => {
      setErrorAlert('Erro ao remover da coleção: ' + (error as Error).message)
    }
  })

  const createColMutation = useMutation({
    mutationFn: (name: string) => createCollection(name),
    onSuccess: (col) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      if (collectionTarget) {
        addColMutation.mutate({ colId: col.id, artworkId: collectionTarget.id })
      }
      setNewColName('')
    },
  })

  const collection = collections.find((c) => c.id === id)
  const artworks: Artwork[] =
    collection?.items
      .filter((it) => it.artwork)
      .map((it) => it.artwork!) ?? []

  const handleClick = useCallback((_a: Artwork, i: number) => setLightboxIndex(i), [])

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
          <Link
            to="/collections"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            Coleções
          </Link>
          {collection && (
            <>
              <span className="text-sm text-muted-foreground/40 font-light hidden sm:inline">/</span>
              <span className="text-sm font-medium text-foreground truncate hidden sm:inline">
                {collection.name}
              </span>
            </>
          )}

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
          </div>
        </div>
      </header>

      <main className="max-w-full px-3 py-4">
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-xs text-muted-foreground">Carregando…</p>
          </div>
        )}

        {!isLoading && !collection && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Coleção não encontrada.
            </p>
            <Link
              to="/collections"
              className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <ArrowLeft size={12} />
              Voltar para coleções
            </Link>
          </div>
        )}

        {!isLoading && collection && artworks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Esta coleção está vazia.
            </p>
          </div>
        )}

        {!isLoading && collection && artworks.length > 0 && (
          <>
            {/* Single compact toolbar — all controls in one row */}
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              {/* Name + count */}
              <div className="flex items-baseline gap-2 mr-auto min-w-0">
                <h2 className="font-display font-semibold text-base text-foreground truncate">
                  {collection.name}
                </h2>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {artworks.length} obra{artworks.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Zoom controls — only in moodboard mode */}
              {viewMode === 'moodboard' && (
                <div className="flex items-center gap-0.5 bg-card border border-border/40 rounded-sm p-0.5">
                  <button type="button" onClick={() => moodboardRef.current?.zoomOut()}
                    disabled={(moodboardRef.current?.zoom ?? 1) <= MIN_ZOOM}
                    className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    title="Afastar (−)"><ZoomOut size={14} /></button>
                  <button type="button" onClick={() => moodboardRef.current?.setZoom(1)}
                    className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors min-w-[3rem] text-center"
                    title="Resetar zoom">
                    {Math.round((moodboardRef.current?.zoom ?? 1) * 100)}%
                  </button>
                  <button type="button" onClick={() => moodboardRef.current?.zoomIn()}
                    disabled={(moodboardRef.current?.zoom ?? 1) >= MAX_ZOOM}
                    className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    title="Aproximar (+)"><ZoomIn size={14} /></button>
                </div>
              )}

              {viewMode === 'moodboard' && (
                <button type="button" onClick={() => moodboardRef.current?.fitView()}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-sm text-xs text-muted-foreground bg-card border border-border/40 hover:text-foreground transition-colors"
                  title="Encaixar tudo na tela">
                  <Maximize2 size={13} />
                  <span className="hidden sm:inline">Encaixar</span>
                </button>
              )}

              {viewMode === 'moodboard' && (
                <button type="button"
                  onClick={() => moodboardRef.current?.exportPng()}
                  disabled={moodboardRef.current?.isExporting}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-sm text-xs text-muted-foreground bg-card border border-border/40 hover:text-foreground disabled:opacity-50 transition-colors"
                  title="Exportar painel como PNG">
                  {moodboardRef.current?.isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span className="hidden sm:inline">{moodboardRef.current?.isExporting ? 'Exportando…' : 'Exportar PNG'}</span>
                </button>
              )}

              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-accent/5 p-0.5 rounded-sm border border-border/40">
                <button type="button" onClick={() => setViewMode('gallery')}
                  className={`p-1.5 rounded-sm transition-colors ${viewMode === 'gallery' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Visão em Grade"><LayoutGrid size={15} /></button>
                <button type="button" onClick={() => setViewMode('moodboard')}
                  className={`p-1.5 rounded-sm transition-colors ${viewMode === 'moodboard' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Painel Livre"><Maximize size={15} /></button>
              </div>
            </div>

            {viewMode === 'gallery' ? (
              <Gallery artworks={artworks} onArtworkClick={handleClick} />
            ) : (
              <Moodboard ref={moodboardRef} collection={collection} onArtworkClick={(index) => setLightboxIndex(index)} />
            )}
          </>
        )}
      </main>

      <Lightbox
        open={lightboxIndex !== null}
        artworks={artworks}
        index={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(i) => setLightboxIndex(i)}
        onAddToCollection={(artwork) => {
          setCollectionTarget(artwork)
          setLightboxIndex(null)
        }}
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
                          <Bookmark size={14} className={isAlreadyIn ? 'fill-current' : ''} />
                          {c.name}
                        </div>
                        {isAlreadyIn && <span className="text-xs font-medium">Remover</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex gap-2">
              <input type="text" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Nova coleção…" className="flex-1 px-3 py-1.5 rounded-sm border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
              <button type="button" disabled={!newColName.trim() || createColMutation.isPending} className="shrink-0 px-3 py-1.5 rounded-sm text-base font-medium bg-accent text-primary-foreground hover:bg-accent disabled:opacity-40 transition-colors" onClick={() => createColMutation.mutate(newColName.trim())}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={errorAlert !== null}
        title="Erro"
        message={errorAlert || ''}
        confirmLabel="OK"
        onConfirm={() => setErrorAlert(null)}
      />
    </div>
  )
}
