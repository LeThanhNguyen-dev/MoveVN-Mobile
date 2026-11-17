import Constants from "expo-constants";
import * as Device from "expo-device";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import * as Storage from "@/services/deviceStorage";
import { apiClient, bareApiClient } from "@/services/apiClient";
import { getSessionGeneration, useAuthStore } from "@/features/auth/hooks/useAuth";
import { unregisterPushDevice } from "./pushDeviceService";
import i18n from "@/i18n";
import { claimSystemNotification, notificationRecipient, NOTIFICATION_CHANNEL_ID } from "./systemNotificationPresentation";

const endpoint = "/api/notifications/push-devices";
let deviceIdPromise: Promise<string> | null = null;
let registration: Promise<void> = Promise.resolve();
let preparing: Promise<typeof import("expo-notifications") | null> | null = null;

export async function loadLocalNotifications() {
  if (Platform.OS === "web") return null;
  return import("expo-notifications");
}

export function prepareLocalNotifications() {
  return preparing ??= (async () => {
    const notifications = await loadLocalNotifications();
    if (!notifications) return null;
    notifications.setNotificationHandler({ handleNotification: async notification => {
      const data = notification.request.content.data ?? {};
      const local = data.localNotification === true || data.localBooking === true;
      const recipient = notificationRecipient(data);
      const currentUserId = useAuthStore.getState().user?.userId;
      // Foreground push and SignalR can arrive in either order. Display exactly one banner.
      const show = Boolean(recipient && recipient.userId === currentUserId && (local || claimSystemNotification(recipient.userId, recipient.notificationId)));
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    } });
    if (Platform.OS === "android") await notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: i18n.t("mobile:notification.channelNotifications"), importance: notifications.AndroidImportance.HIGH,
      // Omit sound to use Android's system default. Channel sound strings are
      // bundled resource filenames; "default" is only valid for notification content.
      vibrationPattern: [0, 250, 250, 250],
    });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
    return permission.granted ? notifications : null;
  })().finally(() => { preparing = null; });
}

export function getPushDeviceId() {
  return deviceIdPromise ??= (async () => {
    const saved = await Storage.getItemAsync("movevn.push.deviceId");
    if (saved) return saved;
    const id = randomUUID();
    await Storage.setItemAsync("movevn.push.deviceId", id);
    return id;
  })().catch(error => { deviceIdPromise = null; throw error; });
}

export async function loadPushNotifications() {
  // Android emulators with Google Play services support FCM; let token registration
  // report unsupported emulator images rather than rejecting all virtual devices.
  if (Platform.OS === "web" || (Platform.OS !== "android" && !Device.isDevice) || Constants.executionEnvironment === "storeClient") return null;
  return import("expo-notifications");
}

export function registerPushDevice() {
  const generation = getSessionGeneration();
  const owner = useAuthStore.getState().user?.userId;
  const operation = registration.catch(() => undefined).then(async () => {
    if (Constants.expoConfig?.extra?.remotePushEnabled !== true) return;
    if (!await loadPushNotifications() || !owner || generation !== getSessionGeneration()) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Remote push requires EXPO_PUBLIC_EAS_PROJECT_ID. Run npm run push:check for setup details.");
    // Share setup/permission requests with the local presenter; do not show two permission prompts.
    const notifications = await prepareLocalNotifications();
    if (generation !== getSessionGeneration() || useAuthStore.getState().user?.userId !== owner) return;
    if (!notifications) { await unregisterPushDevice(); return; }
    const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
    const deviceId = await getPushDeviceId();
    if (generation !== getSessionGeneration() || useAuthStore.getState().user?.userId !== owner) return;
    const accessToken = useAuthStore.getState().token?.accessToken;
    await apiClient.put(endpoint, { deviceId, token, platform: Platform.OS });
    // If sign-out happened during the request, undo the registration using its original account.
    if (generation !== getSessionGeneration() && accessToken) {
      await bareApiClient.delete(`${endpoint}/${encodeURIComponent(deviceId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    }
  });
  registration = operation;
  return operation;
}
