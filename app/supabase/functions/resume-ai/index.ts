import { corsHeaders, json, requireAdminUser } from '../_shared/common.ts'

const MODEL_BY_TASK = {
  generate_bullets: 'gemini-2.5-flash',
  generate_summary: 'gemini-2.5-flash',
  improve_bullet: 'gemini-2.5-flash',
  generate_subtitle: 'gemini-2.5-flash',
  tailor_resume: 'gemini-2.5-flash',
  generate_cover_letter: 'gemini-2.5-flash',
  analyze_jd_match: 'gemini-2.5-flash',
} as const

type TaskName = keyof typeof MODEL_BY_TASK

type ResumeAiProject = {
  title: string
  description: string
  tags: string[]
}

type ResumeAiExperienceEntry = {
  index: number
  title: string
  tags: string[]
  bullets: string[]
}

type ResumeAiRequest =
  | {
      task: 'generate_bullets'
      payload: { project: ResumeAiProject }
    }
  | {
      task: 'generate_summary'
      payload: {
        settings?: {
          location?: string
          education?: { title?: string; issuer?: string; date?: string }[]
        }
        skills?: string[]
        projects?: ResumeAiProject[]
        experienceItems?: ResumeAiExperienceEntry[]
      }
    }
  | {
      task: 'improve_bullet'
      payload: {
        bullet: string
        projectTitle: string
        tags?: string[]
      }
    }
  | {
      task: 'generate_subtitle'
      payload: { project: ResumeAiProject }
    }
  | {
      task: 'tailor_resume'
      payload: {
        jd: string
        currentSummary?: string
        entries?: ResumeAiExperienceEntry[]
        skills?: string[]
      }
    }
  | {
      task: 'analyze_jd_match'
      payload: {
        jd: string
        resumeText: string
      }
    }
  | {
      task: 'generate_cover_letter'
      payload: {
        job?: {
          title?: string
          company?: string
          location?: string
          employmentType?: string
          description?: string
        }
        candidate?: {
          name?: string
          summary?: string
          skills?: string[]
          experience?: {
            index?: number
            title?: string
            bullets?: string[]
          }[]
        }
      }
    }

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string.`)
  }

  return value.trim()
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function asProject(value: unknown, field: string): ResumeAiProject {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected ${field} to be an object.`)
  }

  const project = value as Record<string, unknown>
  return {
    title: asString(project.title, `${field}.title`),
    description: asString(project.description, `${field}.description`),
    tags: asStringArray(project.tags, `${field}.tags`),
  }
}

function asEntryArray(value: unknown): ResumeAiExperienceEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      index: typeof item.index === 'number' ? item.index : index,
      title: typeof item.title === 'string' ? item.title.trim() : '',
      tags: asStringArray(item.tags, `entries[${index}].tags`),
      bullets: asStringArray(item.bullets, `entries[${index}].bullets`),
    }))
}

function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/\|.*\|/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBulletLines(text: string, limit = 4): string[] {
  const cleaned = text.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
  const skip = /^(here are|these are|below are|the following|note:|output:|result:|bullet|example|please|sure|absolutely|of course|certainly)/i

  return cleaned
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^[\s\-*•‣◦]+\s*/, '').replace(/^\d+[\.\)]\s*/, ''))
    .filter((line) => {
      if (line.length < 40 || line.length > 320) return false
      if (skip.test(line)) return false
      if (/[?:]$/.test(line)) return false
      return true
    })
    .slice(0, limit)
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Resume AI did not return valid JSON.')
  }

  return trimmed.slice(start, end + 1)
}

async function callGemini(task: TaskName, prompt: string, maxOutputTokens: number) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase secrets.')
  }

  const model = MODEL_BY_TASK[task]
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const message =
      (errorPayload as { error?: { message?: string } }).error?.message ??
      `Gemini request failed with status ${response.status}.`
    throw new Error(message)
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }

  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  
  // Post-processing: Rigorously destroy any [X] or [X]% that the AI hallucinates despite the prompt.
  rawText = rawText.replace(/\[X\]%/g, 'significant improvement')
  rawText = rawText.replace(/\[X\]/g, 'measurable results')

  return rawText
}

