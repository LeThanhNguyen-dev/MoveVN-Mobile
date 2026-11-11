import { translatedLabels } from "@/i18n/liveLabels";

// Nhãn loại giao dịch: dùng chung key với web khi text trùng, phần khác biệt
// (chữ ngắn hơn cho list mobile) nằm trong namespace mobile.
const sharedTxTypeLabels = translatedLabels("accountWallet", {
  TopUp: "types.TopUp",
  Refund: "types.Refund",
  DisputeCompensation: "types.DisputeCompensation",
  Withdrawal: "types.Withdrawal",
});
const mobileTxTypeLabels = translatedLabels("mobile", {
  BookingEarning: "wallet.txTypes.bookingEarning",
  PlatformFeeRevenue: "wallet.txTypes.platformFeeRevenue",
  PayoutReversal: "wallet.txTypes.payoutReversal",
  AdminAdjust: "wallet.txTypes.adminAdjust",
  BookingPayment: "wallet.txTypes.bookingPayment",
  Penalty: "wallet.txTypes.penalty",
  BookingEarningReversal: "wallet.txTypes.bookingEarningReversal",
  AutoPayout: "wallet.txTypes.autoPayout",
});

// Getter resolve bản dịch mỗi lần đọc để nhãn đổi theo ngôn ngữ đang chọn.
export const TX_TYPE_LABELS: Record<string, string> = Object.defineProperties(
  sharedTxTypeLabels,
  Object.getOwnPropertyDescriptors(mobileTxTypeLabels),
) as Record<string, string>;

export function txTypeLabel(type: string): string {
  return TX_TYPE_LABELS[type] ?? type;
}

const sharedWithdrawalStatusLabels = translatedLabels("accountWallet", {
  Approved: "status.Approved",
});
const mobileWithdrawalStatusLabels = translatedLabels("mobile", {
  Pending: "wallet.statuses.pending",
  NeedsManualReview: "wallet.statuses.needsManualReview",
  Completed: "wallet.statuses.completed",
  Rejected: "wallet.statuses.rejected",
});

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = Object.defineProperties(
  sharedWithdrawalStatusLabels,
  Object.getOwnPropertyDescriptors(mobileWithdrawalStatusLabels),
) as Record<string, string>;

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
