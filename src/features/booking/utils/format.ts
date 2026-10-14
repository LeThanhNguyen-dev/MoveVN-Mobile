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
  InProgress: "Đang thuê",
  Returning: "Đang trả xe",
  Returned: "Đã trả, chờ nhận",
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
