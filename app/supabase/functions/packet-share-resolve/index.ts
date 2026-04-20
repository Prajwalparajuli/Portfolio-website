import { corsHeaders, getServiceClient, json } from '../_shared/common.ts'

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  try {
    const body = await req.json().catch(() => ({})) as { token?: string }
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) {
      return json(400, { error: 'A share token is required.' })
    }

    const service = getServiceClient()
    const tokenHash = await sha256(token)
    const shareResponse = await service
      .from('application_share_links')
      .select('id,application_id,resume_variant_id,title,expires_at,revoked_at,access_count')
      .eq('share_token_hash', tokenHash)
      .maybeSingle()
    if (shareResponse.error) throw shareResponse.error
    const share = shareResponse.data

    if (!share || share.revoked_at) {
      return json(404, { error: 'This recruiter packet link is no longer available.' })
    }

    if (new Date(share.expires_at).getTime() < Date.now()) {
      return json(410, { error: 'This recruiter packet link has expired.' })
    }

    const [
      applicationResponse,
      variantResponse,
      profileResponse,
    ] = await Promise.all([
      service.from('applications').select('*').eq('id', share.application_id).single(),
      share.resume_variant_id
        ? service.from('resume_variants').select('*').eq('id', share.resume_variant_id).single()
        : service.from('resume_variants').select('*').eq('is_primary', true).single(),
      service.from('candidate_profiles').select('*').eq('profile_key', 'primary').maybeSingle(),
    ])
    if (applicationResponse.error) throw applicationResponse.error
    if (variantResponse.error) throw variantResponse.error
    if (profileResponse.error) throw profileResponse.error

    const application = applicationResponse.data
    const variant = variantResponse.data
    const profile = profileResponse.data

    const jobResponse = await service
      .from('job_postings')
      .select('id,title,company,location,job_url,updated_at')
      .eq('id', application.job_posting_id)
      .single()
    if (jobResponse.error) throw jobResponse.error

    const highlightsResponse = await service
      .from('proof_of_work_highlights')
      .select('*')
      .or(`application_id.eq.${application.id},job_posting_id.eq.${application.job_posting_id}`)
      .order('display_order', { ascending: true })
      .limit(6)
    if (highlightsResponse.error) throw highlightsResponse.error

    const accessUpdate = await service
      .from('application_share_links')
      .update({
        access_count: (share.access_count ?? 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', share.id)
    if (accessUpdate.error) throw accessUpdate.error

    return json(200, {
      data: {
        share: {
          id: share.id,
          title: share.title,
          expires_at: share.expires_at,
        },
        job: jobResponse.data,
        application: {
          id: application.id,
          status: application.status,
          cover_letter: application.cover_letter,
          updated_at: application.updated_at,
        },
        profile: profile
          ? {
              display_name: profile.display_name,
              contact_email: profile.contact_email,
              linkedin_url: profile.linkedin_url,
              github_url: profile.github_url,
              location: profile.location,
              now_line: profile.now_line,
            }
          : null,
        resume_variant: {
          id: variant.id,
          name: variant.name,
          updated_at: variant.updated_at,
          content: variant.content,
        },
        highlights: highlightsResponse.data ?? [],
      },
    })
  } catch (error) {
    console.error('packet-share-resolve error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
