import { useState, useCallback, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import type { Collection, CollectionItem } from '@/types/artwork'
import { updateCollectionItem } from '@/api/artworks'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface MoodboardProps {
  collection: Collection
  onArtworkClick: (index: number) => void
}

export default function Moodboard({ collection, onArtworkClick }: MoodboardProps) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<CollectionItem[]>(collection.items)

  useEffect(() => {
    setItems((prev) => {
      // Only update if items were added or removed to avoid interrupting drag/resize
      if (prev.length !== collection.items.length) {
        return collection.items
      }
      return prev
    })
  }, [collection.items])

  const updateMutation = useMutation({
    mutationFn: ({ artworkId, payload }: { artworkId: string; payload: any }) =>
      updateCollectionItem(collection.id, artworkId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const handleDragStop = useCallback(
    (id: string, artworkId: string, d: { x: number; y: number }) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, x: d.x, y: d.y } : item
        )
      )
      updateMutation.mutate({ artworkId, payload: { x: d.x, y: d.y } })
    },
    [updateMutation]
  )

  const handleResizeStop = useCallback(
    (
      id: string,
      artworkId: string,
      ref: HTMLElement,
      position: { x: number; y: number }
    ) => {
      const width = ref.offsetWidth
      const height = ref.offsetHeight
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, width, height, x: position.x, y: position.y }
            : item
        )
      )
      updateMutation.mutate({
        artworkId,
        payload: { width, height, x: position.x, y: position.y },
      })
    },
    [updateMutation]
  )

  const bringToFront = useCallback(
    (id: string, artworkId: string) => {
      const maxZ = Math.max(...items.map((i) => i.z_index || 1), 1)
      const newZ = maxZ + 1
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, z_index: newZ } : item
        )
      )
      updateMutation.mutate({ artworkId, payload: { z_index: newZ } })
    },
    [items, updateMutation]
  )

  return (
    <div className="relative w-full h-[calc(100vh-140px)] bg-accent/5 border border-border/40 rounded-sm overflow-hidden overflow-x-auto overflow-y-auto">
      <div className="relative min-w-[2000px] min-h-[2000px]">
        {items.map((item, index) => {
          if (!item.artwork) return null
          
          const defaultWidth = 300
          const defaultHeight = item.artwork.height && item.artwork.width 
            ? (item.artwork.height / item.artwork.width) * defaultWidth 
            : 300

          return (
            <Rnd
              key={item.id}
              default={{
                x: item.x || 0,
                y: item.y || 0,
                width: item.width || defaultWidth,
                height: item.height || defaultHeight,
              }}
              onDragStop={(_e, d) => handleDragStop(item.id, item.artwork_id, d)}
              onResizeStop={(_e, _direction, ref, _delta, position) =>
                handleResizeStop(item.id, item.artwork_id, ref, position)
              }
              onMouseDown={() => bringToFront(item.id, item.artwork_id)}
              style={{ zIndex: item.z_index || 1 }}
              bounds="parent"
              className="group"
            >
              <div 
                className="w-full h-full relative cursor-move shadow-sm hover:shadow-md transition-shadow bg-card"
                onDoubleClick={() => onArtworkClick(index)}
              >
                <img
                  src={`/images/${item.artwork.image_large || item.artwork.image_original}`}
                  alt={item.artwork.title || 'Artwork'}
                  className="w-full h-full object-cover pointer-events-none"
                />
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/50 pointer-events-none transition-colors" />
              </div>
            </Rnd>
          )
        })}
      </div>
    </div>
  )
}
