export const TX_TYPE_LABELS: Record<string, string> = {
  TopUp: "Nạp tiền",
  BookingEarning: "Thu nhập booking",
  DisputeCompensation: "Bồi thường tranh chấp",
  PlatformFeeRevenue: "Phí nền tảng",
  Refund: "Hoàn tiền",
  PayoutReversal: "Hoàn tiền rút",
  AdminAdjust: "Điều chỉnh",
  BookingPayment: "Trả cọc",
  Withdrawal: "Rút tiền",
  Penalty: "Phạt",
  BookingEarningReversal: "Thu hồi thu nhập",
  AutoPayout: "Chuyển về ngân hàng",
};

export function txTypeLabel(type: string): string {
  return TX_TYPE_LABELS[type] ?? type;
}

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  Pending: "Chờ duyệt",
  Approved: "Đã duyệt",
  NeedsManualReview: "Chờ xử lý tay",
  Completed: "Hoàn tất",
  Rejected: "Từ chối",
};

export function withdrawalStatusLabel(status: string): string {
  return WITHDRAWAL_STATUS_LABELS[status] ?? status;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatMoney(n?: number | null): string {
  if (n === undefined || n === null) return "-";
  return `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
}
