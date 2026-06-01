import { useState, useCallback, useEffect, useRef } from 'react'
import { Rnd } from 'react-rnd'
import type { Collection, CollectionItem } from '@/types/artwork'
import { updateCollectionItem } from '@/api/artworks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Maximize2 } from 'lucide-react'

interface MoodboardProps {
  collection: Collection
  onArtworkClick: (index: number) => void
}

const MOBILE_BREAKPOINT = 640

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  )
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// Resize handle sizes: bigger on touch for easier targeting
const HANDLE_SIZE_DESKTOP = 8
const HANDLE_SIZE_MOBILE = 20

function makeHandleStyles(size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    background: 'hsl(var(--color-accent) / 0.7)',
    borderRadius: 2,
  }
}

const CORNER_HANDLES = ['bottomRight', 'bottomLeft', 'topRight', 'topLeft'] as const
const EDGE_HANDLES = ['bottom', 'right', 'top', 'left'] as const

function buildHandleStyles(size: number) {
  const style = makeHandleStyles(size)
  const result: Record<string, React.CSSProperties> = {}
  for (const h of [...CORNER_HANDLES, ...EDGE_HANDLES]) result[h] = style
  return result
}

export default function Moodboard({ collection, onArtworkClick }: MoodboardProps) {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const containerRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<CollectionItem[]>(collection.items)
  // Track last tap time per item for double-tap detection on touch
  const lastTapRef = useRef<Record<string, number>>({})

  useEffect(() => {
    setItems((prev) => {
      if (prev.length !== collection.items.length) return collection.items
      return prev
    })
  }, [collection.items])

  const updateMutation = useMutation({
    mutationFn: ({ artworkId, payload }: { artworkId: string; payload: Record<string, unknown> }) =>
      updateCollectionItem(collection.id, artworkId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const handleDragStop = useCallback(
    (id: string, artworkId: string, d: { x: number; y: number }) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, x: d.x, y: d.y } : item))
      )
      updateMutation.mutate({ artworkId, payload: { x: d.x, y: d.y } })
    },
    [updateMutation]
  )

  const handleResizeStop = useCallback(
    (id: string, artworkId: string, ref: HTMLElement, position: { x: number; y: number }) => {
      const width = ref.offsetWidth
      const height = ref.offsetHeight
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, width, height, x: position.x, y: position.y } : item
        )
      )
      updateMutation.mutate({ artworkId, payload: { width, height, x: position.x, y: position.y } })
    },
    [updateMutation]
  )

  const bringToFront = useCallback(
    (id: string, artworkId: string) => {
      const maxZ = Math.max(...items.map((i) => i.z_index || 1), 1)
      const newZ = maxZ + 1
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, z_index: newZ } : item))
      )
      updateMutation.mutate({ artworkId, payload: { z_index: newZ } })
    },
    [items, updateMutation]
  )

  // Double-tap handler for mobile lightbox open
  const handleTouchEnd = useCallback(
    (id: string, index: number) => {
      const now = Date.now()
      const last = lastTapRef.current[id] || 0
      if (now - last < 300) {
        onArtworkClick(index)
        lastTapRef.current[id] = 0
      } else {
        lastTapRef.current[id] = now
      }
    },
    [onArtworkClick]
  )

  // Scroll canvas to show all items (fit view)
  const handleFitView = useCallback(() => {
    if (!containerRef.current || items.length === 0) return
    const minX = Math.min(...items.map((i) => i.x || 0))
    const minY = Math.min(...items.map((i) => i.y || 0))
    containerRef.current.scrollTo({
      left: Math.max(0, minX - 24),
      top: Math.max(0, minY - 24),
      behavior: 'smooth',
    })
  }, [items])

  const defaultWidth = isMobile ? 160 : 300
  const handleSize = isMobile ? HANDLE_SIZE_MOBILE : HANDLE_SIZE_DESKTOP
  const handleStyles = buildHandleStyles(handleSize)

  return (
    <div className="relative">
      {/* Fit-view button */}
      <button
        type="button"
        onClick={handleFitView}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-sm text-xs text-muted-foreground bg-background/80 border border-border/40 hover:text-foreground transition-colors backdrop-blur-sm"
        title="Ajustar visualização"
      >
        <Maximize2 size={12} />
        Ajustar
      </button>

      <div
        ref={containerRef}
        className="relative w-full bg-accent/5 border border-border/40 rounded-sm overflow-auto"
        style={{
          height: isMobile ? 'calc(100dvh - 200px)' : 'calc(100vh - 140px)',
          // Allow touch-pan on the container; items will cancel it during drag
          touchAction: 'pan-x pan-y',
        }}
      >
        <div className="relative" style={{ minWidth: isMobile ? 1200 : 2000, minHeight: isMobile ? 1200 : 2000 }}>
          {items.map((item, index) => {
            if (!item.artwork) return null

            const itemDefaultHeight =
              item.artwork.height && item.artwork.width
                ? (item.artwork.height / item.artwork.width) * defaultWidth
                : defaultWidth

            return (
              <Rnd
                key={item.id}
                default={{
                  x: item.x || 0,
                  y: item.y || 0,
                  width: item.width || defaultWidth,
                  height: item.height || itemDefaultHeight,
                }}
                onDragStop={(_e, d) => handleDragStop(item.id, item.artwork_id, d)}
                onResizeStop={(_e, _dir, ref, _delta, position) =>
                  handleResizeStop(item.id, item.artwork_id, ref, position)
                }
                onMouseDown={() => bringToFront(item.id, item.artwork_id)}
                onTouchStart={() => bringToFront(item.id, item.artwork_id)}
                style={{ zIndex: item.z_index || 1 }}
                bounds="parent"
                className="group"
                resizeHandleStyles={handleStyles}
                // Cancel container scroll during drag so the item moves instead
                dragHandleClassName="drag-handle"
              >
                <div
                  className="drag-handle w-full h-full relative cursor-move shadow-sm hover:shadow-md transition-shadow bg-card select-none"
                  onDoubleClick={() => onArtworkClick(index)}
                  onTouchEnd={() => handleTouchEnd(item.id, index)}
                  // This element cancels the touch-pan so Rnd can capture the drag
                  style={{ touchAction: 'none' }}
                >
                  <img
                    src={`/images/${item.artwork.image_large || item.artwork.image_original}`}
                    alt={item.artwork.title || 'Artwork'}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/50 pointer-events-none transition-colors" />
                </div>
              </Rnd>
            )
          })}
        </div>
      </div>

      {isMobile && (
        <p className="mt-1.5 text-[11px] text-muted-foreground text-center">
          Arraste para mover · Toque duplo para abrir · Handles para redimensionar
        </p>
      )}
    </div>
  )
}
