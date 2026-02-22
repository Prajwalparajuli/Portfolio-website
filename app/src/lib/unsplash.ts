/**
 * Unsplash image search. Requires VITE_UNSPLASH_ACCESS_KEY in .env.
 * Get a free key at https://unsplash.com/developers
 */

const ACCESS_KEY = (import.meta.env?.VITE_UNSPLASH_ACCESS_KEY as string) || ''
const API = 'https://api.unsplash.com'

export function isUnsplashConfigured(): boolean {
  return !!ACCESS_KEY && ACCESS_KEY !== ''
}

export interface UnsplashResult {
  id: string
  url: string
  thumb: string
  alt: string | null
}

export async function searchUnsplash(query: string, perPage = 12): Promise<UnsplashResult[]> {
  if (!isUnsplashConfigured()) return []
  const q = query.trim()
  if (!q) return []
  try {
    const res = await fetch(
      `${API}/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const results = data.results || []
    return results.map((p: { id: string; urls: { regular: string; small: string }; alt_description: string | null }) => ({
      id: p.id,
      url: `${p.urls.regular}&w=800&h=600&fit=crop`,
      thumb: p.urls.small,
      alt: p.alt_description || null,
    }))
  } catch {
    return []
  }
}
