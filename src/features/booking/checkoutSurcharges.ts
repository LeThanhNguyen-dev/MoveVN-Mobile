import type { BookingResponse, BookingSurchargeTermResponse, CheckoutSurchargeSelection } from "./types";
export function selectableSurcharges(booking: BookingResponse) {
  return (booking.surchargeTerms ?? []).filter(t => ["Cleaning", "Deodorization", "Custom"].includes(t.feeType));
}
export const surchargeUnit = (method: string) => ({ Fixed: "đơn vị", PerKm: "km", PerHour: "giờ", PerDay: "ngày" }[method] ?? method);
export function surchargeAmount(term: BookingSurchargeTermResponse, quantity: number) {
  return Math.round(Math.min(term.unitPrice * quantity, term.maxAmount ?? Infinity));
}
export function validateSurchargeSelection(booking: BookingResponse, selections: CheckoutSurchargeSelection[]) {
  const terms = selectableSurcharges(booking);
  for (const s of selections) {
    const term = terms.find(t => t.id === s.termId);
    if (!term || !Number.isFinite(s.quantity) || s.quantity <= 0 || s.quantity > 1000000 || Math.abs(s.quantity * 100 - Math.round(s.quantity * 100)) > 0.00001 || (term.calculationMethod === "Fixed" && !Number.isInteger(s.quantity)) || !s.note.trim() || s.note.length > 1000)
      throw new Error("Phụ thu cần số lượng hợp lệ và lý do phát sinh (tối đa 1000 ký tự).");
  }
}
export function appendSurcharges(data: FormData, selections: CheckoutSurchargeSelection[]) {
  selections.forEach((s, i) => {
    data.append(`additionalSurcharges[${i}].termId`, String(s.termId));
    data.append(`additionalSurcharges[${i}].quantity`, String(s.quantity));
    data.append(`additionalSurcharges[${i}].note`, s.note.trim());
  });
}
