import { describe, expect, it } from "vitest";
import { alertPeriodError, alertTimestamp, availabilityTarget, localRentalDate } from "../src/features/availabilityAlerts/alertModel";

describe("availability alert periods and inbox destinations", () => {
  const now = Date.parse("2026-10-25T00:00:00Z");
  it("interprets wall time as Vietnam time, including midnight across UTC dates", () => {
    expect(alertTimestamp("2026-10-26T00:30")).toBe(Date.parse("2026-10-25T17:30:00Z"));
    expect(alertTimestamp("2026-10-26T00:30+07:00")).toBe(Date.parse("2026-10-25T17:30:00Z"));
    expect(localRentalDate("2026-10-25T17:30:00Z")).toBe("2026-10-26T00:30");
  });
  it.each([["", ""], ["broken", "broken"], ["2026-10-25T07:00", "2026-10-26T08:00"],
    ["2026-10-26T08:00", "2026-10-26T08:00"], ["2026-10-26T08:00", "2026-10-26T07:00"]])("rejects invalid or passed periods: %s / %s", (start, end) => {
    expect(alertPeriodError(start, end, now)).not.toBe("");
  });
  it("accepts a future period without deciding vehicle availability on the client", () => {
    expect(alertPeriodError("2026-10-26T08:00", "2026-10-27T08:00", now)).toBe("");
  });
  it("opens the same vehicle and selected Vietnam hours from an inbox notification", () => {
    expect(availabilityTarget(JSON.stringify({ availabilityAlertId: 12, vehicleId: 10, startDate: "2026-10-25T17:30:00Z", endDate: "2026-10-26T17:30:00Z" })))
      .toEqual({ vehicleId: 10, startDate: "2026-10-26T00:30", endDate: "2026-10-27T00:30" });
  });
  it.each(["null", "[]", "broken", "{}", JSON.stringify({ availabilityAlertId: -1, vehicleId: 2 }),
    JSON.stringify({ availabilityAlertId: 1, vehicleId: "https://example.com", startDate: "2026-10-26", endDate: "2026-10-27" }),
    JSON.stringify({ availabilityAlertId: 1, vehicleId: 2, startDate: "2026-10-27", endDate: "2026-10-26" })])("ignores malformed notification data: %s", data => {
    expect(availabilityTarget(data)).toBeNull();
  });
});
