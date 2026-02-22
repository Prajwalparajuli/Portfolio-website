/** Words per minute for read time (average adult). */
const WPM = 200

/**
 * Estimate read time in minutes from HTML or plain text.
 */
export function getReadTimeMinutes(htmlOrText: string): number {
  const text = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(/\s+/).length : 0
  const minutes = Math.max(1, Math.ceil(words / WPM))
  return minutes
}

/**
 * Human-readable read time, e.g. "2 min read".
 */
export function getReadTimeLabel(htmlOrText: string): string {
  const min = getReadTimeMinutes(htmlOrText)
  return min === 1 ? '1 min read' : `${min} min read`
}
