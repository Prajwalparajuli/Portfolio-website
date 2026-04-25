import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  seedDefaultCandidateAnswers,
  sortCandidateAnswers,
} from '@/lib/candidateAnswerBank'
import { deleteCandidateAnswer, getCandidateAnswers, upsertCandidateAnswer } from '@/lib/supabase'
import { CandidateAnswer } from '@/types'

const DEFAULT_ANSWER = {
  label: '',
  category: 'general',
  answer: '',
}

export function AdminAnswerBank() {
  const [answers, setAnswers] = useState<CandidateAnswer[] | null>([])
  const [form, setForm] = useState(DEFAULT_ANSWER)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    getCandidateAnswers().then(setAnswers)
  }, [])

  const grouped = useMemo(() => {
    const source = answers ?? []
    return source.reduce<Record<string, CandidateAnswer[]>>((acc, answer) => {
      const key = answer.category || 'general'
      acc[key] = [...(acc[key] ?? []), answer]
      return acc
    }, {})
  }, [answers])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.label.trim() || !form.answer.trim()) return

    setSaving(true)
    try {
      const saved = await upsertCandidateAnswer({
        prompt_key: slugify(form.label),
        label: form.label.trim(),
        category: form.category.trim() || 'general',
        answer: form.answer.trim(),
      })
      if (!saved) return
      setAnswers((current) => {
        const next = (current ?? []).filter((item) => item.id !== saved.id && item.prompt_key !== saved.prompt_key)
        return sortCandidateAnswers([...next, saved])
      })
      setForm(DEFAULT_ANSWER)
    } finally {
      setSaving(false)
    }
  }

  const handleSeedStarterAnswers = async () => {
    setSeeding(true)
    try {
      const seeded = await seedDefaultCandidateAnswers()
      setAnswers(seeded)
    } finally {
      setSeeding(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteCandidateAnswer(id)
    setAnswers((current) => (current ?? []).filter((item) => item.id !== id))
  }

  if (answers === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Answer Bank</h1>
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">007_career_cockpit_phase2.sql</code> to enable reusable application answers.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Answer Bank</h1>
        <p className="mt-1 text-muted-foreground">
          Save reusable answers for sponsorship, work authorization, relocation, intros, compensation, and links.
        </p>
      </div>

      {(answers ?? []).length === 0 && (
        <Card className="glass border border-emerald-400/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Starter answer pack</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seed the bank with editable student-job-search defaults, then tighten each answer once instead of rewriting it for every application.
              </p>
            </div>
            <Button
              type="button"
              className="gap-2"
              disabled={seeding}
              onClick={() => void handleSeedStarterAnswers()}
            >
              {seeding ? 'Seeding...' : 'Seed starter answers'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="glass">
          <CardContent className="p-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                placeholder="Label, e.g. Work authorization"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              />
              <Input
                placeholder="Category, e.g. logistics"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              />
              <Textarea
                placeholder="Write the reusable answer..."
                className="min-h-[180px]"
                value={form.answer}
                onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
              />
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save answer'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {Object.keys(grouped).length === 0 && (
            <Card className="glass">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No reusable answers yet. Seed the starter pack or add your own first answer on the left.
              </CardContent>
            </Card>
          )}
          {Object.entries(grouped).map(([category, categoryAnswers]) => (
            <Card key={category} className="glass">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">{category}</h2>
                  <Badge variant="outline">{categoryAnswers.length}</Badge>
                </div>
                {categoryAnswers.map((answer) => (
                  <div key={answer.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{answer.label}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{answer.answer}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(answer.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
