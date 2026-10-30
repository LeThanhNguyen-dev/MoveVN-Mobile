import { useEffect } from "react";
import { useGpsStore } from "./gpsStore";
import { getGpsLivePosition } from "./gpsService";
import { startGpsTrackingConnection, stopGpsTrackingConnection, subscribeToBooking, unsubscribeFromBooking } from "./gpsConnection";

/**
 * Kết nối SignalR /hubs/tracking và subscribe theo bookingId (chủ xe xem vị trí xe).
 * Kèm poll REST mỗi 15s làm lưới an toàn: SignalR có thể miss event khi reconnect.
 */
export function useGpsConnection(bookingId: number | null | undefined) {
  const connectionStatus = useGpsStore((state) => state.connectionStatus);
  const position = useGpsStore((state) => (bookingId != null ? state.positions[bookingId] : undefined));
  const status = useGpsStore((state) => (bookingId != null ? state.statuses[bookingId] : undefined));

  useEffect(() => {
    if (bookingId == null) return;
    let active = true;
    void (async () => {
      const started = await startGpsTrackingConnection();
      if (active && started) await subscribeToBooking(bookingId);
      // Subscribe thất bại (mất kết nối lúc gọi) vẫn giữ trạng thái stale;
      // onreconnected của connection không tự subscribe lại nên thử lại 1 lần.
      if (active && !started) {
        setTimeout(() => {
          if (active) void startGpsTrackingConnection().then((ok) => (ok ? subscribeToBooking(bookingId) : false));
        }, 5000);
      }
    })();

    const pollTimer = setInterval(() => {
      void (async () => {
        try {
          const live = await getGpsLivePosition(bookingId);
          if (!active || !live.lastUpdatedAt) return;
          const store = useGpsStore.getState();
          const current = store.positions[bookingId];
          if (current && Date.parse(current.lastUpdatedAt) > Date.parse(live.lastUpdatedAt)) return;
          store.setStatus(bookingId, live.state);
          if (live.latitude != null && live.longitude != null) {
            store.setPosition(bookingId, {
              latitude: live.latitude,
              longitude: live.longitude,
              speedKmh: live.speedKmh,
              heading: live.heading,
              isMock: live.isMock,
              status: live.status,
              lastUpdatedAt: live.lastUpdatedAt,
            });
          }
        } catch {
          // Giữ nguyên dữ liệu SignalR hiện có.
        }
      })();
    }, 15000);

    return () => {
      active = false;
      clearInterval(pollTimer);
      void unsubscribeFromBooking(bookingId);
    };
  }, [bookingId]);

  return { connectionStatus, position, status };
}
