export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  Open: "Mới mở",
  Investigating: "Đang xử lý",
  NeedMoreEvidence: "Chờ bổ sung",
  Escalated: "Chuyển Admin",
  DecisionIssued: "Chờ xác nhận",
  Resolved: "Đã xử lý",
  Closed: "Đã đóng",
};

export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}

export const DISPUTE_TYPE_LABELS: Record<string, string> = {
  Damage: "Hư hỏng",
  Payment: "Thanh toán",
  LateReturn: "Trả trễ",
  Accident: "Tai nạn",
  TrafficFine: "Phạt nguội",
  Other: "Khác",
};

export function disputeTypeLabel(reportType: string): string {
  return DISPUTE_TYPE_LABELS[reportType] ?? reportType;
}

export const DISPUTE_STATUS_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "Open", label: "Mới mở" },
  { key: "Investigating", label: "Đang xử lý" },
  { key: "NeedMoreEvidence", label: "Chờ bổ sung" },
  { key: "Escalated", label: "Chuyển Admin" },
  { key: "DecisionIssued", label: "Chờ xác nhận" },
  { key: "Resolved", label: "Đã xử lý" },
  { key: "Closed", label: "Đã đóng" },
];
