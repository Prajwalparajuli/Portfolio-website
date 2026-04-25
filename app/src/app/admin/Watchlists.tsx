import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ExternalLink, RefreshCw, Save, Sparkles, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import { discoverWatchlist, runScheduledWatchlists } from '@/lib/careerCockpit'
import {
  createCompanyWatchlist,
  deleteCompanyWatchlist,
  getCompanyWatchlists,
  updateCompanyWatchlist,
} from '@/lib/supabase'
import { CompanyWatchlist, CompanyWatchlistInput } from '@/types'

type DossierDraft = Pick<
  CompanyWatchlistInput,
  'why_this_company' | 'research_notes' | 'recent_news' | 'competitors' | 'salary_notes'
>

const EMPTY_DOSSIER: DossierDraft = {
  why_this_company: '',
  research_notes: '',
  recent_news: '',
  competitors: '',
  salary_notes: '',
}

const EMPTY_WATCHLIST: CompanyWatchlistInput = {
  company_name: '',
  careers_url: '',
  source_hint: 'auto',
  board_or_site: '',
  preferred_query: '',
  location_hint: '',
  priority: 'medium',
  is_enabled: true,
  ...EMPTY_DOSSIER,
}

export function AdminWatchlists() {
  const [watchlists, setWatchlists] = useState<Awaited<ReturnType<typeof getCompanyWatchlists>>>([])
  const [form, setForm] = useState(EMPTY_WATCHLIST)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [discoveringId, setDiscoveringId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [savingDossierId, setSavingDossierId] = useState<string | null>(null)
  const [snapshotNotes, setSnapshotNotes] = useState<Record<string, string>>({})
  const [dossierDrafts, setDossierDrafts] = useState<Record<string, DossierDraft>>({})
  const [freshWatchlistId, setFreshWatchlistId] = useState<string | null>(null)

  useEffect(() => {
    getCompanyWatchlists().then(setWatchlists)
  }, [])

  const freshWatchlist = useMemo(
    () => (watchlists ?? []).find((entry) => entry.id === freshWatchlistId) ?? null,
    [freshWatchlistId, watchlists]
  )

  const refreshWatchlists = async () => {
    setWatchlists(await getCompanyWatchlists())
  }

  const replaceWatchlist = (updated: CompanyWatchlist) => {
    setWatchlists((current) =>
      (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const created = await createCompanyWatchlist({
        ...form,
        company_name: form.company_name.trim(),
        careers_url: form.careers_url.trim(),
        board_or_site: form.board_or_site.trim(),
        preferred_query: form.preferred_query.trim(),
        location_hint: form.location_hint.trim(),
      })
      if (!created) return
      setWatchlists((current) => [created, ...(current ?? [])])
      setFreshWatchlistId(created.id)
      setForm(EMPTY_WATCHLIST)
      setAdvancedOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscover = async (watchlistId: string) => {
    setDiscoveringId(watchlistId)
    try {
      const result = await discoverWatchlist({ watchlistId })
      setSnapshotNotes((current) => ({ ...current, [watchlistId]: result.notes }))
      await refreshWatchlists()
      if (freshWatchlistId === watchlistId) setFreshWatchlistId(null)
    } finally {
      setDiscoveringId(null)
    }
  }

  const handleSync = async (watchlistId: string) => {
    setRunningId(watchlistId)
    try {
      await runScheduledWatchlists(watchlistId)
      await refreshWatchlists()
    } finally {
      setRunningId(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      await runScheduledWatchlists()
      await refreshWatchlists()
    } finally {
      setSyncingAll(false)
    }
  }

  const handleDelete = async (watchlistId: string) => {
    await deleteCompanyWatchlist(watchlistId)
    if (freshWatchlistId === watchlistId) setFreshWatchlistId(null)
    setDossierDrafts((current) => {
      const next = { ...current }
      delete next[watchlistId]
      return next
    })
    await refreshWatchlists()
  }

  const handleToggleEnabled = async (watchlist: CompanyWatchlist, checked: boolean) => {
    const updated = await updateCompanyWatchlist(watchlist.id, { is_enabled: checked })
    if (updated) replaceWatchlist(updated)
  }

  const handleSaveDossier = async (watchlist: CompanyWatchlist, draft: DossierDraft) => {
    setSavingDossierId(watchlist.id)
    try {
      const updated = await updateCompanyWatchlist(watchlist.id, {
        ...draft,
        last_researched_at: new Date().toISOString(),
      })
      if (!updated) return
      replaceWatchlist(updated)
      setDossierDrafts((current) => ({
        ...current,
        [watchlist.id]: getDossierDraft(updated),
      }))
    } finally {
      setSavingDossierId(null)
    }
  }

  if (watchlists === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Watchlists</h1>
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">007_career_cockpit_phase2.sql</code> first, then
            {' '}
            <code className="rounded bg-black/30 px-1 py-0.5">009_relationship_crm_phase5.sql</code>
            {' '}to unlock company dossiers.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Watchlists</h1>
          <p className="mt-1 text-muted-foreground">
            Each watchlist is now a company dossier: discover roles, keep research visible, and jump straight into the people around that company.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={getAdminPath('jobs')}>
            <Button variant="outline" className="gap-2">
              <Compass className="h-4 w-4" />
              Back to Discover
            </Button>
          </Link>
          <Link to={getAdminPath('contacts')}>
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </Button>
          </Link>
          <Button onClick={handleSyncAll} disabled={syncingAll} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {syncingAll ? 'Syncing...' : 'Run due watchlists now'}
          </Button>
        </div>
      </div>

      {freshWatchlist && (
        <Card className="glass border border-emerald-400/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{freshWatchlist.company_name} saved.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Discover now to auto-fill source details and start the first company snapshot.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-2"
                disabled={discoveringId === freshWatchlist.id}
                onClick={() => void handleDiscover(freshWatchlist.id)}
              >
                <Sparkles className="h-4 w-4" />
                {discoveringId === freshWatchlist.id ? 'Discovering...' : 'Discover now'}
              </Button>
              <Button variant="outline" onClick={() => setFreshWatchlistId(null)}>
                Keep editing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="glass">
          <CardContent className="p-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Quick add</p>
                <p className="text-xs text-muted-foreground">
                  Save the company and role focus first. ATS controls stay behind Advanced until discovery fills them in.
                </p>
              </div>

              <Input
                placeholder="Company name"
                value={form.company_name}
                onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
              />
              <Input
                placeholder="Careers URL"
                value={form.careers_url}
                onChange={(event) => setForm((current) => ({ ...current, careers_url: event.target.value }))}
              />
              <Input
                placeholder="Role focus"
                value={form.preferred_query}
                onChange={(event) => setForm((current) => ({ ...current, preferred_query: event.target.value }))}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Location hint"
                  value={form.location_hint}
                  onChange={(event) => setForm((current) => ({ ...current, location_hint: event.target.value }))}
                />

                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as CompanyWatchlistInput['priority'],
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                >
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </div>

              <details
                open={advancedOpen}
                onToggle={(event) => setAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)}
                className="rounded-xl border border-white/10 bg-black/20"
              >
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground">
                  Advanced
                </summary>
                <div className="space-y-3 border-t border-white/10 px-3 py-3">
                  <div className="space-y-2">
                    <Label>Source hint</Label>
                    <select
                      value={form.source_hint}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          source_hint: event.target.value as CompanyWatchlistInput['source_hint'],
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    >
                      <option value="auto">Auto detect</option>
                      <option value="greenhouse">Greenhouse</option>
                      <option value="lever">Lever</option>
                      <option value="workday">Workday</option>
                      <option value="ashby">Ashby</option>
                      <option value="smartrecruiters">SmartRecruiters</option>
                      <option value="icims">iCIMS</option>
                      <option value="workable">Workable</option>
                      <option value="jobvite">Jobvite</option>
                      <option value="generic">Generic snapshot</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Board or site token</Label>
                    <Input
                      placeholder="Only if you already know it"
                      value={form.board_or_site}
                      onChange={(event) => setForm((current) => ({ ...current, board_or_site: event.target.value }))}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <span className="text-sm text-foreground">Enabled</span>
                    <Switch
                      checked={form.is_enabled}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, is_enabled: checked }))}
                    />
                  </div>
                </div>
              </details>

              <Button type="submit" className="w-full gap-2" disabled={saving}>
                <Sparkles className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save watchlist'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(watchlists ?? []).map((watchlist) => {
            const dossierDraft = dossierDrafts[watchlist.id] ?? getDossierDraft(watchlist)

            return (
              <Card key={watchlist.id} className="glass">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{watchlist.company_name}</h3>
                        <Badge variant="outline">{watchlist.priority}</Badge>
                        <Badge variant="outline">{buildSourceDetectedLabel(watchlist)}</Badge>
                        {!watchlist.is_enabled && <Badge variant="outline">disabled</Badge>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {watchlist.careers_url && (
                          <a
                            href={watchlist.careers_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            Careers URL
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {watchlist.preferred_query && <span>Role focus: {watchlist.preferred_query}</span>}
                        {watchlist.location_hint && <span>Location: {watchlist.location_hint}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`${getAdminPath('contacts')}?company=${encodeURIComponent(watchlist.id)}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Users className="h-4 w-4" />
                          Contacts
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => void handleDiscover(watchlist.id)}
                        disabled={discoveringId === watchlist.id}
                      >
                        <Compass className="h-4 w-4" />
                        {discoveringId === watchlist.id ? 'Discovering...' : 'Discover'}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => void handleSync(watchlist.id)}
                        disabled={runningId === watchlist.id}
                      >
                        <RefreshCw className="h-4 w-4" />
                        {runningId === watchlist.id ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => void handleDelete(watchlist.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-5">
                    <StatusCell label="Source detected" value={buildSourceDetectedLabel(watchlist)} />
                    <StatusCell label="Last sync" value={watchlist.last_sync_at ? formatWatchlistTime(watchlist.last_sync_at) : 'Never'} />
                    <StatusCell label="Last discovery" value={watchlist.last_discovery_at ? formatWatchlistTime(watchlist.last_discovery_at) : 'Never'} />
                    <StatusCell label="Last researched" value={watchlist.last_researched_at ? formatWatchlistTime(watchlist.last_researched_at) : 'Not logged'} />
                    <StatusCell label="Last error" value={watchlist.last_error ? truncateText(watchlist.last_error, 80) : 'None'} />
                  </div>

                  {(snapshotNotes[watchlist.id] || watchlist.last_error) && (
                    <Textarea
                      value={snapshotNotes[watchlist.id] || watchlist.last_error}
                      readOnly
                      className="min-h-[88px] bg-black/40 text-xs"
                    />
                  )}

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">Company dossier</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Keep the why, research, salary notes, and recent developments attached to the same company record you sync from.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          disabled={savingDossierId === watchlist.id}
                          onClick={() => void handleSaveDossier(watchlist, dossierDraft)}
                        >
                          <Save className="h-4 w-4" />
                          {savingDossierId === watchlist.id ? 'Saving...' : 'Save dossier'}
                        </Button>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <DossierField
                          label="Why this company"
                          value={dossierDraft.why_this_company}
                          onChange={(value) =>
                            setDossierDrafts((current) => ({
                              ...current,
                              [watchlist.id]: {
                                ...dossierDraft,
                                why_this_company: value,
                              },
                            }))
                          }
                          placeholder="Why this company matters for your role target and career story."
                        />
                        <DossierField
                          label="Recent news"
                          value={dossierDraft.recent_news}
                          onChange={(value) =>
                            setDossierDrafts((current) => ({
                              ...current,
                              [watchlist.id]: {
                                ...dossierDraft,
                                recent_news: value,
                              },
                            }))
                          }
                          placeholder="Recent launches, funding, product news, or hiring signals."
                        />
                        <DossierField
                          label="Research notes"
                          value={dossierDraft.research_notes}
                          onChange={(value) =>
                            setDossierDrafts((current) => ({
                              ...current,
                              [watchlist.id]: {
                                ...dossierDraft,
                                research_notes: value,
                              },
                            }))
                          }
                          placeholder="Role patterns, team clues, product context, or open questions."
                        />
                        <DossierField
                          label="Competitors"
                          value={dossierDraft.competitors}
                          onChange={(value) =>
                            setDossierDrafts((current) => ({
                              ...current,
                              [watchlist.id]: {
                                ...dossierDraft,
                                competitors: value,
                              },
                            }))
                          }
                          placeholder="Peer companies or adjacent alternatives worth monitoring."
                        />
                        <div className="lg:col-span-2">
                          <DossierField
                            label="Salary notes"
                            value={dossierDraft.salary_notes}
                            onChange={(value) =>
                              setDossierDrafts((current) => ({
                                ...current,
                                [watchlist.id]: {
                                  ...dossierDraft,
                                  salary_notes: value,
                                },
                              }))
                            }
                            placeholder="Comp bands, negotiation notes, or location-specific salary context."
                          />
                        </div>
                      </div>
                    </div>

                    <details className="rounded-xl border border-white/10 bg-black/20">
                      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground">
                        Technical details
                      </summary>
                      <div className="grid gap-2 border-t border-white/10 px-3 py-3 text-xs text-muted-foreground">
                        <p>Source hint: {humanizeSourceHint(watchlist.source_hint)}</p>
                        <p>Board/site: {watchlist.board_or_site || 'Not set yet'}</p>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <span>Status</span>
                          <Switch
                            checked={watchlist.is_enabled}
                            onCheckedChange={(checked) => void handleToggleEnabled(watchlist, checked)}
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {(watchlists ?? []).length === 0 && (
            <Card className="glass">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No watchlists yet. Add a target company on the left, then discover it.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function DossierField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] border-white/10 bg-black/40"
      />
    </div>
  )
}

function getDossierDraft(watchlist: CompanyWatchlist): DossierDraft {
  return {
    why_this_company: watchlist.why_this_company ?? '',
    research_notes: watchlist.research_notes ?? '',
    recent_news: watchlist.recent_news ?? '',
    competitors: watchlist.competitors ?? '',
    salary_notes: watchlist.salary_notes ?? '',
  }
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function humanizeSourceHint(sourceHint: CompanyWatchlist['source_hint']): string {
  if (sourceHint === 'greenhouse') return 'Greenhouse'
  if (sourceHint === 'lever') return 'Lever'
  if (sourceHint === 'workday') return 'Workday'
  if (sourceHint === 'ashby') return 'Ashby'
  if (sourceHint === 'smartrecruiters') return 'SmartRecruiters'
  if (sourceHint === 'icims') return 'iCIMS'
  if (sourceHint === 'workable') return 'Workable'
  if (sourceHint === 'jobvite') return 'Jobvite'
  if (sourceHint === 'generic') return 'Generic snapshot'
  return 'Auto detect'
}

function buildSourceDetectedLabel(watchlist: CompanyWatchlist): string {
  if (watchlist.source_hint !== 'auto') return humanizeSourceHint(watchlist.source_hint)
  if (watchlist.last_discovery_at) return 'Auto-detected'
  return 'Waiting for discovery'
}

function formatWatchlistTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}...`
}
