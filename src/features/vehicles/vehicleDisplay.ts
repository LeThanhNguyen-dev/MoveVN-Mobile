import { toApiError } from "@/features/auth/services/authService";

export function isVehicleOcrFailure(flags: string[]) {
  return flags.some((flag) => flag === "OCR_ENGINE_UNAVAILABLE" || flag === "OCR_PROCESSING_FAILED");
}

export function getVehicleErrorMessage(error: unknown) {
  const apiError = toApiError(error);

  if (apiError.code === "VEHICLE_9008") {
    return "Cà vẹt đang chờ nhân viên duyệt. Bạn chưa thể tải ảnh khác lên lúc này.";
  }

  if (apiError.code === "VEHICLE_9009") {
    const lockedUntil = apiError.errors[0];
    if (lockedUntil) {
      const date = new Date(lockedUntil);
      if (!Number.isNaN(date.getTime())) {
        return `Bạn đã gửi ảnh không đạt quá nhiều lần. Vui lòng thử lại sau ${date.toLocaleString("vi-VN")}.`;
      }
    }

    return "Bạn đã gửi ảnh không đạt quá nhiều lần. Vui lòng thử lại sau.";
  }

  if (apiError.code === "VEHICLE_9015") {
    return "Phiên xác thực cà vẹt đã hết hạn hoặc thông tin xe đã thay đổi. Vui lòng xác thực lại.";
  }

  if (apiError.code === "VEHICLE_9016") {
    return "Không thể lưu phiên xác thực cà vẹt lúc này. Vui lòng thử lại.";
  }

  return apiError.message || "Không thể xử lý cà vẹt xe. Vui lòng thử lại.";
}
