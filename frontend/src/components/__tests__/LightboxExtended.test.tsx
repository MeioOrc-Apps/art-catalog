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

describe('Lightbox extended', () => {
  it('shows Previous button when index > 0', () => {
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={1} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(screen.getByLabelText('Anterior')).toBeInTheDocument()
  })

  it('calls onNavigate with decremented index on previous button click', () => {
    const onNavigate = vi.fn()
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={1} onClose={() => {}} onNavigate={onNavigate} />
    )
    fireEvent.click(screen.getByLabelText('Anterior'))
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('calls onNavigate with incremented index on next button click', () => {
    const onNavigate = vi.fn()
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={0} onClose={() => {}} onNavigate={onNavigate} />
    )
    fireEvent.click(screen.getByLabelText('Próxima'))
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('ArrowLeft calls navigate to previous', () => {
    const onNavigate = vi.fn()
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={1} onClose={() => {}} onNavigate={onNavigate} />
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('ArrowRight calls navigate to next', () => {
    const onNavigate = vi.fn()
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={0} onClose={() => {}} onNavigate={onNavigate} />
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('does not navigate past first artwork with ArrowLeft', () => {
    const onNavigate = vi.fn()
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={0} onClose={() => {}} onNavigate={onNavigate} />
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate past last artwork with ArrowRight', () => {
    const onNavigate = vi.fn()
    const artworks = [mockArtwork({ id: '1' }), mockArtwork({ id: '2' })]
    render(
      <Lightbox open={true} artworks={artworks} index={1} onClose={() => {}} onNavigate={onNavigate} />
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('locks body scroll when open', () => {
    render(
      <Lightbox open={true} artworks={[mockArtwork()]} index={0} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('shows bookmark button when onAddToCollection is provided', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork()]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onAddToCollection={vi.fn()}
      />
    )
    expect(screen.getByText('Coleções')).toBeInTheDocument()
  })

  it('calls onAddToCollection when bookmark button is clicked', () => {
    const onAddToCollection = vi.fn()
    const artwork = mockArtwork({ title: 'MyArt' })
    render(
      <Lightbox
        open={true}
        artworks={[artwork]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onAddToCollection={onAddToCollection}
      />
    )
    fireEvent.click(screen.getByText('Coleções'))
    expect(onAddToCollection).toHaveBeenCalledWith(artwork)
  })

  it('shows delete button when onDelete is provided', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork()]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    const artwork = mockArtwork()
    render(
      <Lightbox
        open={true}
        artworks={[artwork]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByText('Excluir'))
    expect(onDelete).toHaveBeenCalledWith(artwork)
  })

  it('shows pin button when onTogglePin is provided', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork()]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onTogglePin={vi.fn()}
      />
    )
    expect(screen.getByText('Fixar no topo')).toBeInTheDocument()
  })

  it('calls onTogglePin when pin button is clicked', () => {
    const onTogglePin = vi.fn()
    const artwork = mockArtwork()
    render(
      <Lightbox
        open={true}
        artworks={[artwork]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onTogglePin={onTogglePin}
      />
    )
    fireEvent.click(screen.getByText('Fixar no topo'))
    expect(onTogglePin).toHaveBeenCalledWith(artwork)
  })

  it('closes when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Lightbox open={true} artworks={[mockArtwork()]} index={0} onClose={onClose} onNavigate={() => {}} />
    )
    const dialog = container.querySelector('[role="dialog"]')!
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Desafixar" button for pinned artwork when onTogglePin provided', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork({ is_pinned: true })]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
        onTogglePin={vi.fn()}
      />
    )
    expect(screen.getByText('Desafixar')).toBeInTheDocument()
  })

  it('hides generic titles like "Picture"', () => {
    render(
      <Lightbox
        open={true}
        artworks={[mockArtwork({ title: 'Picture', source_image_url: 'http://img/a.jpg' })]}
        index={0}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    )
    expect(screen.queryByText('Picture')).toBeNull()
  })
})
