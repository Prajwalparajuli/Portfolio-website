import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getActivityLog, getApplications, getCompanyWatchlists, getJobPostings, getJobSyncRuns, getProofOfWorkHighlights, getSavedJobSearches } from '@/lib/supabase'
import type { ActivityEntry } from '@/lib/supabase'
import { Activity as ActivityIcon, BarChart3, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { AnalyticsFunnelRow, AnalyticsInsight, AnalyticsWindow, buildCareerAnalytics } from '@/lib/careerAnalytics'

const WINDOW_OPTIONS: Array<{ value: AnalyticsWindow; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export function AdminActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof getJobPostings>>>([])
  const [applications, setApplications] = useState<Awaited<ReturnType<typeof getApplications>>>([])
  const [savedSearches, setSavedSearches] = useState<Awaited<ReturnType<typeof getSavedJobSearches>>>([])
  const [syncRuns, setSyncRuns] = useState<Awaited<ReturnType<typeof getJobSyncRuns>>>([])
  const [watchlists, setWatchlists] = useState<Awaited<ReturnType<typeof getCompanyWatchlists>>>([])
  const [highlights, setHighlights] = useState<Awaited<ReturnType<typeof getProofOfWorkHighlights>>>([])
  const [window, setWindow] = useState<AnalyticsWindow>('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    Promise.all([
      getActivityLog(),
      getJobPostings(),
      getApplications(),
      getSavedJobSearches(),
      getJobSyncRuns(50),
      getCompanyWatchlists(),
      getProofOfWorkHighlights(),
    ]).then(([activityData, jobData, applicationData, savedSearchData, syncRunData, watchlistData, highlightData]) => {
      if (!mounted) return
      setEntries(activityData)
      setJobs(jobData ?? [])
      setApplications(applicationData ?? [])
      setSavedSearches(savedSearchData ?? [])
      setSyncRuns(syncRunData ?? [])
      setWatchlists(watchlistData ?? [])
      setHighlights(highlightData ?? [])
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [])

  const analytics = useMemo(
    () =>
      buildCareerAnalytics({
        jobs: jobs ?? [],
        applications: applications ?? [],
        savedSearches: savedSearches ?? [],
        syncRuns: syncRuns ?? [],
        watchlists: watchlists ?? [],
        highlights: highlights ?? [],
        window,
      }),
    [applications, highlights, jobs, savedSearches, syncRuns, watchlists, window]
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Activity</h1>
          <p className="text-muted-foreground mt-1">
            Decision support for what is working, what is stalling, and where to redirect effort next.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Window</label>
          <select
            value={window}
            onChange={(event) => setWindow(event.target.value as AnalyticsWindow)}
            className="mt-2 flex h-10 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Card className="glass">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {analytics.overview.map((card) => (
              <Card key={card.id} className="glass">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {analytics.insights.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {analytics.insights.slice(0, 4).map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {analytics.unattributedImportedJobs > 0 && (
            <Card className="glass border border-amber-400/20">
              <CardContent className="p-4 text-sm text-muted-foreground">
                {analytics.unattributedImportedJobs} older imported jobs do not yet carry saved-search attribution. Source and watchlist analytics are trustworthy now; saved-search conversion rows get sharper on new imports going forward.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsTable
              title="Source Yield"
              description="All-time conversion by job source."
              rows={analytics.sourceRows}
            />
            <AnalyticsTable
              title="Saved Search Yield"
              description="Run output plus attributed pipeline results."
              rows={analytics.savedSearchRows}
              showRuns
            />
            <AnalyticsTable
              title="Watchlist Yield"
              description="How each company dossier is converting from discovery into interviews."
              rows={analytics.watchlistRows}
              showRuns
            />
            <AnalyticsTable
              title="Query Yield"
              description="Role-focus/query performance across saved searches and watchlists."
              rows={analytics.queryRows}
            />
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Packet Completeness vs Interview Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.packetRows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_120px]"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.applications} application{row.applications === 1 ? '' : 's'} in this packet bucket.
                    </p>
                  </div>
                  <MetricCell label="Applied" value={String(row.applied)} />
                  <MetricCell label="Interviews" value={String(row.interviews)} />
                  <MetricCell label="Offers" value={String(row.offers)} />
                  <MetricCell label="Interview rate" value={formatPercent(row.interview_rate)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityIcon className="h-5 w-5" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No activity yet. Actions you take in the admin (create, update, delete) will appear here when using Supabase login.
                </p>
              ) : (
                <ul className="space-y-3">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center gap-2 py-2 border-b border-white/5 last:border-0 text-sm"
                    >
                      <span className="font-medium text-muted-foreground">
                        {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                      <span className="text-white">{entry.action}</span>
                      <span className="text-muted-foreground">{entry.entity_type}</span>
                      {entry.entity_id && (
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          {entry.entity_id}
                        </span>
                      )}
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <span className="text-muted-foreground text-xs">
                          {JSON.stringify(entry.details)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function InsightCard({ insight }: { insight: AnalyticsInsight }) {
  return (
    <Card className="glass">
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium text-foreground">{insight.title}</p>
        <p className="text-sm text-muted-foreground">{insight.body}</p>
      </CardContent>
    </Card>
  )
}

function AnalyticsTable({
  title,
  description,
  rows,
  showRuns = false,
}: {
  title: string
  description: string
  rows: AnalyticsFunnelRow[]
  showRuns?: boolean
}) {
  const visibleRows = rows.slice(0, 8)

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows yet.</p>
        ) : (
          visibleRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.jobs} jobs • {row.tracked} tracked • {row.applied} applied
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{formatPercent(row.interview_rate)}</p>
                  <p className="text-xs text-muted-foreground">Interview rate</p>
                </div>
              </div>
              <div className={`mt-3 grid gap-3 ${showRuns ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                {showRuns && (
                  <MetricCell label="Runs" value={String(row.runs ?? 0)} />
                )}
                <MetricCell label="Responses" value={String(row.responses)} />
                <MetricCell label="Interviews" value={String(row.interviews)} />
                <MetricCell label="Offers" value={String(row.offers)} />
                <MetricCell label="Track rate" value={formatPercent(row.track_rate)} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
