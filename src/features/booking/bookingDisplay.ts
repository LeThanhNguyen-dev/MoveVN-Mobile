import type { BookingResponse, InspectionReportResponse } from "./types";

export type BookingRole = "Owner" | "Customer";
export type InspectionType = "CheckIn" | "CheckOut";
export const MAX_INSPECTION_PHOTOS = 12;
export const MAX_INSPECTION_PHOTO_BYTES = 5 * 1024 * 1024;

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  Pending: "Chờ duyệt",
  Approved: "Đã duyệt",
  Rejected: "Đã từ chối",
  Cancelled: "Đã hủy",
  DepositPaid: "Đã đặt cọc",
  Confirmed: "Đã xác nhận",
  InProgress: "Đang nhận xe",
  Returning: "Đang trả xe",
  Returned: "Đã trả xe, chờ nhận",
  Completed: "Hoàn thành",
};

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
  return type === "CheckIn" ? "Check-in · Nhận xe" : "Check-out · Trả xe";
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
  const statusAllowed = booking.status === (type === "CheckIn" ? "DepositPaid" : "InProgress");
  const pickupReached = parseServerDate(booking.startDate).getTime() <= now;
  const timeAllowed = type === "CheckIn" ? (booking.canCheckInNow ?? pickupReached) : pickupReached;
  return {
    report, pickupReached,
    canCreate: role === "Owner" && statusAllowed && timeAllowed && !report,
    canConfirm: role === "Customer" && statusAllowed && timeAllowed && !!report && !report.isCustomerConfirmed,
  };
}

export function validateInspectionFields(odometer: string, damageNoted: boolean, description: string, photoCount: number): string | null {
  if (photoCount < 1 || photoCount > MAX_INSPECTION_PHOTOS) return "Cần chụp từ 1 đến 12 ảnh xe.";
  if (odometer.trim() && (!/^\d+$/.test(odometer.trim()) || Number(odometer) > 2147483647)) {
    return "Số km phải là số nguyên không âm hợp lệ.";
  }
  if (damageNoted && !description.trim()) return "Vui lòng mô tả hư hại của xe.";
  return null;
}
