import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Lightbox from '@/components/Lightbox'
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
  dominant_colors: null,
  phash: 'abc123',
  is_downloaded: true,
  is_pinned: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('Lightbox', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <Lightbox
        open={false}
        artworks={[mockArtwork()]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders dialog with image when open', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork({ image_large: 'x/x_large.jpg' })]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/images/x/x_large.jpg')
  })

  it('shows title when present', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork({ title: 'Mona Lisa' })]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    expect(screen.getByText('Mona Lisa')).toBeInTheDocument()
  })

  it('shows dimensions when present', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork({ width: 1920, height: 1080 })]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    expect(screen.getByText('1920×1080')).toBeInTheDocument()
  })

  it('shows source link when source_page_url is present', () => {
    render(
      <Lightbox
        open={true}
        artworks={[
          mockArtwork({ source_page_url: 'https://example.com/art' }),
        ]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    const link = screen.getByText('Ver fonte original')
    expect(link).toHaveAttribute('href', 'https://example.com/art')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork()]}
        index={0}
        onClose={onClose}
        onNavigate={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork()]}
        index={0}
        onClose={onClose}
        onNavigate={() => {}}
      />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows navigation arrows for multiple artworks', () => {
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox
        open={true}
        artworks={artworks}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    expect(screen.getByLabelText('Próxima')).toBeInTheDocument()
  })
})
