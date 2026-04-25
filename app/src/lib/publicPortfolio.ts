import { Project } from '@/types'

export type ProjectNarrative = {
  hook: string
  summary: string
  outcomes: string[]
  buildDetails: string[]
  paragraphs: string[]
  plainText: string
}

type ExtractedContent = {
  paragraphs: string[]
  bullets: string[]
  plainText: string
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getProjectNarrative(project: Project): ProjectNarrative {
  // Prefer LLM-generated structured narrative when available
  const sn = project.structured_narrative
  if (sn && sn.hook && sn.summary) {
    return {
      hook: sn.hook,
      summary: sn.summary,
      outcomes: sn.results || [],
      buildDetails: [sn.approach, ...(sn.learned || [])].filter(Boolean),
      paragraphs: [sn.problem, sn.approach].filter(Boolean),
      plainText: [sn.hook, sn.problem, sn.approach, ...(sn.results || [])].join(' '),
    }
  }

  // Fallback: extract from HTML description
  const extracted = extractContent(project.description)
  const sentences = extracted.paragraphs.flatMap(splitSentences)
  const hook =
    firstNonEmpty([
      normalizeText(project.ask_me_about ?? ''),
      extracted.paragraphs[0],
      sentences[0],
      project.title,
    ]) ?? project.title

  const summary =
    firstNonEmpty([
      extracted.paragraphs[0],
      sentences.slice(0, 2).join(' '),
      extracted.plainText,
      project.title,
    ]) ?? project.title

  const outcomePool = dedupe([
    ...prioritizeSignalLines(extracted.bullets),
    ...prioritizeSignalLines(sentences),
    ...extracted.bullets,
    ...sentences,
  ]).filter((line) => line !== hook)

  const buildPool = dedupe([
    ...extracted.bullets,
    ...sentences,
    ...extracted.paragraphs,
  ]).filter((line) => line !== hook && line !== summary)

  return {
    hook,
    summary,
    outcomes: (outcomePool.length > 0 ? outcomePool : buildPool).slice(0, 3),
    buildDetails: buildPool.slice(0, 5),
    paragraphs: extracted.paragraphs,
    plainText: extracted.plainText,
  }
}

function extractContent(html: string): ExtractedContent {
  if (!html.trim()) {
    return { paragraphs: [], bullets: [], plainText: '' }
  }

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const paragraphs = Array.from(doc.querySelectorAll('p'))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter(Boolean)
    const bullets = Array.from(doc.querySelectorAll('li'))
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter(Boolean)
    const plainText = normalizeText(doc.body.textContent ?? '')

    return {
      paragraphs: paragraphs.length > 0 ? paragraphs : fallbackParagraphs(plainText),
      bullets,
      plainText,
    }
  }

  const plainText = stripHtml(html)
  return {
    paragraphs: fallbackParagraphs(plainText),
    bullets: [],
    plainText,
  }
}

function prioritizeSignalLines(lines: string[]): string[] {
  const signalLines = lines.filter(hasSignal)
  if (signalLines.length > 0) return signalLines
  return lines
}

function hasSignal(line: string): boolean {
  return /(\d|%|\$|users|customer|accuracy|latency|hours|days|weeks|months|pipeline|model|dashboard|forecast|automation|experiment|etl|llm|ai|analytics)/i.test(
    line
  )
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeText(sentence))
    .filter(Boolean)
}

function fallbackParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((part) => normalizeText(part))
    .filter(Boolean)
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)))
}

function firstNonEmpty(values: string[]): string | null {
  for (const value of values) {
    if (value.trim()) return value.trim()
  }
  return null
}
