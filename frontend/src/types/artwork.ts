export type DominantColor = [number, number, number]

export interface Artwork {
  id: string
  source_image_url: string
  source_page_url: string | null
  title: string | null
  image_original: string | null
  image_large: string | null
  image_thumb: string | null
  width: number | null
  height: number | null
  dominant_colors: DominantColor[] | null
  phash: string | null
  is_downloaded: boolean
  is_pinned: boolean
  created_at: string
  artist?: ArtistSummary | null
}

export interface Artist {
  id: string
  slug: string
  canonical_name: string
  bio_short: string | null
  last_searched_at: string | null
  sync_status: 'ready' | 'processing' | 'error'
  created_at: string
  artworks: Artwork[]
}

export interface ArtistSummary {
  id: string
  slug: string
  canonical_name: string
  last_searched_at: string | null
  sync_status: 'ready' | 'processing' | 'error'
  artworks: Artwork[]
}

export interface ArtistPaginated {
  id: string
  slug: string
  canonical_name: string
  bio_short: string | null
  last_searched_at: string | null
  sync_status: 'ready' | 'processing' | 'error'
  created_at: string
  artworks: Artwork[]
  total: number
  limit: number
  offset: number
}

export interface SearchPayload {
  artist: string
  limit?: number
  refresh?: boolean
}

export interface SearchResponse {
  matched: boolean
  suggestion: string | null
  suggestions: string[]
  artist: Artist | null
}

export interface CollectionItem {
  id: string
  artwork_id: string
  note: string | null
  x: number
  y: number
  width: number | null
  height: number | null
  z_index: number
  created_at: string
  artwork: Artwork | null
}

export interface Collection {
  id: string
  user_id: string
  name: string
  created_at: string
  items: CollectionItem[]
}
