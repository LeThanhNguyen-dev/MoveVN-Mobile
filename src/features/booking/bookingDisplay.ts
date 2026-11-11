import i18n from "@/i18n";
import { translatedLabels } from "@/i18n/liveLabels";
import type { BookingResponse, InspectionReportResponse } from "./types";

export type BookingRole = "Owner" | "Customer";
export type InspectionType = "CheckIn" | "CheckOut";
export const MAX_INSPECTION_PHOTOS = 12;
export const MAX_INSPECTION_PHOTO_BYTES = 5 * 1024 * 1024;

// Three statuses read differently on this screen than in the shared booking labels,
// so they live in the mobile namespace. Both maps expose lazy getters; copying the
// property descriptors (not the values) keeps them resolving on each read.
const sharedStatusLabels = translatedLabels("booking", {
  Pending: "status.pending",
  DepositPaid: "status.depositPaid",
  Confirmed: "status.confirmed",
  Returning: "status.returning",
  Completed: "status.completed",
  Rejected: "status.rejected",
  Cancelled: "status.cancelled",
});
const mobileStatusLabels = translatedLabels("mobile", {
  Approved: "trip.status.approved",
  InProgress: "trip.status.inProgress",
  Returned: "trip.status.returned",
});

export const BOOKING_STATUS_LABELS: Record<string, string> = Object.defineProperties(
  sharedStatusLabels,
  Object.getOwnPropertyDescriptors(mobileStatusLabels),
) as Record<string, string>;

export function parseServerDate(value: string): Date {
  // PostgreSQL DateTime values can arrive without a zone; the API stores UTC.
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
}

export function formatVietnamDateTime(value: string | number | Date): string {
  const date = typeof value === "string" ? parseServerDate(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())}`;
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

export function inspectionLabel(type: InspectionType): string {
  return i18n.t(type === "CheckIn" ? "mobile:trip.display.checkIn" : "mobile:trip.display.checkOut");
}

export function inspectionWatermark(bookingCode: string, type: InspectionType, capturedAt: string): string[] {
  return [
    `MoveVN | ${bookingCode} | ${type === "CheckIn" ? "CHECK-IN" : "CHECK-OUT"}`,
    `${formatVietnamDateTime(capturedAt)} (UTC+07:00)`,
  ];
}

export function inspectionAvailability(
  booking: BookingResponse, role: BookingRole, type: InspectionType,
  reports: InspectionReportResponse[], now = Date.now(),
) {
  const report = reports.find((item) => item.type === type);
  const statusAllowed = type === "CheckIn" ? booking.status === "DepositPaid" : ["InProgress", "Returning"].includes(booking.status);
  const pickupReached = parseServerDate(checkoutStartDate(booking)).getTime() <= now;
  const timeAllowed = type === "CheckIn" ? booking.canCheckInNow === true : pickupReached;
  return {
    report, pickupReached,
    canCreate: role === "Owner" && statusAllowed && timeAllowed && (!report || (type === "CheckIn" && report.requiresRevision === true)),
    canConfirm: role === "Customer" && statusAllowed && timeAllowed && !!report && !report.requiresRevision && !report.isCustomerConfirmed,
  };
}

export function validateInspectionFields(odometer: string, damageNoted: boolean, description: string, photoCount: number): string | null {
  if (photoCount < 1 || photoCount > MAX_INSPECTION_PHOTOS) return i18n.t("mobile:trip.display.photoCount");
  if (odometer.trim() && (!/^\d+$/.test(odometer.trim()) || Number(odometer) > 2147483647)) {
    return i18n.t("booking:detail.validationOdometerInvalid");
  }
  if (damageNoted && !description.trim()) return i18n.t("mobile:trip.display.damageDescription");
  return null;
}

export function canReportNoShow(booking: BookingResponse, reports: InspectionReportResponse[], now = Date.now()): boolean {
  return booking.status === "DepositPaid" && parseServerDate(booking.startDate).getTime() <= now && !reports.some(r => r.type === "CheckIn");
}

export function canOwnerCancel(booking: BookingResponse, now = Date.now()): boolean {
  return ["Approved", "DepositPaid"].includes(booking.status) && parseServerDate(booking.startDate).getTime() > now;
}

export function isDepositExpired(booking: BookingResponse, now = Date.now()): boolean {
  return !booking.paymentDueAt || parseServerDate(booking.paymentDueAt).getTime() <= now || parseServerDate(booking.startDate).getTime() <= now;
}

// A successful early check-in makes checkout available immediately.
export function checkoutStartDate(booking: Pick<BookingResponse, "startDate" | "statusHistory">): string {
  const values = [booking.startDate, ...(booking.statusHistory ?? [])
    .filter(h => h.toStatus === "InProgress").map(h => h.createdAt)];
  const first = values.reduce((first, value) => parseServerDate(value).getTime() < parseServerDate(first).getTime() ? value : first);
  return new Date(Math.floor(parseServerDate(first).getTime() / 60000) * 60000).toISOString();
}
