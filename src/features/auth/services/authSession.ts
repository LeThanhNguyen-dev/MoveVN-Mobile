import { clearSession, getSessionGeneration, initializeAuthSession, setSession, useAuthStore } from "../hooks/useAuth";
import { getCurrentUser, logout, toApiError } from "./authService";
import { refreshAuthSession } from "@/services/apiClient";
import type { AuthResponse } from "../types";

let restoring: Promise<void> | null = null;

export function restoreSession() {
  if (restoring) return restoring;
  restoring = (async () => {
    await initializeAuthSession();
    const token = useAuthStore.getState().token;
    const expected = getSessionGeneration();
    if (token) {
      try {
        if (Date.parse(token.accessTokenExpiresAt) <= Date.now()) await refreshAuthSession();
        const user = await getCurrentUser();
        if (!user) throw new Error("Missing current user.");
        if (expected === getSessionGeneration()) await useAuthStore.getState().updateUser(user);
      } catch (error) {
        const code = toApiError(error).code;
        if (["AUTH_1020", "AUTH_1021", "401", "403"].includes(code)) await clearSession();
        else if (useAuthStore.getState().token) throw error;
      }
    }
    useAuthStore.setState({ isHydrated: true });
  })().finally(() => { restoring = null; });
  return restoring;
}

export async function completeSignIn(result: AuthResponse) {
  if (!result?.token?.accessToken || !result?.token?.refreshToken || !result.user) {
    throw new Error("Invalid authentication response.");
  }
  await setSession(result);
}

export async function signOut() {
  const token = useAuthStore.getState().token;
  const clearing = clearSession();
  const revoking = token ? logout(token.refreshToken, token.accessToken) : Promise.resolve();
  const results = await Promise.allSettled([clearing, revoking]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
}
