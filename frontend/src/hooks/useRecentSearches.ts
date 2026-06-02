import { useCallback, useState } from 'react'

const STORAGE_KEY = 'atelier_recent_searches'
const MAX_RECENT = 8

function readStorage(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeStorage(items: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>(readStorage)

  const addSearch = useCallback((query: string) => {
    setRecents(prev => {
      const next = [query, ...prev.filter(r => r.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT)
      writeStorage(next)
      return next
    })
  }, [])

  const removeSearch = useCallback((query: string) => {
    setRecents(prev => {
      const next = prev.filter(r => r !== query)
      writeStorage(next)
      return next
    })
  }, [])

  return { recents, addSearch, removeSearch }
}
