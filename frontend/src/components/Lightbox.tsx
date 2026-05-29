import { useEffect, useRef, useCallback } from 'react'
import type { Artwork } from '@/types/artwork'
import { X, ChevronLeft, ChevronRight, BookmarkPlus, Trash2, Pin } from 'lucide-react'

interface LightboxProps {
  artworks: Artwork[]
  index: number
  open: boolean
  onClose: () => void
  onNavigate: (index: number) => void
  onAddToCollection?: (artwork: Artwork) => void
  onDelete?: (artwork: Artwork) => void
  onTogglePin?: (artwork: Artwork) => void
}

export default function Lightbox({ artworks, index, open, onClose, onNavigate, onAddToCollection, onDelete, onTogglePin }: LightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const navigate = useCallback(
    (delta: number) => {
      const newIndex = index + delta
      if (newIndex >= 0 && newIndex < artworks.length) {
        onNavigate(newIndex)
      }
    },
    [index, artworks.length, onNavigate]
  )

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        navigate(-1)
      } else if (e.key === 'ArrowRight') {
        navigate(1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, navigate])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  if (!open || !artworks[index]) return null

  const artwork = artworks[index]

  const isManualUpload = artwork.source_image_url?.startsWith('manual_upload_')
  const isGenericTitle = artwork.title?.toLowerCase() === 'picture' || artwork.title?.toLowerCase() === 'image'
  const displayTitle = isManualUpload ? artwork.title : (isGenericTitle ? null : artwork.title)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 animate-fade-in"
      onClick={(e) => {
        if (e.target === containerRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={artwork.title || 'Obra'}
    >
      <button
        type="button"
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-background/60 text-foreground hover:bg-background/80 transition-colors"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X size={22} />
      </button>

      {index > 0 && (
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-2.5 rounded-full bg-background/60 text-foreground hover:bg-background/80 transition-colors"
          onClick={() => navigate(-1)}
          aria-label="Anterior"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {index < artworks.length - 1 && (
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-2.5 rounded-full bg-background/60 text-foreground hover:bg-background/80 transition-colors"
          onClick={() => navigate(1)}
          aria-label="Próxima"
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div 
        className="flex flex-col items-center justify-between w-full h-full p-4 md:p-6 pb-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        
        {/* Header: Artist - Title */}
        <div className="w-full flex-shrink-0 text-center mb-4 mt-2 z-10 px-16">
          <h2 className="text-xl md:text-2xl font-display font-medium text-foreground tracking-wide">
            {artwork.artist && <span className="text-muted-foreground">{artwork.artist.canonical_name}</span>}
            {artwork.artist && displayTitle && <span className="mx-3 text-border/50">—</span>}
            {displayTitle && <span>{displayTitle}</span>}
          </h2>
        </div>

        {/* Image */}
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
          <img
            src={`/images/${artwork.image_large}`}
            alt={artwork.title || artwork.source_image_url}
            className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Footer: Details & Actions */}
        <div className="w-full flex-shrink-0 mt-6 flex justify-center z-10">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 bg-card/40 backdrop-blur-md px-6 py-2.5 rounded-full border border-border/30 shadow-lg">
            
            {/* Dimensions */}
            {(artwork.width || artwork.height) && (
              <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
                <span className="opacity-70">Dimensões:</span>
                <span className="text-foreground">{artwork.width}&times;{artwork.height}</span>
              </div>
            )}
            
            {/* Source Link */}
            {artwork.source_page_url && (
              <>
                <div className="w-1 h-1 rounded-full bg-border/50 hidden sm:block" />
                <a
                  href={artwork.source_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                >
                  Ver fonte original
                </a>
              </>
            )}

            {/* Actions */}
            {(onAddToCollection || onDelete || onTogglePin) && (
              <>
                <div className="w-1 h-1 rounded-full bg-border/50 hidden sm:block" />
                <div className="flex items-center gap-2">
                  {onTogglePin && (
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        artwork.is_pinned 
                          ? 'bg-accent text-primary-foreground hover:bg-accent/90' 
                          : 'bg-accent/10 text-accent hover:bg-accent/20'
                      }`}
                      onClick={() => onTogglePin(artwork)}
                    >
                      <Pin size={14} className={artwork.is_pinned ? "fill-current" : ""} />
                      {artwork.is_pinned ? 'Desafixar' : 'Fixar no topo'}
                    </button>
                  )}
                  {onAddToCollection && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      onClick={() => onAddToCollection(artwork)}
                    >
                      <BookmarkPlus size={14} />
                      Coleções
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      onClick={() => onDelete(artwork)}
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
