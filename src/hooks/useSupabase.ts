/**
 * Strategos PMO — Custom Data Hooks
 *
 * React hooks that wrap Supabase client calls.
 * Each hook manages loading state and error handling.
 */

import { useState, useEffect } from 'react';
import * as SBClient from '../lib/supabase-client';
import type { Activity, PDSEntry, UserMetadata, Snapshot } from '../types';

// ── Generic Hook Types ──────────────────────────────────────────

export interface UseQueryState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

// ── ACTIVITIES / GANTT ──────────────────────────────────────────

export function useActivities(filters?: {
    n0?: string;
    n1?: string;
}): UseQueryState<Activity[]> {
    const [state, setState] = useState<UseQueryState<Activity[]>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let isMounted = true;

        const fetchActivities = async () => {
            try {
                setState((prev) => ({ ...prev, loading: true, error: null }));
                const data = await SBClient.getActivities(filters);

                if (isMounted) {
                    setState({ data, loading: false, error: null });
                }
            } catch (err) {
                if (isMounted) {
                    setState({
                        data: null,
                        loading: false,
                        error: err instanceof Error ? err : new Error(String(err)),
                    });
                }
            }
        };

        fetchActivities();

        return () => {
            isMounted = false;
        };
    }, [filters?.n0, filters?.n1]);

    return state;
}

// ── PDS ENTRIES ─────────────────────────────────────────────────

export function usePDSEntries(filters?: {
    n0?: string;
    n1?: string;
}): UseQueryState<PDSEntry[]> {
    const [state, setState] = useState<UseQueryState<PDSEntry[]>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let isMounted = true;

        const fetchPDS = async () => {
            try {
                setState((prev) => ({ ...prev, loading: true, error: null }));
                const data = await SBClient.getPDSEntries(filters);

                if (isMounted) {
                    setState({ data, loading: false, error: null });
                }
            } catch (err) {
                if (isMounted) {
                    setState({
                        data: null,
                        loading: false,
                        error: err instanceof Error ? err : new Error(String(err)),
                    });
                }
            }
        };

        fetchPDS();

        return () => {
            isMounted = false;
        };
    }, [filters?.n0, filters?.n1]);

    return state;
}

// ── USER PROFILE ────────────────────────────────────────────────

export function useUserProfile(userId?: string): UseQueryState<UserMetadata> {
    const [state, setState] = useState<UseQueryState<UserMetadata>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!userId) {
            setState({ data: null, loading: false, error: null });
            return;
        }

        let isMounted = true;

        const fetchUser = async () => {
            try {
                setState((prev) => ({ ...prev, loading: true, error: null }));
                const data = await SBClient.getUserMetadata(userId);

                if (isMounted) {
                    setState({ data, loading: false, error: null });
                }
            } catch (err) {
                if (isMounted) {
                    setState({
                        data: null,
                        loading: false,
                        error: err instanceof Error ? err : new Error(String(err)),
                    });
                }
            }
        };

        fetchUser();

        return () => {
            isMounted = false;
        };
    }, [userId]);

    return state;
}

// ── SNAPSHOTS ───────────────────────────────────────────────────

export function useSnapshots(): UseQueryState<Snapshot[]> {
    const [state, setState] = useState<UseQueryState<Snapshot[]>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let isMounted = true;

        const fetchSnapshots = async () => {
            try {
                setState((prev) => ({ ...prev, loading: true, error: null }));
                const data = await SBClient.getSnapshots();

                if (isMounted) {
                    setState({ data, loading: false, error: null });
                }
            } catch (err) {
                if (isMounted) {
                    setState({
                        data: null,
                        loading: false,
                        error: err instanceof Error ? err : new Error(String(err)),
                    });
                }
            }
        };

        fetchSnapshots();

        return () => {
            isMounted = false;
        };
    }, []);

    return state;
}

// ── AUTH ────────────────────────────────────────────────────────

export function useAuth() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            try {
                const currentSession = await SBClient.getSession();
                if (isMounted) {
                    setSession(currentSession);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error(String(err)));
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        checkSession();

        // Listen for auth changes
        const {
            data: { subscription },
        } = SBClient.onAuthStateChange((_event, currentSession) => {
            if (isMounted) {
                setSession(currentSession);
            }
        });

        return () => {
            isMounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    return {
        session,
        loading,
        error,
        signIn: SBClient.signIn,
        signOut: SBClient.signOut,
    };
}
