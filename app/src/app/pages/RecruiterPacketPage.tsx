import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { resolvePacketShare } from '@/lib/careerCockpit'
import { ResumeContent } from '@/types/resume'

type PacketData = {
  share: {
    id: string
    title: string
    expires_at: string
  }
  job: {
    title: string
    company: string
    location: string
    job_url: string
    updated_at: string
  }
  application: {
    status: string
    cover_letter: string
    updated_at: string
  }
  profile: {
    display_name: string
    contact_email: string
    linkedin_url: string
    github_url: string
    location: string
    now_line: string
  } | null
  resume_variant: {
    name: string
    updated_at: string
    content: ResumeContent
  }
  highlights: Array<{
    id: string
    title: string
    summary: string
    relevance_reason: string
    url: string
  }>
}

export function RecruiterPacketPage() {
  const { token = '' } = useParams()
  const [packet, setPacket] = useState<PacketData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    resolvePacketShare(token)
      .then((data) => setPacket(data as PacketData))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load recruiter packet.'))
  }, [token])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <Card className="glass">
          <CardContent className="space-y-3 p-8">
            <h1 className="text-2xl font-semibold text-foreground">Recruiter Packet Unavailable</h1>
            <p className="text-muted-foreground">{error}</p>
            <Link to="/">
              <Button variant="outline">Back to portfolio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!packet) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Loading recruiter packet...
      </div>
    )
  }

  const summarySection = packet.resume_variant.content.sections.find((section) => section.type === 'summary')
  const experienceSection = packet.resume_variant.content.sections.find((section) => section.type === 'experience')
  const skillsSection = packet.resume_variant.content.sections.find((section) => section.type === 'skills')

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Recruiter packet</Badge>
          <Badge variant="outline">Expires {new Date(packet.share.expires_at).toLocaleDateString()}</Badge>
        </div>
        <h1 className="text-4xl font-semibold text-foreground">{packet.share.title || packet.job.title}</h1>
        <p className="text-muted-foreground">
          {packet.job.company} • {packet.job.location}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="glass">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Candidate snapshot</h2>
                <p className="text-sm text-muted-foreground">
                  Last packet refresh: {new Date(packet.application.updated_at).toLocaleString()}
                </p>
              </div>
              {summarySection && summarySection.type === 'summary' && (
                <p className="text-sm leading-7 text-muted-foreground">{summarySection.text}</p>
              )}
              {packet.highlights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Proof of work highlights
                  </h3>
                  {packet.highlights.map((highlight) => (
                    <div key={highlight.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{highlight.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{highlight.summary}</p>
                          <p className="mt-2 text-xs text-accent">{highlight.relevance_reason}</p>
                        </div>
                        {highlight.url && (
                          <a href={highlight.url} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm">Open</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Resume</h2>
                <p className="text-sm text-muted-foreground">{packet.resume_variant.name}</p>
              </div>
              {experienceSection && experienceSection.type === 'experience' && (
                <div className="space-y-4">
                  {experienceSection.items.map((item, index) => (
                    <div key={`${item.kind}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="font-medium text-foreground">
                        {item.kind === 'project' ? item.titleOverride || 'Project' : item.role || 'Experience'}
                      </p>
                      {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                          <li key={bulletIndex}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {skillsSection && (
                <p className="text-sm text-muted-foreground">
                  Skills section is included in the tailored packet and available on request.
                </p>
              )}
            </CardContent>
          </Card>

          {packet.application.cover_letter && (
            <Card className="glass">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-lg font-semibold text-foreground">Cover letter</h2>
                <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {packet.application.cover_letter}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="glass">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold text-foreground">Role context</h2>
              <p className="text-sm text-muted-foreground">{packet.job.title}</p>
              {packet.job.job_url && (
                <a href={packet.job.job_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full">Open original posting</Button>
                </a>
              )}
            </CardContent>
          </Card>

          {packet.profile && (
            <Card className="glass">
              <CardContent className="space-y-3 p-6">
                <h2 className="text-lg font-semibold text-foreground">Contact</h2>
                <p className="text-sm text-muted-foreground">{packet.profile.display_name}</p>
                {packet.profile.now_line && <p className="text-sm text-muted-foreground">{packet.profile.now_line}</p>}
                <a href={`mailto:${packet.profile.contact_email}`} className="block text-sm text-accent">
                  {packet.profile.contact_email}
                </a>
                {packet.profile.linkedin_url && (
                  <a href={packet.profile.linkedin_url} target="_blank" rel="noreferrer" className="block text-sm text-accent">
                    LinkedIn
                  </a>
                )}
                {packet.profile.github_url && (
                  <a href={packet.profile.github_url} target="_blank" rel="noreferrer" className="block text-sm text-accent">
                    GitHub
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
