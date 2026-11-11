import i18n from "@/i18n";
import { toApiError } from "@/features/auth/services/authService";

export function isVehicleOcrFailure(flags: string[]) {
  return flags.some((flag) => flag === "OCR_ENGINE_UNAVAILABLE" || flag === "OCR_PROCESSING_FAILED");
}

export function getVehicleErrorMessage(error: unknown) {
  const apiError = toApiError(error);

  if (apiError.code === "VEHICLE_9008") {
    return i18n.t("owner:vehicles.cavetErrors.pendingReview");
  }

  if (apiError.code === "VEHICLE_9009") {
    const lockedUntil = apiError.errors[0];
    if (lockedUntil) {
      const date = new Date(lockedUntil);
      if (!Number.isNaN(date.getTime())) {
        return i18n.t("owner:vehicles.cavetErrors.tooManyAttemptsDate", {
          date: date.toLocaleString("vi-VN"),
        });
      }
    }

    return i18n.t("owner:vehicles.cavetErrors.tooManyAttempts");
  }

  if (apiError.code === "VEHICLE_9015") {
    return i18n.t("mobile:vehicleList.verify.sessionChanged");
  }

  if (apiError.code === "VEHICLE_9016") {
    return i18n.t("mobile:vehicleList.verify.saveSessionError");
  }

  return apiError.message || i18n.t("owner:vehicles.cavetErrors.generic");
}
