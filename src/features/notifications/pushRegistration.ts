import Constants from "expo-constants";
import * as Device from "expo-device";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import * as Storage from "@/services/deviceStorage";
import { apiClient, bareApiClient } from "@/services/apiClient";
import { getSessionGeneration, useAuthStore } from "@/features/auth/hooks/useAuth";
import { unregisterPushDevice } from "./pushDeviceService";

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
      const local = notification.request.content.data?.localBooking === true;
      return { shouldShowBanner: local, shouldShowList: true, shouldPlaySound: local, shouldSetBadge: false };
    } });
    if (Platform.OS === "android") await notifications.setNotificationChannelAsync("bookings-demo", {
      name: "Thông báo đơn thuê", importance: notifications.AndroidImportance.HIGH,
      sound: "default", vibrationPattern: [0, 250, 250, 250],
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
  if (Platform.OS === "web" || !Device.isDevice || Constants.executionEnvironment === "storeClient") return null;
  return import("expo-notifications");
}

export function registerPushDevice() {
  const generation = getSessionGeneration();
  const owner = useAuthStore.getState().user?.userId;
  const operation = registration.catch(() => undefined).then(async () => {
    if (Constants.expoConfig?.extra?.remotePushEnabled !== true) return;
    const notifications = await loadPushNotifications();
    if (!notifications || !owner || generation !== getSessionGeneration()) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    if (Platform.OS === "android") await notifications.setNotificationChannelAsync("bookings", {
      name: "Đơn thuê và bàn giao xe", importance: notifications.AndroidImportance.HIGH,
      sound: "default", vibrationPattern: [0, 250, 250, 250],
    });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
    if (!permission.granted) { await unregisterPushDevice(); return; }
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
