import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Gallery from '@/components/Gallery'
import type { Artwork } from '@/types/artwork'

const mockArtwork = (overrides: Partial<Artwork> = {}): Artwork => ({
  id: 'a1',
  source_image_url: 'http://example.com/img.jpg',
  source_page_url: null,
  title: 'Test Art',
  image_original: null,
  image_large: 'x/x_large.jpg',
  image_thumb: 'x/x_thumb.jpg',
  width: 1200,
  height: 900,
  dominant_colors: [[255, 0, 0], [0, 255, 0]],
  phash: 'abc123',
  is_downloaded: true,
  is_pinned: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('Gallery', () => {
  it('renders nothing when artworks is empty', () => {
    const { container } = render(
      <Gallery artworks={[]} onArtworkClick={() => {}} />
    )
    expect(container.querySelector('.art-masonry')).toBeNull()
  })

  it('renders multiple artwork cards', () => {
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' }), mockArtwork({ id: '3' })]
    render(<Gallery artworks={artworks} onArtworkClick={() => {}} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(3)
  })

  it('uses correct image src from image_thumb', () => {
    const artworks = [mockArtwork({ id: '1', image_thumb: 'egon-schiele/ab/abc123_thumb.jpg' })]
    render(<Gallery artworks={artworks} onArtworkClick={() => {}} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/images/egon-schiele/ab/abc123_thumb.jpg')
  })

  it('sets alt text from title', () => {
    const artworks = [mockArtwork({ id: '1', title: 'Mona Lisa' })]
    render(<Gallery artworks={artworks} onArtworkClick={() => {}} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'Mona Lisa')
  })

  it('renders palette bar with dominant colors', () => {
    const artworks = [
      mockArtwork({
        id: '1',
        dominant_colors: [[255, 0, 0], [0, 128, 0], [0, 0, 255]],
      }),
    ]
    const { container } = render(<Gallery artworks={artworks} onArtworkClick={() => {}} />)

    const paletteSpans = container.querySelectorAll('.h-2 > span')
    expect(paletteSpans).toHaveLength(3)
  })
})
