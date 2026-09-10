import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { AuthSession, AuthState, AuthUser, UserRole } from "@/features/auth/types";

const sessionKey = "movevn.auth.session";
const activeRoleKey = "movevn.auth.activeRole";
const emptySession: AuthSession = { token: null, user: null };
const rolePriority: UserRole[] = ["Admin", "Staff", "Owner", "Customer"];
let generation = 0;
let storageQueue: Promise<void> = Promise.resolve();
let hydration: Promise<AuthSession> | null = null;

function roleFor(user: AuthUser | null, preferred: UserRole | null): UserRole | null {
  const roles = user?.roles ?? [];
  return preferred && roles.includes(preferred)
    ? preferred : rolePriority.find((role) => roles.includes(role)) ?? null;
}

function persist(session: AuthSession, role: UserRole | null) {
  // Serialize writes so an older refresh cannot overwrite a later logout.
  const operation = storageQueue.then(async () => {
    if (session.token) {
      await SecureStore.setItemAsync(sessionKey, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(sessionKey);
    }
    if (role) await SecureStore.setItemAsync(activeRoleKey, role);
    else await SecureStore.deleteItemAsync(activeRoleKey);
    useAuthStore.setState({ storageError: null });
  });
  storageQueue = operation.catch(() => {
    useAuthStore.setState({ storageError: "Không thể cập nhật phiên đăng nhập trên thiết bị." });
  });
  return operation;
}

export const useAuthStore = create<AuthState & { storageError: string | null }>((set, get) => ({
  ...emptySession,
  isHydrated: false,
  activeRole: null,
  storageError: null,
  setSession: async (session) => {
    const expected = generation;
    const activeRole = roleFor(session.user, get().activeRole);
    await persist(session, activeRole);
    if (expected !== generation) throw new Error("Session changed.");
    set({ ...session, activeRole });
  },
  updateUser: async (user) => {
    const expected = generation;
    const session = { token: get().token, user };
    const activeRole = roleFor(user, get().activeRole);
    await persist(session, activeRole);
    if (expected === generation) set({ user, activeRole });
  },
  setActiveRole: async (role) => {
    if (!(get().user?.roles ?? []).includes(role)) return;
    const expected = generation;
    await persist({ token: get().token, user: get().user }, role);
    if (expected === generation) set({ activeRole: role });
  },
  clearSession: () => {
    generation += 1;
    set({ ...emptySession, activeRole: null });
    return persist(emptySession, null);
  },
}));

export function initializeAuthSession(): Promise<AuthSession> {
  if (hydration) return hydration;
  const expected = generation;
  hydration = (async () => {
    const [raw, role] = await Promise.all([
      SecureStore.getItemAsync(sessionKey), SecureStore.getItemAsync(activeRoleKey),
    ]);
    let session: AuthSession = emptySession;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed?.token?.accessToken || !parsed?.token?.refreshToken ||
            typeof parsed.token.sessionId !== "string" ||
            (parsed.user !== null && !Array.isArray(parsed.user?.roles))) throw new Error("Invalid session.");
        session = parsed;
      } catch {
        await persist(emptySession, null);
      }
    }
    if (expected === generation) {
      useAuthStore.setState({ ...session, activeRole: roleFor(session.user, role as UserRole | null) });
    }
    return expected === generation ? session : emptySession;
  })().catch((error) => { hydration = null; throw error; });
  return hydration;
}

export const setSession = (session: AuthSession) => useAuthStore.getState().setSession(session);
export const clearSession = () => useAuthStore.getState().clearSession();
export const getToken = () => useAuthStore.getState().token?.accessToken ?? null;
export const getRefreshToken = () => useAuthStore.getState().token?.refreshToken ?? null;
export const getAuthUser = () => useAuthStore.getState().user;
export const getSessionGeneration = () => generation;
