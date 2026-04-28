/**
 * Fetch a public website URL and extract metadata to build a project import payload.
 *
 * Scrapes the page's HTML for:
 * - <title> and og:title
 * - meta description and og:description
 * - og:image for cover image
 * - tech hints from meta generators, script src attributes, etc.
 */

export interface WebsiteImportData {
  title: string
  description: string
  slug: string
  tags: string[]
  demo_url: string
  cover_image: string | null
  import_source: 'website'
}

/**
 * Fetch a website URL via a CORS proxy and extract project metadata from the HTML.
 * Falls back to basic URL-based inference if scraping fails.
 */
export async function fetchProjectFromWebsiteUrl(url: string): Promise<WebsiteImportData> {
  const normalized = normalizeUrl(url)
  if (!normalized) {
    throw new Error('Invalid URL. Paste a full URL like https://myapp.com')
  }

  let html: string
  try {
    // Try fetching directly first (works for same-origin or CORS-enabled sites)
    const res = await fetch(normalized, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch {
    // If direct fetch fails (CORS), try common CORS proxies
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}`
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
      html = await res.text()
    } catch {
      // If all fetches fail, build a minimal entry from the URL itself
      return buildFallbackFromUrl(normalized)
    }
  }

  return parseHtmlToProjectData(html, normalized)
}

function normalizeUrl(input: string): string | null {
  let url = input.trim()
  if (!url) return null

  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  try {
    const parsed = new URL(url)
    // Must have a real hostname
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null
    return parsed.href
  } catch {
    return null
  }
}

function parseHtmlToProjectData(html: string, sourceUrl: string): WebsiteImportData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const title = extractTitle(doc)
  const description = extractDescription(doc)
  const coverImage = extractOgImage(doc, sourceUrl)
  const tags = detectTechTags(html, doc)

  return {
    title: title || titleFromHostname(sourceUrl),
    description: description
      ? `<h2>Overview</h2><p>${escapeHtml(description)}</p>`
      : '<p>Imported from live website.</p>',
    slug: slugFromTitle(title || titleFromHostname(sourceUrl)),
    tags,
    demo_url: sourceUrl,
    cover_image: coverImage,
    import_source: 'website',
  }
}

function buildFallbackFromUrl(url: string): WebsiteImportData {
  const hostname = titleFromHostname(url)
  return {
    title: hostname,
    description: `<p>Live application at <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></p>`,
    slug: slugFromTitle(hostname),
    tags: [],
    demo_url: url,
    cover_image: null,
    import_source: 'website',
  }
}

function extractTitle(doc: Document): string {
  // Prefer og:title > title tag
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim()
  if (ogTitle) return ogTitle

  const titleTag = doc.querySelector('title')?.textContent?.trim()
  if (titleTag) {
    // Clean common suffixes like " | Company" or " - App Name"
    return titleTag.replace(/\s*[|–—-]\s*[^|–—-]+$/, '').trim() || titleTag
  }

  return ''
}

function extractDescription(doc: Document): string {
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim()
  if (ogDesc) return ogDesc

  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()
  if (metaDesc) return metaDesc

  // Try twitter:description
  const twitterDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content')?.trim()
  if (twitterDesc) return twitterDesc

  return ''
}

function extractOgImage(doc: Document, sourceUrl: string): string | null {
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim()
  if (!ogImage) return null

  // Make relative URLs absolute
  if (ogImage.startsWith('//')) return `https:${ogImage}`
  if (ogImage.startsWith('/')) {
    try {
      const base = new URL(sourceUrl)
      return `${base.origin}${ogImage}`
    } catch {
      return null
    }
  }
  if (ogImage.startsWith('http')) return ogImage

  return null
}

/** Detect tech stack from HTML source patterns */
function detectTechTags(html: string, doc: Document): string[] {
  const tags: string[] = []
  const lower = html.toLowerCase()

  // Framework detection from meta generators
  const generator = doc.querySelector('meta[name="generator"]')?.getAttribute('content')?.toLowerCase() ?? ''
  if (generator.includes('next.js') || generator.includes('next')) tags.push('Next.js')
  if (generator.includes('gatsby')) tags.push('Gatsby')
  if (generator.includes('nuxt')) tags.push('Nuxt')
  if (generator.includes('hugo')) tags.push('Hugo')
  if (generator.includes('wordpress')) tags.push('WordPress')

  // Framework detection from common script/link patterns
  if (lower.includes('__next') || lower.includes('_next/static')) tags.push('Next.js')
  if (lower.includes('__nuxt') || lower.includes('/_nuxt/')) tags.push('Nuxt')
  if (lower.includes('react') && !tags.includes('Next.js')) tags.push('React')
  if (lower.includes('vue') && !tags.includes('Nuxt')) tags.push('Vue')
  if (lower.includes('angular')) tags.push('Angular')
  if (lower.includes('svelte') || lower.includes('sveltekit')) tags.push('Svelte')

  // CSS framework detection
  if (lower.includes('tailwind')) tags.push('Tailwind CSS')
  if (lower.includes('bootstrap')) tags.push('Bootstrap')

  // Platform detection
  if (lower.includes('vercel')) tags.push('Vercel')
  if (lower.includes('netlify')) tags.push('Netlify')
  if (lower.includes('supabase')) tags.push('Supabase')
  if (lower.includes('firebase')) tags.push('Firebase')
  if (lower.includes('stripe')) tags.push('Stripe')

  // Deduplicate
  return [...new Set(tags)].slice(0, 10)
}

function titleFromHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname
    // Remove common prefixes and TLD
    return hostname
      .replace(/^www\./i, '')
      .replace(/\.(com|io|dev|app|co|org|net|xyz)$/i, '')
      .replace(/[.-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || hostname
  } catch {
    return 'Untitled Project'
  }
}

function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || 'project'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
