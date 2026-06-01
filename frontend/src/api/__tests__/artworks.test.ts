import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPost = vi.fn()
const mockGet = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

import {
  searchArtworks,
  listArtists,
  exploreArtworks,
  createArtist,
  getArtist,
  deleteArtist,
  deleteArtwork,
  togglePinArtwork,
  uploadArtwork,
  listCollections,
  createCollection,
  addToCollection,
  removeFromCollection,
  updateCollectionItem,
  deleteCollection,
} from '@/api/artworks'

describe('artworks API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searchArtworks posts search payload', async () => {
    const response = { matched: true, artist: { id: '1', slug: 'monet' } }
    mockPost.mockResolvedValue({ data: response })
    const result = await searchArtworks({ artist: 'Monet', limit: 30 })
    expect(result).toEqual(response)
    expect(mockPost).toHaveBeenCalledWith('/api/artworks/search', { artist: 'Monet', limit: 30 })
  })

  it('listArtists gets all artists', async () => {
    const artists = [{ id: '1', slug: 'monet', canonical_name: 'Monet' }]
    mockGet.mockResolvedValue({ data: artists })
    const result = await listArtists()
    expect(result).toEqual(artists)
    expect(mockGet).toHaveBeenCalledWith('/api/artworks/artists')
  })

  it('exploreArtworks builds URL with offset and limit', async () => {
    mockGet.mockResolvedValue({ data: { artworks: [], total: 0, limit: 50, offset: 0 } })
    await exploreArtworks(undefined, 0, 50)
    expect(mockGet).toHaveBeenCalledWith('/api/artworks/explore?offset=0&limit=50')
  })

  it('exploreArtworks appends color param without hash', async () => {
    mockGet.mockResolvedValue({ data: { artworks: [], total: 0 } })
    await exploreArtworks('#ff0000', 10, 20)
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('color=ff0000')
    expect(url).toContain('offset=10')
    expect(url).toContain('limit=20')
  })

  it('exploreArtworks with color without hash prefix', async () => {
    mockGet.mockResolvedValue({ data: { artworks: [], total: 0 } })
    await exploreArtworks('abc123')
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('color=abc123')
  })

  it('createArtist posts artist name', async () => {
    const artist = { id: '1', slug: 'klimt' }
    mockPost.mockResolvedValue({ data: artist })
    const result = await createArtist('Klimt')
    expect(result).toEqual(artist)
    expect(mockPost).toHaveBeenCalledWith('/api/artworks/artists', { name: 'Klimt' })
  })

  it('getArtist fetches artist with pagination', async () => {
    const artist = { id: '1', slug: 'klimt', artworks: [] }
    mockGet.mockResolvedValue({ data: artist })
    const result = await getArtist('klimt', 2)
    expect(result).toEqual(artist)
    expect(mockGet).toHaveBeenCalledWith('/api/artworks/artists/klimt?limit=30&offset=60')
  })

  it('getArtist uses page 0 when pageParam is undefined', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await getArtist('klimt')
    expect(mockGet).toHaveBeenCalledWith('/api/artworks/artists/klimt?limit=30&offset=0')
  })

  it('deleteArtist sends DELETE request', async () => {
    mockDelete.mockResolvedValue({})
    await deleteArtist('klimt')
    expect(mockDelete).toHaveBeenCalledWith('/api/artworks/artists/klimt')
  })

  it('deleteArtwork sends DELETE for artwork id', async () => {
    mockDelete.mockResolvedValue({})
    await deleteArtwork('artwork-123')
    expect(mockDelete).toHaveBeenCalledWith('/api/artworks/artworks/artwork-123')
  })

  it('togglePinArtwork patches pin endpoint', async () => {
    const artwork = { id: 'a1', is_pinned: true }
    mockPatch.mockResolvedValue({ data: artwork })
    const result = await togglePinArtwork('a1')
    expect(result).toEqual(artwork)
    expect(mockPatch).toHaveBeenCalledWith('/api/artworks/artworks/a1/pin')
  })

  it('uploadArtwork posts FormData for files', async () => {
    const artist = { id: '1', slug: 'picasso' }
    mockPost.mockResolvedValue({ data: artist })
    const file = new File(['data'], 'art.jpg', { type: 'image/jpeg' })
    const result = await uploadArtwork('picasso', [file])
    expect(result).toEqual(artist)
    const [url, formData, config] = mockPost.mock.calls[0]
    expect(url).toBe('/api/artworks/artists/picasso/upload')
    expect(formData).toBeInstanceOf(FormData)
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
  })

  it('listCollections gets all collections', async () => {
    const cols = [{ id: 'c1', name: 'Favorites' }]
    mockGet.mockResolvedValue({ data: cols })
    const result = await listCollections()
    expect(result).toEqual(cols)
    expect(mockGet).toHaveBeenCalledWith('/api/collections')
  })

  it('createCollection posts collection name', async () => {
    const col = { id: 'c1', name: 'New' }
    mockPost.mockResolvedValue({ data: col })
    const result = await createCollection('New')
    expect(result).toEqual(col)
    expect(mockPost).toHaveBeenCalledWith('/api/collections', { name: 'New' })
  })

  it('addToCollection posts artwork to collection', async () => {
    const item = { id: 'i1', artwork_id: 'a1' }
    mockPost.mockResolvedValue({ data: item })
    const result = await addToCollection('c1', 'a1', 'great piece')
    expect(result).toEqual(item)
    expect(mockPost).toHaveBeenCalledWith('/api/collections/c1/items', {
      artwork_id: 'a1',
      note: 'great piece',
    })
  })

  it('removeFromCollection deletes item', async () => {
    mockDelete.mockResolvedValue({})
    await removeFromCollection('c1', 'a1')
    expect(mockDelete).toHaveBeenCalledWith('/api/collections/c1/items/a1')
  })

  it('updateCollectionItem patches item payload', async () => {
    const item = { id: 'i1', x: 10, y: 20 }
    mockPatch.mockResolvedValue({ data: item })
    const result = await updateCollectionItem('c1', 'a1', { x: 10, y: 20 })
    expect(result).toEqual(item)
    expect(mockPatch).toHaveBeenCalledWith('/api/collections/c1/items/a1', { x: 10, y: 20 })
  })

  it('deleteCollection deletes collection by id', async () => {
    mockDelete.mockResolvedValue({})
    await deleteCollection('c1')
    expect(mockDelete).toHaveBeenCalledWith('/api/collections/c1')
  })
})
