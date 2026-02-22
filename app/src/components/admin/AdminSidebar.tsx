import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  FolderKanban, 
  Tags, 
  Settings, 
  Activity,
  LogOut,
  ExternalLink
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getAdminPath, isSecretKeyMode, clearAdminSecretSession } from '@/lib/adminConfig'

const navItems = [
  { href: getAdminPath(), label: 'Dashboard', icon: LayoutDashboard },
  { href: getAdminPath('projects'), label: 'Projects', icon: FolderKanban },
  { href: getAdminPath('skills'), label: 'Skills', icon: Tags },
  { href: getAdminPath('settings'), label: 'Settings', icon: Settings },
  { href: getAdminPath('activity'), label: 'Activity', icon: Activity },
]

export function AdminSidebar() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  return (
    <aside className="w-64 glass-strong flex flex-col">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold gradient-text">Admin Canvas</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {isSecretKeyMode() ? 'Secret link' : user?.email}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Link
          to="/"
          target="_blank"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          <ExternalLink className="h-4 w-4" />
          View Site
        </Link>
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-white hover:bg-white/5"
          onClick={() => {
            if (isSecretKeyMode()) {
              clearAdminSecretSession()
              window.location.href = '/'
            } else {
              signOut()
            }
          }}
        >
          <LogOut className="h-4 w-4" />
          {isSecretKeyMode() ? 'Lock admin' : 'Sign Out'}
        </Button>
      </div>
    </aside>
  )
}
