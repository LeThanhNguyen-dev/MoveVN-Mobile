import i18n from "@/i18n";
import { problemLabels, disputeStatusLabels, trafficFineStatusLabels } from "@/features/disputes/components/disputeLabels";

// Danh sách filter dùng chung cho mobile (đồng bộ web DisputePage).
export const STATUS_FILTERS = [
  "",
  "Open",
  "Investigating",
  "NeedMoreEvidence",
  "DecisionIssued",
  "AwaitingExternalSettlement",
  "Escalated",
  "Resolved",
] as const;

export const TYPE_FILTERS = ["", "Damage", "Payment", "LateReturn", "Accident", "TrafficFine", "Other"] as const;

export const FINE_STATUS_FILTERS = [
  "",
  "Submitted",
  "AwaitingCustomerResponse",
  "ResponsibilityDisputed",
  "AwaitingPayment",
  "PaymentProofSubmitted",
  "Resolved",
  "Rejected",
] as const;

export function statusFilterLabel(status: string): string {
  if (status === "") return i18n.t("mobile:dispute.filters.all");
  return disputeStatusLabels[status] ?? status;
}

export function typeFilterLabel(type: string): string {
  if (type === "") return i18n.t("mobile:dispute.filters.all");
  return problemLabels[type] ?? type;
}

export function fineStatusFilterLabel(status: string): string {
  if (status === "") return i18n.t("mobile:dispute.filters.all");
  return trafficFineStatusLabels[status] ?? status;
}
