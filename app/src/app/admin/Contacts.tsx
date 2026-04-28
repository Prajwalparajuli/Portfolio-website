import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Save, Trash2, UserPlus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import {
  createCareerContact,
  deleteCareerContact,
  getCareerContacts,
  getCompanyWatchlists,
  getContactTouchpoints,
  updateCareerContact,
} from '@/lib/supabase'
import { CareerContact, CareerContactInput, CompanyWatchlist, ContactTouchpoint } from '@/types'

const EMPTY_CONTACT: CareerContactInput = {
  company_watchlist_id: null,
  full_name: '',
  role_title: '',
  organization_name: '',
  relationship_kind: 'networking',
  email: '',
  linkedin_url: '',
  location: '',
  introduced_by: '',
  notes: '',
  next_follow_up_at: null,
  last_contact_at: null,
}

export function AdminContacts() {
  const [searchParams] = useSearchParams()
  const [contacts, setContacts] = useState<CareerContact[] | null>([])
  const [watchlists, setWatchlists] = useState<CompanyWatchlist[] | null>([])
  const [touchpoints, setTouchpoints] = useState<ContactTouchpoint[] | null>([])
  const [form, setForm] = useState<CareerContactInput>(EMPTY_CONTACT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectionApplied, setSelectionApplied] = useState(false)

  useEffect(() => {
    Promise.all([getCareerContacts(), getCompanyWatchlists(), getContactTouchpoints()]).then(
      ([contactData, watchlistData, touchpointData]) => {
        setContacts(contactData)
        setWatchlists(watchlistData)
        setTouchpoints(touchpointData)
      }
    )
  }, [])

  const watchlistMap = useMemo(
    () => new Map((watchlists ?? []).map((watchlist) => [watchlist.id, watchlist])),
    [watchlists]
  )

  useEffect(() => {
    if (selectionApplied || contacts === null || watchlists === null) return

    const requestedContactId = searchParams.get('contact')
    const requestedCompanyId = searchParams.get('company')

    if (requestedContactId) {
      const match = (contacts ?? []).find((contact) => contact.id === requestedContactId)
      if (match) {
        setEditingId(match.id)
        setForm(toCareerContactInput(match))
        setSelectionApplied(true)
        return
      }
    }

    if (requestedCompanyId) {
      const watchlist = (watchlists ?? []).find((entry) => entry.id === requestedCompanyId)
      setForm((current) => ({
        ...current,
        company_watchlist_id: requestedCompanyId,
        organization_name:
          current.organization_name || watchlist?.company_name || current.organization_name,
      }))
    }

    setSelectionApplied(true)
  }, [contacts, searchParams, selectionApplied, watchlists])

  const touchpointsByContactId = useMemo(() => {
    const next = new Map<string, ContactTouchpoint[]>()
    for (const touchpoint of touchpoints ?? []) {
      if (!touchpoint.contact_id) continue
      const existing = next.get(touchpoint.contact_id) ?? []
      next.set(touchpoint.contact_id, [...existing, touchpoint])
    }
    return next
  }, [touchpoints])

  const orderedContacts = useMemo(() => {
    return [...(contacts ?? [])].sort((left, right) => {
      const leftDue = left.next_follow_up_at ? new Date(left.next_follow_up_at).getTime() : Number.POSITIVE_INFINITY
      const rightDue = right.next_follow_up_at ? new Date(right.next_follow_up_at).getTime() : Number.POSITIVE_INFINITY
      if (leftDue !== rightDue) return leftDue - rightDue
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    })
  }, [contacts])

  const dueContacts = useMemo(() => {
    const today = startOfToday().getTime()
    return orderedContacts.filter((contact) => {
      if (!contact.next_follow_up_at) return false
      return new Date(contact.next_follow_up_at).getTime() <= today
    })
  }, [orderedContacts])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const normalized: CareerContactInput = {
        ...form,
        full_name: form.full_name.trim(),
        role_title: form.role_title.trim(),
        organization_name: resolveOrganizationName(form, watchlistMap),
        email: form.email.trim(),
        linkedin_url: form.linkedin_url.trim(),
        location: form.location.trim(),
        introduced_by: form.introduced_by.trim(),
        notes: form.notes.trim(),
        next_follow_up_at: form.next_follow_up_at || null,
        last_contact_at: form.last_contact_at || null,
      }

      const saved = editingId
        ? await updateCareerContact(editingId, normalized)
        : await createCareerContact(normalized)

      if (!saved) return

      setContacts((current) => {
        const withoutCurrent = (current ?? []).filter((entry) => entry.id !== saved.id)
        return [saved, ...withoutCurrent]
      })
      setEditingId(null)
      setForm(EMPTY_CONTACT)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (contact: CareerContact) => {
    setEditingId(contact.id)
    setForm(toCareerContactInput(contact))
  }

  const handleDelete = async (contactId: string) => {
    setDeletingId(contactId)
    try {
      await deleteCareerContact(contactId)
      setContacts((current) => (current ?? []).filter((entry) => entry.id !== contactId))
      if (editingId === contactId) {
        setEditingId(null)
        setForm(EMPTY_CONTACT)
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleReset = () => {
    setEditingId(null)
    setForm(EMPTY_CONTACT)
  }

  if (contacts === null || watchlists === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Contacts</h1>
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">009_relationship_crm_phase5.sql</code> to unlock recruiter, alumni, and referral tracking.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold gradient-text">Contacts</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{orderedContacts.length} total</Badge>
            {dueContacts.length > 0 && <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">{dueContacts.length} due</Badge>}
          </div>
        </div>
        <Link to={getAdminPath('watchlists')}>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Dossiers
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="glass">
          <CardContent className="p-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {editingId ? 'Edit contact' : 'Add contact'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Attach the person to a company dossier when possible so people follow-ups stay tied to the rest of the search.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Company dossier</Label>
                <select
                  value={form.company_watchlist_id ?? ''}
                  onChange={(event) => {
                    const nextCompanyId = event.target.value || null
                    const watchlist = nextCompanyId ? watchlistMap.get(nextCompanyId) : null
                    setForm((current) => ({
                      ...current,
                      company_watchlist_id: nextCompanyId,
                      organization_name:
                        current.organization_name || watchlist?.company_name || current.organization_name,
                    }))
                  }}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                >
                  <option value="">No linked dossier</option>
                  {(watchlists ?? []).map((watchlist) => (
                    <option key={watchlist.id} value={watchlist.id}>
                      {watchlist.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                placeholder="Full name"
                value={form.full_name}
                onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              />
              <Input
                placeholder="Role title"
                value={form.role_title}
                onChange={(event) => setForm((current) => ({ ...current, role_title: event.target.value }))}
              />
              <Input
                placeholder="Organization"
                value={form.organization_name}
                onChange={(event) => setForm((current) => ({ ...current, organization_name: event.target.value }))}
              />

              <select
                value={form.relationship_kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    relationship_kind: event.target.value as CareerContact['relationship_kind'],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
              >
                <option value="recruiter">Recruiter</option>
                <option value="hiring_manager">Hiring manager</option>
                <option value="employee">Employee</option>
                <option value="alumni">Alumni</option>
                <option value="referral">Referral</option>
                <option value="networking">Networking</option>
                <option value="other">Other</option>
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
                <Input
                  placeholder="LinkedIn URL"
                  value={form.linkedin_url}
                  onChange={(event) => setForm((current) => ({ ...current, linkedin_url: event.target.value }))}
                />
                <Input
                  placeholder="Location"
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                />
                <Input
                  placeholder="Introduced by"
                  value={form.introduced_by}
                  onChange={(event) => setForm((current) => ({ ...current, introduced_by: event.target.value }))}
                />
                <Input
                  type="date"
                  value={toDateInputValue(form.last_contact_at)}
                  onChange={(event) => setForm((current) => ({ ...current, last_contact_at: event.target.value || null }))}
                />
                <Input
                  type="date"
                  value={toDateInputValue(form.next_follow_up_at)}
                  onChange={(event) => setForm((current) => ({ ...current, next_follow_up_at: event.target.value || null }))}
                />
              </div>

              <Textarea
                placeholder="Context, outreach notes, shared history, or what to follow up on next."
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[140px] border-white/10 bg-black/40"
              />

              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="gap-2" disabled={saving}>
                  {editingId ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {saving ? 'Saving...' : editingId ? 'Save contact' : 'Add contact'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {orderedContacts.map((contact) => {
            const companyWatchlist = contact.company_watchlist_id ? watchlistMap.get(contact.company_watchlist_id) : null
            const recentTouchpoints = (touchpointsByContactId.get(contact.id) ?? []).slice(0, 3)
            const due = isDue(contact.next_follow_up_at)

            return (
              <Card
                key={contact.id}
                className={`glass ${editingId === contact.id ? 'border border-accent/30' : ''}`}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{contact.full_name || 'Untitled contact'}</h3>
                        <Badge variant={due ? 'default' : 'outline'}>
                          {contact.relationship_kind.replace(/_/g, ' ')}
                        </Badge>
                        {due && <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">Due now</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[contact.role_title, contact.organization_name || companyWatchlist?.company_name].filter(Boolean).join(' - ') || 'No role or organization yet'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(contact)}>
                        Edit
                      </Button>
                      {companyWatchlist && (
                        <Link to={`${getAdminPath('watchlists')}?company=${encodeURIComponent(companyWatchlist.id)}`}>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Users className="h-4 w-4" />
                            Open company
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-muted-foreground"
                        disabled={deletingId === contact.id}
                        onClick={() => void handleDelete(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === contact.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat label="Next follow-up" value={contact.next_follow_up_at ? formatDateTime(contact.next_follow_up_at) : 'Not set'} />
                    <MiniStat label="Last contact" value={contact.last_contact_at ? formatDateTime(contact.last_contact_at) : 'Not logged'} />
                    <MiniStat label="Introduced by" value={contact.introduced_by || 'Direct'} />
                    <MiniStat label="Touchpoints" value={String(recentTouchpoints.length)} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {contact.email && <span>{contact.email}</span>}
                    {contact.location && <span>{contact.location}</span>}
                    {contact.linkedin_url && (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        LinkedIn
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {contact.notes && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
                      {contact.notes}
                    </div>
                  )}

                  {recentTouchpoints.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recent touchpoints</p>
                      {recentTouchpoints.map((touchpoint) => (
                        <div key={touchpoint.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{touchpoint.touchpoint_kind.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline">{touchpoint.channel}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDateTime(touchpoint.occurred_at)}</span>
                          </div>
                          {touchpoint.subject && (
                            <p className="mt-2 text-sm font-medium text-foreground">{touchpoint.subject}</p>
                          )}
                          <p className="mt-2 text-sm text-muted-foreground">{touchpoint.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {orderedContacts.length === 0 && (
            <Card className="glass">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No contacts yet. Add recruiters, alumni, employees, or referrals here so the search stays in one system.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function toCareerContactInput(contact: CareerContact): CareerContactInput {
  return {
    company_watchlist_id: contact.company_watchlist_id,
    full_name: contact.full_name,
    role_title: contact.role_title,
    organization_name: contact.organization_name,
    relationship_kind: contact.relationship_kind,
    email: contact.email,
    linkedin_url: contact.linkedin_url,
    location: contact.location,
    introduced_by: contact.introduced_by,
    notes: contact.notes,
    next_follow_up_at: contact.next_follow_up_at,
    last_contact_at: contact.last_contact_at,
  }
}

function resolveOrganizationName(
  input: CareerContactInput,
  watchlistMap: Map<string, CompanyWatchlist>
): string {
  if (input.organization_name.trim()) return input.organization_name.trim()
  if (!input.company_watchlist_id) return ''
  return watchlistMap.get(input.company_watchlist_id)?.company_name ?? ''
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isDue(value: string | null) {
  if (!value) return false
  return new Date(value).getTime() <= startOfToday().getTime()
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}
