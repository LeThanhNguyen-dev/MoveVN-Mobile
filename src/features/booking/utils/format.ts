export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return `${formatDate(dateStr)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatMoney(n?: number | null): string {
  if (n === undefined || n === null) return "-";
  return `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
}

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

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

const VOLUME_DISCOUNT_TIERS: { min: number; max: number; pct: number }[] = [
  { min: 3, max: 3, pct: 5 },
  { min: 5, max: 6, pct: 10 },
  { min: 7, max: 29, pct: 15 },
  { min: 30, max: Infinity, pct: 25 },
];

/** % giảm giá theo số ngày thuê (khớp web CustomerCreateBookingPage). */
export function getVolumeDiscountPercent(days: number): number {
  for (const t of VOLUME_DISCOUNT_TIERS) {
    if (days >= t.min && days <= t.max) return t.pct;
  }
  return 0;
}

/** Tổng số trang từ totalCount/pageSize của API. */
export function totalPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)));
}

export const ESCROW_HOLD_HOURS = 48;

export interface EscrowHoldInfo {
  hasCheckOutReport: boolean;
  holdUntilMs: number;
  withinHoldWindow: boolean;
  remainingHours: number;
}

/** Giữ tiền cọc 48h sau hoàn thành để đối soát (khớp web bookingStatus.ts). */
export function escrowHoldInfo(
  checkOutCreatedAt?: string | null,
  completedAt?: string | null,
  nowMs?: number,
): EscrowHoldInfo {
  const now = nowMs ?? Date.now();
  const base = completedAt
    ? new Date(completedAt).getTime()
    : checkOutCreatedAt
      ? new Date(checkOutCreatedAt).getTime()
      : 0;
  const withinHoldWindow = base > 0 && now < base + ESCROW_HOLD_HOURS * 60 * 60 * 1000;
  const remainingHours = base > 0
    ? Math.max(Math.ceil((base + ESCROW_HOLD_HOURS * 60 * 60 * 1000 - now) / (60 * 60 * 1000)), 0)
    : 0;
  return {
    hasCheckOutReport: Boolean(checkOutCreatedAt),
    holdUntilMs: base > 0 ? base + ESCROW_HOLD_HOURS * 60 * 60 * 1000 : 0,
    withinHoldWindow,
    remainingHours,
  };
}

/** Parse "DD/MM/YYYY HH:mm" (định dạng hiển thị formatDateTime) sang ISO string. */
export function parseDisplayDateTime(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isPickupReached(startDate: string, nowMs?: number): boolean {
  return new Date(startDate).getTime() <= (nowMs ?? Date.now());
}

export function canOwnerCancelBooking(status: string, startDate: string, nowMs?: number): boolean {
  return (status === "Approved" || status === "DepositPaid") && new Date(startDate).getTime() > (nowMs ?? Date.now());
}

export interface RentalProgress {
  totalDays: number;
  elapsedDays: number;
  currentDay: number;
  remainingMs: number;
  overdue: boolean;
  summary: string;
}

/** Tiến độ thuê: đang ngày thứ mấy, còn lại bao lâu (âm là quá hạn). */
export function rentalProgress(startStr?: string | null, endStr?: string | null, nowMs?: number): RentalProgress | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const now = nowMs ?? Date.now();
  const totalDays = Math.max(1, Math.ceil((end - start) / 86_400_000));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((now - start) / 86_400_000)));
  const remainingMs = end - now;
  const overdue = remainingMs < 0;
  const absMs = Math.abs(remainingMs);
  const d = Math.floor(absMs / 86_400_000);
  const h = Math.floor((absMs % 86_400_000) / 3_600_000);
  const remainText = d > 0 ? `${d} ngày ${h} giờ` : `${h} giờ`;
  return {
    totalDays,
    elapsedDays,
    currentDay: Math.min(totalDays, elapsedDays + 1),
    remainingMs,
    overdue,
    summary: overdue ? `Quá hạn ${remainText}` : `Ngày ${Math.min(totalDays, elapsedDays + 1)}/${totalDays} · còn ${remainText}`,
  };
}