async function handleGenerateBullets(payload: { project: ResumeAiProject }) {
  const project = asProject(payload.project, 'project')
  const cleanDesc = sanitizeText(project.description).slice(0, 1800)
  const tags = project.tags.join(', ') || 'Python'

  const prompt = `You are an expert resume writer for data science and software engineering roles.

Write EXACTLY 4 resume bullet points for the project below. Follow these rules strictly:

RULES:
- Each bullet starts with a past-tense action verb (Built, Developed, Engineered, Designed, Optimized, Analyzed, Evaluated, Implemented, Deployed, Processed, Automated, Constructed)
- STAR formula: [Verb] + [What you did + tools/tech + scale] + [quantified result or outcome]
- CRITICAL RULE: ABSOLUTELY NO PLACEHOLDERS. NEVER use "[X]", "[X]%", "[Metric]", or any bracketed text. If you don't have a specific metric from the description, describe the outcome qualitatively (e.g., "significantly improved performance" instead of "achieved [X]% performance").
- 80-175 characters per bullet - no shorter, no longer
- NEVER start with "I", "We", "Responsible for", "Helped", "Utilized", "Leveraged", or "Used X to"
- Use numbers already in the description whenever possible. If none exist, do not invent them.

COVER THESE 4 ASPECTS IN ORDER:
Line 1: What was built - the system/model/pipeline name + core algorithms + tech stack
Line 2: Data and scale - dataset size, source, preprocessing steps, feature engineering
Line 3: Methodology - model selection/comparison, validation strategy, training approach
Line 4: Results and deployment - metric achieved + how it was deployed/evaluated/presented

Project title: ${project.title}
Technologies: ${tags}
Description: ${cleanDesc}

IMPORTANT: Output EXACTLY 4 lines. Each line is one bullet. No numbering. No dashes. No headers. No explanation before or after.`

  const text = await callGemini('generate_bullets', prompt, 1200)
  const bullets = parseBulletLines(text, 4)

  while (bullets.length < 4) {
    const stubs = [
      `Built ${project.title} using ${tags}, implementing core algorithms to solve the target problem.`,
      `Processed and cleaned dataset using ${tags}, performing feature engineering and data validation.`,
      `Evaluated model architectures to optimize performance and improve baseline metrics.`,
      `Deployed solution and presented findings, enabling data-driven decision making.`,
    ]
    bullets.push(stubs[bullets.length] ?? '')
  }

  return { bullets }
}

async function handleGenerateSummary(payload: ResumeAiRequest['payload'] & {
  settings?: { location?: string; education?: { title?: string; issuer?: string; date?: string }[] }
  skills?: string[]
  projects?: ResumeAiProject[]
  experienceItems?: ResumeAiExperienceEntry[]
}) {
  const settings = payload.settings ?? {}
  const education = Array.isArray(settings.education) ? settings.education : []
  const firstEducation = education[0]
  const degree = firstEducation
    ? `${firstEducation.title ?? ''} at ${firstEducation.issuer ?? ''} (${firstEducation.date ?? ''})`.trim()
    : ''
  const topSkills = asStringArray(payload.skills, 'skills').slice(0, 15).join(', ')
  const projects = Array.isArray(payload.projects) ? payload.projects : []
  const projectTitles = projects.slice(0, 5).map((project) => project.title).join(', ')
  const experienceItems = asEntryArray(payload.experienceItems)
  const sampleBullets = experienceItems
    .slice(0, 4)
    .flatMap((item) => item.bullets.slice(0, 2))
    .filter(Boolean)
    .join(' | ')

  const prompt = `You are a senior technical resume writer with 20 years of experience placing candidates at top-tier companies (FAANG, unicorn startups, Fortune 500 R&D labs). You have reviewed over 50,000 resumes and know exactly what makes a hiring manager stop scrolling.

Write a professional resume summary. This is the FIRST thing a recruiter reads — it has 6 seconds to make them keep reading.

STRUCTURE (exactly 3-4 sentences, 60-90 words total):
1. POSITIONING LINE: "[Degree/Title] specializing in [2-3 specific domains from skills list]" — NOT generic. Use the candidate's actual specialization.
2. TECHNICAL DEPTH: Name 4-6 specific technologies/frameworks from the skills list, woven naturally into a sentence about what the candidate builds. Show they're a practitioner, not a student.
3. PROOF OF IMPACT: Reference a specific type of project or achievement from the sample work. Use concrete language — "developed production ML pipelines" not "worked on projects."
4. VALUE PROPOSITION: What does the candidate bring to an employer? Frame it as solving their problem.

CRITICAL QUALITY RULES:
- Write in third person. No "I" or "My."
- NEVER use these red-flag phrases that scream "AI wrote this": "results-driven", "passionate", "detail-oriented", "team player", "strong communicator", "self-motivated", "proven track record."
- NEVER use placeholder brackets like [X]% or [metric]. Every word must be final.
- ATS parsers read this field. Front-load the most important keywords (the job title and core skills).
- Be specific. "Built classification models using scikit-learn and TensorFlow on healthcare datasets" beats "experienced in machine learning" every time.

Candidate info:
Education: ${degree || 'Not specified'}
Location: ${typeof settings.location === 'string' ? settings.location : 'Not specified'}
Skills: ${topSkills || 'Not specified'}
Projects: ${projectTitles || 'Not specified'}
Sample work context: ${sampleBullets || 'Not available'}

IMPORTANT: Output ONLY the summary paragraph. No labels. No headings. Start writing immediately.`

  const text = await callGemini('generate_summary', prompt, 800)
  return { text: text.trim() }
}

