import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { getGpsSession, postGpsPoints, setGpsSharingConsent } from "./gpsService";
import { useGpsStore } from "./gpsStore";
import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { getMyBookings } from "@/features/booking/bookingService";
import { clearStoredConsent, getStoredConsent, pruneStoredConsents, setStoredConsent } from "./gpsConsentStorage";
import i18n from "@/i18n";
import type { GpsPointRequest } from "./types";

/** Lấy điểm mới mỗi 8s — cân bằng giữa realtime và pin. */
const WATCH_INTERVAL_MS = 8_000;
const WATCH_DISTANCE_M = 8;
/** An toàn: nếu điểm mới chưa đến (đứng yên) thì vẫn flush buffer định kỳ để gửi lại điểm khi mất mạng. */
const RETRY_FLUSH_INTERVAL_MS = 15_000;
/** Heartbeat khi đứng yên: iOS không trả callback nếu không di chuyển, gửi lại điểm cuối
 * mỗi 30s để "Cập nhật lúc" luôn chạy và backend không đánh dấu mất tín hiệu oan. */
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Khi mất mạng giữ tối đa số điểm này để gửi lại (theo thứ tự cũ → mới). */
const OFFLINE_BUFFER_LIMIT = 20;

function errorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

/**
 * Publish GPS cho khách thuê trên app:
 * 1. Tự tìm chuyến đang thuê khi mở lại app và gửi tiếp nếu đã đồng ý trước đó.
 * 2. Khôi phục lựa chọn chia sẻ (SecureStore + session phía máy chủ) — không hỏi lại.
 * 3. Khi publishSharingState = "sharing": xin quyền vị trí, lọc 8m rồi gửi điểm lên backend.
 * Đặt 1 lần trong CustomerNavigator.
 *
 * MVP chỉ track khi app mở (foreground) — iOS/Android siết location nền chặt.
 */
