import { describe, expect, it } from "vitest";
import { inspectionBalance, mileagePreview } from "@/features/booking/bookingSettlement";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";
const booking = { totalAmount: 2000000, escrowAmount: 500000, totalDays: 3, outstandingSurchargeAmount: 100000,
  surchargeTerms: [{ feeType: "ExcessMileage", calculationMethod: "PerKm", includedKm: 200, allowanceScope: "PerDay", unitPrice: 5000 }] } as BookingResponse;

describe("checkout money shown before consent", () => {
  it("includes pending mileage and late fees, without subtracting unrecorded cash", () => {
    const report = { type: "CheckOut", lateReturnFee: 20000, excessMileageFee: 250000, pendingSurchargeAmount: 270000, outstandingSurchargeAmount: 0 } as InspectionReportResponse;
    expect(inspectionBalance(booking, report)).toEqual({ rentalRemaining: 1500000, pending: 270000, outstanding: 0, totalRemaining: 1770000 });
  });
  it("does not collect a paid surcharge twice or count it as still due", () => {
    const report = { type: "CheckOut", isCustomerConfirmed: true, excessMileageFee: 250000, paidSurchargeAmount: 250000, pendingSurchargeAmount: 0, outstandingSurchargeAmount: 0 } as InspectionReportResponse;
    expect(inspectionBalance(booking, report).totalRemaining).toBe(1500000);
    expect(inspectionBalance(booking, { ...report, outstandingSurchargeAmount: 250000, paidSurchargeAmount: 0 }).totalRemaining).toBe(1750000);
  });
  it("does not attach checkout debt to the check-in report", () => {
    expect(inspectionBalance(booking, { type: "CheckIn" } as InspectionReportResponse).totalRemaining).toBe(1500000);
  });
});

describe("booked mileage policy", () => {
  it("uses the per-day allowance, charges only excess, and respects the agreed cap", () => {
    expect(mileagePreview(booking, 1000, "1600")).toMatchObject({ fee: 0, included: 600, excess: 0 });
    expect(mileagePreview(booking, 1000, "1650")).toMatchObject({ fee: 250000, included: 600, travelled: 650, excess: 50 });
    expect(mileagePreview({ ...booking, surchargeTerms: [{ ...booking.surchargeTerms![0]!, allowanceScope: "PerBooking", maxAmount: 100000 }] }, 1000, "1250")).toMatchObject({ fee: 100000, included: 200, excess: 50 });
  });
  it("does not invent fees for a booking without a policy or valid readings", () => {
    expect(mileagePreview({ ...booking, surchargeTerms: [] }, 1000, "1650")).toBeNull();
    for (const value of ["", "999", "1250.5", "2147483648"]) expect(mileagePreview(booking, 1000, value)).toEqual({ valid: false });
    expect(mileagePreview(booking, undefined, "1650")).toEqual({ valid: false });
  });
});
