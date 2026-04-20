import { corsHeaders, getServiceClient, json, requireAdminOrScheduler } from '../_shared/common.ts'

async function callGemini(prompt: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase secrets.')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1600,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message =
      (payload as { error?: { message?: string } }).error?.message ??
      `Gemini request failed with status ${response.status}.`
    throw new Error(message)
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Interview prep did not return valid JSON.')
  }
  return trimmed.slice(start, end + 1)
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
    const body = await req.json().catch(() => ({})) as { applicationId?: string }
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId : ''
    if (!applicationId) {
      return json(400, { error: 'applicationId is required.' })
    }

    const service = getServiceClient()
    const applicationResponse = await service
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    if (applicationResponse.error) throw applicationResponse.error
    const application = applicationResponse.data

    const [jobResponse, variantResponse, answersResponse, matchResponse, highlightResponse] = await Promise.all([
      service.from('job_postings').select('*').eq('id', application.job_posting_id).single(),
      application.resume_variant_id
        ? service.from('resume_variants').select('*').eq('id', application.resume_variant_id).single()
        : service.from('resume_variants').select('*').eq('is_primary', true).single(),
      service.from('candidate_answers').select('label,answer,category').order('category', { ascending: true }),
      service.from('job_matches').select('reason_summary,matched_skill_names,matched_project_titles,missing_signals').eq('job_posting_id', application.job_posting_id).maybeSingle(),
      service.from('proof_of_work_highlights').select('title,summary,relevance_reason').or(`application_id.eq.${application.id},job_posting_id.eq.${application.job_posting_id}`).order('display_order', { ascending: true }).limit(6),
    ])
    if (jobResponse.error) throw jobResponse.error
    if (variantResponse.error) throw variantResponse.error
    if (answersResponse.error) throw answersResponse.error
    if (matchResponse.error) throw matchResponse.error
    if (highlightResponse.error) throw highlightResponse.error

    const job = jobResponse.data
    const variant = variantResponse.data
    const answers = answersResponse.data ?? []
    const match = matchResponse.data
    const highlights = highlightResponse.data ?? []

    const prompt = `You are an expert interview coach helping a software or data candidate prepare for a real role.

Create a concise interview prep brief based on the job, the current application packet, the strongest proof-of-work highlights, and reusable candidate answers.

Return JSON exactly in this shape:
{
  "generated_summary": "2-3 sentence summary",
  "talking_points": ["point 1", "point 2", "point 3"],
  "technical_focus": ["topic 1", "topic 2", "topic 3"],
  "recruiter_questions": ["question 1", "question 2", "question 3"],
  "tell_me_about_yourself": "concise answer"
}

Rules:
- Be specific to the role and the attached portfolio evidence
- Do not invent facts, employers, or metrics
- Use the highlight and match reasoning when possible
- Keep each list item short and usable in an interview prep workflow

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description}

CURRENT COVER LETTER:
${application.cover_letter || '(none)'}

MATCH SUMMARY:
${match?.reason_summary ?? '(none)'}
Matched skills: ${(match?.matched_skill_names ?? []).join(', ')}
Matched projects: ${(match?.matched_project_titles ?? []).join(', ')}
Missing signals: ${(match?.missing_signals ?? []).join(', ')}

HIGHLIGHTS:
${highlights.map((item) => `- ${item.title}: ${item.summary} (${item.relevance_reason})`).join('\n')}

CANDIDATE ANSWERS:
${answers.map((item) => `- [${item.category}] ${item.label}: ${item.answer}`).join('\n')}

RESUME CONTENT:
${JSON.stringify(variant.content).slice(0, 5000)}`

    const raw = await callGemini(prompt)
    const parsed = JSON.parse(extractJsonObject(raw)) as {
      generated_summary?: string
      talking_points?: string[]
      technical_focus?: string[]
      recruiter_questions?: string[]
      tell_me_about_yourself?: string
    }

    const upsert = await service
      .from('interview_prep_notes')
      .upsert({
        application_id: application.id,
        generated_summary: parsed.generated_summary?.trim() ?? '',
        talking_points: (parsed.talking_points ?? []).slice(0, 6),
        technical_focus: (parsed.technical_focus ?? []).slice(0, 6),
        recruiter_questions: (parsed.recruiter_questions ?? []).slice(0, 6),
        tell_me_about_yourself: parsed.tell_me_about_yourself?.trim() ?? '',
      }, { onConflict: 'application_id' })
      .select('*')
      .single()
    if (upsert.error) throw upsert.error

    return json(200, { data: upsert.data })
  } catch (error) {
    console.error('interview-prep-generate error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
