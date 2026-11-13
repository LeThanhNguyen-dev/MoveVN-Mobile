import i18n from "@/i18n";
import { translatedLabels } from "@/i18n/liveLabels";

const NS = "accountVerification";

// Nhãn resolve mỗi lần đọc (getter) để không đóng băng tiếng Việt lúc import module.
export const driverLicenseStatusLabel: Record<string, string> = translatedLabels<string>(NS, {
  None: "driverStatus.None",
  Pending: "driverStatus.Pending",
  Processing: "driverStatus.Processing",
  Verified: "driverStatus.Verified",
  NeedMoreInfo: "driverStatus.NeedMoreInfo",
  Rejected: "driverStatus.Rejected",
  Failed: "driverStatus.Failed",
  Pass: "driverStatus.Pass",
  ManualReview: "driverStatus.ManualReview",
  Reject: "driverStatus.Reject",
});

const flagLabels: Record<string, string> = translatedLabels<string>(NS, {
  IMAGE_TOO_BLURRY: "driverFlags.IMAGE_TOO_BLURRY",
  IMAGE_TOO_DARK: "driverFlags.IMAGE_TOO_DARK",
  IMAGE_TOO_BRIGHT: "driverFlags.IMAGE_TOO_BRIGHT",
  IMAGE_TOO_SMALL: "driverFlags.IMAGE_TOO_SMALL",
  DOCUMENT_NOT_READABLE: "driverFlags.DOCUMENT_NOT_READABLE",
  NO_TEXT_DETECTED: "driverFlags.NO_TEXT_DETECTED",
  DRIVER_LICENSE_NUMBER_NOT_FOUND: "driverFlags.DRIVER_LICENSE_NUMBER_NOT_FOUND",
  LICENSE_CLASS_NOT_FOUND: "driverFlags.LICENSE_CLASS_NOT_FOUND",
  LICENSE_CLASS_NOT_RECOGNIZED_IN_VIETNAM: "driverFlags.LICENSE_CLASS_NOT_RECOGNIZED_IN_VIETNAM",
  LICENSE_CLASS_NOT_VALID_FOR_REQUESTED_VEHICLE:
    "driverFlags.LICENSE_CLASS_NOT_VALID_FOR_REQUESTED_VEHICLE",
  FULL_NAME_NOT_FOUND: "driverFlags.FULL_NAME_NOT_FOUND",
  FULL_NAME_MISMATCH: "driverFlags.FULL_NAME_MISMATCH",
  LICENSE_CLASS_UNCERTAIN: "driverFlags.LICENSE_CLASS_UNCERTAIN",
  MINISTRY_MARKER_NOT_FOUND: "driverFlags.MINISTRY_MARKER_NOT_FOUND",
  NATIONAL_MOTTO_NOT_FOUND: "driverFlags.NATIONAL_MOTTO_NOT_FOUND",
  DRIVER_LICENSE_TITLE_NOT_FOUND: "driverFlags.DRIVER_LICENSE_TITLE_NOT_FOUND",
  LOW_OCR_CONFIDENCE: "driverFlags.LOW_OCR_CONFIDENCE",
  OCR_ENGINE_UNAVAILABLE: "driverFlags.OCR_ENGINE_UNAVAILABLE",
  OCR_PROCESSING_FAILED: "driverFlags.OCR_PROCESSING_FAILED",
  IMAGE_DECODE_FAILED: "driverFlags.IMAGE_DECODE_FAILED",
});

export function formatDriverLicenseFlags(flags?: string[] | null) {
  return (flags ?? []).map((flag) => flagLabels[flag] ?? flag);
}

function formatVietnamTimeFromUtcText(message: string) {
  const match = message.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+UTC/i);
  if (!match) return null;

  const date = new Date(`${match[1]}T${match[2]}Z`);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Bangkok",
  });
}

export function translateDriverLicenseMessage(message?: string | null, fallback?: string) {
  const fallbackText = fallback ?? i18n.t("driverMessages.default", { ns: NS });
  if (!message) return fallbackText;
  const normalized = message.toLowerCase();
  const vietnamLockedUntil = formatVietnamTimeFromUtcText(message);

  if (vietnamLockedUntil && normalized.includes("gplx")) {
    return i18n.t("driverMessages.otpLocked", { ns: NS, time: vietnamLockedUntil });
  }
  if (normalized.includes("gplx") && normalized.includes("a1") && normalized.includes("xác minh")) {
    return i18n.t("driverMessages.a1Mismatch", { ns: NS });
  }
  if (normalized.includes("gplx") && normalized.includes("không phù hợp")) {
    return i18n.t("driverMessages.classMismatch", { ns: NS });
  }
  if (normalized.includes("no readable text") || normalized.includes("ocr did not return")) {
    return i18n.t("driverMessages.noReadableText", { ns: NS });
  }
  if (normalized.includes("markers") || normalized.includes("license class")) {
    return i18n.t("driverMessages.markers", { ns: NS });
  }
  if (normalized.includes("ocr.space api key")) {
    return i18n.t("driverMessages.ocrApiKey", { ns: NS });
  }
  if (normalized.includes("manual driver license fields can only be used")) {
    return i18n.t("driverMessages.manualFields", { ns: NS });
  }
  if (normalized.includes("driver license number and class are required")) {
    return i18n.t("driverMessages.fieldsRequired", { ns: NS });
  }
  if (
    normalized.includes("driver license upload is temporarily locked") ||
    (normalized.includes("gplx") && normalized.includes("quá nhiều"))
  ) {
    return i18n.t("driverMessages.uploadLocked", { ns: NS });
  }
  if (
    normalized.includes("driver license can only be updated") ||
    normalized.includes("cập nhật lại sau")
  ) {
    return i18n.t("driverMessages.updateCooldown", { ns: NS });
  }
  if (normalized.includes("driver license verification passed")) {
    return i18n.t("driverMessages.passed", { ns: NS });
  }
  if (normalized.includes("requires staff review")) {
    return i18n.t("driverMessages.staffReview", { ns: NS });
  }
  return message;
}
