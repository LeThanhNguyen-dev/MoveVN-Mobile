import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ userId: 1 as number | null, role: "Customer", token: "token" as string | null, generation: 1 }));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () => auth.userId ? { userId: auth.userId } : null, getToken: () => auth.token, getSessionGeneration: () => auth.generation,
  useAuthStore: { getState: () => ({ activeRole: auth.role }) },
}));
import { closeAvailabilityAlerts, openAvailabilityAlerts, useAlertNavigation } from "../src/features/availabilityAlerts/alertNavigation";
import { availabilityTarget } from "../src/features/availabilityAlerts/alertModel";
beforeEach(() => { closeAvailabilityAlerts(); auth.userId = 1; auth.role = "Customer"; auth.token = "token"; auth.generation = 1; });
describe("availability center session boundaries", () => {
  it.each(["Customer", "Owner"])("opens the center for %s and captures the session generation", role => {
    auth.role = role; openAvailabilityAlerts(); expect(useAlertNavigation.getState().entry).toMatchObject({ userId: 1, generation: 1 });
  });
  it.each(["Admin", "Staff", "Unknown", ""])("does not open for unsupported role %s", role => {
    auth.role = role; openAvailabilityAlerts(); expect(useAlertNavigation.getState().entry).toBeNull();
  });
  it("does not open for a cached user without an access token", () => {
    auth.token = null; openAvailabilityAlerts(); expect(useAlertNavigation.getState().entry).toBeNull();
  });
  it("does not open without a user", () => {
    auth.userId = null; openAvailabilityAlerts(); expect(useAlertNavigation.getState().entry).toBeNull();
  });
  it("preserves the notified vehicle and Vietnam rental hours", () => {
    const target = availabilityTarget(JSON.stringify({ availabilityAlertId: 7, vehicleId: 10, startDate: "2026-11-01T17:30:00Z", endDate: "2026-11-02T17:30:00Z" }));
    openAvailabilityAlerts(target!); expect(useAlertNavigation.getState().entry?.vehicle).toEqual({ vehicleId: 10, startDate: "2026-11-02T00:30", endDate: "2026-11-03T00:30" });
  });
  it("rejects an invalid destination before mounting a detail screen", () => {
    openAvailabilityAlerts({ vehicleId: -1, startDate: "broken", endDate: "broken" }); expect(useAlertNavigation.getState().entry).toBeNull();
  });
  it("reopening after an account change binds to the new identity", () => {
    openAvailabilityAlerts(); const old = useAlertNavigation.getState().entry!;
    auth.userId = 3; auth.generation++; openAvailabilityAlerts(); const current = useAlertNavigation.getState().entry!;
    expect(current.userId).toBe(3); expect(current.generation).not.toBe(old.generation); expect(current.serial).toBeGreaterThan(old.serial);
    closeAvailabilityAlerts(); expect(useAlertNavigation.getState().entry).toBeNull();
  });
});
