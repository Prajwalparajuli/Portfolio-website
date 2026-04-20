import { corsHeaders, getServiceClient, json, requireAdminOrScheduler } from '../_shared/common.ts'

type PreferenceRow = {
  email_enabled: boolean
  inbox_enabled: boolean
  strong_match_enabled: boolean
  sync_failure_enabled: boolean
  follow_up_enabled: boolean
  stale_application_enabled: boolean
  weekly_digest_enabled: boolean
  timezone: string
}

async function sendDigestEmail(subject: string, lines: string[]) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL')
  const to = Deno.env.get('NOTIFICATION_TO_EMAIL')
  if (!apiKey || !from || !to || lines.length === 0) return

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: lines.join('\n'),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Resend email failed with status ${response.status}. ${body}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const auth = await requireAdminOrScheduler(req)
  if (auth.kind === 'unauthorized') {
    if (auth.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }
    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const service = getServiceClient()
    const [
      prefsResponse,
      applicationsResponse,
      jobsResponse,
      matchesResponse,
      syncRunsResponse,
    ] = await Promise.all([
      service.from('notification_preferences').select('*').eq('profile_key', 'primary').maybeSingle(),
      service.from('applications').select('id,job_posting_id,status,follow_up_at,updated_at'),
      service.from('job_postings').select('id,title,company'),
      service.from('job_matches').select('job_posting_id,total_score,band,reason_summary,refreshed_at').eq('band', 'strong'),
      service.from('job_sync_runs').select('id,label,error_message,completed_at').eq('status', 'error').order('completed_at', { ascending: false }).limit(10),
    ])

    if (prefsResponse.error) throw prefsResponse.error
    if (applicationsResponse.error) throw applicationsResponse.error
    if (jobsResponse.error) throw jobsResponse.error
    if (matchesResponse.error) throw matchesResponse.error
    if (syncRunsResponse.error) throw syncRunsResponse.error

    const prefs = (prefsResponse.data ?? {
      email_enabled: true,
      inbox_enabled: true,
      strong_match_enabled: true,
      sync_failure_enabled: true,
      follow_up_enabled: true,
      stale_application_enabled: true,
      weekly_digest_enabled: true,
      timezone: 'America/Chicago',
    }) as PreferenceRow
    const jobs = new Map(((jobsResponse.data ?? []) as Array<{ id: string; title: string; company: string }>).map((job) => [job.id, job]))
    const applications = (applicationsResponse.data ?? []) as Array<{
      id: string
      job_posting_id: string
      status: string
      follow_up_at: string | null
      updated_at: string
    }>
    const trackedJobIds = new Set(applications.map((application) => application.job_posting_id))
    const strongMatches = ((matchesResponse.data ?? []) as Array<{
      job_posting_id: string
      total_score: number
      reason_summary: string
      refreshed_at: string
    }>).filter((match) => !trackedJobIds.has(match.job_posting_id))

    const now = Date.now()
    const dueApplications = applications.filter((application) => {
      if (!application.follow_up_at) return false
      return new Date(application.follow_up_at).getTime() <= now
    })
    const staleApplications = applications.filter((application) => {
      if (application.status !== 'ready_to_apply' && application.status !== 'applied') return false
      return now - new Date(application.updated_at).getTime() >= 5 * 24 * 60 * 60 * 1000
    })
    const syncFailures = (syncRunsResponse.data ?? []) as Array<{
      id: string
      label: string
      error_message: string
      completed_at: string | null
    }>

    const notificationRows: Array<Record<string, unknown>> = []
    const emailLines: string[] = []

    if (prefs.strong_match_enabled) {
      strongMatches.slice(0, 8).forEach((match) => {
        const job = jobs.get(match.job_posting_id)
        notificationRows.push({
          type: 'strong_match',
          title: `Strong match: ${job?.title ?? 'Untitled role'}`,
          body: match.reason_summary || 'A new strong match was found during the latest scoring run.',
          link_path: '/admin/jobs',
          channel: prefs.email_enabled ? 'both' : 'inbox',
          job_posting_id: match.job_posting_id,
          due_at: null,
        })
        emailLines.push(`Strong match: ${job?.title ?? 'Untitled role'} at ${job?.company ?? 'Unknown company'} — ${match.reason_summary}`)
      })
    }

    if (prefs.follow_up_enabled) {
      dueApplications.slice(0, 8).forEach((application) => {
        const job = jobs.get(application.job_posting_id)
        notificationRows.push({
          type: 'follow_up_due',
          title: `Follow up today: ${job?.title ?? 'Tracked role'}`,
          body: `A follow-up is due for ${job?.company ?? 'this company'}.`,
          link_path: '/admin/applications',
          channel: prefs.email_enabled ? 'both' : 'inbox',
          application_id: application.id,
          job_posting_id: application.job_posting_id,
          due_at: application.follow_up_at,
        })
        emailLines.push(`Follow up due: ${job?.title ?? 'Tracked role'} at ${job?.company ?? 'Unknown company'}`)
      })
    }

    if (prefs.stale_application_enabled) {
      staleApplications.slice(0, 8).forEach((application) => {
        const job = jobs.get(application.job_posting_id)
        notificationRows.push({
          type: 'stale_application',
          title: `Stale application: ${job?.title ?? 'Tracked role'}`,
          body: `This application has been sitting in ${application.status.replace(/_/g, ' ')} for several days.`,
          link_path: '/admin/applications',
          channel: prefs.email_enabled ? 'both' : 'inbox',
          application_id: application.id,
          job_posting_id: application.job_posting_id,
          due_at: null,
        })
        emailLines.push(`Stale application: ${job?.title ?? 'Tracked role'} at ${job?.company ?? 'Unknown company'}`)
      })
    }

    if (prefs.sync_failure_enabled) {
      syncFailures.slice(0, 5).forEach((run) => {
        notificationRows.push({
          type: 'sync_failure',
          title: `Sync failure: ${run.label || 'Watchlist sync'}`,
          body: run.error_message || 'A scheduled sync failed.',
          link_path: '/admin/jobs',
          channel: prefs.email_enabled ? 'both' : 'inbox',
          due_at: run.completed_at,
        })
        emailLines.push(`Sync failure: ${run.label || 'Watchlist sync'} — ${run.error_message}`)
      })
    }

    if (notificationRows.length > 0 && prefs.inbox_enabled) {
      const insert = await service.from('notification_items').insert(notificationRows)
      if (insert.error) throw insert.error
    }

    if (prefs.email_enabled && emailLines.length > 0) {
      await sendDigestEmail('Career cockpit updates', emailLines)
    }

    return json(200, {
      data: {
        notificationsCreated: notificationRows.length,
        emailLines: emailLines.length,
      },
    })
  } catch (error) {
    console.error('notifications-dispatch error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
