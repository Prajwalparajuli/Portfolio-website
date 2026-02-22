/**
 * Admin URL and access config (build-time env).
 * Use these so the admin area can live at a custom path and use secret-key access only.
 */

const basePath = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADMIN_PATH?.trim() || 'admin'
const secretKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADMIN_SECRET_KEY?.trim() || ''

/** Base path segment (no leading slash), e.g. "admin" or "_edit" */
export function getAdminBasePath(): string {
  return basePath
}

/** Full admin path for routing and links. subpath is optional, e.g. "projects", "projects/new" */
export function getAdminPath(subpath?: string): string {
  const base = `/${basePath}`
  return subpath ? `${base}/${subpath.replace(/^\//, '')}` : base
}

/** When set, admin is protected by ?key= only; no login screen is shown. */
export function getAdminSecretKey(): string {
  return secretKey
}

export function isSecretKeyMode(): boolean {
  return secretKey.length > 0
}

const SESSION_KEY = 'admin_secret_session'

export function setAdminSecretSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // ignore
  }
}

export function hasAdminSecretSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function clearAdminSecretSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
