import { FormEvent, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { discoverWatchlist, runScheduledWatchlists } from '@/lib/careerCockpit'
import {
  createCompanyWatchlist,
  deleteCompanyWatchlist,
  getCompanyWatchlists,
  updateCompanyWatchlist,
} from '@/lib/supabase'
import { CompanyWatchlistInput } from '@/types'

const EMPTY_WATCHLIST: CompanyWatchlistInput = {
  company_name: '',
  careers_url: '',
  source_hint: 'auto',
  board_or_site: '',
  preferred_query: '',
  location_hint: '',
  priority: 'medium',
  is_enabled: true,
}

export function AdminWatchlists() {
  const [watchlists, setWatchlists] = useState<Awaited<ReturnType<typeof getCompanyWatchlists>>>([])
  const [form, setForm] = useState(EMPTY_WATCHLIST)
  const [saving, setSaving] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [discoveringId, setDiscoveringId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [snapshotNotes, setSnapshotNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    getCompanyWatchlists().then(setWatchlists)
  }, [])

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
      setForm(EMPTY_WATCHLIST)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscover = async (watchlistId: string) => {
    setDiscoveringId(watchlistId)
    try {
      const result = await discoverWatchlist({ watchlistId })
      setSnapshotNotes((current) => ({ ...current, [watchlistId]: result.notes }))
      setWatchlists(await getCompanyWatchlists())
    } finally {
      setDiscoveringId(null)
    }
  }

  const handleSync = async (watchlistId: string) => {
    setRunningId(watchlistId)
    try {
      await runScheduledWatchlists(watchlistId)
      setWatchlists(await getCompanyWatchlists())
    } finally {
      setRunningId(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      await runScheduledWatchlists()
      setWatchlists(await getCompanyWatchlists())
    } finally {
      setSyncingAll(false)
    }
  }

  if (watchlists === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Watchlists</h1>
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">007_career_cockpit_phase2.sql</code> to enable company watchlists.
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
            Track target companies, auto-discover Greenhouse or Lever boards, and run daily syncs.
          </p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncingAll}>
          {syncingAll ? 'Syncing...' : 'Run due watchlists now'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="glass">
          <CardContent className="p-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Source hint</Label>
                  <select
                    value={form.source_hint}
                    onChange={(event) => setForm((current) => ({ ...current, source_hint: event.target.value as CompanyWatchlistInput['source_hint'] }))}
                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto detect</option>
                    <option value="greenhouse">Greenhouse</option>
                    <option value="lever">Lever</option>
                    <option value="generic">Generic snapshot</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as CompanyWatchlistInput['priority'] }))}
                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <Input
                placeholder="Board/site token if already known"
                value={form.board_or_site}
                onChange={(event) => setForm((current) => ({ ...current, board_or_site: event.target.value }))}
              />
              <Input
                placeholder="Preferred role query"
                value={form.preferred_query}
                onChange={(event) => setForm((current) => ({ ...current, preferred_query: event.target.value }))}
              />
              <Input
                placeholder="Location hint"
                value={form.location_hint}
                onChange={(event) => setForm((current) => ({ ...current, location_hint: event.target.value }))}
              />
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-sm text-foreground">Enabled</span>
                <Switch
                  checked={form.is_enabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, is_enabled: checked }))}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Add watchlist'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(watchlists ?? []).map((watchlist) => (
            <Card key={watchlist.id} className="glass">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{watchlist.company_name}</h3>
                      <Badge variant="outline">{watchlist.priority}</Badge>
                      <Badge variant="outline">{watchlist.source_hint}</Badge>
                      {!watchlist.is_enabled && <Badge variant="outline">disabled</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{watchlist.careers_url}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDiscover(watchlist.id)} disabled={discoveringId === watchlist.id}>
                      {discoveringId === watchlist.id ? 'Discovering...' : 'Discover'}
                    </Button>
                    <Button size="sm" onClick={() => handleSync(watchlist.id)} disabled={runningId === watchlist.id}>
                      {runningId === watchlist.id ? 'Syncing...' : 'Sync'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteCompanyWatchlist(watchlist.id).then(async () => setWatchlists(await getCompanyWatchlists()))}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>Board/site: {watchlist.board_or_site || 'Not set yet'}</p>
                  <p>Preferred query: {watchlist.preferred_query || 'Not set'}</p>
                  <p>Last discovery: {watchlist.last_discovery_at ? new Date(watchlist.last_discovery_at).toLocaleString() : 'Never'}</p>
                  <p>Last sync: {watchlist.last_sync_at ? new Date(watchlist.last_sync_at).toLocaleString() : 'Never'}</p>
                </div>
                {(snapshotNotes[watchlist.id] || watchlist.last_error) && (
                  <Textarea
                    value={snapshotNotes[watchlist.id] || watchlist.last_error}
                    readOnly
                    className="min-h-[88px] bg-black/40 text-xs"
                  />
                )}
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <span className="text-sm text-foreground">Enabled</span>
                  <Switch
                    checked={watchlist.is_enabled}
                    onCheckedChange={(checked) =>
                      updateCompanyWatchlist(watchlist.id, { is_enabled: checked }).then(async () => setWatchlists(await getCompanyWatchlists()))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
