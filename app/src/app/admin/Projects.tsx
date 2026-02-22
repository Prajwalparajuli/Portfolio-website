import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminPath } from '@/lib/adminConfig'
import { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Plus, Eye, EyeOff, Copy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getAllProjects, reorderProjects, updateProject, deleteProject, createProject } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SortableProjectItemProps {
  project: Project
  selected: boolean
  onToggleSelect: (id: string) => void
  onTogglePublish: (id: string, isPublished: boolean) => void
  onDelete: (id: string) => void
  onDuplicate: (project: Project) => void
}

function SortableProjectItem({ project, selected, onToggleSelect, onTogglePublish, onDelete, onDuplicate }: SortableProjectItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="glass hover:bg-white/5 transition-colors"
    >
      <CardContent className="p-4 flex items-center gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(project.id)}
          className="h-4 w-4 rounded border-white/20 bg-black/40"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-white/10 rounded"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        {project.cover_image && (
          <img
            src={project.cover_image}
            alt={project.title}
            className="w-16 h-16 object-cover rounded-lg"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{project.title}</h3>
            {!project.is_published && (
              <Badge variant="secondary" className="text-xs">
                Draft
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {project.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{project.tags.length - 3}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={project.is_published}
              onCheckedChange={(checked) => onTogglePublish(project.id, checked)}
            />
            {project.is_published ? (
              <Eye className="h-4 w-4 text-muted-foreground" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <Link to={getAdminPath(`projects/${project.id}/edit`)}>
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(project)}
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-strong">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{project.title}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(project.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isReordering, setIsReordering] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    getAllProjects().then(setProjects)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setIsReordering(true)
      
      const oldIndex = projects.findIndex((p) => p.id === active.id)
      const newIndex = projects.findIndex((p) => p.id === over.id)
      
      const newProjects = arrayMove(projects, oldIndex, newIndex)
      setProjects(newProjects)
      
      try {
        await reorderProjects(newProjects.map((p) => p.id))
      } catch (error) {
        console.error('Error reordering projects:', error)
        setProjects(projects)
      } finally {
        setIsReordering(false)
      }
    }
  }

  const handleTogglePublish = async (id: string, isPublished: boolean) => {
    try {
      await updateProject(id, { is_published: isPublished })
      setProjects(projects.map((p) => 
        p.id === id ? { ...p, is_published: isPublished } : p
      ))
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
      setProjects(projects.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleDuplicate = async (project: Project) => {
    try {
      const maxOrder = Math.max(0, ...projects.map((p) => p.display_order))
      const newSlug = project.slug.replace(/-copy(-\d+)?$/, '') + '-copy'
      const created = await createProject({
        slug: newSlug,
        title: project.title + ' (copy)',
        description: project.description,
        cover_image: project.cover_image,
        tags: project.tags,
        github_url: project.github_url,
        demo_url: project.demo_url,
        display_order: maxOrder + 1,
        is_published: false,
      })
      if (created) {
        setProjects([...projects, created])
        navigate(getAdminPath(`projects/${created.id}/edit`))
      }
    } catch (error) {
      console.error('Error duplicating project:', error)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === projects.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(projects.map((p) => p.id)))
  }

  const handleBulkPublish = async (publish: boolean) => {
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => updateProject(id, { is_published: publish })))
      setProjects(projects.map((p) => (ids.includes(p.id) ? { ...p, is_published: publish } : p)))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Error updating projects:', error)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} project(s)? This cannot be undone.`)) return
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => deleteProject(id)))
      setProjects(projects.filter((p) => !ids.includes(p.id)))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Error deleting projects:', error)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage and reorder your portfolio projects
          </p>
        </div>
        <Link to={getAdminPath('projects/new')}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Drag to reorder projects. Changes are saved automatically.
          </p>
          {projects.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === projects.length}
                onChange={selectAll}
                className="h-4 w-4 rounded border-white/20 bg-black/40"
              />
              Select all
            </label>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg glass">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button variant="secondary" size="sm" onClick={() => handleBulkPublish(true)}>
              Publish
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkPublish(false)}>
              Unpublish
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {projects.map((project) => (
                <SortableProjectItem
                  key={project.id}
                  project={project}
                  selected={selectedIds.has(project.id)}
                  onToggleSelect={toggleSelect}
                  onTogglePublish={handleTogglePublish}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {projects.length === 0 && (
          <Card className="glass">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                No projects yet. Create your first project to get started.
              </p>
              <Link to={getAdminPath('projects/new')}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