export function useGpsPublisher() {
  const activePublishBookingId = useGpsStore((state) => state.activePublishBookingId);
  const publishSharingState = useGpsStore((state) => state.publishSharingState);
  const userId = useAuthStore((state) => state.user?.userId ?? null);

  const bufferRef = useRef<GpsPointRequest[]>([]);
  const inFlightRef = useRef(false);
  const lastLocationRef = useRef<GpsPointRequest | null>(null);
  const flushRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Reset khi đổi tài khoản: tránh gửi nhầm GPS của booking cũ dưới userId mới.
  useEffect(() => {
    useGpsStore.getState().activate(userId);
  }, [userId]);

  // Mở lại app (không vào lại đơn): tìm chuyến đang thuê và tự gửi tiếp nếu đã đồng ý.
  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const [inProgress, returning] = await Promise.all([
          getMyBookings({ status: "InProgress", page: 1, pageSize: 10 }),
          getMyBookings({ status: "Returning", page: 1, pageSize: 10 }),
        ]);
        if (cancelled) return;
        const activeBookings = [...inProgress.items, ...returning.items];
        // Chuyến đã kết thúc → dọn lựa chọn đã lưu.
        await pruneStoredConsents(activeBookings.map((booking) => booking.id));
        if (cancelled) return;

        const store = useGpsStore.getState();
        if (activeBookings.length === 0) {
          if (store.activePublishBookingId != null) store.setActivePublishBooking(null);
          return;
        }
        // Người dùng đang mở một đơn cụ thể — ưu tiên đơn đó.
        if (store.activePublishBookingId != null) return;

        const grantedBookingId = await findGrantedBooking(activeBookings.map((booking) => booking.id));
        if (cancelled) return;
        if (grantedBookingId != null) {
          useGpsStore.getState().setActivePublishBooking(grantedBookingId);
          return;
        }

        // Thiết bị chưa lưu gì (đổi máy/xóa dữ liệu): hỏi máy chủ phiên nào đang chia sẻ.
        const hasDeclined = await hasDeclinedBooking(activeBookings.map((booking) => booking.id));
        if (cancelled || hasDeclined) return;
        const sessions = await Promise.all(
          activeBookings.map((booking) => getGpsSession(booking.id).catch(() => null)),
        );
        if (cancelled) return;
        const sharing = sessions.find((session) => session?.sharingState === "sharing");
        if (sharing) {
          await setStoredConsent(sharing.bookingId, "granted");
          if (cancelled) return;
          useGpsStore.getState().setActivePublishBooking(sharing.bookingId);
        }
      } catch {
        // Mất mạng: bỏ qua, mở trang chi tiết đơn sẽ kích hoạt lại.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Khôi phục lựa chọn chia sẻ cho booking đang mở (máy chủ thắng bản lưu trên máy).
  useEffect(() => {
    if (activePublishBookingId == null) return;
    const bookingId = activePublishBookingId;
    let cancelled = false;
    void (async () => {
      // Người dùng vừa bấm Đồng ý/Dừng → không ghi đè.
      if (useGpsStore.getState().publishSharingState !== "idle") return;

      let serverSharing: string | null | undefined;
      try {
        const session = await getGpsSession(bookingId);
        serverSharing = session.sharingState;
      } catch (error) {
        // GPS_13003 = chưa có phiên; lỗi khác (mất mạng) = chưa biết, dùng bản lưu trên máy.
        serverSharing = errorCode(error) === "GPS_13003" ? null : undefined;
      }
      if (cancelled) return;

      if (serverSharing === "ended") {
        await clearStoredConsent(bookingId);
        if (cancelled) return;
        useGpsStore.getState().setActivePublishBooking(null);
        useGpsStore.getState().setPublishSharingState("ended");
        return;
      }
      if (serverSharing === "paused") {
        await setStoredConsent(bookingId, "declined");
        if (cancelled) return;
        useGpsStore.getState().setPublishSharingState("paused");
        return;
      }
      if (serverSharing === "declined") {
        await setStoredConsent(bookingId, "declined");
        if (cancelled) return;
        useGpsStore.getState().setPublishSharingState("declined");
        return;
      }
      if (serverSharing === "sharing") {
        await setStoredConsent(bookingId, "granted");
        if (cancelled) return;
        useGpsStore.getState().setPublishSharingState("sharing");
        return;
      }

      const stored = await getStoredConsent(bookingId);
      if (cancelled) return;
      if (stored === "granted") {
        // Đánh dấu đồng ý phía máy chủ trước khi gửi điểm (nếu chưa có phiên).
        try {
          await setGpsSharingConsent(bookingId, true);
        } catch {
          // Mất mạng: cứ chạy, điểm đầu tiên sẽ tạo phiên khi mạng trở lại.
        }
        if (cancelled) return;
        useGpsStore.getState().setPublishSharingState("sharing");
        return;
      }
      if (stored === "declined") {
        useGpsStore.getState().setPublishSharingState("declined");
        return;
      }
      // Chưa từng chọn → để modal xác nhận hiện ra.
      useGpsStore.getState().setPublishSharingState("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [activePublishBookingId]);

  const flush = useCallback(async () => {
    // Không chồng request: nếu request trước chưa xong thì bỏ lượt này,
    // buffer giữ nguyên điểm mới nhất để lần flush sau gửi.
    if (inFlightRef.current) return;
    const bookingId = useGpsStore.getState().activePublishBookingId;
    const points = bufferRef.current;
    if (!bookingId || points.length === 0) return;
    bufferRef.current = [];
    inFlightRef.current = true;
    try {
      await postGpsPoints(bookingId, points);
      const store = useGpsStore.getState();
      store.setPublishError(null);
      store.markPublished();
    } catch (error) {
      const code = errorCode(error);
      // Chuyến đã kết thúc/bị hủy (server từ chối) → ngừng gửi im lặng.
      if (code === "GPS_13001" || code === "GPS_13003") {
        bufferRef.current = [];
        await clearStoredConsent(bookingId);
        useGpsStore.getState().setActivePublishBooking(null);
        useGpsStore.getState().setPublishSharingState("ended");
        useGpsStore.getState().setPublishError(null);
        return;
      }
      // Khách đã dừng chia sẻ (server đã ghi nhận) → đồng bộ lại trạng thái.
      if (code === "GPS_13005") {
        bufferRef.current = [];
        await setStoredConsent(bookingId, "declined");
        useGpsStore.getState().setPublishSharingState("paused");
        useGpsStore.getState().setPublishError(null);
        return;
      }
      // Mất mạng: giữ lại tối đa OFFLINE_BUFFER_LIMIT điểm gần nhất để gửi lần sau.
      bufferRef.current = [...points.slice(-OFFLINE_BUFFER_LIMIT), ...bufferRef.current].slice(-OFFLINE_BUFFER_LIMIT);
      useGpsStore.getState().setPublishError(getApiErrorMessage(error, i18n.t("mobile:gps.publisher.sendFailed")));
    } finally {
      inFlightRef.current = false;
    }
  }, []);
  flushRef.current = flush;

  useEffect(() => {
    if (activePublishBookingId == null || publishSharingState !== "sharing") return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    // Mỗi lần bật chia sẻ gửi ngay điểm đầu tiên, sau đó mới lọc theo khoảng cách.
    lastLocationRef.current = null;

    const handleLocation = (location: Location.LocationObject) => {
      if (useGpsStore.getState().activePublishBookingId !== activePublishBookingId) return;
      if (useGpsStore.getState().publishSharingState !== "sharing") return;
      const coords = location.coords;
      const point: GpsPointRequest = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        speedKmh: coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : null,
        accuracyMeters: coords.accuracy,
        heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
        isMock: Boolean((location as unknown as { mocked?: boolean }).mocked),
        status: "ok",
        clientTimestamp: new Date(location.timestamp || Date.now()).toISOString(),
      };
      lastLocationRef.current = point;
      bufferRef.current.push(point);
      // Realtime: gửi ngay khi có điểm, không chờ gom batch.
      void flushRef.current?.();
    };

    void (async () => {
      // Khách nhận thông báo "bật GPS" từ chủ xe → publishSharingState về sharing,
      // effect này được gắn lại nên requestForegroundPermissionsAsync sẽ mở lại prompt
      // nếu người dùng chưa chặn vĩnh viễn.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      useGpsStore.getState().setPermissionStatus(permission.granted ? "granted" : "denied");
      if (!permission.granted) {
        useGpsStore.getState().setPublishError(i18n.t("mobile:gps.publisher.permissionDenied"));
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: WATCH_INTERVAL_MS,
          distanceInterval: WATCH_DISTANCE_M,
        },
        handleLocation,
      );

      // Gửi ngay 1 điểm đầu khi (re)đăng ký để chủ xe thấy tín hiệu trở lại tức thì,
      // không phải chờ callback đầu của watchPosition (có thể 5–15s).
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) handleLocation(current);
      } catch {
        // Không lấy được vị trí tức thời: watchPosition sẽ gửi điểm đầu sau vài giây.
      }
    })();

    const retryTimer = setInterval(() => {
      const store = useGpsStore.getState();
      // Heartbeat khi đứng yên: nếu quá 30s chưa gửi được điểm nào mà vẫn có vị trí
      // cuối, gửi lại chính điểm đó với timestamp mới (iOS không callback khi đứng yên).
      const idleMs = Date.now() - (store.lastPublishedAt ?? 0);
      if (store.activePublishBookingId === activePublishBookingId
        && store.publishSharingState === "sharing"
        && bufferRef.current.length === 0
        && !inFlightRef.current
        && lastLocationRef.current
        && idleMs >= HEARTBEAT_INTERVAL_MS) {
        bufferRef.current.push({
          ...lastLocationRef.current,
          clientTimestamp: new Date().toISOString(),
        });
      }
      void flushRef.current?.();
    }, RETRY_FLUSH_INTERVAL_MS);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void flushRef.current?.();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      clearInterval(retryTimer);
      appStateSub.remove();
      // Chỉ gửi nốt điểm còn lại khi vẫn đang chia sẻ đúng chuyến này; nếu khách vừa
      // dừng thì server đã chuyển Paused và sẽ từ chối (GPS_13005) — bỏ buffer.
      const store = useGpsStore.getState();
      if (store.publishSharingState === "sharing" && store.activePublishBookingId === activePublishBookingId) {
        void flushRef.current?.();
      } else {
        bufferRef.current = [];
      }
    };
  }, [activePublishBookingId, publishSharingState]);

  return { activePublishBookingId, publishSharingState };
}

async function findGrantedBooking(bookingIds: number[]): Promise<number | null> {
  for (const bookingId of bookingIds) {
    if ((await getStoredConsent(bookingId)) === "granted") return bookingId;
  }
  return null;
}

async function hasDeclinedBooking(bookingIds: number[]): Promise<boolean> {
  for (const bookingId of bookingIds) {
    if ((await getStoredConsent(bookingId)) === "declined") return true;
  }
  return false;
}