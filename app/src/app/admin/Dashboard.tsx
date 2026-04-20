import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, BriefcaseBusiness, FolderKanban, Send, Settings, Tags } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getAllProjects,
  getApplications,
  getCompanyWatchlists,
  getJobPostings,
  getJobMatches,
  getNotificationItems,
  getSkills,
} from '@/lib/supabase'
import { getAdminPath } from '@/lib/adminConfig'
import { ApplicationRecord, CompanyWatchlist, JobMatch, JobPosting, NotificationItem, Project, Skill } from '@/types'

export function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([])
  const [watchlists, setWatchlists] = useState<CompanyWatchlist[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => {
    Promise.all([
      getAllProjects(),
      getSkills(),
      getJobPostings(),
      getApplications(),
      getJobMatches(),
      getCompanyWatchlists(),
      getNotificationItems(),
    ]).then(([projectsData, skillsData, jobsData, applicationsData, jobMatchData, watchlistData, notificationData]) => {
      setProjects(projectsData)
      setSkills(skillsData)
      setJobs(jobsData ?? [])
      setApplications(applicationsData ?? [])
      setJobMatches(jobMatchData ?? [])
      setWatchlists(watchlistData ?? [])
      setNotifications(notificationData ?? [])
    })
  }, [])

  const publishedProjects = projects.filter((project) => project.is_published)
  const draftProjects = projects.filter((project) => !project.is_published)

  const stats = [
    {
      title: 'Projects',
      value: projects.length,
      icon: FolderKanban,
      href: getAdminPath('projects'),
      description: `${publishedProjects.length} published, ${draftProjects.length} drafts`,
    },
    {
      title: 'Skills',
      value: skills.length,
      icon: Tags,
      href: getAdminPath('skills'),
      description: 'Available for tagging and matching',
    },
    {
      title: 'Jobs',
      value: jobs.length,
      icon: BriefcaseBusiness,
      href: getAdminPath('jobs'),
      description: 'Manual capture + fit scoring',
    },
    {
      title: 'Applications',
      value: applications.length,
      icon: Send,
      href: getAdminPath('applications'),
      description: 'Pipeline you are actively tracking',
    },
    {
      title: 'Inbox',
      value: notifications.filter((item) => !item.is_read).length,
      icon: BellRing,
      href: getAdminPath('inbox'),
      description: 'Unread follow-ups, failures, and match alerts',
    },
    {
      title: 'Settings',
      value: '8',
      icon: Settings,
      href: getAdminPath('settings'),
      description: 'Profile, links, resume, and site details',
    },
  ]

  const overdueFollowUps = applications.filter((application) => {
    if (!application.follow_up_at) return false
    return new Date(application.follow_up_at).getTime() <= Date.now()
  })

  const strongMatches = jobMatches.filter((match) => match.band === 'strong')
  const staleApplications = applications.filter((application) => {
    if (application.status !== 'ready_to_apply' && application.status !== 'applied') return false
    return Date.now() - new Date(application.updated_at).getTime() >= 5 * 24 * 60 * 60 * 1000
  })
  const unsyncedWatchlists = watchlists.filter((watchlist) => !watchlist.last_sync_at)
  const activeApplications = applications.filter((application) => application.status !== 'archived' && application.status !== 'rejected')
  const responseRate = activeApplications.length === 0
    ? 0
    : Math.round((applications.filter((application) => application.status === 'interview' || application.status === 'offer').length / activeApplications.length) * 100)
  const nextActions = [
    overdueFollowUps[0] ? 'Clear overdue follow-ups from the Applications lane.' : null,
    strongMatches.length > 0 ? 'Review strong matches and push the best ones into tailoring.' : null,
    unsyncedWatchlists.length > 0 ? 'Run discovery and first sync on new watchlists.' : null,
    staleApplications.length > 0 ? 'Move stale applications forward or archive them.' : null,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Portfolio state, job pipeline, and resume workbench at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} to={stat.href}>
              <Card className="glass h-full cursor-pointer transition-colors hover:bg-white/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.slice(0, 5).map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between border-b border-white/5 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {project.is_published ? 'Published' : 'Draft'}
                  </p>
                </div>
                <Link
                  to={getAdminPath(`projects/${project.id}/edit`)}
                  className="text-sm text-primary hover:underline"
                >
                  Edit
                </Link>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">
                No projects yet. Create your first project.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Strong Matches" value={strongMatches.length} />
              <MetricCard label="Overdue Follow-Ups" value={overdueFollowUps.length} />
              <MetricCard label="Unsynced Watchlists" value={unsyncedWatchlists.length} />
              <MetricCard label="Response Rate" value={`${responseRate}%`} />
            </div>

            <div className="space-y-2 rounded-lg bg-white/5 p-4">
              <p className="font-medium">Recommended next actions</p>
              {(nextActions.length > 0 ? nextActions : ['No urgent actions right now. Use this time to improve packet quality.']).map((action) => (
                <p key={action} className="text-sm text-muted-foreground">
                  {action}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Link
                to={getAdminPath('watchlists')}
                className="block rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <p className="font-medium">Manage Watchlists</p>
                <p className="text-sm text-muted-foreground">
                  Track target companies and keep daily syncs healthy.
                </p>
              </Link>
              <Link
                to={getAdminPath('answers')}
                className="block rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <p className="font-medium">Update Answer Bank</p>
                <p className="text-sm text-muted-foreground">
                  Keep logistics, salary, and intro answers ready for fast applications.
                </p>
              </Link>
              <Link
                to={getAdminPath('resume')}
                className="block rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <p className="font-medium">Refine Resume</p>
                <p className="text-sm text-muted-foreground">
                  Tune the master packet before the next scoring run.
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
