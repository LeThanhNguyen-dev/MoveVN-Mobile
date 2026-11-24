import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import i18n from "@/i18n";
import { bareApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import * as SecureStore from "@/services/deviceStorage";
import { authSessionStorageKey, useAuthStore } from "@/features/auth/hooks/useAuth";
import type { ApiResponse, AuthResponse, AuthSession } from "@/features/auth/types";
import { useGpsStore } from "./gpsStore";
import {
  clearActivePublishTarget,
  clearStoredConsent,
  getActivePublishTarget,
  setStoredConsent,
} from "./gpsConsentStorage";
import type { GpsPointRequest } from "./types";

/** Tên task của expo-task-manager — trùng giữa lúc defineTask và startLocationUpdatesAsync. */
export const GPS_TASK_NAME = "movevn-gps-publisher";

/** Lấy điểm mới mỗi ~8s — cân bằng giữa realtime và pin. */
export const GPS_WATCH_INTERVAL_MS = 8_000;
/** Khi mất mạng giữ tối đa số điểm này để gửi lại (theo thứ tự cũ → mới). */
const OFFLINE_BUFFER_LIMIT = 20;
/** Dưới ngưỡng này (kèm dịch chuyển nhỏ) coi như điện thoại đang đứng yên. */
const STATIONARY_SPEED_KMH = 3;
/** Sàn bán kính quanh mốc đỗ: nhiễu GPS trong bán kính này không tính là "đã chạy". */
const STATIONARY_RADIUS_M = 15;
/** Trần bán kính ghim: accuracy báo sai (trong hầm/toà nhà) không được nuốt cả trăm mét. */
const MAX_STATIONARY_RADIUS_M = 100;

type GpsPublishRuntime = {
  /** Điểm chờ gửi (chỉ giữ khi request lỗi mạng). */
  buffer: GpsPointRequest[];
  inFlight: boolean;
  /** Điểm hợp lệ gần nhất — gửi lại làm heartbeat khi đứng yên. */
  lastPoint: GpsPointRequest | null;
  /** Mốc đỗ: điểm đầu tiên lúc điện thoại đứng yên (để ghim các điểm nhiễu sau đó). */
  parked: { latitude: number; longitude: number } | null;
};

/**
 * Khi app mở, hook và task dùng chung module scope này; khi app bị đóng, task
 * chạy trong tiến trình headless với state riêng khởi tạo lại từ đầu.
 */
export const gpsRuntime: GpsPublishRuntime = {
  buffer: [],
  inFlight: false,
  lastPoint: null,
  parked: null,
};

export function resetGpsRuntime() {
  gpsRuntime.buffer = [];
  gpsRuntime.inFlight = false;
  gpsRuntime.lastPoint = null;
  gpsRuntime.parked = null;
}

/**
 * Dung sai quanh mốc đỗ = 2×sai số GPS (phủ phần lớn nhiễu jitter), sàn 15m, trần 100m.
 * Trần thấp hơn mức nhiễu thật (vd 50m khi accuracy 80m) thì một nửa số điểm lọt qua
 * thành đường ngoằn ngoèo và quãng đường ảo.
 */
export function pinRadiusMeters(accuracy: number | null | undefined): number {
  return Math.min(MAX_STATIONARY_RADIUS_M, Math.max(STATIONARY_RADIUS_M, 2 * (accuracy ?? 0)));
}

/** Khoảng cách (m) giữa 2 toạ độ — đủ chính xác cho ngưỡng vài mét. */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Chuẩn hoá một fix GPS thành điểm gửi server, ghim nhiễu quanh mốc đỗ. */
export function buildGpsPoint(location: Location.LocationObject): GpsPointRequest {
  const coords = location.coords;
  const speedKmh = coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : null;

  // Điện thoại đặt yên một chỗ mà xoay/xê dịch vẫn cho ra toạ độ nhảy 10–30 m
  // (multipath + accuracy thấp). Ghim về mốc đỗ: chủ xe không thấy xe "nhảy
  // lung tung" quanh một điểm, và backend không cộng quãng đường ảo.
  const parked = gpsRuntime.parked;
  const looksStationary =
    (speedKmh == null || speedKmh < STATIONARY_SPEED_KMH) &&
    (parked == null ||
      distanceMeters(parked.latitude, parked.longitude, coords.latitude, coords.longitude) <=
        pinRadiusMeters(coords.accuracy));

  let latitude = coords.latitude;
  let longitude = coords.longitude;
  let speed = speedKmh;
  if (looksStationary) {
    const anchor = parked ?? { latitude: coords.latitude, longitude: coords.longitude };
    gpsRuntime.parked = anchor;
    latitude = anchor.latitude;
    longitude = anchor.longitude;
    speed = 0;
  } else {
    // Đã chạy thật khỏi mốc → nhả ghim, lấy toạ độ mới làm chuẩn.
    gpsRuntime.parked = null;
  }

  return {
    latitude,
    longitude,
    speedKmh: speed,
    accuracyMeters: coords.accuracy,
    heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
    isMock: Boolean((location as unknown as { mocked?: boolean }).mocked),
    status: "ok",
    clientTimestamp: new Date(location.timestamp || Date.now()).toISOString(),
  };
}

export function enqueueGpsPoint(point: GpsPointRequest) {
  gpsRuntime.lastPoint = point;
  gpsRuntime.buffer.push(point);
  if (gpsRuntime.buffer.length > OFFLINE_BUFFER_LIMIT) {
    gpsRuntime.buffer = gpsRuntime.buffer.slice(-OFFLINE_BUFFER_LIMIT);
  }
}

/** Gửi lại điểm cuối với thời gian mới để server giữ kết nối khi xe đứng yên. */
export function enqueueHeartbeat() {
  if (!gpsRuntime.lastPoint) return false;
  enqueueGpsPoint({ ...gpsRuntime.lastPoint, clientTimestamp: new Date().toISOString() });
  return true;
}

async function readStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(authSessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.token?.accessToken && parsed.token.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

async function currentTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const memory = useAuthStore.getState().token;
  if (memory?.accessToken && memory.refreshToken) return memory;
  const stored = (await readStoredSession())?.token;
  return stored ? { accessToken: stored.accessToken, refreshToken: stored.refreshToken } : null;
}

let refreshInFlight: Promise<string | null> | null = null;

/** Access token sống 60 phút — chuyến dài phải tự refresh ngay trong tiến trình nền. */
function refreshAccessToken(refreshToken: string): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await bareApiClient.post<ApiResponse<AuthResponse>>(
        endpoints.auth.refreshToken,
        { refreshToken },
      );
      const data = res.data.data;
      if (!data?.token?.accessToken || !data.user) return null;
      // Ghi lại cả SecureStore để lần chạy nền sau dùng token mới.
      await useAuthStore.getState().setSession({ token: data.token, user: data.user });
      return data.token.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function resolveStoreBookingId(): number | null {
  const state = useGpsStore.getState();
  if (state.activePublishBookingId == null) return null;
  return state.publishSharingState === "sharing" ? state.activePublishBookingId : null;
}

async function resolveBookingId(explicit?: number | null): Promise<number | null> {
  if (explicit != null) return explicit;
  const state = useGpsStore.getState();
  // App đang mở và khách đã dừng chia sẻ → không gửi, kể cả khi bản lưu trên máy chưa kịp xoá.
  if (state.activePublishBookingId != null) return resolveStoreBookingId();
  return getActivePublishTarget();
}

function syncStoreAfterPublish(bookingId: number) {
  const store = useGpsStore.getState();
  if (store.activePublishBookingId !== bookingId) return;
  store.setPublishError(null);
  store.markPublished();
}

async function markEnded(bookingId: number) {
  gpsRuntime.buffer = [];
  await clearStoredConsent(bookingId);
  await clearActivePublishTarget();
  const store = useGpsStore.getState();
  if (store.activePublishBookingId === bookingId) {
    store.setActivePublishBooking(null);
    store.setPublishSharingState("ended");
    store.setPublishError(null);
  }
  await stopGpsTask();
}

async function markPaused(bookingId: number) {
  gpsRuntime.buffer = [];
  await setStoredConsent(bookingId, "declined");
  const store = useGpsStore.getState();
  if (store.activePublishBookingId === bookingId) {
    store.setPublishSharingState("paused");
    store.setPublishError(null);
  }
  await stopGpsTask();
}

/** Quản trị viên tắt chức năng: dừng gửi, giữ lựa chọn đồng ý để bật lại sẽ tiếp tục. */
async function markFeatureDisabled(bookingId: number) {
  gpsRuntime.buffer = [];
  resetGpsRuntime();
  await clearActivePublishTarget();
  const store = useGpsStore.getState();
  if (store.activePublishBookingId === bookingId) {
    store.setPublishSharingState("notShared");
    store.setPublishError(null);
  }
  await stopGpsTask();
}

function errorCodeOf(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

type PostOutcome = { kind: "ok" } | { kind: "unauthorized" } | { kind: "ended" | "paused" | "disabled" | "retry" };

async function postPoints(bookingId: number, points: GpsPointRequest[], accessToken: string): Promise<PostOutcome> {
  try {
    await bareApiClient.post(
      endpoints.tracking.postLocation(bookingId),
      { points },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return { kind: "ok" };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401) return { kind: "unauthorized" };
    const code = errorCodeOf(error);
    // Chuyến đã kết thúc/bị hủy (server từ chối) → ngừng gửi im lặng.
    if (code === "GPS_13001" || code === "GPS_13003") return { kind: "ended" };
    // Khách đã dừng chia sẻ (server đã ghi nhận) → đồng bộ lại trạng thái.
    if (code === "GPS_13005") return { kind: "paused" };
    // Quản trị viên tắt chức năng → ngừng gửi, không giữ điểm chờ gửi lại.
    if (code === "GPS_13006") return { kind: "disabled" };
    return { kind: "retry" };
  }
}

/**
 * Gửi các điểm đang chờ. An toàn khi gọi chồng: request chưa xong thì bỏ lượt này,
 * buffer giữ nguyên để lần sau gửi.
 */
export async function flushGpsBuffer(explicitBookingId?: number | null): Promise<void> {
  if (gpsRuntime.inFlight) return;
  const bookingId = await resolveBookingId(explicitBookingId);
  if (bookingId == null || gpsRuntime.inFlight || gpsRuntime.buffer.length === 0) return;

  gpsRuntime.inFlight = true;
  const points = gpsRuntime.buffer;
  gpsRuntime.buffer = [];
  try {
    const tokens = await currentTokens();
    if (!tokens) {
      await stopGpsTask();
      return;
    }

    let outcome = await postPoints(bookingId, points, tokens.accessToken);
    if (outcome.kind === "unauthorized") {
      const accessToken = await refreshAccessToken(tokens.refreshToken);
      if (!accessToken) {
        // Phiên hết hạn hẳn (logout/refresh token chết) → dừng dịch vụ nền.
        await stopGpsTask();
        return;
      }
      outcome = await postPoints(bookingId, points, accessToken);
    }

    if (outcome.kind === "ok") {
      syncStoreAfterPublish(bookingId);
      return;
    }
    if (outcome.kind === "ended") {
      await markEnded(bookingId);
      return;
    }
    if (outcome.kind === "paused") {
      await markPaused(bookingId);
      return;
    }
    if (outcome.kind === "disabled") {
      await markFeatureDisabled(bookingId);
      return;
    }

    // Mất mạng: giữ lại tối đa OFFLINE_BUFFER_LIMIT điểm gần nhất để gửi lần sau.
    gpsRuntime.buffer = [...points, ...gpsRuntime.buffer].slice(-OFFLINE_BUFFER_LIMIT);
    const store = useGpsStore.getState();
    if (store.activePublishBookingId === bookingId) {
      store.setPublishError(i18n.t("mobile:gps.publisher.sendFailed"));
    }
  } finally {
    gpsRuntime.inFlight = false;
  }
}

export async function hasGpsTaskStarted(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  } catch {
    return false;
  }
}

export async function stopGpsTask(): Promise<void> {
  try {
    if (await hasGpsTaskStarted()) await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  } catch {
    // Task chưa từng chạy hoặc platform không hỗ trợ — không có gì phải dừng.
  }
}

/**
 * Android: dịch vụ chạy nền (foreground service type "location") + thông báo thường trực,
 * GPS vẫn gửi khi khoá màn hình. iOS: cần quyền "Always" + UIBackgroundModes location.
 */
export async function startGpsTask(notification: { title: string; body: string }): Promise<void> {
  if (Platform.OS === "web") return;
  if (await hasGpsTaskStarted()) return;
  await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: GPS_WATCH_INTERVAL_MS,
    // 0 = nhận cả khi đứng yên (heartbeat), không chỉ khi đi đủ xa.
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: notification.title,
      notificationBody: notification.body,
    },
  });
}

type GpsTaskData = { locations?: Location.LocationObject[] };

if (Platform.OS !== "web") {
  TaskManager.defineTask<GpsTaskData>(GPS_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const locations = data?.locations ?? [];
    if (locations.length === 0) return;
    for (const location of locations) {
      enqueueGpsPoint(buildGpsPoint(location));
    }
    await flushGpsBuffer();
  });
}
