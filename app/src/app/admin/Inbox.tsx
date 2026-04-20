import { useEffect, useState } from 'react'
import { BellRing, Mail, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { dispatchCareerNotifications } from '@/lib/careerCockpit'
import {
  getNotificationItems,
  getNotificationPreferences,
  saveNotificationPreferences,
  updateNotificationItem,
} from '@/lib/supabase'
import { NotificationItem, NotificationPreference } from '@/types'

const DEFAULT_PREFS: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'> = {
  profile_key: 'primary',
  email_enabled: true,
  inbox_enabled: true,
  strong_match_enabled: true,
  sync_failure_enabled: true,
  follow_up_enabled: true,
  stale_application_enabled: true,
  weekly_digest_enabled: true,
  digest_hour: 8,
  timezone: 'America/Chicago',
}

export function AdminInbox() {
  const [items, setItems] = useState<NotificationItem[] | null>([])
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getNotificationItems(), getNotificationPreferences()]).then(([itemData, prefData]) => {
      setItems(itemData)
      setPrefs(prefData)
    })
  }, [])

  const effectivePrefs = prefs ?? {
    id: 'notification-prefs-draft',
    created_at: '',
    updated_at: '',
    ...DEFAULT_PREFS,
  }

  const handleToggle = async (key: keyof typeof DEFAULT_PREFS, value: boolean | number | string) => {
    setSavingKey(String(key))
    try {
      const saved = await saveNotificationPreferences({ [key]: value })
      if (saved) setPrefs(saved)
    } finally {
      setSavingKey(null)
    }
  }

  const handleDispatch = async () => {
    setSyncing(true)
    try {
      await dispatchCareerNotifications()
      setItems(await getNotificationItems())
    } finally {
      setSyncing(false)
    }
  }

  const handleReadToggle = async (item: NotificationItem) => {
    const updated = await updateNotificationItem(item.id, { is_read: !item.is_read })
    if (!updated) return
    setItems((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
  }

  if (items === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Inbox</h1>
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">007_career_cockpit_phase2.sql</code> to enable inbox and notification preferences.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Strong matches, due follow-ups, sync failures, and stale applications in one place.
          </p>
        </div>
        <Button onClick={handleDispatch} disabled={syncing} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {syncing ? 'Dispatching...' : 'Refresh inbox + email'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="glass">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4 text-accent" />
              Notification preferences
            </div>
            <PreferenceRow
              label="Email delivery"
              checked={effectivePrefs.email_enabled}
              disabled={savingKey === 'email_enabled'}
              onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
            />
            <PreferenceRow
              label="In-app inbox"
              checked={effectivePrefs.inbox_enabled}
              disabled={savingKey === 'inbox_enabled'}
              onCheckedChange={(checked) => handleToggle('inbox_enabled', checked)}
            />
            <PreferenceRow
              label="Strong matches"
              checked={effectivePrefs.strong_match_enabled}
              disabled={savingKey === 'strong_match_enabled'}
              onCheckedChange={(checked) => handleToggle('strong_match_enabled', checked)}
            />
            <PreferenceRow
              label="Sync failures"
              checked={effectivePrefs.sync_failure_enabled}
              disabled={savingKey === 'sync_failure_enabled'}
              onCheckedChange={(checked) => handleToggle('sync_failure_enabled', checked)}
            />
            <PreferenceRow
              label="Due follow-ups"
              checked={effectivePrefs.follow_up_enabled}
              disabled={savingKey === 'follow_up_enabled'}
              onCheckedChange={(checked) => handleToggle('follow_up_enabled', checked)}
            />
            <PreferenceRow
              label="Stale applications"
              checked={effectivePrefs.stale_application_enabled}
              disabled={savingKey === 'stale_application_enabled'}
              onCheckedChange={(checked) => handleToggle('stale_application_enabled', checked)}
            />
            <PreferenceRow
              label="Weekly digest"
              checked={effectivePrefs.weekly_digest_enabled}
              disabled={savingKey === 'weekly_digest_enabled'}
              onCheckedChange={(checked) => handleToggle('weekly_digest_enabled', checked)}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(items ?? []).map((item) => (
            <Card key={item.id} className="glass">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                      <Badge variant={item.is_read ? 'outline' : 'default'}>
                        {item.is_read ? 'Read' : 'Unread'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleReadToggle(item)}>
                    {item.is_read ? 'Mark unread' : 'Mark read'}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{item.type.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{item.channel}</Badge>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {(items ?? []).length === 0 && (
            <Card className="glass">
              <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
                <BellRing className="h-4 w-4" />
                Nothing is queued right now. Run a dispatch to refresh the inbox.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function PreferenceRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}
