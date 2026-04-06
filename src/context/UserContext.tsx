import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth, useUserProfile } from '../hooks/useSupabase'
import type { UserMetadata } from '../types'

interface UserContextValue {
    user: UserMetadata | null
    session: any
    loading: boolean
    error: Error | null
    signIn: (email: string, password: string) => Promise<any>
    signOut: () => Promise<void>
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
    const auth = useAuth()
    const profile = useUserProfile(auth.session?.user?.id)

    const value = useMemo(
        () => ({
            user: profile.data,
            session: auth.session,
            loading: auth.loading || profile.loading,
            error: auth.error || profile.error,
            signIn: auth.signIn,
            signOut: auth.signOut,
        }),
        [
            auth.loading,
            auth.session,
            auth.error,
            auth.signIn,
            auth.signOut,
            profile.data,
            profile.loading,
            profile.error,
        ]
    )

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
    const context = useContext(UserContext)
    if (!context) {
        throw new Error('useUser must be used within UserProvider')
    }
    return context
}
