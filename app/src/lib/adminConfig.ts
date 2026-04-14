/**
 * Admin URL config (build-time env).
 * Only the admin path is configurable from the frontend build.
 */

const basePath = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADMIN_PATH?.trim() || 'admin'
const allowedEmailsValue =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADMIN_ALLOWED_EMAILS?.trim() || ''

const allowedEmails = allowedEmailsValue
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

/** Base path segment (no leading slash), e.g. "admin" or "_edit" */
export function getAdminBasePath(): string {
  return basePath
}

/** Full admin path for routing and links. subpath is optional, e.g. "projects", "projects/new" */
export function getAdminPath(subpath?: string): string {
  const base = `/${basePath}`
  return subpath ? `${base}/${subpath.replace(/^\//, '')}` : base
}

export function getAdminAllowedEmails(): string[] {
  return [...allowedEmails]
}

export function isAdminAllowlistConfigured(): boolean {
  return allowedEmails.length > 0
}

export function isAllowedAdminEmail(email?: string | null): boolean {
  if (!email) return false
  if (!isAdminAllowlistConfigured()) return true
  return allowedEmails.includes(email.trim().toLowerCase())
}
