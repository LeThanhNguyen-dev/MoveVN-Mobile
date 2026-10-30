import { describe, it, expect } from "vitest";
import { selectableSurcharges, surchargeAmount, validateSurchargeSelection, appendSurcharges } from "@/features/booking/checkoutSurcharges";
import { inspectionBalance } from "@/features/booking/bookingSettlement";
import type { BookingResponse, BookingSurchargeTermResponse, InspectionReportResponse } from "@/features/booking/types";
const cleaning = { id: 1, feeType: "Cleaning", calculationMethod: "Fixed", unitPrice: 100000 } as BookingSurchargeTermResponse;
const custom = { id: 2, feeType: "Custom", calculationMethod: "PerHour", unitPrice: 40000, maxAmount: 90000 } as BookingSurchargeTermResponse;
const booking = { totalAmount: 500000, escrowAmount: 100000, surchargeTerms: [cleaning, custom, { id: 3, feeType: "ExcessMileage" }] } as BookingResponse;
describe("selected checkout fees", () => {
  it("offers manual fees separately from automatically calculated mileage", () => {
    expect(selectableSurcharges(booking).map(t => t.id)).toEqual([1, 2]);
    expect(surchargeAmount(cleaning, 1)).toBe(100000);
    expect(surchargeAmount(cleaning, 3)).toBe(300000);
    expect(() => validateSurchargeSelection(booking, [{ termId: 1, quantity: 3, note: "Thiếu 3 mũ" }])).not.toThrow();
    expect(surchargeAmount(custom, 3)).toBe(90000);
  });
  it("requires booked terms, positive quantities and an explanation", () => {
    expect(() => validateSurchargeSelection(booking, [{ termId: 1, quantity: 1, note: "Bùn đất" }])).not.toThrow();
    for (const s of [
      { termId: 1, quantity: 1.5, note: "Bùn đất" }, { termId: 3, quantity: 1, note: "Không được chọn phí tự động" },
      { termId: 1, quantity: 1, note: " " }, { termId: 2, quantity: NaN, note: "Reason" }, { termId: 2, quantity: 0, note: "Reason" },
      { termId: 2, quantity: 1.001, note: "Reason" }, { termId: 999, quantity: 1, note: "Reason" },
    ]) expect(() => validateSurchargeSelection(booking, [s])).toThrow();
  });
  it("sends only term ID, quantity and reason using the API form collection format", () => {
    const data = new FormData(); appendSurcharges(data, [{ termId: 2, quantity: 2.5, note: "  Phát sinh 2,5 giờ  " }]);
    expect(Object.fromEntries(data.entries())).toEqual({ "additionalSurcharges[0].termId": "2", "additionalSurcharges[0].quantity": "2.5", "additionalSurcharges[0].note": "Phát sinh 2,5 giờ" });
  });
  it("includes selected fees with mileage and late fees in the confirmation total", () => {
    const report = { type: "CheckOut", lateReturnFee: 20000, excessMileageFee: 50000, additionalSurcharges: [{ amount: 100000 }] } as InspectionReportResponse;
    expect(inspectionBalance(booking, report)).toMatchObject({ pending: 170000, rentalRemaining: 400000, surchargeRemaining: 170000 });
    expect(inspectionBalance(booking, { ...report, isCustomerConfirmed: true, pendingSurchargeAmount: 0, outstandingSurchargeAmount: 170000 })).toMatchObject({ pending: 0, rentalRemaining: 400000, surchargeRemaining: 170000 });
  });
});
