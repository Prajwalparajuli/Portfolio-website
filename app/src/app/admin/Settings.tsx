import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Upload, FileText, Github, Linkedin, Twitter, Mail, Plus, Trash2, GraduationCap, Award, PenLine } from 'lucide-react'
import { PortfolioSettings, EducationEntry } from '@/types'
import { getSettings, updateSetting, uploadResume } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { getAdminPath } from '@/lib/adminConfig'

export function AdminSettings() {
  const [settings, setSettings] = useState<PortfolioSettings | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const handleSave = async () => {
    if (!settings) return

    setIsSubmitting(true)
    setSaveMessage(null)

    try {
      const updates = Object.entries(settings).map(([key, value]) => {
        if (key === 'education') return updateSetting(key, JSON.stringify(Array.isArray(value) ? value : []))
        return updateSetting(key, typeof value === 'string' ? value || '' : '')
      })
      await Promise.all(updates)
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setSaveMessage('Error saving settings. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResumeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }

    setIsUploading(true)
    
    try {
      const url = await uploadResume(file)
      if (url && settings) {
        setSettings({ ...settings, resume_url: url })
        setSaveMessage('Resume uploaded successfully!')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (error) {
      console.error('Error uploading resume:', error)
      setSaveMessage('Error uploading resume. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }, [settings])

  if (!settings) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your portfolio settings and personal information
        </p>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="glass mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="social">Social Links</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Site Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="site_title">Site Title</Label>
                  <Input
                    id="site_title"
                    value={settings.site_title}
                    onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
                    placeholder="AI Portfolio"
                    className="bg-black/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_description">Site Description</Label>
                  <Input
                    id="site_description"
                    value={settings.site_description}
                    onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                    placeholder="Portfolio of a Data Scientist & AI Engineer"
                    className="bg-black/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="now_line">Now / status line (optional)</Label>
                  <Input
                    id="now_line"
                    value={settings.now_line ?? ''}
                    onChange={(e) => setSettings({ ...settings, now_line: e.target.value })}
                    placeholder="e.g. Building X · Open to ML roles"
                    className="bg-black/40 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Short line shown on the hero, e.g. what you&apos;re doing or availability.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={settings.bio}
                    onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                    placeholder="Write a brief bio about yourself..."
                    className="bg-black/40 border-white/10 min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be displayed on your portfolio homepage.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Email
                  </Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={settings.contact_email}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    placeholder="your.email@example.com"
                    className="bg-black/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (optional)</Label>
                  <Input
                    id="location"
                    value={settings.location ?? ''}
                    onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA"
                    className="bg-black/40 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground">Shown in hero and footer.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Education & Certifications</CardTitle>
                <p className="text-sm text-muted-foreground">Build credibility on your public site.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {(settings.education ?? []).map((entry, i) => (
                  <div key={i} className="p-4 rounded-lg bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={entry.type}
                        onChange={(e) => {
                          const next = [...(settings.education ?? [])]
                          next[i] = { ...next[i], type: e.target.value as 'education' | 'certification' }
                          setSettings({ ...settings, education: next })
                        }}
                        className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="education">Education</option>
                        <option value="certification">Certification</option>
                      </select>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSettings({ ...settings, education: (settings.education ?? []).filter((_, j) => j !== i) })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input placeholder="Title (e.g. B.S. Computer Science)" value={entry.title} onChange={(e) => { const next = [...(settings.education ?? [])]; next[i] = { ...next[i], title: e.target.value }; setSettings({ ...settings, education: next }) }} className="bg-black/40 border-white/10" />
                    <Input placeholder="Issuer (e.g. MIT)" value={entry.issuer} onChange={(e) => { const next = [...(settings.education ?? [])]; next[i] = { ...next[i], issuer: e.target.value }; setSettings({ ...settings, education: next }) }} className="bg-black/40 border-white/10" />
                    <Input placeholder="Date (e.g. 2020)" value={entry.date} onChange={(e) => { const next = [...(settings.education ?? [])]; next[i] = { ...next[i], date: e.target.value }; setSettings({ ...settings, education: next }) }} className="bg-black/40 border-white/10" />
                    <Input placeholder="URL (optional)" value={entry.url ?? ''} onChange={(e) => { const next = [...(settings.education ?? [])]; next[i] = { ...next[i], url: e.target.value || undefined }; setSettings({ ...settings, education: next }) }} className="bg-black/40 border-white/10" />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setSettings({ ...settings, education: [...(settings.education ?? []), { type: 'education', title: '', issuer: '', date: '' }] })} className="gap-2">
                  <Plus className="h-4 w-4" /> Add entry
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Social Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="github_url" className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub URL
                  </Label>
                  <Input
                    id="github_url"
                    value={settings.github_url}
                    onChange={(e) => setSettings({ ...settings, github_url: e.target.value })}
                    placeholder="https://github.com/yourusername"
                    className="bg-black/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin_url" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn URL
                  </Label>
                  <Input
                    id="linkedin_url"
                    value={settings.linkedin_url}
                    onChange={(e) => setSettings({ ...settings, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/yourusername"
                    className="bg-black/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter_url" className="flex items-center gap-2">
                    <Twitter className="h-4 w-4" />
                    Twitter URL
                  </Label>
                  <Input
                    id="twitter_url"
                    value={settings.twitter_url}
                    onChange={(e) => setSettings({ ...settings, twitter_url: e.target.value })}
                    placeholder="https://twitter.com/yourusername"
                    className="bg-black/40 border-white/10"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume" className="space-y-6">
            {/* Resume builder entry point */}
            <Card className="glass border-white/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PenLine className="h-5 w-5" />
                  Resume Builder
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Build an ATS-friendly resume from your projects, skills, and education — with a live preview and one-click PDF export.
                </p>
              </CardHeader>
              <CardContent>
                <Link to={getAdminPath('resume')}>
                  <Button className="gap-2">
                    <PenLine className="h-4 w-4" />
                    Open Resume Builder
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Resume</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload a PDF directly (overrides the builder URL shown on the public site).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Resume (PDF)</Label>
                  <div className="flex items-center gap-4">
                    {settings.resume_url && (
                      <a
                        href={settings.resume_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        View Current Resume
                      </a>
                    )}
                    <label className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                      "border-white/20 hover:border-white/40"
                    )}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload New Resume
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleResumeUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between">
          <div>
            {saveMessage && (
              <p className={cn(
                "text-sm",
                saveMessage.includes('Error') ? "text-destructive" : "text-green-400"
              )}>
                {saveMessage}
              </p>
            )}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
