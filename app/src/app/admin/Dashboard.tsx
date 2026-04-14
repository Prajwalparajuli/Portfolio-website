import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, FolderKanban, Send, Settings, Tags } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getAllProjects,
  getApplications,
  getJobPostings,
  getSkills,
} from '@/lib/supabase'
import { getAdminPath } from '@/lib/adminConfig'
import { ApplicationRecord, JobPosting, Project, Skill } from '@/types'

export function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])

  useEffect(() => {
    Promise.all([
      getAllProjects(),
      getSkills(),
      getJobPostings(),
      getApplications(),
    ]).then(([projectsData, skillsData, jobsData, applicationsData]) => {
      setProjects(projectsData)
      setSkills(skillsData)
      setJobs(jobsData ?? [])
      setApplications(applicationsData ?? [])
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
      title: 'Settings',
      value: '8',
      icon: Settings,
      href: getAdminPath('settings'),
      description: 'Profile, links, resume, and site details',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Portfolio state, job pipeline, and resume workbench at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to={getAdminPath('projects/new')}
              className="block rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
            >
              <p className="font-medium">Create New Project</p>
              <p className="text-sm text-muted-foreground">
                Add a fresh project and pull a smarter description from GitHub.
              </p>
            </Link>
            <Link
              to={getAdminPath('resume')}
              className="block rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
            >
              <p className="font-medium">Refine Resume</p>
              <p className="text-sm text-muted-foreground">
                Reorder sections, tune density, and keep variants aligned.
              </p>
            </Link>
            <Link
              to={getAdminPath('jobs')}
              className="block rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
            >
              <p className="font-medium">Capture Jobs</p>
              <p className="text-sm text-muted-foreground">
                Save a posting, score the fit, and push it into the application tracker.
              </p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
