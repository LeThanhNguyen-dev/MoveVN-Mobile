export type GpsPointStatus = "ok" | "gps_off" | "no_network";

export type GpsPointRequest = {
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  accuracyMeters?: number | null;
  heading?: number | null;
  isMock?: boolean;
  status?: GpsPointStatus;
  clientTimestamp?: string;
};

export type GpsPointsAcceptedResponse = {
  bookingId: number;
  sessionId: number;
  acceptedCount: number;
  trackingActive: boolean;
};

export type GpsLiveState = "live" | "stale" | "ended" | "none";

export type GpsLivePositionResponse = {
  bookingId: number;
  state: GpsLiveState;
  latitude: number | null;
  longitude: number | null;
  speedKmh?: number | null;
  heading?: number | null;
  isMock?: boolean;
  status?: GpsPointStatus | string;
  lastUpdatedAt: string | null;
  trackingActive: boolean;
};

export type GpsRoutePointResponse = {
  timestamp: string;
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  status?: string;
};

export type GpsTrackingSessionResponse = {
  id: number;
  bookingId: number;
  vehicleId: number;
  consentGiven: boolean;
  startedAt: string;
  endedAt: string | null;
  endReason?: string | null;
  state: "Active" | "Stale" | "Ended" | string;
  lastSeenAt: string | null;
  signalLostCount: number;
  trackingActive: boolean;
};

export type RequestGpsEnableResponse = {
  bookingId: number;
  requested: boolean;
  requestedAt: string;
};

export type GpsLocationUpdatedPayload = {
  bookingId: number;
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  accuracyMeters?: number | null;
  heading?: number | null;
  isMock?: boolean;
  status?: string;
  serverTimestamp: string;
};

export type GpsStatusChangedPayload = {
  bookingId: number;
  status: "lost" | "restored" | "ended" | "gpsEnableRequested" | string;
  serverTimestamp: string;
};

export type GpsConnectionStatus = "offline" | "connecting" | "connected";

export type GpsPosition = {
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  heading?: number | null;
  isMock?: boolean;
  status?: string;
  lastUpdatedAt: string;
};
