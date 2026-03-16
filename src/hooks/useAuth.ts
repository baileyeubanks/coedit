import { useEffect, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  justSignedIn: boolean;  // true for the single tick after SIGNED_IN event
}

export function useAuth(): AuthState {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(isSupabaseConfigured);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN') {
        setJustSignedIn(true);
        // Reset the flag after one render cycle so it doesn't persist
        setTimeout(() => setJustSignedIn(false), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading, justSignedIn };
}

