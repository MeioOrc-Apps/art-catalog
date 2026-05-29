interface SkeletonProps {
  count?: number
}

export default function Skeleton({ count = 6 }: SkeletonProps) {
  return (
    <div className="art-masonry columns-2 md:columns-3 lg:columns-4 gap-4" role="list">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="art-masonry-item break-inside-avoid mb-4 rounded-sm overflow-hidden bg-card/30 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="aspect-[4/3] bg-background/50" />
          <div className="h-2 bg-background/30" />
        </div>
      ))}
    </div>
  )
}
