import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Rnd } from 'react-rnd'
import { RotateCcw, RotateCw } from 'lucide-react'
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
  onArtworkClick: (artworkId: string) => void
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

const HANDLE_DIRS = ['bottomRight','bottomLeft','topRight','topLeft','bottom','right','top','left'] as const

function buildHandleStyles(size: number): Record<string, React.CSSProperties> {
  const style: React.CSSProperties = {
    width: size, height: size,
    background: 'rgba(212, 165, 116, 0.9)',
    borderRadius: '50%',
    zIndex: 20,
  }
  return Object.fromEntries(HANDLE_DIRS.map(h => [h, style]))
}

function buildHandleClasses(): Record<string, string> {
  return Object.fromEntries(HANDLE_DIRS.map(h => [h, 'moodboard-handle']))
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
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [rotations, setRotations] = useState<Record<string, number>>(() => {
      try { return JSON.parse(localStorage.getItem(`mb_rot_${collection.id}`) ?? '{}') }
      catch { return {} }
    })
    const lastTapRef = useRef<Record<string, number>>({})
    const pinchStartDistRef = useRef<number | null>(null)
    const pinchStartZoomRef = useRef<number>(1)
    const itemEls = useRef<Record<string, HTMLDivElement | null>>({})
    const rotatingRef = useRef<{ id: string; cx: number; cy: number; startAngle: number; startRot: number; last: number } | null>(null)

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

    const setItemRotation = useCallback((id: string, deg: number) => {
      setRotations(prev => {
        const next = { ...prev, [id]: deg }
        try { localStorage.setItem(`mb_rot_${collection.id}`, JSON.stringify(next)) } catch {}
        return next
      })
    }, [collection.id])

    const startRotateDrag = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
      e.stopPropagation()
      e.preventDefault()
      const el = itemEls.current[id]
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const startAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI)
      rotatingRef.current = { id, cx, cy, startAngle, startRot: rotations[id] || 0, last: rotations[id] || 0 }

      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!rotatingRef.current) return
        const x = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
        const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
        const angle = Math.atan2(y - rotatingRef.current.cy, x - rotatingRef.current.cx) * (180 / Math.PI)
        const newRot = rotatingRef.current.startRot + (angle - rotatingRef.current.startAngle)
        rotatingRef.current.last = newRot
        setRotations(prev => ({ ...prev, [rotatingRef.current!.id]: newRot }))
      }
      const onEnd = () => {
        if (rotatingRef.current) setItemRotation(rotatingRef.current.id, rotatingRef.current.last)
        rotatingRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('mouseup', onEnd)
        document.removeEventListener('touchend', onEnd)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('mouseup', onEnd)
      document.addEventListener('touchend', onEnd)
    }, [rotations, setItemRotation])

    const bringToFront = useCallback((id: string, artworkId: string) => {
      setSelectedId(id)
      const maxZ = Math.max(...items.map(i => i.z_index || 1), 1)
      const newZ = maxZ + 1
      setItems(prev => prev.map(item => item.id === id ? { ...item, z_index: newZ } : item))
      updateMutation.mutate({ artworkId, payload: { z_index: newZ } })
    }, [items, updateMutation])

    const handleTouchEnd = useCallback((id: string, artworkId: string) => {
      const now = Date.now()
      const last = lastTapRef.current[id] || 0
      if (now - last < 300) { onArtworkClick(artworkId); lastTapRef.current[id] = 0 }
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

        type ItemRect = { x: number; y: number; w: number; h: number; src: string; z: number; rotation: number }
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
          rects.push({ x, y, w, h, src, z: item.z_index || 1, rotation: rotations[item.id] || 0 })
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
            const iw = img.naturalWidth, ih = img.naturalHeight
            // Replicate object-cover: scale to fill, crop center
            const scale = Math.max(rect.w / iw, rect.h / ih)
            const sx = Math.max(0, (iw - rect.w / scale) / 2)
            const sy = Math.max(0, (ih - rect.h / scale) / 2)
            const sw = Math.min(iw, rect.w / scale)
            const sh = Math.min(ih, rect.h / scale)

            const cx = rect.x - minX + PAD + rect.w / 2
            const cy = rect.y - minY + PAD + rect.h / 2
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate(rect.rotation * Math.PI / 180)
            ctx.drawImage(img, sx, sy, sw, sh, -rect.w / 2, -rect.h / 2, rect.w, rect.h)
            ctx.restore()
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

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null) }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [])

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
    const handleClasses = buildHandleClasses()
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
              {items.map((item) => {
                if (!item.artwork) return null
                const itemDefaultH = item.artwork.height && item.artwork.width
                  ? (item.artwork.height / item.artwork.width) * defaultW
                  : defaultW
                const rotation = rotations[item.id] || 0
                const isSelected = selectedId === item.id

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
                    className={`group moodboard-item${isSelected ? ' is-selected' : ''}`}
                    resizeHandleStyles={handleStyles}
                    resizeHandleClasses={handleClasses}
                    dragHandleClassName="drag-handle"
                  >
                    {/* Rotation drag handle — appears above item when selected */}
                    {isSelected && (
                      <div
                        className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <div
                          className="w-6 h-6 rounded-full bg-accent/80 border border-accent/40 flex items-center justify-center shadow cursor-grab active:cursor-grabbing touch-none"
                          onMouseDown={e => startRotateDrag(e, item.id)}
                          onTouchStart={e => startRotateDrag(e, item.id)}
                          title="Arraste para girar"
                        >
                          <RotateCw size={12} className="text-primary-foreground pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div
                      ref={el => { itemEls.current[item.id] = el }}
                      className="drag-handle w-full h-full relative cursor-move shadow-sm hover:shadow-md transition-shadow"
                      onDoubleClick={() => onArtworkClick(item.artwork_id)}
                      onTouchEnd={() => handleTouchEnd(item.id, item.artwork_id)}
                      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center', touchAction: 'none' }}
                    >
                      <img
                        src={`/images/${item.artwork.image_large || item.artwork.image_original}`}
                        alt={item.artwork.title || 'Artwork'}
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/50 pointer-events-none transition-colors" />

                      {/* Rotation buttons — bottom-right when selected */}
                      {isSelected && (
                        <div
                          className="absolute bottom-1 right-1 z-30 flex items-center gap-0.5"
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="p-1 rounded bg-background/80 hover:bg-background text-foreground transition-colors"
                            onClick={() => setItemRotation(item.id, rotation - 15)}
                            title="-15°"
                          ><RotateCcw size={11} /></button>
                          <button
                            type="button"
                            className="px-1.5 py-1 rounded bg-background/80 hover:bg-background text-foreground text-[10px] font-mono transition-colors min-w-[2.5rem] text-center"
                            onClick={() => setItemRotation(item.id, 0)}
                            title="Resetar"
                          >{Math.round(rotation)}°</button>
                          <button
                            type="button"
                            className="p-1 rounded bg-background/80 hover:bg-background text-foreground transition-colors"
                            onClick={() => setItemRotation(item.id, rotation + 15)}
                            title="+15°"
                          ><RotateCw size={11} /></button>
                        </div>
                      )}
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
