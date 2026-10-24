import { describe, expect, it } from "vitest";
import { pushBookingTarget } from "@/features/notifications/pushNavigation";

describe("OS push booking routing", () => {
  it.each([["customer", "Customer"], ["owner", "Owner"]])("preserves the recipient and %s booking destination", (roleTarget, role) => {
    expect(pushBookingTarget({ userId: "12", dataJson: JSON.stringify({ bookingId: 42, roleTarget }) }, "tap-1"))
      .toEqual({ bookingId: 42, roleTarget: role, userId: 12, requestId: "tap-1" });
  });
  it.each([{}, { userId: 12, dataJson: "garbage" }, { userId: 12, dataJson: "null" },
    { userId: 12, dataJson: '{"bookingId":42,"roleTarget":"Admin"}' },
    { userId: 0, dataJson: '{"bookingId":42,"roleTarget":"customer"}' },
    { userId: 12, dataJson: '{"bookingId":1.5,"roleTarget":"customer"}' },
  ])("rejects malformed or unsupported destinations: %j", data => {
    expect(pushBookingTarget(data, "tap-2")).toBeNull();
  });
});
