import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserPermission } from '../types/index'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  permissions: UserPermission[]
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<UserPermission[]>([])

  useEffect(() => {
    // Hydrate from existing session immediately
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    // Keep in sync with all subsequent auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch permissions whenever the authenticated user changes
  useEffect(() => {
    if (!user) {
      setPermissions([])
      return
    }
    let cancelled = false
    supabase
      .from('user_permissions')
      .select('id, user_id, program_id, plan_id, page, access_level')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!cancelled) setPermissions((data as UserPermission[]) ?? [])
      })
    return () => { cancelled = true }
  }, [user])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signInWithMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, permissions, signIn, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
