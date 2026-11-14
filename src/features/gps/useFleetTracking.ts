import { useCallback, useEffect, useRef, useState } from "react";
import { getOwnerTrackingVehicles } from "./gpsService";
import { startGpsTrackingConnection, subscribeToBooking, unsubscribeFromBooking } from "./gpsConnection";
import { useGpsStore } from "./gpsStore";
import type { OwnerTrackingVehicleResponse } from "./types";

const POLL_INTERVAL_MS = 20_000;

/**
 * Bản đồ tổng hợp của chủ xe: gọi 1 API lấy tất cả xe đang thuê, poll 20s làm
 * lưới an toàn và subscribe SignalR từng booking để cập nhật realtime.
 */
export function useFleetTracking() {
  const [items, setItems] = useState<OwnerTrackingVehicleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const subscribedRef = useRef<Set<number>>(new Set());
  const activeRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getOwnerTrackingVehicles();
      if (!activeRef.current) return;
      setItems(data.items);
      setUpdatedAt(data.serverTimestamp);
      setFailed(false);

      const store = useGpsStore.getState();
      for (const item of data.items) {
        store.setSharingState(item.bookingId, item.sharingState);
        const current = store.positions[item.bookingId];
        const currentAt = current ? Date.parse(current.lastUpdatedAt) : 0;
        const itemAt = item.lastUpdatedAt ? Date.parse(item.lastUpdatedAt) : 0;
        // SignalR có thể đã đẩy điểm mới hơn dữ liệu poll.
        if (!current || itemAt >= currentAt) {
          store.setStatus(item.bookingId, item.state);
          if (item.latitude != null && item.longitude != null && item.lastUpdatedAt) {
            store.setPosition(item.bookingId, {
              latitude: item.latitude,
              longitude: item.longitude,
              speedKmh: item.speedKmh,
              heading: item.heading,
              isMock: item.isMock,
              lastUpdatedAt: item.lastUpdatedAt,
            });
          }
        }
      }

      // Xe đã trả xe → bỏ subscribe; xe mới vào thuê giữa chừng → subscribe thêm.
      const activeIds = new Set(data.items.map((item) => item.bookingId));
      for (const bookingId of [...subscribedRef.current]) {
        if (!activeIds.has(bookingId)) {
          subscribedRef.current.delete(bookingId);
          void unsubscribeFromBooking(bookingId);
        }
      }
      if (await startGpsTrackingConnection()) {
        if (!activeRef.current) return;
        for (const item of data.items) {
          subscribedRef.current.add(item.bookingId);
          // Subscribe lại mỗi vòng poll: SignalR mất nhóm sau khi reconnect và
          // invoke Subscribe là idempotent phía server.
          void subscribeToBooking(item.bookingId);
        }
      }
    } catch {
      if (activeRef.current) setFailed(true);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      clearInterval(timer);
      const ids = [...subscribedRef.current];
      subscribedRef.current.clear();
      for (const bookingId of ids) void unsubscribeFromBooking(bookingId);
    };
  }, [refresh]);

  return { items, loading, failed, updatedAt, refresh };
}