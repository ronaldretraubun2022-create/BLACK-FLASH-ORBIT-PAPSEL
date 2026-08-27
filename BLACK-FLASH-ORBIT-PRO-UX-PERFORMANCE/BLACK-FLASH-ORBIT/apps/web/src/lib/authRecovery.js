import { supabase } from "./supabase";

const AUTH_EXPIRED_MESSAGE = "Session login kedaluwarsa. Silakan login ulang.";
let authRecoveryPromise = null;

export function isStaleRefreshTokenError(error) {
  const message = [
    error?.code,
    error?.error,
    error?.error_description,
    error?.message,
    error?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("refresh_token_not_found") ||
    message.includes("refresh_token_already_used") ||
    (message.includes("refresh token") &&
      (message.includes("invalid") ||
        message.includes("not found") ||
        message.includes("already used") ||
        message.includes("expired")))
  );
}

export function createSessionExpiredError() {
  return new Error(AUTH_EXPIRED_MESSAGE);
}

export async function recoverStaleRefreshToken(error) {
  if (!isStaleRefreshTokenError(error)) return false;

  await clearAuthSessionAndRedirect();
  return true;
}

export async function clearAuthSessionAndRedirect() {
  if (!authRecoveryPromise) {
    authRecoveryPromise = runAuthRecovery().finally(() => {
      authRecoveryPromise = null;
    });
  }

  return authRecoveryPromise;
}

async function runAuthRecovery() {
  try {
    await supabase?.auth?.signOut?.({ scope: "local" });
  } catch {
    // Local storage cleanup below is the fallback when Supabase signOut fails.
  }

  clearStoredAuthState();
  redirectToLogin();
}

function clearStoredAuthState() {
  if (typeof window === "undefined") return;

  try {
    clearAuthStorage(window.localStorage);
  } catch {
    // Ignore storage access errors in private or locked-down browser contexts.
  }

  try {
    clearAuthStorage(window.sessionStorage);
  } catch {
    // Ignore storage access errors in private or locked-down browser contexts.
  }
}

function clearAuthStorage(storage) {
  if (!storage) return;

  const keys = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key) keys.push(key);
  }

  keys.forEach((key) => {
    if (isAuthStorageKey(key)) {
      storage.removeItem(key);
    }
  });
}

function isAuthStorageKey(key) {
  return (
    key === "orbit_access_token" ||
    (key.startsWith("sb-") &&
      (key.includes("auth-token") || key.includes("code-verifier"))) ||
    key.startsWith("supabase.auth.token")
  );
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;

  window.location.replace("/login");
}
