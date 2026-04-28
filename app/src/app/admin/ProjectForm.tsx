import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { X, Upload, Loader2, Github, ExternalLink, Eye, Search, Globe } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  getAllProjects,
  getSkills,
  createProject,
  updateProject,
  uploadProjectImage,
  createSkill,
} from '@/lib/supabase'
import { getAdminPath } from '@/lib/adminConfig'
import { cn, generateSlug } from '@/lib/utils'
import { fetchProjectFromGitHubUrl, type GitHubImportSummary } from '@/lib/github'
import { fetchProjectFromWebsiteUrl } from '@/lib/website-import'
import { invokeAdminFunction } from '@/lib/functions'
import { getSuggestedCoverImage } from '@/lib/coverSuggestions'
import { ProjectDetail } from '@/components/public/ProjectDetail'
import { isUnsplashConfigured, searchUnsplash, type UnsplashResult } from '@/lib/unsplash'

const NEW_PROJECT_DRAFT_KEY = 'admin-project-form-draft-v1'

type ProjectFormState = {
  slug: string
  title: string
  description: string
  cover_image: string | null
  tags: string[]
  github_url: string | null
  demo_url: string | null
  display_order: number
  is_published: boolean
  ask_me_about: string | null
}

type ProjectDraft = {
  formData: ProjectFormState
  githubImportUrl: string
  importSummary: GitHubImportSummary | null
}

