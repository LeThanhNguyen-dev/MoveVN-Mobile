import type { BookingResponse, InspectionReportResponse } from "./types";
import { bookingActions } from "./bookingActions";
import { escrowHoldInfo } from "./utils/format";

export type FlowRole = "Owner" | "Customer";

export const FLOW_STEPS = 6;

const ACTIONABLE_KEYS = new Set([
  "approve",
  "payDeposit",
  "createCheckIn",
  "confirmCheckIn",
  "requestCheckInRevision",
  "reportNoShow",
  "reportReturn",
  "createCheckOut",
  "confirmCheckOut",
  "disputeCheckOut",
  "confirmReceipt",
  "settle",
  "paySurcharge",
]);

const TERMINAL_KEYS = new Set(["cancelled", "rejected"]);

export function bookingFlowStep(status: string | undefined): number {
  switch (status) {
    case "Pending": return 0;
    case "Approved": return 1;
    case "DepositPaid":
    case "Confirmed": return 2;
    case "InProgress": return 3;
    case "Returning": return 4;
    case "Returned": return 5;
    case "Completed": return 6;
    default: return 0;
  }
}

export interface FlowGuide {
  step: number;
  key: string;
  hours?: number;
  actionable: boolean;
  terminal: boolean;
}

/** Suy ra bước hiện tại + hành động tiếp theo từ trạng thái booking (dùng chung hợp đồng action của web/mobile). */
export function bookingFlowGuide(
  booking: BookingResponse,
  reports: InspectionReportResponse[],
  role: FlowRole | undefined,
  now = Date.now(),
): FlowGuide {
  const status = booking.status;
  const step = bookingFlowStep(status);
  const actions = bookingActions(booking, reports, role, now);
  const checkIn = reports.find((r) => r.type === "CheckIn");
  const checkOut = reports.find((r) => r.type === "CheckOut");
  const owner = role === "Owner";
  let key = "default";
  let hours: number | undefined;

  if (status === "Cancelled") {
    key = "cancelled";
  } else if (status === "Rejected") {
    key = "rejected";
  } else if (status === "Pending") {
    key = actions.approve ? "approve" : "waitApproval";
  } else if (status === "Approved") {
    key = actions.payDeposit ? "payDeposit" : owner ? "waitDeposit" : "waitDepositExpired";
  } else if (status === "DepositPaid" || status === "Confirmed") {
    if (owner) {
      key = actions.createCheckIn
        ? "createCheckIn"
        : checkIn && !checkIn.isCustomerConfirmed && !checkIn.requiresRevision
          ? "waitCheckInConfirm"
          : checkIn?.requiresRevision
            ? "createCheckIn"
            : checkIn?.isCustomerConfirmed
              ? "waitStart"
              : "waitPickup";
    } else {
      key = actions.confirmCheckIn
        ? "confirmCheckIn"
        : actions.requestCheckInRevision
          ? "requestCheckInRevision"
          : actions.reportNoShow
            ? "reportNoShow"
            : checkIn?.requiresRevision
              ? "waitCheckInRevision"
              : checkIn?.isCustomerConfirmed
                ? "waitStart"
                : checkIn
                  ? "confirmCheckIn"
                  : booking.canCheckInNow
                    ? "waitPickupReport"
                    : "waitPickup";
    }
  } else if (status === "InProgress") {
    if (owner) {
      key = actions.createCheckOut ? "createCheckOut" : "renting";
    } else {
      key = actions.reportReturn ? "reportReturn" : "renting";
    }
  } else if (status === "Returning") {
    if (owner) {
      key = actions.createCheckOut
        ? "createCheckOut"
        : checkOut && !checkOut.isCustomerConfirmed
          ? "waitCheckOutConfirm"
          : checkOut?.isCustomerConfirmed
            ? "waitReturnFinish"
            : "renting";
    } else {
      key = actions.confirmCheckOut
        ? "confirmCheckOut"
        : actions.disputeCheckOut
          ? "disputeCheckOut"
          : checkOut?.isCustomerConfirmed
            ? "waitOwnerReceipt"
            : !checkOut
              ? "waitReturnReport"
              : "renting";
    }
  } else if (status === "Returned") {
    if (owner) {
      key = actions.confirmReceipt ? "confirmReceipt" : "waitReturnFinish";
    } else {
      key = actions.paySurcharge ? "paySurcharge" : "waitOwnerReceipt";
    }
  } else if (status === "Completed") {
    if (actions.settle) {
      key = "settle";
    } else if (actions.paySurcharge) {
      key = "paySurcharge";
    } else if (owner && booking.escrowStatus === "Held") {
      const hold = escrowHoldInfo(checkOut?.createdAt, booking.completedAt, now);
      hours = hold.remainingHours;
      key = hold.withinHoldWindow ? "settleHold" : "settle";
    } else {
      key = "done";
    }
  }

  return {
    step,
    key,
    hours,
    actionable: ACTIONABLE_KEYS.has(key),
    terminal: TERMINAL_KEYS.has(key),
  };
}
