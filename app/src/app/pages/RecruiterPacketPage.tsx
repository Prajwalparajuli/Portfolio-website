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
        <Card className="border-white/10 bg-black/20">
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
  const candidateName =
    packet.profile?.display_name || packet.resume_variant.content.header.name || 'Candidate'
  const experienceItems =
    experienceSection && experienceSection.type === 'experience' ? experienceSection.items.slice(0, 4) : []
  const statusFacts = [
    packet.profile?.location?.trim() || '',
    packet.profile?.now_line?.trim() || '',
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Recruiter packet</Badge>
          <Badge variant="outline">Expires {new Date(packet.share.expires_at).toLocaleDateString()}</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Why {candidateName} fits {packet.job.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Prepared for {packet.job.company}. This packet surfaces role-relevant proof, tailored resume
              evidence, and direct contact without making a recruiter dig.
            </p>

            {statusFacts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {statusFacts.map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {packet.profile?.contact_email && (
                <Button asChild className="rounded-full">
                  <a href={`mailto:${packet.profile.contact_email}`}>Email candidate</a>
                </Button>
              )}

              {packet.profile?.linkedin_url && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href={packet.profile.linkedin_url} target="_blank" rel="noreferrer">
                    Open LinkedIn
                  </a>
                </Button>
              )}

              {packet.job.job_url && (
                <Button asChild variant="ghost" className="rounded-full">
                  <a href={packet.job.job_url} target="_blank" rel="noreferrer">
                    Open original posting
                  </a>
                </Button>
              )}
            </div>
          </div>

          <Card className="border-white/10 bg-black/20">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Packet details
                </p>
                <p className="mt-3 text-base font-medium text-foreground">{packet.resume_variant.name}</p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Last packet refresh: {new Date(packet.application.updated_at).toLocaleString()}</p>
                <p>Posting refreshed: {new Date(packet.job.updated_at).toLocaleDateString()}</p>
                <p>Company: {packet.job.company}</p>
                <p>Location: {packet.job.location || 'Not specified'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-black/20">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Candidate snapshot</h2>
                <p className="text-sm text-muted-foreground">
                  A quick recruiter view of fit, scope, and communication readiness.
                </p>
              </div>

              {summarySection && summarySection.type === 'summary' && summarySection.text.trim() && (
                <p className="text-sm leading-7 text-foreground/90">{summarySection.text}</p>
              )}

              {!summarySection && packet.profile?.now_line && (
                <p className="text-sm leading-7 text-foreground/90">{packet.profile.now_line}</p>
              )}
            </CardContent>
          </Card>

          {packet.highlights.length > 0 && (
            <Card className="border-white/10 bg-black/20">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Why this candidate</h2>
                  <p className="text-sm text-muted-foreground">
                    Direct proof tied to the job and the selected packet.
                  </p>
                </div>

                <div className="space-y-4">
                  {packet.highlights.map((highlight) => (
                    <div key={highlight.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{highlight.title}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{highlight.summary}</p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                            {highlight.relevance_reason}
                          </p>
                        </div>
                        {highlight.url && (
                          <Button asChild variant="outline" size="sm" className="rounded-full">
                            <a href={highlight.url} target="_blank" rel="noreferrer">
                              Open proof
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-white/10 bg-black/20">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tailored resume evidence</h2>
                <p className="text-sm text-muted-foreground">
                  The most relevant experience pulled into this packet.
                </p>
              </div>

              <div className="space-y-4">
                {experienceItems.length > 0 ? (
                  experienceItems.map((item, index) => (
                    <div key={`${item.kind}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="font-medium text-foreground">
                        {item.kind === 'project' ? item.titleOverride || 'Project' : item.role || 'Experience'}
                      </p>
                      {item.subtitle && <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>}
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                        {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                          <li key={bulletIndex}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tailored experience bullets are available yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {packet.application.cover_letter && (
            <Card className="border-white/10 bg-black/20">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Cover letter starter</h2>
                  <p className="text-sm text-muted-foreground">
                    Included for context if the recruiter wants the supporting narrative behind the application.
                  </p>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {packet.application.cover_letter}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {packet.profile && (
            <Card className="border-white/10 bg-black/20">
              <CardContent className="space-y-3 p-6">
                <h2 className="text-lg font-semibold text-foreground">Candidate</h2>
                <p className="text-sm text-muted-foreground">{candidateName}</p>
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

          <Card className="border-white/10 bg-black/20">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold text-foreground">Role context</h2>
              <p className="text-sm text-muted-foreground">{packet.job.title}</p>
              <p className="text-sm text-muted-foreground">{packet.job.company}</p>
              <p className="text-sm text-muted-foreground">{packet.job.location || 'Location not specified'}</p>
              {packet.job.job_url && (
                <Button asChild variant="outline" className="w-full rounded-full">
                  <a href={packet.job.job_url} target="_blank" rel="noreferrer">
                    Open original posting
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
