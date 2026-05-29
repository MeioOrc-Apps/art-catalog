import { api } from './client'
import type {
  ArtistPaginated,
  ArtistSummary,
  Collection,
  CollectionItem,
  SearchPayload,
  SearchResponse,
} from '@/types/artwork'

export async function searchArtworks(body: SearchPayload): Promise<SearchResponse> {
  const { data } = await api.post<SearchResponse>('/api/artworks/search', body)
  return data
}

export async function listArtists(): Promise<ArtistSummary[]> {
  const { data } = await api.get<ArtistSummary[]>('/api/artworks/artists')
  return data
}

export async function exploreArtworks(color?: string, offset = 0, limit = 50): Promise<{ artworks: Artwork[], total: number, limit: number, offset: number }> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
  })
  if (color) {
    params.append('color', color.replace('#', ''))
  }
  const { data } = await api.get(`/api/artworks/explore?${params.toString()}`)
  return data
}

export async function createArtist(name: string): Promise<Artist> {
  const { data } = await api.post<Artist>('/api/artworks/artists', { name })
  return data
}

export async function getArtist(slug: string, pageParam?: number): Promise<ArtistPaginated> {
  const limit = 30
  const offset = (pageParam ?? 0) * limit
  const { data } = await api.get<ArtistPaginated>(
    `/api/artworks/artists/${slug}?limit=${limit}&offset=${offset}`
  )
  return data
}

export async function deleteArtist(slug: string): Promise<void> {
  await api.delete(`/api/artworks/artists/${slug}`)
}

export async function deleteArtwork(id: string): Promise<void> {
  await api.delete(`/api/artworks/artworks/${id}`)
}

export async function togglePinArtwork(id: string): Promise<Artwork> {
  const { data } = await api.patch<Artwork>(`/api/artworks/artworks/${id}/pin`)
  return data
}

export async function uploadArtwork(slug: string, files: File[]): Promise<Artist> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  const { data } = await api.post<Artist>(`/api/artworks/artists/${slug}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export async function listCollections(): Promise<Collection[]> {
  const { data } = await api.get<Collection[]>('/api/collections')
  return data
}

export async function createCollection(name: string): Promise<Collection> {
  const { data } = await api.post<Collection>('/api/collections', { name })
  return data
}

export async function addToCollection(
  collectionId: string,
  artworkId: string,
  note?: string,
): Promise<CollectionItem> {
  const { data } = await api.post<CollectionItem>(
    `/api/collections/${collectionId}/items`,
    { artwork_id: artworkId, note },
  )
  return data
}

export async function removeFromCollection(
  collectionId: string,
  artworkId: string,
): Promise<void> {
  await api.delete(`/api/collections/${collectionId}/items/${artworkId}`)
}

export async function updateCollectionItem(
  collectionId: string,
  artworkId: string,
  payload: Partial<{ x: number; y: number; width: number; height: number; z_index: number; note: string }>,
): Promise<CollectionItem> {
  const { data } = await api.patch<CollectionItem>(
    `/api/collections/${collectionId}/items/${artworkId}`,
    payload,
  )
  return data
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await api.delete(`/api/collections/${collectionId}`)
}

