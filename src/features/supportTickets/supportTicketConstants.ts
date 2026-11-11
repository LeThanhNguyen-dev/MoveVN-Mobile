import i18n from "@/i18n";
import { localizedOption, translatedLabels } from "@/i18n/liveLabels";

// Label maps live at module scope, so they resolve on every read to follow runtime language changes.
export const supportTicketStatusLabels: Record<string, string> = translatedLabels("support", {
  Open: "status.open",
  InProgress: "status.inProgress",
  Resolved: "status.resolved",
  Closed: "status.closed",
});

export const supportTicketStatusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-amber-100 text-amber-700",
  Resolved: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-600",
};

export const supportTicketPriorityLabels: Record<string, string> = translatedLabels("support", {
  Low: "priority.low",
  Normal: "priority.normal",
  High: "priority.high",
  Urgent: "priority.urgent",
});

export const supportTicketPriorityColors: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600",
  Normal: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

export const supportTicketStatusOptions = [
  localizedOption("", "support", "status.all"),
  localizedOption("Open", "support", "status.open"),
  localizedOption("InProgress", "support", "status.inProgress"),
  localizedOption("Resolved", "support", "status.resolved"),
  localizedOption("Closed", "support", "status.closed"),
];

export const supportTicketEditableStatusOptions = supportTicketStatusOptions.filter((option) => option.value);

export const supportTicketPriorityOptions = [
  localizedOption("Low", "support", "priority.low"),
  localizedOption("Normal", "support", "priority.normal"),
  localizedOption("High", "support", "priority.high"),
  localizedOption("Urgent", "support", "priority.urgent"),
];

export const supportTicketCategoryOptions = [
  { value: "Booking", get label() { return i18n.t("support:category.booking"); } },
  { value: "Payment", get label() { return i18n.t("support:category.payment"); } },
  { value: "Vehicle", get label() { return i18n.t("support:category.vehicle"); } },
  { value: "Account", get label() { return i18n.t("support:category.account"); } },
  { value: "Other", get label() { return i18n.t("support:category.other"); } },
];

export function formatSupportTicketDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
