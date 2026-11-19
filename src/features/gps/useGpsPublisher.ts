import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { getGpsSession, setGpsSharingConsent } from "./gpsService";
import { useGpsStore } from "./gpsStore";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { getMyBookings } from "@/features/booking/bookingService";
import {
  clearActivePublishTarget,
  clearStoredConsent,
  getStoredConsent,
  pruneStoredConsents,
  setActivePublishTarget,
  setStoredConsent,
} from "./gpsConsentStorage";
import {
  buildGpsPoint,
  enqueueGpsPoint,
  enqueueHeartbeat,
  flushGpsBuffer,
  gpsRuntime,
  GPS_WATCH_INTERVAL_MS,
  resetGpsRuntime,
  startGpsTask,
  stopGpsTask,
} from "./backgroundLocationTask";
import i18n from "@/i18n";

/** An toàn: nếu điểm mới chưa đến (đứng yên) thì vẫn flush buffer định kỳ để gửi lại điểm khi mất mạng. */
const RETRY_FLUSH_INTERVAL_MS = 15_000;
/** Heartbeat khi đứng yên: gửi lại điểm cuối mỗi 30s để "Cập nhật lúc" luôn chạy
 * và backend không đánh dấu mất tín hiệu oan. */
const HEARTBEAT_INTERVAL_MS = 30_000;

function errorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

/**
 * Publish GPS cho khách thuê trên app:
 * 1. Tự tìm chuyến đang thuê khi mở lại app và gửi tiếp nếu đã đồng ý trước đó.
 * 2. Khôi phục lựa chọn chia sẻ (SecureStore + session phía máy chủ) — không hỏi lại.
 * 3. Khi publishSharingState = "sharing": xin quyền vị trí và chạy foreground service
 *    (expo-task-manager + thông báo thường trực) để GPS vẫn gửi khi khoá màn hình.
 *    Không có quyền chạy nền thì lùi về watchPosition chỉ khi app mở.
 * Đặt 1 lần trong CustomerNavigator.
 */
export function useGpsPublisher() {
  const activePublishBookingId = useGpsStore((state) => state.activePublishBookingId);
  const publishSharingState = useGpsStore((state) => state.publishSharingState);
  const userId = useAuthStore((state) => state.user?.userId ?? null);

  // Reset khi đổi tài khoản: tránh gửi nhầm GPS của booking cũ dưới userId mới.
  useEffect(() => {
    const previousUserId = useGpsStore.getState().userId;
    if (previousUserId != null && previousUserId !== userId) {
      // Đổi user/đăng xuất là trường hợp duy nhất được tắt dịch vụ nền từ vòng đời UI.
      void stopGpsTask();
      void clearActivePublishTarget();
    }
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

  // Không chia sẻ nữa (dừng/kết thúc/đổi chuyến) → tắt hẳn dịch vụ nền + thông báo.
  // Lúc mở lại app store còn trống (null + idle) chưa phải là "đã dừng": giữ service
  // đang chạy cho tới khi publisher khôi phục xong trạng thái chia sẻ.
  useEffect(() => {
    if (activePublishBookingId == null && publishSharingState === "idle") return;
    if (activePublishBookingId != null
      && !["ended", "paused", "declined", "notShared"].includes(publishSharingState)) return;
    void stopGpsTask();
    void clearActivePublishTarget();
  }, [activePublishBookingId, publishSharingState]);

  useEffect(() => {
    if (activePublishBookingId == null || publishSharingState !== "sharing") return;
    const bookingId = activePublishBookingId;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    // Mỗi lần bật chia sẻ gửi ngay điểm đầu tiên, sau đó mới lọc theo khoảng cách.
    resetGpsRuntime();

    const handleLocation = (location: Location.LocationObject) => {
      enqueueGpsPoint(buildGpsPoint(location));
      // Realtime: gửi ngay khi có điểm, không chờ gom batch.
      void flushGpsBuffer(bookingId);
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

      // Lưu chuyến đang chia sẻ để tiến trình nền biết gửi cho booking nào khi app đóng.
      await setActivePublishTarget(bookingId);

      let backgroundGranted = false;
      if (Platform.OS !== "web") {
        // Android 10+: "Cho phép mọi lúc"; bắt buộc để dịch vụ nền đọc GPS khi khoá máy.
        const background = await Location.requestBackgroundPermissionsAsync();
        if (cancelled) return;
        backgroundGranted = background.granted;
      }

      if (backgroundGranted) {
        try {
          // Android 13+: thông báo thường trực chỉ hiện khi đã cấp quyền thông báo.
          if (Platform.OS === "android") await Notifications.requestPermissionsAsync();
          await startGpsTask({
            title: i18n.t("mobile:gps.foreground.title"),
            body: i18n.t("mobile:gps.foreground.body"),
          });
        } catch {
          backgroundGranted = false;
        }
      }
      if (cancelled) return;

      if (!backgroundGranted) {
        // Không có quyền chạy nền: vẫn chia sẻ khi app đang mở như trước.
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: GPS_WATCH_INTERVAL_MS,
            distanceInterval: 8,
          },
          handleLocation,
        );
      }

      // Gửi ngay 1 điểm đầu khi (re)đăng ký để chủ xe thấy tín hiệu trở lại tức thì,
      // không phải chờ callback đầu của dịch vụ nền (có thể 5–15s).
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) handleLocation(current);
      } catch {
        // Không lấy được vị trí tức thời: dịch vụ nền sẽ gửi điểm đầu sau vài giây.
      }
    })();

    const retryTimer = setInterval(() => {
      const store = useGpsStore.getState();
      if (store.activePublishBookingId !== bookingId || store.publishSharingState !== "sharing") return;
      // Heartbeat khi đứng yên: quá 30s chưa gửi được điểm nào mà vẫn có vị trí
      // cuối (iOS không callback khi đứng yên) thì gửi lại chính điểm đó.
      const idleMs = Date.now() - (store.lastPublishedAt ?? 0);
      if (gpsRuntime.buffer.length === 0
        && !gpsRuntime.inFlight
        && idleMs >= HEARTBEAT_INTERVAL_MS) {
        enqueueHeartbeat();
      }
      void flushGpsBuffer(bookingId);
    }, RETRY_FLUSH_INTERVAL_MS);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void flushGpsBuffer(bookingId);
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      clearInterval(retryTimer);
      appStateSub.remove();
      // App bị đóng/đổi màn hình KHÔNG được tắt dịch vụ nền: task tự gửi tiếp bằng
      // target đã lưu. Chỉ gửi nốt điểm còn trong buffer rồi thôi.
      void flushGpsBuffer(bookingId);
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
