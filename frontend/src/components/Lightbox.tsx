import { useEffect, useRef, useCallback, useState } from 'react'
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

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const SWIPE_THRESHOLD = 50 // px to trigger navigation

export default function Lightbox({
  artworks,
  index,
  open,
  onClose,
  onNavigate,
  onAddToCollection,
  onDelete,
  onTogglePin,
}: LightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Image zoom state
  const [imgZoom, setImgZoom] = useState(1)
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 })

  // Touch tracking refs (avoid re-renders during gesture)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const pinchStartDistRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number>(1)
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const resetZoom = useCallback(() => {
    setImgZoom(1)
    setImgOffset({ x: 0, y: 0 })
  }, [])

  // Reset zoom when switching images
  useEffect(() => { resetZoom() }, [index, resetZoom])

  const navigate = useCallback(
    (delta: number) => {
      const newIndex = index + delta
      if (newIndex >= 0 && newIndex < artworks.length) {
        onNavigate(newIndex)
      }
    },
    [index, artworks.length, onNavigate]
  )

  // Keyboard
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') navigate(-1)
      else if (e.key === 'ArrowRight') navigate(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, navigate])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [open])

  // ── Touch handlers on the image area ─────────────────────────────────────

  const handleImgTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      if (imgZoom > 1) {
        // Start panning
        panStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          ox: imgOffset.x,
          oy: imgOffset.y,
        }
      }
      pinchStartDistRef.current = null
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchStartDistRef.current = Math.hypot(dx, dy)
      pinchStartZoomRef.current = imgZoom
      touchStartRef.current = null
    }
  }, [imgZoom, imgOffset])

  const handleImgTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomRef.current * (dist / pinchStartDistRef.current)))
      setImgZoom(newZoom)
    } else if (e.touches.length === 1 && imgZoom > 1 && panStartRef.current) {
      e.preventDefault()
      const dx = e.touches[0].clientX - panStartRef.current.x
      const dy = e.touches[0].clientY - panStartRef.current.y
      setImgOffset({ x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy })
    }
  }, [imgZoom])

  const handleImgTouchEnd = useCallback((e: React.TouchEvent) => {
    pinchStartDistRef.current = null
    panStartRef.current = null

    // Only handle swipe if not zoomed in and it was a single-finger gesture
    if (imgZoom > 1 || !touchStartRef.current) return

    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    touchStartRef.current = null

    // Swipe must be more horizontal than vertical
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return

    if (dx < 0) navigate(1)   // swipe left → next
    else navigate(-1)         // swipe right → previous
  }, [imgZoom, navigate])

  // Mouse drag-to-pan when zoomed
  const mousePanRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const handleAreaMouseDown = useCallback((e: React.MouseEvent) => {
    if (imgZoom <= 1) return
    e.preventDefault()
    mousePanRef.current = { x: e.clientX, y: e.clientY, ox: imgOffset.x, oy: imgOffset.y }
  }, [imgZoom, imgOffset])
  const handleAreaMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mousePanRef.current) return
    setImgOffset({ x: mousePanRef.current.ox + e.clientX - mousePanRef.current.x, y: mousePanRef.current.oy + e.clientY - mousePanRef.current.y })
  }, [])
  const handleAreaMouseUp = useCallback(() => { mousePanRef.current = null }, [])

  // Double-tap to zoom 2× (or reset) — only fires on the image itself
  const handleImgDoubleClick = useCallback(() => {
    setImgZoom((prev) => (prev > 1 ? 1 : 2))
    setImgOffset({ x: 0, y: 0 })
  }, [])

  if (!open || !artworks[index]) return null

  const artwork = artworks[index]
  const isManualUpload = artwork.source_image_url?.startsWith('manual_upload_')
  const isGenericTitle = artwork.title?.toLowerCase() === 'picture' || artwork.title?.toLowerCase() === 'image'
  const displayTitle = isManualUpload ? artwork.title : (isGenericTitle ? null : artwork.title)
  const isZoomed = imgZoom > 1

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 animate-fade-in"
      onClick={(e) => { if (e.target === containerRef.current) onClose() }}
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

      {/* Nav arrows — hidden when zoomed on mobile (use swipe instead) */}
      {index > 0 && !isZoomed && (
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-2.5 rounded-full bg-background/60 text-foreground hover:bg-background/80 transition-colors"
          onClick={() => navigate(-1)}
          aria-label="Anterior"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {index < artworks.length - 1 && !isZoomed && (
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
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Header */}
        <div className="w-full flex-shrink-0 text-center mb-4 mt-2 z-10 px-16">
          <h2 className="text-xl md:text-2xl font-display font-medium text-foreground tracking-wide">
            {artwork.artist && (
              <span className="text-muted-foreground">{artwork.artist.canonical_name}</span>
            )}
            {artwork.artist && displayTitle && (
              <span className="mx-3 text-border/50">—</span>
            )}
            {displayTitle && <span>{displayTitle}</span>}
          </h2>
        </div>

        {/* Image area with touch support */}
        <div
          className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
          onTouchStart={handleImgTouchStart}
          onTouchMove={handleImgTouchMove}
          onTouchEnd={handleImgTouchEnd}
          onMouseDown={handleAreaMouseDown}
          onMouseMove={handleAreaMouseMove}
          onMouseUp={handleAreaMouseUp}
          onMouseLeave={handleAreaMouseUp}
          style={{ cursor: isZoomed ? 'grab' : 'default' }}
        >
          <img
            ref={imageRef}
            src={`/images/${artwork.image_large}`}
            alt={artwork.title || artwork.source_image_url}
            className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm"
            style={{
              transform: `scale(${imgZoom}) translate(${imgOffset.x / imgZoom}px, ${imgOffset.y / imgZoom}px)`,
              transition: isZoomed ? 'none' : 'transform 0.2s ease',
              touchAction: 'none',
            }}
            draggable={false}
            onDoubleClick={handleImgDoubleClick}
            onClick={(e) => e.stopPropagation()}
          />
          {isZoomed && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); resetZoom() }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs bg-background/70 text-muted-foreground border border-border/40 backdrop-blur-sm"
            >
              Resetar zoom
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="w-full flex-shrink-0 mt-6 flex justify-center z-10">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 bg-card/40 backdrop-blur-md px-6 py-2.5 rounded-full border border-border/30 shadow-lg">
            {(artwork.width || artwork.height) && (
              <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
                <span className="opacity-70">Dimensões:</span>
                <span className="text-foreground">{artwork.width}&times;{artwork.height}</span>
              </div>
            )}
            {artwork.source_page_url?.match(/^https?:\/\//) && (
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
                      <Pin size={14} className={artwork.is_pinned ? 'fill-current' : ''} />
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
