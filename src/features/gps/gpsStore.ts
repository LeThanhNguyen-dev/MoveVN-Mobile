import { create } from "zustand";
import type { GpsConnectionStatus, GpsLiveState, GpsLocationUpdatedPayload, GpsStatusChangedPayload, GpsPosition } from "./types";

type GpsState = {
  userId: number | null;
  connectionStatus: GpsConnectionStatus;
  /** Vị trí mới nhất theo bookingId (từ SignalR hoặc REST lần cuối). */
  positions: Record<number, GpsPosition>;
  /** Trạng thái tracking theo bookingId: live | stale | ended | none. */
  statuses: Record<number, GpsLiveState>;
  /** Booking khách thuê đang đi và app đang chia sẻ vị trí (null = dừng gửi). */
  activePublishBookingId: number | null;
  publishError: string | null;
  permissionStatus: "undetermined" | "granted" | "denied";
  /** Lần cuối gửi điểm GPS thành công (epoch ms) — cho chỉ báo "đang chia sẻ vị trí". */
  lastPublishedAt: number | null;
  /** Timestamp của lần chủ xe yêu cầu bật GPS gần nhất (để khách thấy banner). */
  gpsEnableRequestedAt: number | null;

  activate: (userId: number | null) => void;
  setConnectionStatus: (status: GpsConnectionStatus) => void;
  applyPosition: (payload: GpsLocationUpdatedPayload) => void;
  applyStatus: (payload: GpsStatusChangedPayload) => void;
  setPosition: (bookingId: number, position: GpsPosition) => void;
  setStatus: (bookingId: number, state: GpsLiveState) => void;
  setActivePublishBooking: (bookingId: number | null) => void;
  setPublishError: (message: string | null) => void;
  setPermissionStatus: (status: "undetermined" | "granted" | "denied") => void;
  markPublished: () => void;
  markGpsEnableRequested: () => void;
  reset: () => void;
};

export const useGpsStore = create<GpsState>((set) => ({
  userId: null,
  connectionStatus: "offline",
  positions: {},
  statuses: {},
  activePublishBookingId: null,
  publishError: null,
  permissionStatus: "undetermined",
  lastPublishedAt: null,
  gpsEnableRequestedAt: null,

  activate: (userId) => set((state) => (state.userId === userId ? state : ({ ...state, userId, positions: {}, statuses: {}, activePublishBookingId: null, publishError: null, lastPublishedAt: null, gpsEnableRequestedAt: null }))),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  applyPosition: (payload) => set((state) => ({
    positions: {
      ...state.positions,
      [payload.bookingId]: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        speedKmh: payload.speedKmh,
        heading: payload.heading,
        isMock: payload.isMock,
        status: payload.status,
        lastUpdatedAt: payload.serverTimestamp,
      },
    },
    statuses: { ...state.statuses, [payload.bookingId]: "live" },
  })),
  applyStatus: (payload) => set((state) => {
    const next: Partial<GpsState> = {
      statuses: { ...state.statuses, [payload.bookingId]: mapStatus(payload.status) },
    };
    if (payload.status === "gpsEnableRequested") {
      next.gpsEnableRequestedAt = Date.now();
    }
    return next as GpsState;
  }),
  setPosition: (bookingId, position) => set((state) => ({ positions: { ...state.positions, [bookingId]: position } })),
  setStatus: (bookingId, stateValue) => set((state) => ({ statuses: { ...state.statuses, [bookingId]: stateValue } })),
  setActivePublishBooking: (activePublishBookingId) => set({ activePublishBookingId, publishError: null }),
  setPublishError: (publishError) => set({ publishError }),
  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
  markPublished: () => set({ lastPublishedAt: Date.now() }),
  markGpsEnableRequested: () => set({ gpsEnableRequestedAt: Date.now() }),
  reset: () => set({ userId: null, positions: {}, statuses: {}, activePublishBookingId: null, publishError: null, lastPublishedAt: null, gpsEnableRequestedAt: null }),
}));

function mapStatus(status: string): GpsLiveState {
  if (status === "lost") return "stale";
  if (status === "ended") return "ended";
  if (status === "restored") return "live";
  return "none";
}
