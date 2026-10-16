import type { CompensationDirection, DisputeSettlementMethod, EvidenceRequestedFrom } from "@/features/disputes/types";

// Port từ web DisputePage: nhãn trạng thái, loại vấn đề, thanh toán.
export const disputeStatusLabels: Record<string, string> = {
  Open: "Mới mở",
  Investigating: "Đang điều tra",
  NeedMoreEvidence: "Chờ bổ sung",
  Escalated: "Chuyển Admin",
  DecisionIssued: "Chờ xác nhận kết quả",
  AwaitingExternalSettlement: "Chờ xác nhận quyết toán",
  Resolved: "Đã xử lý",
};

export const problemLabels: Record<string, string> = {
  Damage: "Hư hại xe",
  Payment: "Thanh toán",
  LateReturn: "Trả xe muộn",
  Accident: "Tai nạn",
  TrafficFine: "Phạt nguội",
  Other: "Khác",
};

export const compensationDirectionLabels: Record<CompensationDirection, string> = {
  CustomerPaysOwner: "Khách bồi thường cho chủ xe",
  OwnerRefundsCustomer: "Chủ xe hoàn/giảm tiền cho khách",
  NoCompensation: "Không phát sinh bồi thường",
};

export const settlementMethodLabels: Record<DisputeSettlementMethod, string> = {
  ExternalOnly: "Thanh toán trực tiếp giữa hai bên",
  DepositThenExternal: "Thanh toán từ ví, phần thiếu thanh toán trực tiếp",
};

export const evidenceTargetLabels: Record<EvidenceRequestedFrom, string> = {
  Customer: "Khách thuê",
  Owner: "Chủ xe",
  Both: "Cả hai bên",
};

export const trafficFineStatusLabels: Record<string, string> = {
  Submitted: "Chờ xác minh hồ sơ",
  AwaitingCustomerResponse: "Chờ khách xác nhận trách nhiệm",
  ResponsibilityDisputed: "Khách phản đối trách nhiệm",
  AwaitingPayment: "Chờ chứng từ thanh toán",
  PaymentProofSubmitted: "Chờ xác minh chứng từ",
  Resolved: "Đã xác minh hoàn tất",
  Rejected: "Hồ sơ bị từ chối",
};

/** Tách chuỗi URL phân cách bởi xuống dòng/phẩy như backend lưu evidenceUrls. */
export function evidenceList(value?: string | null): string[] {
  if (!value) return [];
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

export function formatDisputeDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDisputeMoney(value?: number | null): string {
  if (value == null) return "-";
  return `${value.toLocaleString("vi-VN")}đ`;
}
