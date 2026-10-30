import * as Storage from "@/services/deviceStorage";
import { bareApiClient } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";

export async function unregisterPushDevice() {
  const accessToken = useAuthStore.getState().token?.accessToken;
  const deviceId = await Storage.getItemAsync("movevn.push.deviceId");
  if (deviceId && accessToken) await bareApiClient.delete(`/api/notifications/push-devices/${encodeURIComponent(deviceId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000,
  });
}
