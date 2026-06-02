import ArtworkCard from '@/components/ArtworkCard'
import type { Artwork } from '@/types/artwork'
import { useState, useEffect } from 'react'

interface GalleryProps {
  artworks: Artwork[]
  onArtworkClick: (artwork: Artwork, index: number) => void
  quality?: 'thumb' | 'large'
}

function useColumns() {
  const [columns, setColumns] = useState(4)

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth < 768) setColumns(2)
      else if (window.innerWidth < 1024) setColumns(3)
      else setColumns(4)
    }
    
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  return columns
}

export default function Gallery({ artworks, onArtworkClick, quality = 'thumb' }: GalleryProps) {
  const columnsCount = useColumns()

  if (!artworks || artworks.length === 0) {
    return null
  }

  const columns: { artwork: Artwork; originalIndex: number }[][] = Array.from({ length: columnsCount }, () => [])
  
  artworks.forEach((artwork, index) => {
    columns[index % columnsCount].push({ artwork, originalIndex: index })
  })

  return (
    <div className="flex gap-4 w-full items-start" role="list">
      {columns.map((col, colIndex) => (
        <div key={colIndex} className="flex-1 flex flex-col">
          {col.map(({ artwork, originalIndex }) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              index={originalIndex}
              onClick={(i) => onArtworkClick(artwork, i)}
              quality={quality}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
