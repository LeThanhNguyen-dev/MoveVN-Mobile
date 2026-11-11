import i18n from "@/i18n";
import type { BookingResponse, InspectionReportResponse } from "./types";

export function handoverProgress(booking: BookingResponse, type: "CheckIn" | "CheckOut", report?: InspectionReportResponse) {
  const state = (label: string, guidance: string, tone: "waiting" | "action" | "done" = "waiting") => ({ label, guidance, tone });
  const text = (key: string) => i18n.t(`mobile:inspection.handover.${key}`);
  if (["Cancelled", "Rejected"].includes(booking.status)) return state(text("stopped"), text("stoppedHint"));
  if (type === "CheckIn") {
    if (report?.isCustomerConfirmed || ["InProgress", "Returning", "Returned", "Completed"].includes(booking.status)) return state(text("checkInDone"), text("checkInDoneHint"), "done");
    if (report?.requiresRevision) return state(text("checkInRevision"), report.revisionReason || text("checkInRevisionHint"), "action");
    if (report) return state(text("awaitingCustomerCheckIn"), text("awaitingCustomerCheckInHint"), "action");
    if (booking.status !== "DepositPaid") return state(text("checkInNotDue"), text("checkInNotDueHint"));
    if (!booking.canCheckInNow) return state(text("waitingPickupTime"), booking.checkInUnavailableReason || text("waitingPickupTimeHint"));
    return state(text("ownerCreateReport"), text("ownerCreateReportHint"), "action");
  }
  const outstanding = Math.max(report?.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0, report?.externalPendingSurchargeAmount ?? booking.externalPendingSurchargeAmount ?? 0);
  if (["Returned", "Completed"].includes(booking.status) && outstanding > 0) return state(text("outstandingSurcharge"), text("outstandingSurchargeHint"), "action");
  if (booking.status === "Completed") return state(text("returnDone"), text("returnDoneHint"), "done");
  if (booking.status === "Returned") return state(text("ownerReceive"), text("ownerReceiveHint"), "action");
  if (report?.requiresRevision) return state(text("updateReport"), text("updateReportHint"), "action");
  if (report && !report.isCustomerConfirmed) return state(text("awaitingCustomerCheckOut"), text("awaitingCustomerCheckOutHint"), "action");
  if (booking.status === "Returning") return state(text("ownerInspect"), text("ownerInspectHint"), "action");
  if (booking.status === "InProgress") return state(text("renting"), text("rentingHint"));
  return state(text("returnNotDue"), text("returnNotDueHint"));
}
