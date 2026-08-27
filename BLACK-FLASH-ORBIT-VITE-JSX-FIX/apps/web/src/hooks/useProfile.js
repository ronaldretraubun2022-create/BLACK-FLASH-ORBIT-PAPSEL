import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../context/AuthContext";
import { clearProfileCache, ensureUserProfile } from "../services/profile";

const ProfileContext = createContext(null);

function createFallbackProfile(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: "user",
  };
}

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(userId));

  const loadProfile = useCallback(
    async ({ force = false } = {}) => {
      if (!userId) {
        setProfile(null);
        setError("");
        setIsLoading(false);
        return null;
      }

      const profileUser = {
        id: userId,
        email: userEmail,
      };

      setIsLoading(true);
      setError("");

      try {
        if (force) clearProfileCache(profileUser);

        const nextProfile = await ensureUserProfile(profileUser, { force });
        setProfile(nextProfile);
        return nextProfile;
      } catch (profileError) {
        const fallbackProfile = createFallbackProfile(profileUser);
        setProfile(fallbackProfile);
        setError(profileError?.message || "Profile unavailable.");
        return fallbackProfile;
      } finally {
        setIsLoading(false);
      }
    },
    [userEmail, userId],
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      error,
      isLoading,
      profile,
      refreshProfile: () => loadProfile({ force: true }),
    }),
    [error, isLoading, loadProfile, profile],
  );

  return createElement(ProfileContext.Provider, { value }, children);
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile must be used inside ProfileProvider.");
  }

  return context;
}
