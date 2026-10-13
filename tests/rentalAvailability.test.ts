import { describe, expect, it } from "vitest";
import { firstBusyDateInRange, getBusyDateKeys } from "../src/features/vehicles/utils/rentalPeriod";

describe("rental calendar availability", () => {
  it("blocks both ends of a booking and a single locked day", () => {
    const busy = getBusyDateKeys([
      { startDate: "2026-10-05T10:00:00", endDate: "2026-10-07T08:00:00" },
      { startDate: "2026-10-10", endDate: "2026-10-10" },
    ]);
    expect([...busy].sort()).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-10"]);
    expect(firstBusyDateInRange("2026-10-04T08:00:00", "2026-10-08T08:00:00", busy)).toBe("2026-10-05");
    expect(firstBusyDateInRange("2026-10-08T08:00:00", "2026-10-10T08:00:00", busy)).toBe("2026-10-10");
    expect(firstBusyDateInRange("2026-10-08T08:00:00", "2026-10-09T08:00:00", busy)).toBeNull();
  });

  it("expands a blocked range across months", () => {
    const busy = getBusyDateKeys([{ startDate: "2026-10-31", endDate: "2026-11-02" }]);
    expect([...busy]).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});
