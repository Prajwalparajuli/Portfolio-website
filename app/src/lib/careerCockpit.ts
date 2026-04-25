import { invokeAdminFunction } from '@/lib/functions'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { ApplicationShareLink, InterviewPrepNote } from '@/types'

const PACKET_RESOLVE_FUNCTION = 'packet-share-resolve'

export async function refreshHybridMatches(jobIds?: string[]) {
  return invokeAdminFunction<{
    jobsProcessed: number
    evidenceCount: number
    matchesUpdated: number
  }>('jobs-match', {
    jobIds: Array.isArray(jobIds) ? jobIds : [],
  })
}

export async function discoverWatchlist(input: { watchlistId?: string; careersUrl?: string }) {
  return invokeAdminFunction<{
    watchlistId: string | null
    sourceHint:
      | 'greenhouse'
      | 'lever'
      | 'workday'
      | 'ashby'
      | 'smartrecruiters'
      | 'icims'
      | 'workable'
      | 'jobvite'
      | 'generic'
    boardOrSite: string
    snapshotJobs: Array<{ title: string; url: string; location: string }>
    notes: string
    discoveredAt: string
  }>('watchlist-discover', input)
}

export async function runScheduledWatchlists(watchlistId?: string) {
  return invokeAdminFunction<{
    scheduledAt: string
    watchlistsProcessed: number
    watchlistsSynced: number
    savedSearchesProcessed?: number
    savedSearchesSynced?: number
    importedJobs: number
    matchRefresh?: {
      skipped: boolean
      jobsProcessed: number
      matchesUpdated: number
    } | null
    failures: string[]
  }>('jobs-sync-scheduler', {
    watchlistId: watchlistId ?? '',
  })
}

export async function dispatchCareerNotifications() {
  return invokeAdminFunction<{
    notificationsCreated: number
    emailLines: number
  }>('notifications-dispatch', {})
}

export async function generateInterviewPrep(applicationId: string) {
  return invokeAdminFunction<InterviewPrepNote>('interview-prep-generate', {
    applicationId,
  })
}

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function getApplicationShareLinks(applicationId: string): Promise<ApplicationShareLink[]> {
  const { data, error } = await supabase
    .from('application_share_links')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => ({
    ...row,
    share_url: undefined,
  })) as ApplicationShareLink[]
}

export async function createApplicationShareLink(input: {
  applicationId: string
  resumeVariantId: string | null
  title: string
  expiresAt?: string
}): Promise<ApplicationShareLink> {
  const token = randomToken()
  const tokenHash = await sha256(token)
  const expiresAt = input.expiresAt
    ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('application_share_links')
    .insert({
      application_id: input.applicationId,
      resume_variant_id: input.resumeVariantId,
      share_token_hash: tokenHash,
      title: input.title,
      expires_at: expiresAt,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    ...(data as ApplicationShareLink),
    share_url: `${baseUrl}/packet/${token}`,
  }
}

export async function revokeApplicationShareLink(id: string): Promise<ApplicationShareLink> {
  const { data, error } = await supabase
    .from('application_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as ApplicationShareLink
}

export async function resolvePacketShare(token: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for packet sharing.')
  }

  const { data, error } = await supabase.functions.invoke(PACKET_RESOLVE_FUNCTION, {
    body: { token },
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error('Recruiter packet returned an unexpected response.')
  }

  return (data as { data: Record<string, unknown> }).data
}
