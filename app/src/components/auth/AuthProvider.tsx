import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, getCurrentUser, isCurrentUserAdmin } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function refreshAuthState(nextUser?: User | null) {
      setIsLoading(true)
      const resolvedUser = nextUser ?? await getCurrentUser()
      setUser(resolvedUser)
      if (!resolvedUser) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }

      try {
        setIsAdmin(false)
        setIsAdmin(await isCurrentUserAdmin())
      } catch {
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    getCurrentUser()
      .then((nextUser) => refreshAuthState(nextUser))
      .catch(() => {
        setUser(null)
        setIsAdmin(false)
        setIsLoading(false)
      })

    let subscription: { unsubscribe: () => void } | null = null
    try {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          void refreshAuthState(session?.user ?? null)
        }
      )
      subscription = sub
    } catch {
      setIsLoading(false)
    }

    return () => subscription?.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
