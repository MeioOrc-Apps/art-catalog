import { useCallback, useState } from 'react'

const STORAGE_KEY = 'atelier_gallery_quality'

export function useGalleryQuality() {
  const [quality, setQuality] = useState<'thumb' | 'large'>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'large' ? 'large' : 'thumb'
    } catch {
      return 'thumb'
    }
  })

  const toggleQuality = useCallback(() => {
    setQuality(prev => {
      const next = prev === 'thumb' ? 'large' : 'thumb'
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  return { quality, toggleQuality }
}
