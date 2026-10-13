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

/** Tổng số trang từ totalCount/pageSize của API. */
export function totalPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)));
}
