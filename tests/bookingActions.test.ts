import { describe, expect, it } from "vitest";
import { bookingActions } from "@/features/booking/bookingActions";
import { bookingActions as webActions } from "../../MoveVN-FrontEnd/src/features/booking/bookingActions";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";

const now = Date.parse("2026-10-22T10:00:00Z");
const booking = { status: "Pending", startDate: "2026-10-22T11:00:00Z", paymentDueAt: "2026-10-22T10:30:00Z", statusHistory: [], escrowStatus: "Held" } as unknown as BookingResponse;
const checkIn = { type: "CheckIn", isCustomerConfirmed: false, version: 2 } as InspectionReportResponse;
const checkOut = { type: "CheckOut", isCustomerConfirmed: false, version: 3 } as InspectionReportResponse;

describe("web/mobile booking action parity", () => {
  for (const status of ["Pending", "Approved", "DepositPaid", "Confirmed", "InProgress", "Returning", "Returned", "Completed", "Cancelled", "Rejected"]) {
    for (const role of ["Owner", "Customer"] as const) {
      it(`${role}: ${status} exposes identical actions on web and mobile`, () => {
        for (const reports of [[], [checkIn], [checkIn, checkOut], [{ ...checkIn, requiresRevision: true }], [{ ...checkOut, isCustomerConfirmed: true }]]) {
          const current = { ...booking, status, canCheckInNow: true, outstandingSurchargeAmount: 100000, externalPendingSurchargeAmount: 100000 };
          expect(bookingActions(current, reports, role, now)).toEqual(webActions(current as never, reports as never, role, now));
        }
      });
    }
  }
  it("locks expired deposits and permits only the server-approved early check-in", () => {
    expect(bookingActions({ ...booking, status: "Approved", paymentDueAt: "2026-10-22T09:59:00Z" }, [], "Customer", now).payDeposit).toBe(false);
    expect(bookingActions({ ...booking, status: "DepositPaid", canCheckInNow: false }, [checkIn], "Customer", now).confirmCheckIn).toBe(false);
    expect(bookingActions({ ...booking, status: "DepositPaid", canCheckInNow: true }, [checkIn], "Customer", now).confirmCheckIn).toBe(true);
    expect(bookingActions({ ...booking, status: "DepositPaid", canCheckInNow: true }, [{ ...checkIn, requiresRevision: true }], "Customer", now).confirmCheckIn).toBe(false);
  });
  it("permits checkout after early handover while requiring receipt and money confirmation separately", () => {
    const current = { ...booking, status: "InProgress", statusHistory: [{ toStatus: "InProgress", createdAt: "2026-10-22T09:59:00Z" }] } as BookingResponse;
    expect(bookingActions(current, [checkIn], "Owner", now).createCheckOut).toBe(true);
    expect(bookingActions(current, [checkOut], "Customer", now).confirmCheckOut).toBe(true);
    const returned = { ...current, status: "Returned", externalPendingSurchargeAmount: 100000 };
    expect(bookingActions(returned, [checkOut], "Owner", now)).toMatchObject({ confirmReceipt: true, confirmExternalSurcharge: true, settle: false });
    expect(bookingActions(returned, [checkOut], "Customer", now)).toMatchObject({ confirmReceipt: false, paySurcharge: true, confirmCheckOut: false });
  });
  it("holds escrow for 48 hours after completion", () => {
    const current = { ...booking, status: "Completed", startDate: "2026-10-19T10:00:00Z", completedAt: "2026-10-21T10:00:00Z" };
    expect(bookingActions(current, [checkOut], "Owner", now).settle).toBe(false);
    expect(bookingActions(current, [checkOut], "Owner", now + 24 * 3600000).settle).toBe(true);
  });
  it("uses the latest report payment totals when booking totals are stale", () => {
    const current = { ...booking, status: "Returned", externalPendingSurchargeAmount: 0, outstandingSurchargeAmount: 0 };
    const latest = { ...checkOut, externalPendingSurchargeAmount: 250000, outstandingSurchargeAmount: 250000 };
    expect(bookingActions(current, [latest], "Owner", now).confirmExternalSurcharge).toBe(true);
    expect(webActions(current as never, [latest] as never, "Owner", now).confirmExternalSurcharge).toBe(true);
    expect(bookingActions({ ...current, externalPendingSurchargeAmount: 250000 }, [{ ...latest, externalPendingSurchargeAmount: 0 }], "Owner", now).confirmExternalSurcharge).toBe(false);
  });
});
