import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/components/auth/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { Button } from '@/components/ui/button'
import { Loader2, ShieldAlert } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import { preloadAdminRoutes } from './admin/routes'

const devBypassAdmin = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && !isSupabaseConfigured

function AdminRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function AdminLayout() {
  const { user, isAdmin, isLoading, signOut } = useAuth()

  useEffect(() => {
    if (user || devBypassAdmin) {
      void preloadAdminRoutes()
    }
  }, [user])

  if (isLoading && !devBypassAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!user && !devBypassAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background mesh-gradient">
        <LoginForm />
      </div>
    )
  }

  if (!isAdmin && !devBypassAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background mesh-gradient">
        <div className="glass-strong w-full max-w-md rounded-2xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-destructive/10 p-3">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Admin Access Required</h1>
              <p className="text-sm text-muted-foreground">
                This account is authenticated but not authorized for the admin area.
              </p>
            </div>
          </div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-3 text-sm text-muted-foreground space-y-1">
              <p>Signed in as: {user?.email ?? 'unknown user'}</p>
              <p>
                Add this email to the Supabase <code>public.admin_users</code> table if it should have access.
              </p>
            </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                window.location.href = '/'
              }}
            >
              Back to site
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                void signOut()
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <Suspense fallback={<AdminRouteFallback />}>
          <div className="mx-auto w-full max-w-[1500px]">
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  )
}
