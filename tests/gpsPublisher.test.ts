import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  foreground: vi.fn(), background: vi.fn(), watch: vi.fn(), current: vi.fn(),
  start: vi.fn(), stop: vi.fn(), remove: vi.fn(),
  executionEnvironment: "standalone", platform: "ios",
}));
vi.mock("react-native", () => ({
  Platform: { get OS() { return mocks.platform; } },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("expo-constants", () => ({
  default: { get executionEnvironment() { return mocks.executionEnvironment; } },
}));
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: mocks.foreground,
  requestBackgroundPermissionsAsync: mocks.background,
  watchPositionAsync: mocks.watch,
  getCurrentPositionAsync: mocks.current,
  Accuracy: { High: 4 },
}));
vi.mock("expo-notifications", () => ({ requestPermissionsAsync: vi.fn() }));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: null }),
}));
vi.mock("@/features/booking/bookingService", () => ({ getMyBookings: vi.fn() }));
vi.mock("@/features/gps/gpsService", () => ({ getGpsSession: vi.fn(), setGpsSharingConsent: vi.fn() }));
vi.mock("@/features/gps/gpsConsentStorage", () => ({
  clearActivePublishTarget: vi.fn(), clearStoredConsent: vi.fn(),
  getStoredConsent: vi.fn(), pruneStoredConsents: vi.fn(),
  setActivePublishTarget: vi.fn(), setStoredConsent: vi.fn(),
}));
vi.mock("@/features/gps/backgroundLocationTask", () => ({
  buildGpsPoint: vi.fn(), enqueueGpsPoint: vi.fn(), enqueueHeartbeat: vi.fn(),
  flushGpsBuffer: vi.fn(), gpsRuntime: { buffer: [], inFlight: false },
  GPS_WATCH_INTERVAL_MS: 8000, resetGpsRuntime: vi.fn(),
  startGpsTask: mocks.start, stopGpsTask: mocks.stop,
}));

import { useGpsPublisher } from "@/features/gps/useGpsPublisher";
import { useGpsStore } from "@/features/gps/gpsStore";
import i18n from "@/i18n";

let tree: ReactTestRenderer | undefined;
function Publisher() {
  useGpsPublisher();
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.executionEnvironment = "standalone";
  mocks.platform = "ios";
  useGpsStore.getState().reset();
  useGpsStore.setState({ activePublishBookingId: 42, publishSharingState: "sharing" });
  mocks.foreground.mockResolvedValue({ granted: true });
  mocks.background.mockResolvedValue({ granted: true });
  mocks.watch.mockResolvedValue({ remove: mocks.remove });
  mocks.current.mockRejectedValue(new Error("Position unavailable"));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});
async function mountPublisher() {
  await act(async () => { tree = create(React.createElement(Publisher)); });
}

it("handles missing iOS usage descriptions without an unhandled rejection", async () => {
  mocks.foreground.mockRejectedValue(new Error("One of the NSLocation*UsageDescription keys must be present in Info.plist"));
  await mountPublisher();
  expect(useGpsStore.getState().publishError).toBe(i18n.t("mobile:gps.publisher.startFailed"));
  expect(mocks.background).not.toHaveBeenCalled();
  expect(mocks.watch).not.toHaveBeenCalled();
});

it("keeps foreground tracking when background permission requests reject", async () => {
  mocks.background.mockRejectedValue(new Error("Background location unavailable"));
  await mountPublisher();
  expect(mocks.watch).toHaveBeenCalledOnce();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(useGpsStore.getState().publishError).toBeNull();
});

it("reports a foreground watcher startup failure", async () => {
  mocks.background.mockResolvedValue({ granted: false });
  mocks.watch.mockRejectedValue(new Error("Location services unavailable"));
  await mountPublisher();
  expect(useGpsStore.getState().publishError).toBe(i18n.t("mobile:gps.publisher.startFailed"));
});

it.each(["ios", "android"])("uses foreground GPS in Expo Go on %s without requesting background access", async (platform) => {
  mocks.executionEnvironment = "storeClient";
  mocks.platform = platform;
  await mountPublisher();
  expect(mocks.foreground).toHaveBeenCalledOnce();
  expect(mocks.background).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.watch).toHaveBeenCalledOnce();
  expect(useGpsStore.getState().publishError).toBeNull();
});
