import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  FolderKanban, 
  Tags, 
  Settings, 
  Activity,
  LogOut,
  ExternalLink,
  FileText
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { getAdminPath, isSecretKeyMode, clearAdminSecretSession } from '@/lib/adminConfig'

const navItems = [
  { href: getAdminPath(), label: 'Dashboard', icon: LayoutDashboard },
  { href: getAdminPath('projects'), label: 'Projects', icon: FolderKanban },
  { href: getAdminPath('skills'), label: 'Skills', icon: Tags },
  { href: getAdminPath('resume'), label: 'Resume', icon: FileText },
  { href: getAdminPath('settings'), label: 'Settings', icon: Settings },
  { href: getAdminPath('activity'), label: 'Activity', icon: Activity },
]

export function AdminSidebar() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  return (
    <aside className="w-64 glass-strong flex flex-col border-r border-border/50">
      <div className="p-6 border-b border-border/50">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-display font-semibold gradient-text"
        >
          Admin Canvas
        </motion.h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          {isSecretKeyMode() ? 'Secret link' : user?.email}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item, index) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden',
                  isActive
                    ? 'bg-accent/15 text-accent border border-accent/20'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground border border-transparent'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-accent' : ''
                )} />
                <span className="relative z-10">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-accent/5 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border/50 space-y-2">
        <Link
          to="/"
          target="_blank"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-all duration-200 group"
        >
          <ExternalLink className="h-4 w-4 group-hover:text-accent transition-colors" />
          View Site
        </Link>
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-surface rounded-xl"
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
