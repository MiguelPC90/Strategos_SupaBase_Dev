import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type Role = 'admin' | 'editor' | 'viewer'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  avatar_url: string | null
}

interface UseRoleResult {
  profile: Profile | null
  role: Role | null
  isAdmin: boolean
  isGestor: boolean
  isViewer: boolean
  loading: boolean
}

export function useRole(): UseRoleResult {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setProfile(null)
        } else {
          setProfile(data as Profile)
        }
        setLoading(false)
      })
  }, [user])

  const role = profile?.role ?? null

  return {
    profile,
    role,
    isAdmin: role === 'admin',
    isGestor: role === 'editor',
    isViewer: role === 'viewer',
    loading,
  }
}
