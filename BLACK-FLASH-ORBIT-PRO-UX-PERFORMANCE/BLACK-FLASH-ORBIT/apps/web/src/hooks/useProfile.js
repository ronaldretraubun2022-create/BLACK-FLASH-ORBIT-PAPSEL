import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { clearProfileCache, ensureUserProfile } from "../services/profile";

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(user));

  const loadProfile = useCallback(
    async ({ force = false } = {}) => {
      if (!user) {
        setProfile(null);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        if (force) clearProfileCache(user);
        setProfile(await ensureUserProfile(user, { force }));
      } catch (profileError) {
        setProfile({
          id: user.id,
          email: user.email,
          role: "user",
        });
        setError(profileError.message);
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    error,
    isLoading,
    profile,
    refreshProfile: () => loadProfile({ force: true }),
  };
}
