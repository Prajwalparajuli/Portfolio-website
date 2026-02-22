import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/components/auth/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { Loader2 } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  isSecretKeyMode,
  getAdminSecretKey,
  setAdminSecretSession,
  hasAdminSecretSession,
} from '@/lib/adminConfig'
import { useEffect, useState } from 'react'

const devBypassAdmin = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && !isSupabaseConfigured

export function AdminLayout() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [secretKeyAllowed, setSecretKeyAllowed] = useState<boolean | null>(
    () => (isSecretKeyMode() ? null : true)
  )

  const keyParam = searchParams.get('key')
  const expectedKey = getAdminSecretKey()

  useEffect(() => {
    if (!isSecretKeyMode()) {
      setSecretKeyAllowed(true)
      return
    }
    if (keyParam === expectedKey) {
      setAdminSecretSession()
      setSecretKeyAllowed(true)
      searchParams.delete('key')
      setSearchParams(searchParams, { replace: true })
      return
    }
    if (hasAdminSecretSession()) {
      setSecretKeyAllowed(true)
      return
    }
    setSecretKeyAllowed(false)
    navigate('/', { replace: true })
  }, [keyParam, expectedKey, navigate, searchParams, setSearchParams])

  // Secret-key mode: no login screen; require ?key=SECRET or existing session
  if (isSecretKeyMode()) {
    if (secretKeyAllowed === false) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      )
    }
    if (secretKeyAllowed === true) {
      return (
        <div className="min-h-screen flex bg-[#0a0a0a]">
          <AdminSidebar />
          <main className="flex-1 p-8 overflow-auto">
            <div className="max-w-6xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  if (isLoading && !devBypassAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  if (!user && !devBypassAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a] mesh-gradient">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
