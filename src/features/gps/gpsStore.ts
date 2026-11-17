import { create } from "zustand";
import type {
  GpsConnectionStatus,
  GpsLiveState,
  GpsLocationUpdatedPayload,
  GpsPosition,
  GpsSharingState,
  GpsStatusChangedPayload,
} from "./types";

/** Trạng thái chia sẻ trên thiết bị khách: idle = chưa quyết định (cần hỏi). */
export type GpsPublishSharingState = GpsSharingState | "idle";

type GpsState = {
  userId: number | null;
  connectionStatus: GpsConnectionStatus;
  /** Vị trí mới nhất theo bookingId (từ SignalR hoặc REST lần cuối). */
  positions: Record<number, GpsPosition>;
  /** Trạng thái tracking theo bookingId: live | stale | ended | none. */
  statuses: Record<number, GpsLiveState>;
  /** Trạng thái chia sẻ theo bookingId: sharing | paused | declined | notShared | ended. */
  sharingStates: Record<number, GpsSharingState>;
  /** Booking khách thuê đang đi và app đang chia sẻ vị trí (null = dừng gửi). */
  activePublishBookingId: number | null;
  /** Trạng thái chia sẻ của booking đang hoạt động (điều khiển publisher + banner). */
  publishSharingState: GpsPublishSharingState;
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
  setSharingState: (bookingId: number, state: GpsSharingState) => void;
  setActivePublishBooking: (bookingId: number | null) => void;
  setPublishSharingState: (state: GpsPublishSharingState) => void;
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
  sharingStates: {},
  activePublishBookingId: null,
  publishSharingState: "idle",
  publishError: null,
  permissionStatus: "undetermined",
  lastPublishedAt: null,
  gpsEnableRequestedAt: null,

  activate: (userId) => set((state) => (state.userId === userId ? state : ({
    ...state,
    userId,
    positions: {},
    statuses: {},
    sharingStates: {},
    activePublishBookingId: null,
    publishSharingState: "idle",
    publishError: null,
    lastPublishedAt: null,
    gpsEnableRequestedAt: null,
  }))),
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
    sharingStates: { ...state.sharingStates, [payload.bookingId]: "sharing" },
  })),
  applyStatus: (payload) => set((state) => {
    if (payload.status === "gpsEnableRequested") {
      return { gpsEnableRequestedAt: Date.now() };
    }
    // Chỉ sự kiện tracking mới đổi status; sự kiện chia sẻ chỉ đổi sharingState
    // để không biến "khách dừng chia sẻ" thành "mất tín hiệu".
    if (payload.status === "sharingStopped") {
      return { sharingStates: { ...state.sharingStates, [payload.bookingId]: "paused" } };
    }
    if (payload.status === "sharingStarted") {
      return { sharingStates: { ...state.sharingStates, [payload.bookingId]: "sharing" } };
    }
    if (payload.status === "ended") {
      return {
        statuses: { ...state.statuses, [payload.bookingId]: "ended" },
        sharingStates: { ...state.sharingStates, [payload.bookingId]: "ended" },
      };
    }
    if (payload.status === "lost" || payload.status === "restored") {
      return {
        statuses: { ...state.statuses, [payload.bookingId]: mapStatus(payload.status) },
        sharingStates: { ...state.sharingStates, [payload.bookingId]: "sharing" },
      };
    }
    return state;
  }),
  setPosition: (bookingId, position) => set((state) => ({ positions: { ...state.positions, [bookingId]: position } })),
  setStatus: (bookingId, stateValue) => set((state) => ({ statuses: { ...state.statuses, [bookingId]: stateValue } })),
  setSharingState: (bookingId, stateValue) => set((state) => ({ sharingStates: { ...state.sharingStates, [bookingId]: stateValue } })),
  setActivePublishBooking: (activePublishBookingId) => set((state) => ({
    activePublishBookingId,
    // Đổi chuyến → chưa biết lựa chọn của chuyến mới (publisher sẽ khôi phục).
    publishSharingState: state.activePublishBookingId === activePublishBookingId ? state.publishSharingState : "idle",
    publishError: null,
  })),
  setPublishSharingState: (publishSharingState) => set({ publishSharingState }),
  setPublishError: (publishError) => set({ publishError }),
  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
  markPublished: () => set({ lastPublishedAt: Date.now() }),
  markGpsEnableRequested: () => set({ gpsEnableRequestedAt: Date.now() }),
  reset: () => set({
    userId: null,
    positions: {},
    statuses: {},
    sharingStates: {},
    activePublishBookingId: null,
    publishSharingState: "idle",
    publishError: null,
    lastPublishedAt: null,
    gpsEnableRequestedAt: null,
  }),
}));

function mapStatus(status: string): GpsLiveState {
  if (status === "lost") return "stale";
  if (status === "ended") return "ended";
  if (status === "restored") return "live";
  return "none";
}