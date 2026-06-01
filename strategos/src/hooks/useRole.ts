import { useProfile } from '../context/ProfileContext'

type Role = 'admin' | 'program_manager' | 'editor' | 'sponsor' | 'stakeholder'

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
  const { profile: profileData, loading } = useProfile()

  const profile: Profile | null = profileData
    ? {
        id:         profileData.id,
        email:      profileData.email,
        full_name:  profileData.fullName || null,
        role:       profileData.role as Role,
        avatar_url: null,
      }
    : null

  const role = profile?.role ?? null
  const canPotentiallyEdit = ['admin', 'program_manager', 'editor'].includes(role ?? '')

  return {
    profile,
    role,
    isAdmin:          role === 'admin',
    isProgramManager: role === 'program_manager',
    isEditor:         role === 'editor',
    isGestor:         role === 'editor',
    isSponsor:        role === 'sponsor',
    isStakeholder:    role === 'stakeholder',
    isViewer:         !canPotentiallyEdit && role !== null,
    canPotentiallyEdit,
    loading,
  }
}
