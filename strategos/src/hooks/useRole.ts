import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type Role = 'admin' | 'program_manager' | 'editor' | 'sponsor' | 'stakeholder' | 'viewer'

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
  isProgramManager: boolean
  isEditor: boolean
  /** Alias for isEditor — kept for backward compatibility */
  isGestor: boolean
  isSponsor: boolean
  isStakeholder: boolean
  /** True for roles that cannot edit (sponsor, stakeholder, legacy viewer) */
  isViewer: boolean
  /** True for admin, program_manager, editor — roles that can hold edit permissions */
  canPotentiallyEdit: boolean
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
  const canPotentiallyEdit = ['admin', 'program_manager', 'editor'].includes(role ?? '')

  return {
    profile,
    role,
    isAdmin: role === 'admin',
    isProgramManager: role === 'program_manager',
    isEditor: role === 'editor',
    isGestor: role === 'editor',
    isSponsor: role === 'sponsor',
    isStakeholder: role === 'stakeholder',
    isViewer: !canPotentiallyEdit && role !== null,
    canPotentiallyEdit,
    loading,
  }
}
