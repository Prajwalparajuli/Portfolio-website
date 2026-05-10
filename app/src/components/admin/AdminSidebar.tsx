import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import {
  ClipboardList,
  ExternalLink,
  FileText,
  FolderKanban,
  LogOut,
  Scissors,
  Settings,
  Tags,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getAdminPath } from '@/lib/adminConfig'

type NavItem = {
  href: string
  label: string
  icon: typeof FileText
}

const navItems: NavItem[] = [
  { href: getAdminPath('resume'), label: 'Resume', icon: FileText },
  { href: getAdminPath('tailor'), label: 'Quick Tailor', icon: Scissors },
  { href: getAdminPath('tracker'), label: 'Tracker', icon: ClipboardList },
  { href: getAdminPath('projects'), label: 'Projects', icon: FolderKanban },
  { href: getAdminPath('skills'), label: 'Skills', icon: Tags },
  { href: getAdminPath('settings'), label: 'Settings', icon: Settings },
]

export function AdminSidebar() {
  const { signOut, user } = useAuth()
  const { pathname } = useLocation()

  return (
    <aside className="flex w-60 flex-col border-r border-border/50 bg-background/95 backdrop-blur">
      <div className="border-b border-border/50 px-4 py-4">
        <p className="text-lg font-semibold text-foreground">Career Cockpit</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Resume &amp; Portfolio
        </p>
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {user?.email ?? 'Local dev bypass'}
        </p>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-accent/20 bg-accent/10 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-surface hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-accent' : 'text-muted-foreground')} />
              {item.label}
            </Link>
          )
        })}
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
