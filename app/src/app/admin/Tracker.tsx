import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus, Trash2, CheckCircle2, Circle, Building2, User, Briefcase, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

const STEPS = ['Applied', 'Screened', 'Interview', 'Technical', 'Final', 'Offer'] as const
type StepName = typeof STEPS[number]

interface TrackedJob {
  id: string
  title: string
  company: string
  contact: string
  notes: string
  steps: Record<StepName, boolean>
  createdAt: string
  archivedAt: string | null
}

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_KEY = 'job-tracker'

function load(): TrackedJob[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function save(jobs: TrackedJob[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(jobs))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminTracker() {
  const [jobs, setJobs] = useState<TrackedJob[]>(load)
  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')

  // Persist
  const persist = useCallback((next: TrackedJob[]) => {
    setJobs(next)
    save(next)
  }, [])

  const handleAdd = useCallback(() => {
    if (!title.trim() || !company.trim()) return
    const job: TrackedJob = {
      id: crypto.randomUUID(),
      title: title.trim(),
      company: company.trim(),
      contact: contact.trim(),
      notes: '',
      steps: Object.fromEntries(STEPS.map(s => [s, false])) as Record<StepName, boolean>,
      createdAt: new Date().toISOString(),
      archivedAt: null,
    }
    persist([job, ...jobs])
    setTitle('')
    setCompany('')
    setContact('')
    setShowForm(false)
  }, [title, company, contact, jobs, persist])

  const toggleStep = useCallback((id: string, step: StepName) => {
    persist(jobs.map(j =>
      j.id === id ? { ...j, steps: { ...j.steps, [step]: !j.steps[step] } } : j
    ))
  }, [jobs, persist])

  const updateNotes = useCallback((id: string, notes: string) => {
    persist(jobs.map(j => j.id === id ? { ...j, notes } : j))
  }, [jobs, persist])

  const archiveJob = useCallback((id: string) => {
    persist(jobs.map(j => j.id === id ? { ...j, archivedAt: new Date().toISOString() } : j))
  }, [jobs, persist])

  const deleteJob = useCallback((id: string) => {
    if (!confirm('Delete this job permanently?')) return
    persist(jobs.filter(j => j.id !== id))
  }, [jobs, persist])

  const activeJobs = jobs.filter(j => !j.archivedAt)
  const archivedJobs = jobs.filter(j => j.archivedAt)

  const getProgress = (j: TrackedJob) => {
    const done = STEPS.filter(s => j.steps[s]).length
    return Math.round((done / STEPS.length) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Job Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track applications and milestones.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          Add Job
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="glass border-white/10">
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Job title</label>
                <Input
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Software Engineer"
                  className="bg-black/30 border-white/10 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Company</label>
                <Input
                  value={company} onChange={e => setCompany(e.target.value)}
                  placeholder="Google"
                  className="bg-black/30 border-white/10 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Contact (optional)</label>
                <Input
                  value={contact} onChange={e => setContact(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="bg-black/30 border-white/10 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!title.trim() || !company.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active jobs */}
      {activeJobs.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-white/15 py-16 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No active applications</p>
          <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3" /> Add your first job
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeJobs.map(job => (
            <Card key={job.id} className="glass border-white/10">
              <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                    <p className="text-xs text-muted-foreground">{job.company}</p>
                    {job.contact && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{job.contact}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      getProgress(job) >= 80 ? 'bg-emerald-500/20 text-emerald-400'
                        : getProgress(job) >= 40 ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/10 text-muted-foreground'
                    )}>
                      {getProgress(job)}%
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => archiveJob(job.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-400" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteJob(job.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-wrap gap-1.5">
                  {STEPS.map(step => {
                    const done = job.steps[step]
                    return (
                      <button
                        key={step}
                        onClick={() => toggleStep(job.id, step)}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                          done
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                            : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground'
                        )}
                      >
                        {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        {step}
                      </button>
                    )
                  })}
                </div>

                {/* Notes */}
                <input
                  value={job.notes}
                  onChange={e => updateNotes(job.id, e.target.value)}
                  placeholder="Quick notes..."
                  className="w-full bg-transparent border-none text-xs text-muted-foreground placeholder:text-muted-foreground/40 outline-none focus:text-foreground"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archived */}
      {archivedJobs.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showArchived ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {archivedJobs.length} archived
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2">
              {archivedJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 opacity-60">
                  <div>
                    <p className="text-xs text-foreground">{job.title} — {job.company}</p>
                    <p className="text-[10px] text-muted-foreground">{getProgress(job)}% · Archived {new Date(job.archivedAt!).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteJob(job.id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
