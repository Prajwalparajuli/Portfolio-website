import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import {
  Activity,
  BellRing,
  BriefcaseBusiness,
  Compass,
  ExternalLink,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Settings,
  Tags,
  Users,
  Wrench,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { getAdminPath } from '@/lib/adminConfig'
import { getNotificationItems } from '@/lib/supabase'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Live badge count (e.g. unread notifications) */
  badge?: number
}

const primaryItems: NavItem[] = [
  { href: getAdminPath('today'), label: 'Today', icon: LayoutDashboard },
  { href: getAdminPath('jobs'), label: 'Discover', icon: Compass },
  { href: getAdminPath('applications'), label: 'Applications', icon: BriefcaseBusiness },
  { href: getAdminPath('resume'), label: 'Resume', icon: FileText },
  { href: getAdminPath('projects'), label: 'Projects', icon: FolderKanban },
]

const moreItems: NavItem[] = [
  { href: getAdminPath('answers'), label: 'Answer Bank', icon: NotebookPen },
  { href: getAdminPath('contacts'), label: 'Contacts', icon: Users },
  { href: getAdminPath('skills'), label: 'Skills', icon: Tags },
  { href: getAdminPath('watchlists'), label: 'Watchlists', icon: Wrench },
  { href: getAdminPath('activity'), label: 'Activity', icon: Activity },
  { href: getAdminPath('settings'), label: 'Settings', icon: Settings },
]

export function AdminSidebar() {
  const { signOut, user } = useAuth()
  const { pathname } = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let mounted = true
    const fetchUnread = async () => {
      try {
        const items = await getNotificationItems(50)
        if (!mounted) return
        setUnreadCount((items ?? []).filter((n) => !n.is_read).length)
      } catch {
        // Silently fail — sidebar shouldn't break on notification fetch errors
      }
    }
    void fetchUnread()
    const interval = setInterval(fetchUnread, 60_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  /** Inbox with live unread badge */
  const inboxItem: NavItem = {
    href: getAdminPath('inbox'),
    label: 'Inbox',
    icon: BellRing,
    badge: unreadCount,
  }

  return (
    <aside className="flex w-60 flex-col border-r border-border/50 bg-background/95 backdrop-blur">
      <div className="border-b border-border/50 px-4 py-4">
        <p className="text-lg font-semibold text-foreground">Career Cockpit</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Private application workflow
        </p>
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {user?.email ?? 'Local dev bypass'}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {primaryItems.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
          <SidebarLink item={inboxItem} pathname={pathname} />
        </div>

        <CompactGroup title="More" items={moreItems} pathname={pathname} />
      </div>

      <div className="space-y-2 border-t border-border/50 px-3 py-3">
        <Link
          to="/"
          target="_blank"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          View Site
        </Link>

        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-lg px-3 text-muted-foreground hover:bg-surface hover:text-foreground"
          onClick={() => {
            if (user) {
              signOut()
              return
            }
            window.location.href = '/'
          }}
        >
          <LogOut className="h-4 w-4" />
          {user ? 'Sign Out' : 'Exit Admin'}
        </Button>
      </div>
    </aside>
  )
}

function CompactGroup({
  title,
  items,
  pathname,
}: {
  title: string
  items: NavItem[]
  pathname: string
}) {
  const isActive = items.some((item) => isPathActive(pathname, item.href))

  return (
    <details open={isActive} className="rounded-xl border border-white/10 bg-black/10">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </summary>
      <div className="space-y-1 border-t border-white/10 px-2 py-2">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} compact />
        ))}
      </div>
    </details>
  )
}

function SidebarLink({
  item,
  pathname,
  compact = false,
}: {
  item: NavItem
  pathname: string
  compact?: boolean
}) {
  const Icon = item.icon
  const isActive = isPathActive(pathname, item.href)

  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
        compact ? 'text-sm' : 'font-medium',
        isActive
          ? 'border-accent/20 bg-accent/10 text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-surface hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', isActive ? 'text-accent' : 'text-muted-foreground')} />
      <span className="flex-1">{item.label}</span>
      {(item.badge ?? 0) > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/20 px-1.5 text-[10px] font-semibold text-accent">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
