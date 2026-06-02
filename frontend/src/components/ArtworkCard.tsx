import { Pin } from 'lucide-react'
import type { Artwork } from '@/types/artwork'

interface ArtworkCardProps {
  artwork: Artwork
  index: number
  onClick: (index: number) => void
  quality?: 'thumb' | 'large'
}

function PaletteBar({ colors }: { colors: [number, number, number][] }) {
  return (
    <div className="flex h-2 w-full overflow-hidden">
      {colors.map((c, i) => (
        <span
          key={i}
          className="flex-1"
          style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
        />
      ))}
    </div>
  )
}

export default function ArtworkCard({ artwork, index, onClick, quality = 'thumb' }: ArtworkCardProps) {
  return (
    <article
      className="art-masonry-item break-inside-avoid mb-4 cursor-pointer group rounded-sm overflow-hidden bg-card/50 border border-border/30 animate-slide-up"
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => onClick(index)}
    >
      <div className="relative overflow-hidden bg-background">
        <img
          src={`/images/${quality === 'large' ? (artwork.image_large || artwork.image_thumb) : artwork.image_thumb}`}
          alt={artwork.title || artwork.source_image_url}
          loading="lazy"
          className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {artwork.is_pinned && (
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-background/60 backdrop-blur-sm text-accent shadow-sm z-10">
            <Pin size={12} className="fill-current" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 pb-2 pt-6 px-2.5 bg-gradient-to-t from-black/50 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {artwork.title && (
            <p className="text-xs font-medium text-white/90 truncate font-body">
              {artwork.title}
            </p>
          )}
          {artwork.artist && (
            <p className="text-[11px] text-white/70 truncate font-body mt-0.5">
              {artwork.artist.canonical_name}
            </p>
          )}
          {artwork.width && artwork.height && (
            <p className="text-[10px] text-white/50 font-mono leading-tight mt-1">
              {artwork.width}&times;{artwork.height}
            </p>
          )}
        </div>
      </div>
      {artwork.dominant_colors && artwork.dominant_colors.length > 0 && (
        <PaletteBar colors={artwork.dominant_colors} />
      )}
    </article>
  )
}
