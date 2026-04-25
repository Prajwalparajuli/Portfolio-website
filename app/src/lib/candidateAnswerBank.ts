import { upsertCandidateAnswer } from '@/lib/supabase'
import { CandidateAnswer } from '@/types'

type CandidateAnswerSeed = Pick<CandidateAnswer, 'prompt_key' | 'label' | 'category' | 'answer'>

export const DEFAULT_CANDIDATE_ANSWER_SEEDS: CandidateAnswerSeed[] = [
  {
    prompt_key: 'professional-intro',
    label: 'Professional intro',
    category: 'introduction',
    answer:
      'Early-career candidate focused on data, analytics, and machine learning roles, with hands-on project experience building end-to-end technical workflows and communicating results clearly.',
  },
  {
    prompt_key: 'work-authorization',
    label: 'Work authorization',
    category: 'logistics',
    answer:
      'Editable template: Authorized to work in [country]. Update this answer to reflect current work authorization details accurately.',
  },
  {
    prompt_key: 'sponsorship',
    label: 'Sponsorship',
    category: 'logistics',
    answer:
      'Editable template: [Do / do not] require sponsorship now or in the future. Replace this line with the exact answer you want recruiters to receive.',
  },
  {
    prompt_key: 'start-availability',
    label: 'Start availability',
    category: 'logistics',
    answer:
      'Available to start in [month / year] or sooner with coordination. Update this answer if your graduation timeline or availability changes.',
  },
  {
    prompt_key: 'location-relocation',
    label: 'Location / relocation',
    category: 'logistics',
    answer:
      'Open to roles in [target cities / regions], remote opportunities, and relocation for the right fit. Tailor this answer to your real flexibility.',
  },
  {
    prompt_key: 'compensation',
    label: 'Compensation',
    category: 'compensation',
    answer:
      'Focused first on role scope, team, and growth. Comfortable discussing compensation once level and responsibilities are clear.',
  },
  {
    prompt_key: 'portfolio-links',
    label: 'Portfolio / GitHub / LinkedIn',
    category: 'links',
    answer:
      'Portfolio: [portfolio url] | GitHub: [github url] | LinkedIn: [linkedin url]',
  },
  {
    prompt_key: 'why-this-role',
    label: 'Why this role',
    category: 'role-fit',
    answer:
      'Strong fit because the role combines [domain], [technical skills], and [business impact area] already demonstrated across projects, coursework, and prior work.',
  },
]

const ANSWER_PRIORITY = new Map(
  DEFAULT_CANDIDATE_ANSWER_SEEDS.map((seed, index) => [seed.prompt_key, index] as const)
)

export function sortCandidateAnswers(answers: CandidateAnswer[]): CandidateAnswer[] {
  return [...answers].sort((left, right) => {
    const leftRank = ANSWER_PRIORITY.get(left.prompt_key) ?? Number.MAX_SAFE_INTEGER
    const rightRank = ANSWER_PRIORITY.get(right.prompt_key) ?? Number.MAX_SAFE_INTEGER

    if (leftRank !== rightRank) return leftRank - rightRank
    return left.category.localeCompare(right.category) || left.label.localeCompare(right.label)
  })
}

export function getSuggestedCandidateAnswers(
  answers: CandidateAnswer[],
  limit = 4
): CandidateAnswer[] {
  return sortCandidateAnswers(answers).slice(0, limit)
}

export async function seedDefaultCandidateAnswers(): Promise<CandidateAnswer[]> {
  const saved = await Promise.all(
    DEFAULT_CANDIDATE_ANSWER_SEEDS.map((seed) => upsertCandidateAnswer(seed))
  )

  return sortCandidateAnswers(
    saved.filter((answer): answer is CandidateAnswer => Boolean(answer))
  )
}
