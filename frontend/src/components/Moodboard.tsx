import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Rnd } from 'react-rnd'
import type { Collection, CollectionItem } from '@/types/artwork'
import { updateCollectionItem } from '@/api/artworks'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface MoodboardHandle {
  fitView: () => void
  exportPng: () => Promise<void>
  isExporting: boolean
  zoom: number
  setZoom: (z: number) => void
  zoomIn: () => void
  zoomOut: () => void
}

interface MoodboardProps {
  collection: Collection
  onArtworkClick: (index: number) => void
}

const MOBILE_BREAKPOINT = 640
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 3
export const ZOOM_STEP = 0.15

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

const HANDLE_SIZE_DESKTOP = 8
const HANDLE_SIZE_MOBILE = 20

function buildHandleStyles(size: number): Record<string, React.CSSProperties> {
  const style: React.CSSProperties = {
    width: size, height: size,
    background: 'hsl(var(--color-accent) / 0.7)',
    borderRadius: 2,
  }
  return Object.fromEntries(
    ['bottomRight','bottomLeft','topRight','topLeft','bottom','right','top','left'].map(h => [h, style])
  )
}

const Moodboard = forwardRef<MoodboardHandle, MoodboardProps>(
  function Moodboard({ collection, onArtworkClick }, ref) {
    const queryClient = useQueryClient()
    const isMobile = useIsMobile()
    const containerRef = useRef<HTMLDivElement>(null)
    // canvasRef wraps the unscaled inner div where Rnd items live
    const canvasRef = useRef<HTMLDivElement>(null)
    const [items, setItems] = useState<CollectionItem[]>(collection.items)
    const [zoom, setZoomState] = useState(1)
    const [isExporting, setIsExporting] = useState(false)
    const lastTapRef = useRef<Record<string, number>>({})
    const pinchStartDistRef = useRef<number | null>(null)
    const pinchStartZoomRef = useRef<number>(1)

    useEffect(() => {
      setItems(prev => prev.length !== collection.items.length ? collection.items : prev)
    }, [collection.items])

    const updateMutation = useMutation({
      mutationFn: ({ artworkId, payload }: { artworkId: string; payload: Record<string, unknown> }) =>
        updateCollectionItem(collection.id, artworkId, payload),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
    })

    const handleDragStop = useCallback((id: string, artworkId: string, d: { x: number; y: number }) => {
      setItems(prev => prev.map(item => item.id === id ? { ...item, x: d.x, y: d.y } : item))
      updateMutation.mutate({ artworkId, payload: { x: d.x, y: d.y } })
    }, [updateMutation])

    const handleResizeStop = useCallback((id: string, artworkId: string, el: HTMLElement, position: { x: number; y: number }) => {
      const width = el.offsetWidth, height = el.offsetHeight
      setItems(prev => prev.map(item => item.id === id ? { ...item, width, height, x: position.x, y: position.y } : item))
      updateMutation.mutate({ artworkId, payload: { width, height, x: position.x, y: position.y } })
    }, [updateMutation])

    const bringToFront = useCallback((id: string, artworkId: string) => {
      const maxZ = Math.max(...items.map(i => i.z_index || 1), 1)
      const newZ = maxZ + 1
      setItems(prev => prev.map(item => item.id === id ? { ...item, z_index: newZ } : item))
      updateMutation.mutate({ artworkId, payload: { z_index: newZ } })
    }, [items, updateMutation])

    const handleTouchEnd = useCallback((id: string, index: number) => {
      const now = Date.now()
      const last = lastTapRef.current[id] || 0
      if (now - last < 300) { onArtworkClick(index); lastTapRef.current[id] = 0 }
      else lastTapRef.current[id] = now
    }, [onArtworkClick])

    const clamp = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
    const setZoom = useCallback((z: number) => setZoomState(clamp(z)), [])

    const fitView = useCallback(() => {
      if (!containerRef.current || items.length === 0) return
      const xs = items.map(i => i.x || 0)
      const ys = items.map(i => i.y || 0)
      const rights = items.map(i => (i.x || 0) + (i.width || 300))
      const bottoms = items.map(i => (i.y || 0) + (i.height || 300))
      const minX = Math.min(...xs), minY = Math.min(...ys)
      const cW = containerRef.current.clientWidth, cH = containerRef.current.clientHeight
      const fitZoom = clamp(Math.min(cW / (Math.max(...rights) - minX + 48), cH / (Math.max(...bottoms) - minY + 48)) * 0.9)
      setZoomState(fitZoom)
      setTimeout(() => {
        containerRef.current?.scrollTo({ left: Math.max(0, minX * fitZoom - 24), top: Math.max(0, minY * fitZoom - 24), behavior: 'smooth' })
      }, 50)
    }, [items])

    // Export: read actual rendered positions from DOM so the image exactly matches what's on screen
    const exportPng = useCallback(async () => {
      if (isExporting || !canvasRef.current) return
      setIsExporting(true)
      try {
        // Each Rnd item is a child div of canvasRef with transform: translate(x,y) and explicit width/height
        const rndEls = Array.from(canvasRef.current.children) as HTMLElement[]
        if (rndEls.length === 0) return

        type ItemRect = { x: number; y: number; w: number; h: number; src: string; z: number }
        const rects: ItemRect[] = []

        rndEls.forEach((el, i) => {
          const item = items[i]
          if (!item?.artwork) return
          // Rnd renders: <div style="transform:translate(Xpx,Ypx); width:Wpx; height:Hpx">
          const style = el.style
          const match = /translate\(([^,]+)px,\s*([^)]+)px\)/.exec(style.transform || '')
          const x = match ? parseFloat(match[1]) : (item.x || 0)
          const y = match ? parseFloat(match[2]) : (item.y || 0)
          const w = el.offsetWidth || item.width || 300
          const h = el.offsetHeight || item.height || 300
          const src = `/images/${item.artwork.image_large || item.artwork.image_original}`
          rects.push({ x, y, w, h, src, z: item.z_index || 1 })
        })

        if (rects.length === 0) return

        const minX = Math.min(...rects.map(r => r.x))
        const minY = Math.min(...rects.map(r => r.y))
        const maxX = Math.max(...rects.map(r => r.x + r.w))
        const maxY = Math.max(...rects.map(r => r.y + r.h))
        const PAD = 32
        const W = maxX - minX + PAD * 2
        const H = maxY - minY + PAD * 2
        const SCALE = 2

        const canvas = document.createElement('canvas')
        canvas.width = W * SCALE; canvas.height = H * SCALE
        const ctx = canvas.getContext('2d')!
        ctx.scale(SCALE, SCALE)
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, W, H)

        await Promise.all(rects.sort((a, b) => a.z - b.z).map(rect => new Promise<void>(resolve => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.drawImage(img, rect.x - minX + PAD, rect.y - minY + PAD, rect.w, rect.h)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = rect.src
        })))

        canvas.toBlob(blob => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = `${collection.name.replace(/\s+/g, '_')}.png`
          link.href = url; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }, 'image/png')
      } finally {
        setIsExporting(false)
      }
    }, [items, isExporting, collection.name])

    // Scroll-wheel zoom
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoomState(prev => clamp(prev + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))) }
      }
      el.addEventListener('wheel', onWheel, { passive: false })
      return () => el.removeEventListener('wheel', onWheel)
    }, [])

    // Pinch
    const handleContainerTouchStart = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        pinchStartZoomRef.current = zoom
      }
    }, [zoom])

    const handleContainerTouchMove = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
        e.preventDefault()
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        setZoomState(clamp(pinchStartZoomRef.current * (dist / pinchStartDistRef.current)))
      }
    }, [])

    const handleContainerTouchEnd = useCallback(() => { pinchStartDistRef.current = null }, [])

    useImperativeHandle(ref, () => ({
      fitView, exportPng, isExporting, zoom, setZoom,
      zoomIn: () => setZoomState(prev => clamp(prev + ZOOM_STEP)),
      zoomOut: () => setZoomState(prev => clamp(prev - ZOOM_STEP)),
    }), [fitView, exportPng, isExporting, zoom, setZoom])

    const defaultW = isMobile ? 160 : 300
    const handleStyles = buildHandleStyles(isMobile ? HANDLE_SIZE_MOBILE : HANDLE_SIZE_DESKTOP)
    const canvasSize = isMobile ? 1200 : 2000

    return (
      <div className="relative select-none">
        <div
          ref={containerRef}
          className="relative w-full bg-accent/5 border border-border/40 rounded-sm overflow-auto"
          style={{ height: isMobile ? 'calc(100dvh - 200px)' : 'calc(100vh - 148px)', touchAction: 'pan-x pan-y' }}
          onTouchStart={handleContainerTouchStart}
          onTouchMove={handleContainerTouchMove}
          onTouchEnd={handleContainerTouchEnd}
        >
          {/* Outer div expands with zoom so scrollbars track real space */}
          <div style={{ width: canvasSize * zoom, height: canvasSize * zoom, position: 'relative' }}>
            {/* Inner canvas at 1× — scaled via CSS transform */}
            <div
              ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0, width: canvasSize, height: canvasSize, transformOrigin: '0 0', transform: `scale(${zoom})` }}
            >
              {items.map((item, index) => {
                if (!item.artwork) return null
                const itemDefaultH = item.artwork.height && item.artwork.width
                  ? (item.artwork.height / item.artwork.width) * defaultW
                  : defaultW

                return (
                  <Rnd
                    key={item.id}
                    default={{ x: item.x || 0, y: item.y || 0, width: item.width || defaultW, height: item.height || itemDefaultH }}
                    scale={zoom}
                    onDragStop={(_e, d) => handleDragStop(item.id, item.artwork_id, d)}
                    onResizeStop={(_e, _dir, el, _delta, position) => handleResizeStop(item.id, item.artwork_id, el, position)}
                    onMouseDown={() => bringToFront(item.id, item.artwork_id)}
                    onTouchStart={() => bringToFront(item.id, item.artwork_id)}
                    style={{ zIndex: item.z_index || 1 }}
                    bounds="parent"
                    className="group"
                    resizeHandleStyles={handleStyles}
                    dragHandleClassName="drag-handle"
                  >
                    <div
                      className="drag-handle w-full h-full relative cursor-move shadow-sm hover:shadow-md transition-shadow bg-card"
                      onDoubleClick={() => onArtworkClick(index)}
                      onTouchEnd={() => handleTouchEnd(item.id, index)}
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
        </div>

        {isMobile && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Toque duplo: abrir · Pinça: zoom · Arrastar: mover
          </p>
        )}
      </div>
    )
  }
)

export default Moodboard
