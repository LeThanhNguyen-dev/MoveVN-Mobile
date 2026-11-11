import type { CompensationDirection, DisputeSettlementMethod, EvidenceRequestedFrom } from "@/features/disputes/types";
import { translatedLabels } from "@/i18n/liveLabels";

// Port từ web DisputePage: nhãn trạng thái, loại vấn đề, thanh toán.
// Bản dịch resolve mỗi lần đọc (getter) để không đóng băng tiếng Việt lúc import.
export const disputeStatusLabels: Record<string, string> = translatedLabels<string>("disputes", {
  Open: "status.Open",
  Investigating: "status.Investigating",
  NeedMoreEvidence: "status.NeedMoreEvidence",
  Escalated: "status.Escalated",
  DecisionIssued: "status.DecisionIssued",
  AwaitingExternalSettlement: "status.AwaitingExternalSettlement",
  Resolved: "status.Resolved",
});

export const problemLabels: Record<string, string> = translatedLabels<string>("disputes", {
  Damage: "problem.Damage",
  Payment: "problem.Payment",
  LateReturn: "problem.LateReturn",
  Accident: "problem.Accident",
  TrafficFine: "problem.TrafficFine",
  Other: "problem.Other",
});

export const compensationDirectionLabels: Record<CompensationDirection, string> = translatedLabels<CompensationDirection>(
  "disputes",
  {
    CustomerPaysOwner: "compensationDirection.CustomerPaysOwner",
    OwnerRefundsCustomer: "compensationDirection.OwnerRefundsCustomer",
    NoCompensation: "compensationDirection.NoCompensation",
  },
);

export const settlementMethodLabels: Record<DisputeSettlementMethod, string> = translatedLabels<DisputeSettlementMethod>(
  "disputes",
  {
    ExternalOnly: "settlementMethod.ExternalOnly",
    DepositThenExternal: "settlementMethod.DepositThenExternal",
  },
);

export const evidenceTargetLabels: Record<EvidenceRequestedFrom, string> = translatedLabels<EvidenceRequestedFrom>(
  "disputes",
  {
    Customer: "party.Customer",
    Owner: "party.Owner",
    Both: "party.Both",
  },
);

export const trafficFineStatusLabels: Record<string, string> = translatedLabels<string>("disputes", {
  Submitted: "trafficFine.status.Submitted",
  AwaitingCustomerResponse: "trafficFine.status.AwaitingCustomerResponse",
  ResponsibilityDisputed: "trafficFine.status.ResponsibilityDisputed",
  AwaitingPayment: "trafficFine.status.AwaitingPayment",
  PaymentProofSubmitted: "trafficFine.status.PaymentProofSubmitted",
  Resolved: "trafficFine.status.Resolved",
  Rejected: "trafficFine.status.Rejected",
});

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
