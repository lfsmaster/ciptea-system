/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import type { Profile, Role } from '../../types/domain';

interface AuthContextValue { session: Session | null; user: User | null; profile: Profile | null; roles: Role[]; loading: boolean; configured: boolean; signOut: () => Promise<void>; refreshProfile: () => Promise<void>; }
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId?: string) => {
    if (!supabase || !userId) { setProfile(null); return; }
    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setProfile(row ? { ...row, roles: row.roles || [] } : null);
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      try { await loadProfile(data.session?.user.id); } finally { setLoading(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      await loadProfile(next?.user.id);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    session, user: session?.user ?? null, profile, roles: profile?.roles ?? [], loading, configured: isSupabaseConfigured,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
    refreshProfile: async () => loadProfile(session?.user.id)
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider'); return value; }
