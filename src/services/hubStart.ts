import { clearSession, getAuthUser, getToken, useAuthStore } from "@/features/auth/hooks/useAuth";
import { refreshAuthSession } from "@/services/apiClient";

const lastFailureByHub = new Map<string, number>();
const RETRY_COOLDOWN_MS = 60_000;
const EXPIRY_SKEW_MS = 30_000;

function isUnauthorized(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 401;
}

function accessTokenExpiresAtMs(): number | null {
  const expiresAt = useAuthStore.getState().token?.accessTokenExpiresAt;
  if (!expiresAt) return null;
  const parsed = Date.parse(expiresAt);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Token cho SignalR negotiate. Nếu access token hết hạn (hoặc sắp hết) thì
 * refresh trước, tránh negotiate 401 lặp lại khi reconnect. Refresh hỏng vì
 * phiên chết thì đăng xuất để user đăng nhập lại.
 */
export async function getHubAccessToken(): Promise<string> {
  const current = getToken();
  if (!current) return "";
  const expiresAt = accessTokenExpiresAtMs();
  if (expiresAt != null && expiresAt - Date.now() > EXPIRY_SKEW_MS) {
    return current;
  }
  try {
    const refreshed = await refreshAuthSession();
    return refreshed.token.accessToken;
  } catch (error) {
    if (isUnauthorized(error)) {
      await clearSession().catch(() => undefined);
    }
    return getToken() ?? "";
  }
}

/**
 * Chạy HubConnection.start() có phục hồi auth: thất bại thì refresh token 1 lần
 * rồi thử lại 1 lần. Giới hạn 1 chu kỳ/phút. Nếu chính refresh cũng 401
 * (phiên chết hẳn) thì đăng xuất để user đăng nhập lại thay vì kẹt.
 */
export async function startHubWithAuthRecovery(
  hubKey: string,
  expectedUserId: number,
  start: () => Promise<void>,
): Promise<boolean> {
  try {
    await start();
    return true;
  } catch {
    if (Date.now() - (lastFailureByHub.get(hubKey) ?? 0) < RETRY_COOLDOWN_MS) return false;
    lastFailureByHub.set(hubKey, Date.now());
    try {
      await refreshAuthSession();
    } catch (refreshErr) {
      if (isUnauthorized(refreshErr)) {
        await clearSession().catch(() => undefined);
      }
      return false;
    }
    const freshToken = getToken();
    const freshUser = getAuthUser();
    if (!freshToken || !freshUser || freshUser.userId !== expectedUserId) return false;
    try {
      await start();
      return true;
    } catch {
      return false;
    }
  }
}
