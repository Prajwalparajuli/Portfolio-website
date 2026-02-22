/**
 * Suggest a cover image URL based on project tags.
 * Uses Picsum Photos by ID so URLs are stable and always load.
 * Each tag maps to a different image so suggestions vary by project type.
 */

const W = 800
const H = 600

/** Map tag -> Picsum image ID (integer). IDs 0–30 are known to exist and return working images. */
const TAG_TO_PICSUM_ID: Record<string, number> = {
  default: 0,
  code: 1,
  python: 2,
  javascript: 3,
  typescript: 4,
  react: 5,
  vue: 6,
  next: 7,
  'data science': 8,
  'machine learning': 9,
  'deep learning': 10,
  tensorflow: 11,
  pytorch: 12,
  api: 13,
  docker: 14,
  aws: 15,
  tailwind: 16,
  rust: 17,
  go: 18,
  java: 19,
  node: 20,
}

function picsumUrl(id: number): string {
  return `https://picsum.photos/id/${id}/${W}/${H}`
}

/**
 * Returns a working cover image URL. Same tag always gets the same image.
 */
export function getSuggestedCoverImage(tags: string[], _slug: string): string {
  const tagLower = tags.map((t) => t.toLowerCase().trim())
  for (const t of tagLower) {
    const id = TAG_TO_PICSUM_ID[t]
    if (id !== undefined) return picsumUrl(id)
  }
  return picsumUrl(TAG_TO_PICSUM_ID.default)
}
