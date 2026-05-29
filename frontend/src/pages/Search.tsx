import { useState, useCallback, useRef, useEffect } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query'
import {
  searchArtworks,
  listArtists,
  getArtist,
  createArtist,
  deleteArtist,
  deleteArtwork,
  uploadArtwork,
  togglePinArtwork,
  listCollections,
  createCollection,
  addToCollection,
  removeFromCollection,
} from '@/api/artworks'
import Gallery from '@/components/Gallery'
import Lightbox from '@/components/Lightbox'
import Skeleton from '@/components/Skeleton'
import type { Artwork, ArtistSummary, ArtistPaginated } from '@/types/artwork'
import { SearchIcon, RefreshCw, Upload, AlertCircle, LogOut, Plus, Bookmark, FolderOpen, ShieldAlert, ArrowLeft, Compass } from 'lucide-react'
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { Link } from 'react-router-dom'
import ConfirmDialog from '@/components/ConfirmDialog'

/* ── Prompt dialog ── */
function PromptDialog({
  open,
  title,
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  placeholder: string
  confirmLabel: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue('')
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-border rounded-sm p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-semibold text-lg text-foreground mb-4">
          {title}
        </h3>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-base rounded-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent mb-6"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              onConfirm(value.trim())
            } else if (e.key === 'Escape') {
              onCancel()
            }
          }}
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-sm text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onConfirm(value.trim())}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ── */

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [submittedArtist, setSubmittedArtist] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    slug: string; name: string; count: number
  } | null>(null)
  const [deleteArtworkTarget, setDeleteArtworkTarget] = useState<Artwork | null>(null)
  const [collectionTarget, setCollectionTarget] = useState<Artwork | null>(null)
  const [newColName, setNewColName] = useState('')
  const [dedupSuggestion, setDedupSuggestion] = useState<{
    artist: string; suggestions: string[]
  } | null>(null)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [artistSort, setArtistSort] = useState<'recent' | 'alphabetical'>('recent')

  const queryClient = useQueryClient()
  const logout = useLogout()
  const { user } = useAuthStore()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data: artistsList = [] } = useQuery({
    queryKey: ['artists'],
    queryFn: listArtists,
    refetchInterval: (query) => {
      const data = query.state.data as ArtistSummary[] | undefined;
      return data?.some((a) => a.sync_status === 'processing') ? 2000 : false;
    },
  })

  const searchMutation = useMutation({
    mutationFn: (vars: { artist: string; refresh?: boolean }) =>
      searchArtworks({ artist: vars.artist, refresh: vars.refresh }),
    onSuccess: (res) => {
      if (!res.matched) {
        setDedupSuggestion({
          artist: res.suggestion || res.suggestions[0] || '',
          suggestions: res.suggestions,
        })
        return
      }
      setDedupSuggestion(null)
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.removeQueries({ queryKey: ['artist-pages', res.artist!.slug] })
      setActiveSlug(res.artist!.slug)
      setSubmittedArtist(res.artist!.canonical_name)
    },
  })

  const [errorAlert, setErrorAlert] = useState<string | null>(null)

  const createArtistMutation = useMutation({
    mutationFn: (name: string) => createArtist(name),
    onSuccess: (artist) => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      setActiveSlug(artist.slug)
      setSubmittedArtist(artist.canonical_name)
      setQuery('')
    },
    onError: (error) => {
      setErrorAlert('Erro ao criar artista: ' + (error as Error).message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => deleteArtist(slug),
    onSuccess: (_, slug) => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      if (activeSlug === slug) {
        setActiveSlug(null)
        setSubmittedArtist(null)
        queryClient.removeQueries({ queryKey: ['artist-pages', slug] })
      }
      setDeleteTarget(null)
    },
  })

  const deleteArtworkMutation = useMutation({
    mutationFn: (id: string) => deleteArtwork(id),
    onSuccess: () => {
      if (activeSlug) {
        queryClient.invalidateQueries({ queryKey: ['artist-pages', activeSlug] })
        queryClient.invalidateQueries({ queryKey: ['artists'] })
      }
    },
    onError: (error) => {
      setErrorAlert('Erro ao deletar imagem: ' + (error as Error).message)
    }
  })

  const togglePinMutation = useMutation({
    mutationFn: (id: string) => togglePinArtwork(id),
    onSuccess: () => {
      if (activeSlug) {
        queryClient.invalidateQueries({ queryKey: ['artist-pages', activeSlug] })
        queryClient.invalidateQueries({ queryKey: ['artists'] })
      }
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useMutation({
    mutationFn: ({ slug, files }: { slug: string; files: File[] }) => uploadArtwork(slug, files),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ['artist-pages', slug] })
      queryClient.invalidateQueries({ queryKey: ['artists'] })
    },
    onError: (error) => {
      setErrorAlert('Erro ao fazer upload da imagem: ' + (error as Error).message)
    }
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0 && activeSlug) {
      uploadMutation.mutate({ slug: activeSlug, files })
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
    staleTime: 60_000,
  })

  const addColMutation = useMutation({
    mutationFn: (vars: { colId: string; artworkId: string }) =>
      addToCollection(vars.colId, vars.artworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setCollectionTarget(null)
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
      setCollectionTarget(null)
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

  const pagesQuery = useInfiniteQuery({
    queryKey: ['artist-pages', activeSlug],
    queryFn: ({ pageParam }) => getArtist(activeSlug!, pageParam ?? 0),
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit
      return nextOffset < lastPage.total ? nextOffset / lastPage.limit : undefined
    },
    enabled: !!activeSlug,
    refetchInterval: (query) => {
      const data = query.state.data as { pages: ArtistPaginated[] } | undefined;
      const firstPage = data?.pages?.[0];
      return firstPage?.sync_status === 'processing' ? 2000 : false;
    },
  })

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
  const totalArtworks = pagesQuery.data?.pages[0]?.total ?? 0
  const displayWorks = allArtworks.length > 0 ? allArtworks : (searchMutation.data?.artist?.artworks || [])
  const displayName = searchMutation.data?.artist?.canonical_name ?? submittedArtist
  const displayTotal = totalArtworks || (searchMutation.data?.artist?.artworks?.length ?? 0)

  const isProcessing = searchMutation.isPending || 
    (activeSlug ? 
      (artistsList.find(a => a.slug === activeSlug)?.sync_status === 'processing' || pagesQuery.data?.pages[0]?.sync_status === 'processing') 
      : searchMutation.data?.artist?.sync_status === 'processing') ||
    (submittedArtist && !activeSlug && artistsList.find(a => a.canonical_name.toLowerCase() === submittedArtist.toLowerCase())?.sync_status === 'processing') ||
    (pendingSearch && artistsList.find(a => a.canonical_name.toLowerCase() === pendingSearch.toLowerCase())?.sync_status === 'processing')

  const hasResults = displayWorks.length > 0

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || searchMutation.isPending) return
    setPendingSearch(trimmed)
    searchMutation.mutate({ artist: trimmed })
  }, [query, searchMutation])

  const handleArtistClick = useCallback((slug: string, name?: string) => {
    setActiveSlug(slug)
    setSubmittedArtist(name || slug)
    setDedupSuggestion(null)
  }, [])

  const handleLightboxOpen = useCallback((_artwork: Artwork, index: number) => {
    setLightboxIndex(index)
  }, [])
  const handleLightboxClose = useCallback(() => setLightboxIndex(null), [])
  const handleLightboxNavigate = useCallback((newIndex: number) => {
    setLightboxIndex(newIndex)
  }, [])
  const handleAddToCollection = useCallback((artwork: Artwork) => {
    setCollectionTarget(artwork)
    handleLightboxClose()
  }, [])

  const handleRefresh = useCallback(() => {
    if (!submittedArtist || isProcessing) return
    queryClient.removeQueries({ queryKey: ['artist-pages', activeSlug] })
    searchMutation.mutate({ artist: submittedArtist, refresh: true })
  }, [submittedArtist, activeSlug, searchMutation, queryClient, isProcessing])

  const handleDedupAccept = useCallback(() => {
    if (!dedupSuggestion?.artist) return
    setDedupSuggestion(null)
    setQuery(dedupSuggestion.artist)
    searchMutation.mutate({ artist: dedupSuggestion.artist })
  }, [dedupSuggestion, searchMutation])

  const handleDedupForceCreate = useCallback(() => {
    if (!pendingSearch) return
    setDedupSuggestion(null)
    searchMutation.mutate({ artist: pendingSearch, refresh: true })
    setPendingSearch(null)
  }, [pendingSearch, searchMutation])

  // const chartChips = artistsList.map((a) => ({
  //   slug: a.slug, canonical_name: a.canonical_name, artwork_count: a.artworks?.length || 0, sync_status: a.sync_status
  // }))

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        {isMobileSearchOpen ? (
          <div className="flex items-center h-14 gap-2 px-4 max-w-full mx-auto sm:hidden">
            <button 
              onClick={() => setIsMobileSearchOpen(false)} 
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <form onSubmit={(e) => { handleSubmit(e); setIsMobileSearchOpen(false); }} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar artista…"
                  className="w-full h-10 pl-8 pr-3 text-base rounded-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  disabled={isProcessing || false}
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || isProcessing || false}
                className="shrink-0 h-10 px-3 flex items-center justify-center rounded-sm bg-accent text-primary-foreground hover:brightness-110 active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Buscar"
              >
                <SearchIcon size={16} />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center h-14 gap-2 sm:gap-4 px-4 max-w-full mx-auto">
            <button
              type="button"
              onClick={() => {
                setActiveSlug(null); setSubmittedArtist(null); setQuery(''); setDedupSuggestion(null)
                queryClient.removeQueries({ queryKey: ['artist-pages'] })
              }}
              className="font-display italic font-bold text-2xl tracking-tighter bg-gradient-to-r from-accent via-accent-gold to-accent-terracotta bg-clip-text text-transparent shrink-0 hover:opacity-80 transition-opacity"
            >
              Art Catalog
            </button>

            <form onSubmit={handleSubmit} className="hidden sm:flex flex-1 items-center gap-2 max-w-md ml-auto">
              <div className="relative flex-1">
                <SearchIcon size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar artista…"
                  className="w-full h-10 pl-8 pr-3 text-base rounded-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  disabled={isProcessing || false}
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || isProcessing || false}
                className="shrink-0 h-10 px-3 flex items-center justify-center rounded-sm bg-accent text-primary-foreground hover:brightness-110 active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Buscar"
              >
                <SearchIcon size={16} />
              </button>
            </form>

            <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(true)}
                className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Buscar"
              >
                <SearchIcon size={20} />
              </button>

              <button
                type="button"
                onClick={() => setIsPromptOpen(true)}
                disabled={createArtistMutation.isPending}
                className="hidden sm:flex items-center gap-1.5 px-3 h-10 rounded-sm bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium mr-2"
              >
                <Plus size={16} />
                {createArtistMutation.isPending ? 'Criando...' : 'Novo Artista'}
              </button>
              <button
                type="button"
                onClick={() => setIsPromptOpen(true)}
                disabled={createArtistMutation.isPending}
                className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Novo Artista"
              >
                <Plus size={20} />
              </button>

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
        )}
      </header>

      <main className="flex-1 flex flex-col">
        {dedupSuggestion && (
          <div className="px-4 py-3 border-b border-border bg-card/30">
            <p className="text-base text-muted-foreground mb-2">
              Você quis dizer{' '}
              <strong className="text-foreground">
                {dedupSuggestion.artist || dedupSuggestion.suggestions[0]}
              </strong>?
            </p>
            <div className="flex gap-2">
              <button type="button" className="px-3 py-1.5 rounded-sm text-base font-medium bg-accent text-primary-foreground hover:brightness-110 transition-colors" onClick={handleDedupAccept}>
                Sim, usar esse
              </button>
              <button type="button" className="px-3 py-1.5 rounded-sm text-base text-muted-foreground hover:text-foreground hover:bg-card transition-colors" onClick={handleDedupForceCreate}>
                Não, criar novo &quot;{query.trim()}&quot;
              </button>
            </div>
          </div>
        )}

        {isProcessing && !hasResults && (
          <div className="max-w-full px-4 py-6">
            <div className="flex flex-col items-center justify-center mb-8 mt-4">
              <div className="flex items-center gap-3 text-accent mb-2">
                <RefreshCw size={20} className="animate-spin" />
                <span className="text-lg font-display font-medium">Buscando obras…</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Isso pode levar alguns segundos dependendo da quantidade de imagens.
              </p>
            </div>
            <Skeleton count={8} />
          </div>
        )}

        {searchMutation.isError && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <AlertCircle size={40} className="mx-auto mb-3 text-destructive opacity-70" />
              <p className="text-base text-muted-foreground mb-3">
                Não foi possível buscar as obras. Tente novamente.
              </p>
              <button type="button" className="px-4 py-2 rounded-sm bg-accent text-primary-foreground text-base font-medium hover:brightness-110 transition-all" onClick={() => submittedArtist && searchMutation.mutate({ artist: submittedArtist })}>
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {hasResults && (
          <div className="flex-1 flex flex-col">
            <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 py-2 border-b border-border flex-wrap gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display font-semibold text-lg text-foreground">{displayName}</h2>
                <span className="text-base text-muted-foreground font-mono tabular-nums">
                  {displayTotal} obras
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-base text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => {
                    const artist = artistsList.find(a => a.slug === activeSlug)
                    if (artist) {
                      setDeleteTarget({ slug: artist.slug, name: artist.canonical_name, count: artist.artworks?.length || 0 })
                    }
                  }}
                  title="Excluir Artista"
                >
                  <LogOut size={14} className="rotate-180" />
                  Excluir Artista
                </button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-base text-foreground hover:text-accent hover:bg-card transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  title="Formatos suportados: JPG, PNG, WEBP, GIF"
                >
                  <Upload size={14} />
                  {uploadMutation.isPending ? 'Enviando...' : 'Upload'}
                </button>
                <button type="button" className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-base text-foreground hover:text-accent hover:bg-card transition-colors" onClick={handleRefresh} disabled={isProcessing || false}>
                  <RefreshCw size={14} />
                  Atualizar
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 md:p-4">
              <Gallery artworks={displayWorks} onArtworkClick={handleLightboxOpen} />
              {pagesQuery.hasNextPage && (
                <div ref={loadMoreRef} className="h-12 flex items-center justify-center">
                  {pagesQuery.isFetchingNextPage && (
                    <span className="text-base text-muted-foreground">Carregando…</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {searchMutation.data?.artist && displayWorks.length === 0 && !isProcessing && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
            <p className="text-base text-muted-foreground">Nenhuma obra encontrada para este artista.</p>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                title="Formatos suportados: JPG, PNG, WEBP, GIF"
              >
                <Upload size={16} />
                {uploadMutation.isPending ? 'Enviando...' : 'Fazer Upload Manual'}
              </button>
            </div>
          </div>
        )}

        {activeSlug && displayWorks.length === 0 && !isProcessing && !searchMutation.data?.artist && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
            <p className="text-base text-muted-foreground">Nenhuma obra encontrada para este artista.</p>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                title="Formatos suportados: JPG, PNG, WEBP, GIF"
              >
                <Upload size={16} />
                {uploadMutation.isPending ? 'Enviando...' : 'Fazer Upload Manual'}
              </button>
            </div>
          </div>
        )}

        {!displayWorks.length && !isProcessing && !searchMutation.isError && !dedupSuggestion && !searchMutation.data?.artist && !activeSlug && (
          <div className="flex-1 flex flex-col px-4 py-4 max-w-6xl mx-auto w-full relative">
            {artistsList.length > 0 ? (
              <>
                <div className="absolute top-4 right-4 z-10">
                  <div className="flex items-center text-[11px] text-muted-foreground bg-card/40 backdrop-blur-sm p-0.5 rounded-sm border border-border/30 shadow-sm">
                    <button 
                      type="button"
                      onClick={() => setArtistSort('recent')}
                      className={`px-2 py-0.5 rounded-sm transition-colors ${artistSort === 'recent' ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'}`}
                    >
                      Recentes
                    </button>
                    <button 
                      type="button"
                      onClick={() => setArtistSort('alphabetical')}
                      className={`px-2 py-0.5 rounded-sm transition-colors ${artistSort === 'alphabetical' ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'}`}
                    >
                      A-Z
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                  {[...artistsList]
                    .sort((a, b) => {
                      if (artistSort === 'alphabetical') {
                        return a.canonical_name.localeCompare(b.canonical_name)
                      }
                      // Default is 'recent', which is how the backend returns them
                      return 0
                    })
                    .map((artist) => {
                      const previews = artist.artworks?.slice(0, 4) || []
                      return (
                        <button
                          key={artist.slug}
                          type="button"
                          onClick={() => handleArtistClick(artist.slug, artist.canonical_name)}
                          className="group text-left bg-card/30 border border-border/30 rounded-sm overflow-hidden hover:bg-card/60 transition-colors relative"
                        >
                      <div className="aspect-[4/3] p-2 grid grid-cols-2 gap-1 bg-background/50">
                        {previews.map((art) => (
                          <div key={art.id} className="relative overflow-hidden rounded-[2px] bg-card">
                            <img
                              src={`/images/${art.image_thumb}`}
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
                        <h3 className="font-display font-semibold text-lg text-foreground truncate flex items-center gap-2">
                          {artist.sync_status === 'processing' && (
                            <RefreshCw size={12} className="animate-spin text-accent shrink-0" />
                          )}
                          {artist.canonical_name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {artist.artworks?.length || 0} obras
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center mt-12">
                <div className="w-24 h-24 mb-6 rounded-full bg-card/50 flex items-center justify-center border border-border/20">
                  <SearchIcon size={32} className="text-muted-foreground/50" />
                </div>
                <h2 className="text-xl font-display font-semibold text-foreground mb-2">
                  Seu catálogo de referências
                </h2>
                <p className="text-base text-muted-foreground text-center max-w-md">
                  Busque pelo nome de um artista para baixar suas obras e criar sua galeria pessoal.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <Lightbox
        open={lightboxIndex !== null}
        artworks={displayWorks}
        index={lightboxIndex ?? 0}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
        onAddToCollection={handleAddToCollection}
        onDelete={(artwork) => {
          setDeleteArtworkTarget(artwork)
        }}
        onTogglePin={(artwork) => {
          togglePinMutation.mutate(artwork.id)
        }}
      />

      <ConfirmDialog
        open={deleteArtworkTarget !== null}
        title="Deletar imagem?"
        message="Esta imagem será removida permanentemente do acervo deste artista."
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
        open={deleteTarget !== null}
        title={`Excluir ${deleteTarget?.name}?`}
        message={`${deleteTarget?.name} e suas ${deleteTarget?.count} obras serão removidos permanentemente. Esta ação é irreversível.`}
        confirmLabel="Excluir"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.slug) }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PromptDialog
        open={isPromptOpen}
        title="Novo Artista"
        placeholder="Nome do artista..."
        confirmLabel="Criar"
        onConfirm={(name) => {
          createArtistMutation.mutate(name)
          setIsPromptOpen(false)
        }}
        onCancel={() => setIsPromptOpen(false)}
      />

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
