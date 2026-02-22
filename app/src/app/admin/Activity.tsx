import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getActivityLog } from '@/lib/supabase'
import type { ActivityEntry } from '@/lib/supabase'
import { Activity as ActivityIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export function AdminActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActivityLog().then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Activity</h1>
        <p className="text-muted-foreground mt-1">
          Recent changes in your portfolio
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="h-5 w-5" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No activity yet. Actions you take in the admin (create, update, delete) will appear here when using Supabase login.
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 py-2 border-b border-white/5 last:border-0 text-sm"
                >
                  <span className="font-medium text-muted-foreground">
                    {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                  <span className="text-white">{entry.action}</span>
                  <span className="text-muted-foreground">{entry.entity_type}</span>
                  {entry.entity_id && (
                    <span className="text-muted-foreground truncate max-w-[120px]">
                      {entry.entity_id}
                    </span>
                  )}
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {JSON.stringify(entry.details)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