async function handleImproveBullet(payload: { bullet: string; projectTitle: string; tags?: string[]; orphanedSkills?: string[] }) {
  const bullet = asString(payload.bullet, 'bullet')
  const projectTitle = asString(payload.projectTitle, 'projectTitle')
  const tags = asStringArray(payload.tags, 'tags')
  const orphanedSkills = asStringArray(payload.orphanedSkills || [], 'orphanedSkills')

  const prompt = `You are an expert resume writer. Rewrite the resume bullet below to be stronger and more impactful.

RULES:
1. Keep the same core facts. Do not invent numbers.
2. Start with a strong past-tense action verb.
3. DO NOT use "[X]" or "[X]%" placeholders. If a metric is missing, emphasize the qualitative impact or technical complexity.
4. Output must be 80-175 characters.
5. NEVER start with "I", "We", "Responsible for", "Leveraged", or "Utilized".
${orphanedSkills.length > 0 ? `6. IMPORTANT: Try to naturally incorporate one or more of these missing skills if relevant: ${orphanedSkills.join(', ')}` : ''}

Project: ${projectTitle}
Technologies: ${tags.join(', ')}
Original bullet: ${bullet}

IMPORTANT: Output ONLY the single improved bullet on one line. No quotes. No explanation.`

  const raw = await callGemini('improve_bullet', prompt, 400)
  const cleaned = raw
    .split('\n')[0]
    .trim()
    .replace(/^[-•*"'\d.)\s]+/, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .trim()

  return { bullet: cleaned.length >= 20 ? cleaned : bullet }
}

async function handleGenerateSubtitle(payload: { project: ResumeAiProject }) {
  const project = asProject(payload.project, 'project')
  const cleanDesc = sanitizeText(project.description).slice(0, 600)

  const prompt = `Write a short subtitle (4-8 words) describing this project's type. It appears after an em dash on a resume: "Project Title - [subtitle]".

Good examples: "Hybrid ML Ranking Pipeline", "NLP Topic Modeling System", "Deep Learning Classification Model", "End-to-End Data Analysis Pipeline"

Project title: ${project.title}
Technologies: ${project.tags.join(', ')}
Description (excerpt): ${cleanDesc}

IMPORTANT: Output ONLY the subtitle words. No quotes. No dash. No punctuation at the end.`

  const raw = await callGemini('generate_subtitle', prompt, 200)
  const subtitle = raw.split('\n')[0].trim().replace(/^["']|["']$/g, '').replace(/[.:!?]$/, '')

  return { subtitle }
}

async function handleTailorResume(payload: {
  jd: string
  currentSummary?: string
  entries?: ResumeAiExperienceEntry[]
  skills?: string[]
  orphanedSkills?: string[]
}) {
  const jd = asString(payload.jd, 'jd').slice(0, 4000)
  const currentSummary = typeof payload.currentSummary === 'string' ? payload.currentSummary.trim() : ''
  const entries = asEntryArray(payload.entries)
  const skills = asStringArray(payload.skills, 'skills')
  const orphanedSkills = asStringArray(payload.orphanedSkills || [], 'orphanedSkills')

  const entriesSnapshot = entries
    .map((entry) => {
      const tags = entry.tags.join(', ')
      const bullets = entry.bullets.filter(Boolean).map((bullet) => `  - ${bullet}`).join('\n')
      return `Entry ${entry.index} - ${entry.title} [${tags}]:\n${bullets}`
    })
    .join('\n\n')

  const prompt = `You are a senior technical resume strategist who has spent 20 years in technical recruiting at companies like Google, Amazon, and top AI startups. You have personally reviewed over 50,000 resumes and know exactly how ATS systems parse, score, and rank candidates. You also know what makes a human hiring manager's eyes light up vs. glaze over.

Your task: Rewrite this resume's summary and bullet points to maximize this candidate's chances for the specific job description below.

═══ YOUR EXPERT METHODOLOGY ═══

1. KEYWORD MIRRORING (most critical for ATS):
   - Extract EVERY hard skill, technology, framework, methodology, and domain keyword from the JD.
   - Mirror these keywords EXACTLY as written in the JD (e.g., if JD says "machine learning pipelines" — use that exact phrase, not "ML systems").
   - Front-load the most important keywords in the first bullet of each entry.

2. BULLET FORMULA (CAR: Challenge → Action → Result):
   - Start with a strong PAST-TENSE action verb. Never "Utilized", "Leveraged", "Responsible for", "Helped with".
   - GOOD verbs: Engineered, Architected, Optimized, Developed, Built, Deployed, Designed, Implemented, Automated, Analyzed, Reduced, Accelerated, Processed, Trained, Evaluated, Integrated.
   - After the verb: [WHAT you built/did] + [HOW using specific tools/tech] + [WHY it mattered / scale / outcome].
   - Include technical specificity: model names (XGBoost, BERT, ResNet), dataset sizes, performance metrics if available.
   - If no hard number exists, describe TECHNICAL COMPLEXITY: "across 6 heterogeneous feature sets" or "handling class imbalance with SMOTE and stratified k-fold."
   - NEVER use "[X]" or "[X]%" placeholders. Every word must be final and real.

3. DYNAMIC BULLET ALLOCATION (this is what separates good from great):
   - Score each entry 1-10 for relevance to this specific JD.
   - 8-10 relevance: 4-6 detailed, keyword-rich bullets. This is your star content.
   - 5-7 relevance: 2-3 bullets, emphasizing transferable skills from the JD.
   - 1-4 relevance: 1-2 compact bullets. Don't waste resume space on irrelevant work.

4. SUMMARY REWRITE:
   - Open with the EXACT job title from the JD (or close synonym) + specialization.
   - Weave in 4-6 specific technologies from the JD naturally.
   - End with a value statement that matches the employer's needs.
   - 3-4 sentences, 60-90 words. No fluff.

5. ATS SURVIVAL RULES:
   - No tables, columns, or special characters.
   - Spell out acronyms on first use if the JD does: "Natural Language Processing (NLP)".
   - Match the JD's spelling: "TensorFlow" not "Tensorflow", "scikit-learn" not "sklearn".
${orphanedSkills.length > 0 ? `
6. ORPHANED SKILLS INJECTION:
   The candidate has these verified skills that aren't yet mentioned in any bullet. Naturally weave relevant ones into bullets where they honestly apply:
   ${orphanedSkills.join(', ')}` : ''}

═══ INPUTS ═══

JOB DESCRIPTION:
${jd}

CURRENT SUMMARY:
${currentSummary || '(none yet)'}

CURRENT EXPERIENCE ENTRIES:
${entriesSnapshot}

ALL CANDIDATE SKILLS: ${skills.join(', ')}

═══ OUTPUT FORMAT ═══

Return JSON exactly like this:
{
  "summary": "the rewritten summary paragraph",
  "entries": [
    { "index": 0, "bullets": ["bullet1", "bullet2", "bullet3", "bullet4"] }
  ]
}

Remember: every bullet must read like it was written by someone who deeply understands both the candidate's work AND the hiring manager's needs. Not generic AI output — expert career strategy.`

  const raw = await callGemini('tailor_resume', prompt, 4000)
  const jsonText = extractJsonObject(raw)
  const parsed = JSON.parse(jsonText) as {
    summary?: string
    entries?: { index?: number; bullets?: string[] }[]
  }

  const bullets: Record<number, string[]> = {}

  for (const entry of parsed.entries ?? []) {
    if (typeof entry.index !== 'number' || !Array.isArray(entry.bullets)) continue
    bullets[entry.index] = entry.bullets.filter((bullet) => typeof bullet === 'string' && bullet.trim().length > 10).slice(0, 7)
  }

  return {
    summary: parsed.summary?.trim() || currentSummary,
    bullets,
  }
}

async function handleGenerateCoverLetter(payload: {
  job?: {
    title?: string
    company?: string
    location?: string
    employmentType?: string
    description?: string
  }
  candidate?: {
    name?: string
    summary?: string
    skills?: string[]
    experience?: {
      index?: number
      title?: string
      bullets?: string[]
    }[]
  }
}) {
  const job = payload.job ?? {}
  const candidate = payload.candidate ?? {}

  const jobTitle = typeof job.title === 'string' ? job.title.trim() : ''
  const company = typeof job.company === 'string' ? job.company.trim() : ''
  const location = typeof job.location === 'string' ? job.location.trim() : ''
  const employmentType = typeof job.employmentType === 'string' ? job.employmentType.trim() : ''
  const description = typeof job.description === 'string' ? job.description.trim().slice(0, 3000) : ''

  if (!jobTitle && !company && !description) {
    throw new Error('Cover letter generation requires job details.')
  }

  const candidateName = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : ''
  const skills = asStringArray(candidate.skills, 'candidate.skills').slice(0, 20).join(', ')
  const experience = Array.isArray(candidate.experience)
    ? candidate.experience
        .filter((entry): entry is { title?: string; bullets?: string[] } => Boolean(entry) && typeof entry === 'object')
        .slice(0, 3)
        .map((entry, index) => {
          const title = typeof entry.title === 'string' ? entry.title.trim() : `Experience ${index + 1}`
          const bullets = asStringArray(entry.bullets, `candidate.experience[${index}].bullets`)
            .slice(0, 3)
            .map((bullet) => `- ${bullet}`)
            .join('\n')
          return `${title}\n${bullets}`
        })
        .join('\n\n')
    : ''

  const prompt = `You are a senior career strategist who has coached hundreds of candidates into roles at top tech companies. You write cover letters that hiring managers actually read — because they're specific, concise, and make the case that this candidate solves a real problem.

Write a cover letter following this PROVEN STRUCTURE:

PARAGRAPH 1 — THE HOOK (3-4 sentences):
- Open with "Dear Hiring Team," (never "To Whom It May Concern")
- State the EXACT role title and company name.
- Immediately connect: what specific thing about this company/role excites the candidate? Reference something concrete from the JD (a technology they use, a problem they're solving, a team they're building).
- End with a positioning statement: "As a [specific title] with [specific experience], I bring [specific value]."

PARAGRAPH 2 — THE PROOF (4-5 sentences):
- Pick 2-3 specific projects/experiences from the candidate's resume that DIRECTLY map to the JD's requirements.
- Use the SAME keywords the JD uses.
- Include at least one technical detail that shows depth ("built a classification pipeline using XGBoost with stratified cross-validation" not "worked on ML projects").
- Show you understand the employer's problem and how the candidate's experience solves it.

PARAGRAPH 3 — THE CLOSE (2-3 sentences):
- Reiterate enthusiasm for the specific role (not generic "any position").
- Mention eagerness to discuss how the candidate's skills align.
- End with "Sincerely," and the candidate's name.

CRITICAL RULES:
- 220-320 words total. Hiring managers stop reading after 1 page.
- NEVER invent experience, metrics, or employers.
- NEVER say "I am writing to apply" or "I am excited to apply" — those are the two most generic openings in existence.
- NEVER mention being an AI or that this is a draft.
- No postal addresses or contact blocks.
- Be specific enough that this letter could ONLY be about this candidate and this job.

JOB:
Title: ${jobTitle || 'Not specified'}
Company: ${company || 'Not specified'}
Location: ${location || 'Not specified'}
Employment type: ${employmentType || 'Not specified'}
Description:
${description || 'Not provided'}

CANDIDATE:
Name: ${candidateName || 'Candidate'}
Summary:
${summary || 'Not provided'}

Skills:
${skills || 'Not provided'}

Relevant experience:
${experience || 'Not provided'}

IMPORTANT: Output ONLY the cover letter text. No markdown. No extra commentary.`

  const text = await callGemini('generate_cover_letter', prompt, 1200)
  return { text: text.trim() }
}

async function handleAnalyzeJdMatch(payload: { jd: string; resumeText: string }) {
  const jd = asString(payload.jd, 'jd').slice(0, 4000)
  const resumeText = asString(payload.resumeText, 'resumeText').slice(0, 4000)

  const prompt = `You are an expert Applicant Tracking System (ATS) parser and technical recruiter.

Analyze the provided Job Description against the provided Candidate Resume.
1. Extract the core requirements (hard skills, soft skills, technologies, methodologies) from the JD.
2. Cross-reference them against the resume text.
3. Calculate a realistic Match Score from 0 to 100 based on keyword overlap and experience alignment. Be rigorous. 85+ is excellent, 70-84 is good, below 70 needs work.
4. Identify 3-5 critical missing keywords that the candidate MUST add to pass the ATS.
5. Identify any minor red flags (e.g., missing years of experience, missing a core degree if strictly required).

JOB DESCRIPTION:
${jd}

CANDIDATE RESUME:
${resumeText}

Output as JSON exactly in this format:
{
  "score": 82,
  "foundKeywords": ["Python", "SQL", "Machine Learning"],
  "missingKeywords": ["AWS", "Docker", "CI/CD pipeline"],
  "redFlags": ["Job requires 5 years experience, resume shows only 3."]
}`

  const raw = await callGemini('analyze_jd_match', prompt, 1000)
  const jsonText = extractJsonObject(raw)
  const parsed = JSON.parse(jsonText) as {
    score?: number
    foundKeywords?: string[]
    missingKeywords?: string[]
    redFlags?: string[]
  }

  return {
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    foundKeywords: asStringArray(parsed.foundKeywords, 'foundKeywords'),
    missingKeywords: asStringArray(parsed.missingKeywords, 'missingKeywords'),
    redFlags: asStringArray(parsed.redFlags, 'redFlags'),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const authResult = await requireAdminUser(req)

  if (!authResult.user) {
    if (authResult.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }

    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const body = (await req.json()) as ResumeAiRequest

    if (!body?.task || !body?.payload) {
      return json(400, { error: 'Invalid request body.' })
    }

    let data: Record<string, unknown>

    switch (body.task) {
      case 'generate_bullets':
        data = await handleGenerateBullets(body.payload)
        break
      case 'generate_summary':
        data = await handleGenerateSummary(body.payload)
        break
      case 'improve_bullet':
        data = await handleImproveBullet(body.payload)
        break
      case 'generate_subtitle':
        data = await handleGenerateSubtitle(body.payload)
        break
      case 'tailor_resume':
        data = await handleTailorResume(body.payload)
        break
      case 'analyze_jd_match':
        data = await handleAnalyzeJdMatch(body.payload)
        break
      case 'generate_cover_letter':
        data = await handleGenerateCoverLetter(body.payload)
        break
      default:
        return json(400, { error: 'Unsupported resume AI task.' })
    }

    return json(200, { data })
  } catch (error) {
    console.error('resume-ai error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
