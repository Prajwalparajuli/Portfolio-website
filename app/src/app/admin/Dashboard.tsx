import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderKanban, Tags, Settings, Eye } from 'lucide-react'
import { getAllProjects, getSkills } from '@/lib/supabase'
import { getAdminPath } from '@/lib/adminConfig'
import { Project, Skill } from '@/types'

export function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])

  useEffect(() => {
    Promise.all([getAllProjects(), getSkills()]).then(([projectsData, skillsData]) => {
      setProjects(projectsData)
      setSkills(skillsData)
    })
  }, [])

  const publishedProjects = projects.filter(p => p.is_published)
  const draftProjects = projects.filter(p => !p.is_published)

  const stats = [
    {
      title: 'Total Projects',
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
      description: 'Available for tagging',
    },
    {
      title: 'Site Views',
      value: '—',
      icon: Eye,
      href: '#',
      description: 'Analytics coming soon',
    },
    {
      title: 'Settings',
      value: '8',
      icon: Settings,
      href: getAdminPath('settings'),
      description: 'Configure your portfolio',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here&apos;s what&apos;s happening with your portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} to={stat.href}>
              <Card className="glass hover:bg-white/5 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.slice(0, 5).map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div>
                  <p className="font-medium">{project.title}</p>
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
              <p className="text-muted-foreground text-center py-4">
                No projects yet. Create your first project!
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
              className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <p className="font-medium">Create New Project</p>
              <p className="text-sm text-muted-foreground">
                Add a new project to your portfolio
              </p>
            </Link>
            <Link
              to={getAdminPath('settings')}
              className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <p className="font-medium">Update Settings</p>
              <p className="text-sm text-muted-foreground">
                Update your bio, resume, and contact info
              </p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
