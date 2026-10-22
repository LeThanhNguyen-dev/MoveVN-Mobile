import type { BookingResponse, InspectionReportResponse } from "./types";

const timestamp = (value?: string | null) => value ? new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`).getTime() : NaN;

// Keep this state contract identical in web and mobile. Server authorization is authoritative.
export function bookingActions(booking: BookingResponse, reports: InspectionReportResponse[], role: "Owner" | "Customer" | undefined, now = Date.now()) {
  const checkIn = reports.find(report => report.type === "CheckIn");
  const checkOut = reports.find(report => report.type === "CheckOut");
  const owner = role === "Owner", customer = role === "Customer";
  const start = timestamp(booking.startDate);
  const handoverAt = Math.min(start, ...(booking.statusHistory ?? []).filter(item => item.toStatus === "InProgress").map(item => timestamp(item.createdAt)).filter(Number.isFinite));
  const started = handoverAt <= now;
  const holdBase = timestamp(booking.completedAt ?? checkOut?.createdAt);
  const activeReturn = ["InProgress", "Returning"].includes(booking.status);
  return {
    approve: owner && booking.status === "Pending",
    reject: owner && booking.status === "Pending",
    cancel: start > now && (owner ? ["Approved", "DepositPaid"].includes(booking.status) : customer && ["Pending", "Approved", "DepositPaid", "Confirmed"].includes(booking.status)),
    payDeposit: customer && booking.status === "Approved" && timestamp(booking.paymentDueAt) > now && start > now,
    createCheckIn: owner && booking.status === "DepositPaid" && booking.canCheckInNow === true && (!checkIn || checkIn.requiresRevision === true),
    confirmCheckIn: customer && booking.status === "DepositPaid" && booking.canCheckInNow === true && !!checkIn && !checkIn.isCustomerConfirmed && !checkIn.requiresRevision,
    requestCheckInRevision: customer && booking.status === "DepositPaid" && !!checkIn && !checkIn.isCustomerConfirmed && !checkIn.requiresRevision,
    reportNoShow: customer && booking.status === "DepositPaid" && !checkIn && start <= now,
    reportReturn: customer && booking.status === "InProgress" && !checkOut && started,
    createCheckOut: owner && activeReturn && !checkOut && started,
    confirmCheckOut: customer && activeReturn && !!checkOut && !checkOut.isCustomerConfirmed && started,
    disputeCheckOut: customer && activeReturn && !!checkOut && !checkOut.isCustomerConfirmed && started,
    confirmReceipt: owner && booking.status === "Returned",
    settle: owner && booking.status === "Completed" && booking.escrowStatus === "Held" && started && (!Number.isFinite(holdBase) || now >= holdBase + 48 * 3600000),
    paySurcharge: customer && ["Returned", "Completed"].includes(booking.status) && !!checkOut && Math.max(checkOut.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0, checkOut.externalPendingSurchargeAmount ?? booking.externalPendingSurchargeAmount ?? 0) > 0,
    confirmExternalSurcharge: owner && ["Returned", "Completed"].includes(booking.status) && !!checkOut && (checkOut.externalPendingSurchargeAmount ?? booking.externalPendingSurchargeAmount ?? 0) > 0,
  };
}
