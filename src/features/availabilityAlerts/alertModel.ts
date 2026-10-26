export type AvailabilityAlert = {
  id: number; vehicleId: number; vehicleName: string; licensePlate: string;
  startDate: string; endDate: string; status: "Active" | "Notified" | "Cancelled" | "Expired" | "Booked";
  createdAt: string; closedAt: string | null;
};
export const alertStatusLabels: Record<AvailabilityAlert["status"], string> = {
  Active: "Đang theo dõi", Notified: "Đã thông báo", Cancelled: "Đã hủy", Expired: "Đã hết hạn", Booked: "Đã có đơn thuê",
};
export function alertTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,7})?)?(Z|[+-]\d{2}:\d{2})?$/i.exec(value);
  if (!match) return NaN;
  const [, y, m, d, h, minute, second, offset] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1 || month < 1 || month > 12 || day < 1 || Number(h) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59) return NaN;
  const calendar = new Date(0); calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return NaN;
  return Date.parse(offset ? value : `${value}+07:00`);
}
export function alertPeriodError(start: string, end: string, now = Date.now()) {
  const from = alertTimestamp(start), until = alertTimestamp(end);
  return !Number.isFinite(from) || !Number.isFinite(until) || from <= now || until <= from
    ? "Chọn ngày nhận ở tương lai và ngày trả sau ngày nhận." : "";
}
export function formatAlertDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(alertTimestamp(value)));
}
export function alertVehiclePath(item: Pick<AvailabilityAlert, "vehicleId" | "startDate" | "endDate">) {
  return `/vehicle/${item.vehicleId}?${new URLSearchParams({ startDate: item.startDate, endDate: item.endDate })}`;
}

export type AlertVehicleTarget = { vehicleId: number; startDate: string; endDate: string };
export function isAlertVehicleTarget(value: unknown): value is AlertVehicleTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as AlertVehicleTarget;
  return Number.isSafeInteger(item.vehicleId) && item.vehicleId > 0
    && typeof item.startDate === "string" && typeof item.endDate === "string"
    && Number.isFinite(alertTimestamp(item.startDate)) && alertTimestamp(item.endDate) > alertTimestamp(item.startDate);
}
export function localRentalDate(value: string | number) {
  const instant = typeof value === "string" ? alertTimestamp(value) : value;
  return new Date(instant + 7 * 3600000).toISOString().slice(0, 16);
}
export function availabilityTarget(dataJson?: string | null): AlertVehicleTarget | null {
  try {
    const data = JSON.parse(dataJson ?? "{}") as Record<string, unknown>;
    if (typeof data.availabilityAlertId !== "number" || !Number.isSafeInteger(data.availabilityAlertId) || data.availabilityAlertId <= 0
      || !isAlertVehicleTarget(data)) return null;
    const start = alertTimestamp(data.startDate), end = alertTimestamp(data.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { vehicleId: data.vehicleId, startDate: localRentalDate(start), endDate: localRentalDate(end) };
  } catch { return null; }
}
