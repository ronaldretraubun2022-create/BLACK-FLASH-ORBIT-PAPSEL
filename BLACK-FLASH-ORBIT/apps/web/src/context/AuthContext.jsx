import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { recoverStaleRefreshToken } from "../lib/authRecovery";
import { insertRegisteredUserProfile } from "../services/profile";

const AuthContext = createContext(null);
const TOKEN_REFRESH_WINDOW_MS = 60000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    getFreshAuthSession()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
        }
      })
      .catch(async (authError) => {
        await recoverStaleRefreshToken(authError);

        if (isMounted) {
          setSession(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      async signIn({ email, password }) {
        if (!supabase) throw new Error("Supabase environment is not configured.");

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setSession(data.session ?? null);

        return data;
      },
      async signUp({ email, password }) {
        if (!supabase) throw new Error("Supabase environment is not configured.");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        let profileError = null;

        if (data.user) {
          try {
            await insertRegisteredUserProfile(data.user);
          } catch (insertError) {
            profileError = insertError;
          }
        }

        return { ...data, profileError };
      },
      async signOut() {
        if (!supabase) return;

        const { error } = await supabase.auth.signOut();

        if (error) throw error;
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function getFreshAuthSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    if (await recoverStaleRefreshToken(error)) return null;

    throw error;
  }

  const session = data.session;

  if (!session?.access_token) return null;

  if (shouldRefreshSession(session)) {
    return refreshAuthSession();
  }

  return session;
}

function shouldRefreshSession(session) {
  const expiresAtMs = Number(session?.expires_at || 0) * 1000;

  if (!expiresAtMs) return true;

  return expiresAtMs - Date.now() <= TOKEN_REFRESH_WINDOW_MS;
}

async function refreshAuthSession() {
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    if (await recoverStaleRefreshToken(error)) return null;

    throw error;
  }

  return data.session ?? null;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