export function AdminProjectForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const [formData, setFormData] = useState<ProjectFormState>({
    slug: '',
    title: '',
    description: '',
    cover_image: null as string | null,
    tags: [] as string[],
    github_url: null as string | null,
    demo_url: null as string | null,
    display_order: 0,
    is_published: true,
    ask_me_about: null as string | null,
  })
  
  const [newTag, setNewTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuggestingCover, setIsSuggestingCover] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [githubImportUrl, setGithubImportUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<GitHubImportSummary | null>(null)
  const [websiteImportUrl, setWebsiteImportUrl] = useState('')
  const [isImportingWebsite, setIsImportingWebsite] = useState(false)
  const [websiteImportError, setWebsiteImportError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'github' | 'website'>('github')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnsplashResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null)
  const [smartNarrative, setSmartNarrative] = useState<Record<string, unknown> | null>(null)
  const lastSavedSnapshotRef = useRef('')
  const hasHydratedRef = useRef(false)
  const restoredDraftRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your project description here...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, description: editor.getHTML() }))
    },
  })

  useEffect(() => {
    // Load available tags
    getSkills().then(skills => {
      setAvailableTags(skills.map(s => s.name))
    })

    // Load project if editing
    if (id) {
      getAllProjects().then(projects => {
        const project = projects.find(p => p.id === id)
        if (project) {
          const nextFormData = {
            slug: project.slug,
            title: project.title,
            description: project.description,
            cover_image: project.cover_image,
            tags: mergeProjectTags(project.tags),
            github_url: project.github_url,
            demo_url: project.demo_url,
            display_order: project.display_order,
            is_published: project.is_published,
            ask_me_about: project.ask_me_about ?? null,
          }
          setFormData({
            ...nextFormData,
          })
          setPreviewImage(project.cover_image)
          setImportSummary(null)
          editor?.commands.setContent(project.description)
          lastSavedSnapshotRef.current = JSON.stringify(nextFormData)
          hasHydratedRef.current = true
        }
      })
    } else if (!restoredDraftRef.current && editor) {
      const draft = readProjectDraft()
      if (draft) {
        setFormData({
          ...draft.formData,
          tags: mergeProjectTags(draft.formData.tags),
        })
        setGithubImportUrl(draft.githubImportUrl)
        setImportSummary(draft.importSummary ?? null)
        setPreviewImage(draft.formData.cover_image)
        editor.commands.setContent(draft.formData.description || '')
      }
      restoredDraftRef.current = true
      hasHydratedRef.current = true
    }
  }, [id, editor])

  useEffect(() => {
    if (!hasHydratedRef.current) return

    if (isEditing && id) {
      const nextSnapshot = JSON.stringify(formData)
      if (nextSnapshot === lastSavedSnapshotRef.current) return

      setAutoSaveMessage('Autosaving…')
      const timeoutId = window.setTimeout(async () => {
        try {
          await updateProject(id, formData)
          lastSavedSnapshotRef.current = JSON.stringify(formData)
          setAutoSaveMessage('Saved')
          window.setTimeout(() => setAutoSaveMessage(null), 1500)
        } catch (error) {
          console.error('Error autosaving project:', error)
          setAutoSaveMessage('Autosave failed')
        }
      }, 900)

      return () => window.clearTimeout(timeoutId)
    }

    writeProjectDraft({
      formData,
      githubImportUrl,
      importSummary,
    })
    setAutoSaveMessage('Draft saved locally')
    const timeoutId = window.setTimeout(() => setAutoSaveMessage(null), 1200)
    return () => window.clearTimeout(timeoutId)
  }, [formData, githubImportUrl, id, importSummary, isEditing])

  const getSuggestedCover = useCallback(async (tags: string[], slug: string, title: string) => {
    const searchTerm = [...tags.slice(0, 2), title].filter(Boolean).join(' ')
    if (isUnsplashConfigured() && searchTerm.trim()) {
      const [first] = await searchUnsplash(searchTerm, 1)
      if (first?.url) return first.url
    }
    return getSuggestedCoverImage(tags, slug)
  }, [])

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewImage(reader.result as string)
      }
      reader.readAsDataURL(file)

      if (id) {
        const url = await uploadProjectImage(file, id)
        setFormData(prev => ({ ...prev, cover_image: url }))
        setPendingCoverFile(null)
      } else {
        setPendingCoverFile(file)
        setFormData(prev => ({ ...prev, cover_image: null }))
      }
    } catch (error) {
      console.error('Error uploading image:', error)
    } finally {
      setIsUploading(false)
    }
  }, [id])

  const handleAddTag = () => {
    const normalizedTag = normalizeProjectTag(newTag)
    if (normalizedTag) {
      setFormData(prev => ({ ...prev, tags: addProjectTag(prev.tags, normalizedTag) }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  const handleImportFromGitHub = async () => {
    if (!githubImportUrl.trim()) return
    setIsImporting(true)
    setImportError(null)
    try {
      const data = await fetchProjectFromGitHubUrl(githubImportUrl.trim())
      const mergedTags = mergeProjectTags(formData.tags, data.tags)
      setFormData(prev => ({
        ...prev,
        title: data.title,
        description: data.description,
        slug: data.slug,
        tags: mergedTags.length > 0 ? mergedTags : prev.tags,
        github_url: data.github_url,
        demo_url: data.demo_url ?? prev.demo_url,
        ask_me_about: data.ask_me_about ?? prev.ask_me_about,
      }))
      setImportSummary(data.import_summary)
      editor?.commands.setContent(data.description)
      const suggestedCover = await getSuggestedCover(
        mergedTags.length > 0 ? mergedTags : formData.tags,
        data.slug,
        data.title
      )
      setFormData(prev => ({ ...prev, cover_image: suggestedCover }))
      setPreviewImage(suggestedCover)
      setPendingCoverFile(null)
      setGithubImportUrl('')

      // Fire LLM-enhanced description in the background (non-blocking)
      if (data.github_url) {
        generateSmartNarrative(data.github_url)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to fetch repo')
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportFromWebsite = async () => {
    if (!websiteImportUrl.trim()) return
    setIsImportingWebsite(true)
    setWebsiteImportError(null)
    try {
      const data = await fetchProjectFromWebsiteUrl(websiteImportUrl.trim())
      const mergedTags = mergeProjectTags(formData.tags, data.tags)
      setFormData(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        slug: data.slug || prev.slug,
        tags: mergedTags.length > 0 ? mergedTags : prev.tags,
        demo_url: data.demo_url,
      }))
      editor?.commands.setContent(data.description || '')

      // Use the OG image as cover if available
      if (data.cover_image) {
        setFormData(prev => ({ ...prev, cover_image: data.cover_image }))
        setPreviewImage(data.cover_image)
        setPendingCoverFile(null)
      } else {
        // Fall back to suggested cover
        const suggestedCover = await getSuggestedCover(
          mergedTags.length > 0 ? mergedTags : formData.tags,
          data.slug,
          data.title
        )
        setFormData(prev => ({ ...prev, cover_image: suggestedCover }))
        setPreviewImage(suggestedCover)
        setPendingCoverFile(null)
      }

      setWebsiteImportUrl('')
      setImportSummary(null)
    } catch (err) {
      setWebsiteImportError(err instanceof Error ? err.message : 'Failed to fetch website')
    } finally {
      setIsImportingWebsite(false)
    }
  }

  /** Call the project-describe edge function to generate a structured narrative via Gemini */
  const generateSmartNarrative = async (githubUrl: string) => {
    try {
      const res = await invokeAdminFunction<{ hook: string; problem: string; approach: string; results: string[]; learned: string[]; summary: string }>(
        'project-describe',
        { github_url: githubUrl },
        { notReadyMessage: 'project-describe edge function not deployed yet. Deploy it to enable AI descriptions.' }
      )
      // Store the narrative — it'll be saved when the user creates/updates the project
      setSmartNarrative(res)
      setAutoSaveMessage('✨ AI description generated')
      setTimeout(() => setAutoSaveMessage(null), 3000)
    } catch (err) {
      console.warn('Smart narrative generation skipped:', err instanceof Error ? err.message : err)
      // Non-fatal — the basic description still works
    }
  }

  const handleSuggestCover = async () => {
    setIsSuggestingCover(true)
    try {
      const url = await getSuggestedCover(formData.tags, formData.slug, formData.title)
      setFormData(prev => ({ ...prev, cover_image: url }))
      setPreviewImage(url)
      setPendingCoverFile(null)
    } finally {
      setIsSuggestingCover(false)
    }
  }

  const handleSearchImages = () => setSearchOpen(true)

  const runImageSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    try {
      const results = await searchUnsplash(searchQuery.trim())
      setSearchResults(results)
      if (results.length === 0 && isUnsplashConfigured()) {
        setSearchError('No images found. Try a different search.')
      }
    } catch {
      setSearchError('Search failed. Check your connection.')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const selectSearchImage = (url: string) => {
    setFormData(prev => ({ ...prev, cover_image: url }))
    setPreviewImage(url)
    setPendingCoverFile(null)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const syncedSkills = await ensureSkillsForTags(formData.tags)
      if (syncedSkills.length > 0) {
        setAvailableTags((prev) => mergeProjectTags(prev, syncedSkills))
      }

      let savedProjectId = id ?? null

      if (isEditing && id) {
        await updateProject(id, formData)
      } else {
        const created = await createProject(formData)
        savedProjectId = created?.id ?? null
      }

      if (!isEditing && pendingCoverFile && savedProjectId) {
        const uploadedCoverUrl = await uploadProjectImage(pendingCoverFile, savedProjectId)
        if (uploadedCoverUrl) {
          await updateProject(savedProjectId, { cover_image: uploadedCoverUrl })
        }
      }

      // Save LLM-generated narrative if available
      if (smartNarrative && savedProjectId) {
        try {
          await updateProject(savedProjectId, { structured_narrative: smartNarrative } as Partial<typeof formData>)
        } catch (err) {
          console.warn('Failed to save structured narrative:', err)
          // Non-fatal — column may not exist yet
        }
      }

      clearProjectDraft()
      navigate(getAdminPath('projects'))
    } catch (error) {
      console.error('Error saving project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">
          {isEditing ? 'Edit Project' : 'New Project'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditing ? 'Update your project details' : 'Create a new project for your portfolio'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {!isEditing && (
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    importMode === 'github'
                      ? 'border-accent/30 bg-accent/10 text-foreground'
                      : 'border-white/10 bg-black/20 text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setImportMode('github')}
                >
                  <Github className="h-3.5 w-3.5" />
                  GitHub
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    importMode === 'website'
                      ? 'border-accent/30 bg-accent/10 text-foreground'
                      : 'border-white/10 bg-black/20 text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setImportMode('website')}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </button>
              </div>

              {importMode === 'github' ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Paste a public repo URL to import title, description, tags, and tech stack from the README and repo metadata.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com/owner/repo"
                      value={githubImportUrl}
                      onChange={(e) => { setGithubImportUrl(e.target.value); setImportError(null) }}
                      className="bg-black/40 border-white/10 flex-1"
                      disabled={isImporting}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleImportFromGitHub}
                      disabled={isImporting}
                    >
                      {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
                    </Button>
                  </div>
                  {importError && (
                    <p className="text-xs text-destructive">{importError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Paste the live URL of your app or website. We'll pull the title, description, cover image, and detect the tech stack.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://myapp.vercel.app"
                      value={websiteImportUrl}
                      onChange={(e) => { setWebsiteImportUrl(e.target.value); setWebsiteImportError(null) }}
                      className="bg-black/40 border-white/10 flex-1"
                      disabled={isImportingWebsite}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleImportFromWebsite}
                      disabled={isImportingWebsite}
                    >
                      {isImportingWebsite ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
                    </Button>
                  </div>
                  {websiteImportError && (
                    <p className="text-xs text-destructive">{websiteImportError}</p>
                  )}
                </div>
              )}

              {importSummary && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">Detected from GitHub</p>
                      <p className="text-xs text-muted-foreground">
                        Title source: {importSummary.title_source === 'readme_heading' ? 'README heading' : 'repository name'}
                      </p>
                    </div>
                    {importSummary.repo_kinds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {importSummary.repo_kinds.map((kind) => (
                          <Badge key={kind} variant="secondary">{kind}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {importSummary.highlights.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground/90">Highlights</p>
                      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                        {importSummary.highlights.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importSummary.detected_tags.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground/90">Detected tags</p>
                      <div className="flex flex-wrap gap-2">
                        {importSummary.detected_tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {importSummary.notable_files.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground/90">Notable files</p>
                      <div className="flex flex-wrap gap-2">
                        {importSummary.notable_files.map((file) => (
                          <Badge key={file} variant="outline" className="font-mono text-[11px]">
                            {file}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {importSummary.readme_sections.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      README sections kept: {importSummary.readme_sections.slice(0, 5).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="glass">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  const title = e.target.value
                  setFormData(prev => ({
                    ...prev,
                    title,
                    slug: isEditing ? prev.slug : generateSlug(title),
                  }))
                }}
                placeholder="e.g., Vision-Language Model Comparison"
                className="bg-black/40 border-white/10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="e.g., vision-language-model-comparison"
                className="bg-black/40 border-white/10"
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be used in the URL: /projects/{formData.slug}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex flex-wrap items-center gap-4">
                {previewImage && (
                  <div className="relative">
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null)
                        setPendingCoverFile(null)
                        setFormData(prev => ({ ...prev, cover_image: null }))
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={handleSuggestCover} disabled={isSuggestingCover}>
                  {isSuggestingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest cover'}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleSearchImages} className="gap-1.5">
                  <Search className="h-4 w-4" />
                  Search images
                </Button>
                <label className={cn(
                  "flex flex-col items-center justify-center w-32 h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  previewImage ? "border-white/10" : "border-white/20 hover:border-white/40"
                )}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Upload image</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tags are also synced into the Skills table on save, so imported projects can strengthen resume and matching data.
              </p>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  className="bg-black/40 border-white/10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button type="button" onClick={handleAddTag} variant="secondary">
                  Add
                </Button>
              </div>
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-muted-foreground mr-2">Suggested:</span>
                  {availableTags
                    .filter(tag => !formData.tags.some(existing => existing.toLowerCase() === tag.toLowerCase()))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, tags: addProjectTag(prev.tags, tag) }))}
                        className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <p className="text-xs text-muted-foreground">
                GitHub import now keeps the useful overview and feature/result sections instead of dumping the whole README.
              </p>
              <div className="glass rounded-lg overflow-hidden">
                <div className="flex items-center gap-1 p-2 border-b border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={cn(editor?.isActive('bold') && 'bg-white/10')}
                  >
                    Bold
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={cn(editor?.isActive('italic') && 'bg-white/10')}
                  >
                    Italic
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={cn(editor?.isActive('heading', { level: 2 }) && 'bg-white/10')}
                  >
                    H2
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    className={cn(editor?.isActive('bulletList') && 'bg-white/10')}
                  >
                    List
                  </Button>
                </div>
                <EditorContent
                  editor={editor}
                  className="p-4 min-h-[200px] prose prose-invert max-w-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ask_me_about">Ask me about (optional)</Label>
              <Input
                id="ask_me_about"
                value={formData.ask_me_about ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, ask_me_about: e.target.value || null }))}
                placeholder="e.g. Ask me about: scaling this to 1M users"
                className="bg-black/40 border-white/10"
              />
              <p className="text-xs text-muted-foreground">
                Conversation starter shown on the project page.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="github_url" className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub URL
                </Label>
                <Input
                  id="github_url"
                  value={formData.github_url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, github_url: e.target.value || null }))}
                  placeholder="https://github.com/..."
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo_url" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Live Demo URL
                </Label>
                <Input
                  id="demo_url"
                  value={formData.demo_url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, demo_url: e.target.value || null }))}
                  placeholder="https://..."
                  className="bg-black/40 border-white/10"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
              <div className="flex-1">
                <Label htmlFor="is_published" className="font-medium">
                  Publish Project
                </Label>
                <p className="text-sm text-muted-foreground">
                  Make this project visible on your portfolio
                </p>
              </div>
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          {autoSaveMessage && (
            <p className={cn(
              'mr-auto text-sm',
              autoSaveMessage.includes('failed') ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {autoSaveMessage}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            disabled={!formData.slug.trim()}
            title={formData.slug.trim() ? 'Preview with current form data' : 'Add a slug to preview'}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(getAdminPath('projects'))}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              isEditing ? 'Update Project' : 'Create Project'
            )}
          </Button>
        </div>
      </form>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between p-4 border-b border-border glass-strong">
            <span className="text-sm font-medium text-muted-foreground">Preview</span>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <ProjectDetail
              project={{
                ...formData,
                description: editor?.getHTML() ?? formData.description,
                ask_me_about: formData.ask_me_about ?? null,
                id: 'preview',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }}
              hideBack
            />
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-4 p-4 border-b border-border glass-strong flex-wrap">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <Input
                placeholder="Search for images (e.g. python code, machine learning)"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && runImageSearch()}
                className="max-w-sm bg-black/40 border-white/10"
              />
              <Button type="button" onClick={runImageSearch} disabled={searchLoading || !searchQuery.trim()}>
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); setSearchError(null); }}>
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {!isUnsplashConfigured() ? (
              <div className="max-w-md rounded-lg glass p-6 text-muted-foreground text-sm">
                <p className="font-medium text-foreground mb-2">Image search uses Unsplash</p>
                <p className="mb-3">Add your free API key to enable search. Get one at <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-primary underline">unsplash.com/developers</a>.</p>
                <p>In your <code className="bg-white/10 px-1 rounded">.env</code> add:</p>
                <pre className="mt-2 p-3 rounded bg-black/40 text-xs overflow-x-auto">VITE_UNSPLASH_ACCESS_KEY=your_access_key</pre>
              </div>
            ) : (
              <>
                {searchError && <p className="text-sm text-destructive mb-3">{searchError}</p>}
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {searchResults.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => selectSearchImage(img.url)}
                        className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary focus:outline-none transition-colors"
                      >
                        <img src={img.thumb} alt={img.alt ?? 'Search result'} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  !searchLoading && (
                    <p className="text-sm text-muted-foreground">Enter a search term and click Search to find images.</p>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function readProjectDraft(): ProjectDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(NEW_PROJECT_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProjectDraft
  } catch {
    return null
  }
}

function writeProjectDraft(value: ProjectDraft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(NEW_PROJECT_DRAFT_KEY, JSON.stringify(value))
}

function clearProjectDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(NEW_PROJECT_DRAFT_KEY)
}

function normalizeProjectTag(tag: string): string {
  return tag
    .trim()
    .replace(/\s+/g, ' ')
}

function addProjectTag(tags: string[], tag: string): string[] {
  const normalizedTag = normalizeProjectTag(tag)
  if (!normalizedTag) return tags
  if (tags.some((entry) => entry.toLowerCase() === normalizedTag.toLowerCase())) return tags
  return [...tags, normalizedTag]
}

function mergeProjectTags(...groups: string[][]): string[] {
  return groups.reduce((acc, group) => {
    for (const tag of group) {
      const normalizedTag = normalizeProjectTag(tag)
      if (!normalizedTag) continue
      if (acc.some((entry) => entry.toLowerCase() === normalizedTag.toLowerCase())) continue
      acc.push(normalizedTag)
    }
    return acc
  }, [] as string[])
}

async function ensureSkillsForTags(tags: string[]): Promise<string[]> {
  const normalizedTags = mergeProjectTags(tags)
  if (normalizedTags.length === 0) return []

  const existingSkills = await getSkills()
  const existingNames = new Set(existingSkills.map((skill) => skill.name.trim().toLowerCase()))
  const createdSkills: string[] = []

  for (const tag of normalizedTags) {
    const key = tag.toLowerCase()
    if (existingNames.has(key)) continue

    const meta = getSkillMetaForTag(tag)
    await createSkill(tag, meta.category, meta.color)
    existingNames.add(key)
    createdSkills.push(tag)
  }

  return createdSkills
}

function getSkillMetaForTag(tag: string): { category: string; color: string } {
  const normalized = tag.trim().toLowerCase()

  if (/(python|javascript|typescript|java|c\+\+|go|rust|sql|html|css|swift)/i.test(normalized)) {
    return { category: 'languages', color: '#2563eb' }
  }

  if (/(react|next\.js|vue|angular|svelte|tailwind|vite|node\.js|express|fastapi|flask|django|graphql|rest|api|supabase)/i.test(normalized)) {
    return { category: 'frameworks', color: '#8b5cf6' }
  }

  if (/(ai|llm|nlp|machine learning|deep learning|data science|pandas|numpy|scikit|tensorflow|pytorch|openai|opencv|computer vision)/i.test(normalized)) {
    return { category: 'data-ai', color: '#10b981' }
  }

  if (/(docker|kubernetes|aws|gcp|github actions|postgresql|mysql|mongodb|redis)/i.test(normalized)) {
    return { category: 'cloud-devops', color: '#f59e0b' }
  }

  if (/(analytics|bi|business intelligence|data|risk)/i.test(normalized)) {
    return { category: 'analytics', color: '#ec4899' }
  }

  return { category: 'technical', color: '#3b82f6' }
}
