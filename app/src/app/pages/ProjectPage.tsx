import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { ProjectDetail } from '@/components/public/ProjectDetail'
import { getProjectBySlug } from '@/lib/supabase'
import { Project } from '@/types'
import { Loader2 } from 'lucide-react'

const DEFAULT_TITLE = 'AI Portfolio | Data Scientist & AI Engineer'
const DEFAULT_DESCRIPTION = 'Portfolio showcasing data science, machine learning, and AI engineering projects'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim().slice(0, 160)
}

function setProjectMeta(project: Project) {
  const title = `${project.title} | Portfolio`
  const description = stripHtml(project.description) || project.title
  const image = project.cover_image || ''

  document.title = title

  const setMeta = (name: string, content: string, isProperty = false) => {
    const attr = isProperty ? 'property' : 'name'
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attr, name)
      document.head.appendChild(el)
    }
    el.content = content
  }

  setMeta('description', description)
  setMeta('og:title', title, true)
  setMeta('og:description', description, true)
  setMeta('og:image', image, true)
  setMeta('og:type', 'article', true)
  setMeta('twitter:card', 'summary_large_image')
  setMeta('twitter:title', title)
  setMeta('twitter:description', description)
  setMeta('twitter:image', image)
}

function resetMeta() {
  document.title = DEFAULT_TITLE
  const setMeta = (name: string, content: string, isProperty = false) => {
    const attr = isProperty ? 'property' : 'name'
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
    if (el) el.content = content
  }
  setMeta('description', DEFAULT_DESCRIPTION)
  setMeta('og:title', DEFAULT_TITLE, true)
  setMeta('og:description', DEFAULT_DESCRIPTION, true)
  setMeta('og:image', '', true)
  setMeta('twitter:title', DEFAULT_TITLE)
  setMeta('twitter:description', DEFAULT_DESCRIPTION)
  setMeta('twitter:image', '')
}

export function ProjectPage() {
  const { slug } = useParams<{ slug: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (slug) {
      getProjectBySlug(slug).then((data) => {
        setProject(data)
        setIsLoading(false)
      })
    }
  }, [slug])

  useEffect(() => {
    if (project) {
      setProjectMeta(project)
      return () => resetMeta()
    }
  }, [project])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  if (!project) {
    return <Navigate to="/" />
  }

  return <ProjectDetail project={project} />
}
