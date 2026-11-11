import axios from "axios";
import i18n from "@/i18n";
import { translatedLabels } from "@/i18n/liveLabels";
import { getApiErrorMessage } from "@/services/apiClient";
import type { CreateViolation, ViolationReason, ViolationStatus, ViolationTargetType } from "./types";

// Nhãn dùng chung key với web khi text trùng; phần khác biệt nằm ở namespace mobile.
// Getter giữ nguyên descriptor để nhãn đổi theo ngôn ngữ đang chọn.
const sharedTargetLabels = translatedLabels("violations", { User: "target.User", Booking: "target.Booking" });
const mobileTargetLabels = translatedLabels("mobile", { Vehicle: "violation.target.Vehicle" });
export const targetLabels = Object.defineProperties(
  sharedTargetLabels,
  Object.getOwnPropertyDescriptors(mobileTargetLabels),
) as Record<ViolationTargetType, string>;

export const statusLabels = translatedLabels<ViolationStatus>("violations", {
  Open: "status.Open",
  InReview: "status.InReview",
  Resolved: "status.Resolved",
  Rejected: "status.Rejected",
});

const sharedActionLabels = translatedLabels("violations", {
  Reopen: "action.Reopen",
  Reject: "action.Reject",
  WarnUser: "action.WarnUser",
  VehicleHidden: "action.VehicleHidden",
});
const mobileActionLabels = translatedLabels("mobile", {
  Submitted: "violation.action.Submitted",
  Claim: "violation.action.Claim",
  Release: "violation.action.Release",
  Takeover: "violation.action.Takeover",
  ConfirmViolation: "violation.action.ConfirmViolation",
  HideVehicle: "violation.action.HideVehicle",
  SuspendAccount: "violation.action.SuspendAccount",
  LiftVehicleRestriction: "violation.action.LiftVehicleRestriction",
  AccountSuspended: "violation.action.AccountSuspended",
});
export const actionLabels: Record<string, string> = Object.defineProperties(
  sharedActionLabels,
  Object.getOwnPropertyDescriptors(mobileActionLabels),
) as Record<string, string>;
export const validReportId = (id: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);
export function safeEvidence(url: string) {
  try { const u = new URL(url); return url.length <= 2000 && u.protocol === "https:" && !u.username && !u.password && /^[a-z0-9.-]+$/i.test(u.hostname) && u.hostname.includes(".") && !/^\d[\d.]*$/.test(u.hostname) && !u.hostname.toLowerCase().endsWith(".local"); }
  catch { return false; }
}
export function validateViolation(value: CreateViolation, reasons: ViolationReason[]) {
  if (!Number.isSafeInteger(value.targetId) || value.targetId <= 0 || !["User", "Vehicle", "Booking"].includes(value.targetType)) return i18n.t("mobile:violation.errors.invalidTarget");
  if (!reasons.some(r => r.code === value.reason && r.targetTypes.includes(value.targetType))) return i18n.t("mobile:violation.errors.invalidReason");
  const length = value.description.trim().length;
  if (length < 20 || length > 4000) return i18n.t("mobile:violation.errors.invalidDescription");
  if (value.evidenceUrls.length > 5 || value.evidenceUrls.some(url => !safeEvidence(url))) return i18n.t("mobile:violation.errors.invalidEvidence");
  return "";
}
export function violationError(error: unknown, fallback = i18n.t("mobile:violation.errors.loadReport")) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return i18n.t("mobile:violation.errors.serverSlow");
    if (error.response?.status === 401) return i18n.t("mobile:violation.errors.sessionExpired");
    if (error.response?.status === 403) return i18n.t("mobile:violation.errors.forbidden");
    if (error.response?.status === 404) return i18n.t("mobile:violation.errors.notFound");
    return getApiErrorMessage(error, fallback);
  }
  return error instanceof Error ? error.message : fallback;
}
export function violationFromNotification(dataJson?: string | null) {
  try { const data = JSON.parse(dataJson || "{}"); const match = typeof data.targetPath === "string" && data.targetPath.match(/^\/my-violations\/([\da-f-]+)\/?$/i); return match && validReportId(match[1]) ? String(match[1]) : null; }
  catch { return null; }
}
