import type { BookingResponse, InspectionReportResponse } from "./types";

export function inspectionBalance(booking: BookingResponse, report: InspectionReportResponse) {
  const rentalRemaining = Math.max(booking.totalAmount - booking.escrowAmount, 0);
  const pending = report.type === "CheckOut" ? report.pendingSurchargeAmount ?? (report.isCustomerConfirmed ? 0 : (report.lateReturnFee ?? 0) + (report.excessMileageFee ?? 0) + (report.additionalSurcharges ?? []).reduce((sum, fee) => sum + fee.amount, 0)) : 0;
  const outstanding = report.type === "CheckOut" ? report.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0 : 0;
  return { rentalRemaining, pending, outstanding, totalRemaining: rentalRemaining + pending + outstanding };
}

export function mileagePreview(booking: BookingResponse, initialKm: number | undefined, finalKm: string) {
  const term = booking.surchargeTerms?.find(t => t.feeType === "ExcessMileage");
  if (!term) return null;
  if (initialKm == null || !/^\d+$/.test(finalKm.trim()) || Number(finalKm) < initialKm || Number(finalKm) > 2147483647) return { valid: false as const };
  const included = (term.includedKm ?? 0) * (term.allowanceScope === "PerDay" ? Math.max(booking.totalDays, 1) : 1);
  const travelled = Number(finalKm) - initialKm;
  const excess = Math.max(travelled - included, 0);
  return { valid: true as const, included, travelled, excess, unitPrice: term.unitPrice, fee: Math.round(Math.min(excess * term.unitPrice, term.maxAmount ?? Infinity)) };
}
