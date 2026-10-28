import { getDiscountPercent } from "@/features/booking/utils/bookingPricing";
import type { PricingQuoteResponse } from "@/features/vehicles/types";
import { DAYS_VI, getHour, parseDateValue } from "@/features/vehicles/utils/rentalPeriod";

export type RentalPricing = {
  days: number;
  base: number;
  discountPercent: number;
  discountAmount: number;
  payable: number;
  averagePerDay: number;
};

/** Giá thuê sau giảm giá dài ngày, dùng chung công thức với luồng booking. */
export function buildRentalPricing(
  quote: PricingQuoteResponse | null,
  days: number,
): RentalPricing | null {
  if (!quote || days <= 0) return null;
  const base = Math.max(quote.totalDynamicPrice, 0);
  const discountPercent = getDiscountPercent(days);
  const discountAmount = Math.round((base * discountPercent) / 100);
  const payable = Math.max(base - discountAmount, 0);
  return {
    days,
    base,
    discountPercent,
    discountAmount,
    payable,
    averagePerDay: Math.round(payable / days),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 12/11 hoặc 12/11/2026 khi khác năm hiện tại. */
export function formatDateShort(value: string, withYear = false): string {
  const date = parseDateValue(value);
  if (!date) return "Chọn ngày";
  const dayMonth = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  return withYear ? `${dayMonth}/${date.getFullYear()}` : dayMonth;
}

/** 12 – 15/11, 30/11 – 02/12 hoặc 30/12/2026 – 02/01/2027. */
export function formatShortRange(startDate: string, endDate: string): string {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  if (!start || !end) return "Chọn ngày";
  if (start.getTime() === end.getTime()) return formatDateShort(startDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) return `${pad(start.getDate())} – ${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;
  return `${formatDateShort(startDate, !sameYear)} – ${formatDateShort(endDate, !sameYear)}`;
}

/** T4 · 09:00 */
export function formatDateMeta(value: string): string {
  const date = parseDateValue(value);
  if (!date) return "Chạm để chọn";
  const weekday = DAYS_VI[date.getDay()] ?? "";
  return `${weekday} · ${getHour(value)}`;
}
