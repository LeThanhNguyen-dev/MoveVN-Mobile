import i18n from "@/i18n";
import { translatedLabels } from "@/i18n/liveLabels";

// Nhãn resolve mỗi lần đọc (getter) để không đóng băng tiếng Việt lúc import module.
const sharedStatusLabels = translatedLabels<string>("disputes", {
  Open: "status.Open",
  NeedMoreEvidence: "status.NeedMoreEvidence",
  Escalated: "status.Escalated",
  Resolved: "status.Resolved",
});
const mobileStatusLabels = translatedLabels<string>("mobile", {
  Investigating: "dispute.legacy.status.Investigating",
  DecisionIssued: "dispute.legacy.status.DecisionIssued",
  Closed: "dispute.legacy.status.Closed",
});

export const DISPUTE_STATUS_LABELS: Record<string, string> = Object.defineProperties(
  sharedStatusLabels,
  Object.getOwnPropertyDescriptors(mobileStatusLabels),
) as Record<string, string>;

export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}

const sharedTypeLabels = translatedLabels<string>("disputes", {
  Payment: "problem.Payment",
  Accident: "problem.Accident",
  TrafficFine: "problem.TrafficFine",
  Other: "problem.Other",
});
const mobileTypeLabels = translatedLabels<string>("mobile", {
  Damage: "dispute.legacy.problem.Damage",
  LateReturn: "dispute.legacy.problem.LateReturn",
});

export const DISPUTE_TYPE_LABELS: Record<string, string> = Object.defineProperties(
  sharedTypeLabels,
  Object.getOwnPropertyDescriptors(mobileTypeLabels),
) as Record<string, string>;

export function disputeTypeLabel(reportType: string): string {
  return DISPUTE_TYPE_LABELS[reportType] ?? reportType;
}

function statusFilterOption(key: string) {
  return {
    key,
    get label(): string {
      return key === "" ? i18n.t("mobile:dispute.filters.all") : disputeStatusLabel(key);
    },
  };
}

export const DISPUTE_STATUS_FILTERS = [
  "",
  "Open",
  "Investigating",
  "NeedMoreEvidence",
  "Escalated",
  "DecisionIssued",
  "Resolved",
  "Closed",
].map(statusFilterOption);
