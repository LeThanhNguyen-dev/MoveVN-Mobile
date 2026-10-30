import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { postGpsPoints } from "./gpsService";
import { useGpsStore } from "./gpsStore";
import { getApiErrorMessage } from "@/services/apiClient";
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

/**
 * Publish GPS cho khách thuê: mỗi khi store có activePublishBookingId (booking đang
 * InProgress/Returning được mở ở TripDetail), hook xin quyền location, theo dõi vị trí
 * và gửi NGAY từng điểm lên backend (độ trễ ~8s + mạng). Đặt 1 lần trong CustomerNavigator.
 *
 * MVP chỉ track khi app mở (foreground) — iOS/Android siết location nền chặt.
 */
export function useGpsPublisher() {
  const activePublishBookingId = useGpsStore((state) => state.activePublishBookingId);
  const bufferRef = useRef<GpsPointRequest[]>([]);
  const inFlightRef = useRef(false);
  const lastLocationRef = useRef<GpsPointRequest | null>(null);
  const flushRef = useRef<(() => Promise<void>) | undefined>(undefined);

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
      // Chuyến đã kết thúc/bị hủy (server từ chối) → ngừng gửi im lặng thay vì báo lỗi.
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "GPS_13001" || code === "GPS_13003") {
        useGpsStore.getState().setActivePublishBooking(null);
        useGpsStore.getState().setPublishError(null);
        return;
      }
      // Mất mạng: giữ lại tối đa OFFLINE_BUFFER_LIMIT điểm gần nhất để gửi lần sau.
      bufferRef.current = [...points.slice(-OFFLINE_BUFFER_LIMIT), ...bufferRef.current].slice(-OFFLINE_BUFFER_LIMIT);
      useGpsStore.getState().setPublishError(getApiErrorMessage(error, "Không gửi được vị trí. Sẽ thử lại."));
    } finally {
      inFlightRef.current = false;
    }
  }, []);
  flushRef.current = flush;

  useEffect(() => {
    if (activePublishBookingId == null) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const handleLocation = (location: Location.LocationObject) => {
      if (useGpsStore.getState().activePublishBookingId == null) return;
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
      // Khách nhận thông báo "bật GPS" từ chủ xe → activePublishBookingId vẫn giữ,
      // effect này được gắn lại nên requestForegroundPermissionsAsync sẽ mở lại prompt
      // nếu người dùng chưa chặn vĩnh viễn.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      useGpsStore.getState().setPermissionStatus(permission.granted ? "granted" : "denied");
      if (!permission.granted) {
        useGpsStore.getState().setPublishError("Bạn chưa bật chia sẻ vị trí. Chủ xe không thể theo dõi chuyến đi.");
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
        handleLocation(current);
      } catch {
        // Không lấy được vị trí tức thời: watchPosition sẽ gửi điểm đầu sau vài giây.
      }
    })();

    const retryTimer = setInterval(() => {
      const store = useGpsStore.getState();
      // Heartbeat khi đứng yên: nếu quá 30s chưa gửi được điểm nào mà vẫn có vị trí
      // cuối, gửi lại chính điểm đó với timestamp mới (iOS không callback khi đứng yên).
      const idleMs = Date.now() - (store.lastPublishedAt ?? 0);
      if (store.activePublishBookingId != null
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
      void flushRef.current?.();
    };
  }, [activePublishBookingId]);

  return { activePublishBookingId };
}
