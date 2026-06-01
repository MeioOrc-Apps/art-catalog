import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Collection } from '@/types/artwork'
import type { MoodboardHandle } from '@/components/Moodboard'

const mockUpdateCollectionItem = vi.fn()

vi.mock('@/api/artworks', () => ({
  updateCollectionItem: (...args: unknown[]) => mockUpdateCollectionItem(...args),
}))

vi.mock('react-rnd', () => ({
  Rnd: vi.fn(({ children, style, position, size }: { children: React.ReactNode; style?: React.CSSProperties; position?: object; size?: object }) => (
    <div
      data-testid="rnd-item"
      style={{ ...style, left: (position as any)?.x, top: (position as any)?.y, width: (size as any)?.width, height: (size as any)?.height }}
    >
      {children}
    </div>
  )),
}))

import Moodboard from '@/components/Moodboard'

const mockArtwork = {
  id: 'a1',
  title: 'Sunset',
  source_image_url: 'http://img/a1.jpg',
  source_page_url: null,
  image_original: null,
  image_large: 'a1_large.jpg',
  image_thumb: 'a1_thumb.jpg',
  width: 800,
  height: 600,
  dominant_colors: [[255, 0, 0]] as [number, number, number][],
  phash: 'h1',
  is_downloaded: true,
  is_pinned: false,
  created_at: '2024-01-01T00:00:00Z',
}

const mockCollection: Collection = {
  id: 'col-1',
  name: 'Test Collection',
  user_id: 'u1',
  created_at: '2024-01-01T00:00:00Z',
  items: [
    {
      id: 'i1',
      artwork_id: 'a1',
      artwork: mockArtwork,
      note: null,
      x: 100,
      y: 50,
      width: 200,
      height: 150,
      z_index: 1,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
}

const emptyCollection: Collection = {
  ...mockCollection,
  id: 'empty-col',
  items: [],
}

function renderMoodboard(collection = mockCollection) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Moodboard collection={collection} onArtworkClick={() => {}} />
    </QueryClientProvider>
  )
}

describe('Moodboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateCollectionItem.mockResolvedValue({})
  })

  it('renders the canvas container', () => {
    const { container } = renderMoodboard()
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders an Rnd item for each collection item', () => {
    renderMoodboard()
    expect(screen.getAllByTestId('rnd-item')).toHaveLength(1)
  })

  it('renders item image with correct src', () => {
    renderMoodboard()
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/images/a1_large.jpg')
  })

  it('renders empty canvas when collection has no items', () => {
    const { container } = renderMoodboard(emptyCollection)
    expect(screen.queryAllByTestId('rnd-item')).toHaveLength(0)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders with multiple items', () => {
    const multiCol: Collection = {
      ...mockCollection,
      id: 'multi-col',
      items: [
        { ...mockCollection.items[0], id: 'i1' },
        {
          ...mockCollection.items[0],
          id: 'i2',
          artwork_id: 'a2',
          artwork: { ...mockArtwork, id: 'a2', title: 'Sunrise', image_thumb: 'a2_thumb.jpg' },
        },
      ],
    }
    renderMoodboard(multiCol)
    expect(screen.getAllByTestId('rnd-item')).toHaveLength(2)
  })

  it('exposes zoom methods via ref', async () => {
    const ref = React.createRef<MoodboardHandle>()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <Moodboard ref={ref} collection={mockCollection} onArtworkClick={() => {}} />
      </QueryClientProvider>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.zoom).toBe(1)
    act(() => { ref.current?.zoomIn() })
    expect(ref.current?.zoom).toBeGreaterThan(1)
    act(() => { ref.current?.zoomOut() })
    act(() => { ref.current?.setZoom(1.5) })
    expect(ref.current?.zoom).toBe(1.5)
    act(() => { ref.current?.fitView() })
  })

  it('exposes isExporting via ref', () => {
    const ref = React.createRef<MoodboardHandle>()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <Moodboard ref={ref} collection={mockCollection} onArtworkClick={() => {}} />
      </QueryClientProvider>
    )
    expect(ref.current?.isExporting).toBe(false)
  })

  it('uses item artwork as fallback when null artwork exists', () => {
    const colWithNullArtwork: Collection = {
      ...mockCollection,
      items: [
        { ...mockCollection.items[0], artwork: null },
        mockCollection.items[0],
      ],
    }
    renderMoodboard(colWithNullArtwork)
    // Only items with artwork should render as Rnd items with images
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThanOrEqual(1)
  })
})
