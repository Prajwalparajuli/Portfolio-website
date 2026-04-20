/**
 * Admin URL config (build-time env).
 * Only the admin path is configurable from the frontend build.
 */

const basePath = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADMIN_PATH?.trim() || 'admin'

/** Base path segment (no leading slash), e.g. "admin" or "_edit" */
export function getAdminBasePath(): string {
  return basePath
}

/** Full admin path for routing and links. subpath is optional, e.g. "projects", "projects/new" */
export function getAdminPath(subpath?: string): string {
  const base = `/${basePath}`
  return subpath ? `${base}/${subpath.replace(/^\//, '')}` : base
}
