import axios from "axios";
import { getApiErrorMessage } from "@/services/apiClient";
import type { CreateViolation, ViolationReason, ViolationStatus, ViolationTargetType } from "./types";

export const targetLabels: Record<ViolationTargetType, string> = { User: "Tài khoản", Vehicle: "Tin xe", Booking: "Booking" };
export const statusLabels: Record<ViolationStatus, string> = { Open: "Chờ tiếp nhận", InReview: "Đang xác minh", Resolved: "Xác nhận vi phạm", Rejected: "Không đủ căn cứ" };
export const actionLabels: Record<string, string> = { Submitted: "Đã tiếp nhận báo cáo", Claim: "Bắt đầu xác minh", Release: "Chuyển lại hàng đợi", Takeover: "Chuyển người phụ trách", Reopen: "Mở lại xác minh", Reject: "Không đủ căn cứ vi phạm", ConfirmViolation: "Đã xác nhận vi phạm", HideVehicle: "Xác nhận vi phạm và ẩn tin xe", WarnUser: "Xác nhận vi phạm và cảnh báo", SuspendAccount: "Xác nhận vi phạm và tạm khóa tài khoản", LiftVehicleRestriction: "Gỡ hạn chế đăng xe", VehicleHidden: "Đã ẩn tin xe", AccountSuspended: "Đã tạm khóa tài khoản" };
export const validReportId = (id: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);
export function safeEvidence(url: string) {
  try { const u = new URL(url); return url.length <= 2000 && u.protocol === "https:" && !u.username && !u.password && /^[a-z0-9.-]+$/i.test(u.hostname) && u.hostname.includes(".") && !/^\d[\d.]*$/.test(u.hostname) && !u.hostname.toLowerCase().endsWith(".local"); }
  catch { return false; }
}
export function validateViolation(value: CreateViolation, reasons: ViolationReason[]) {
  if (!Number.isSafeInteger(value.targetId) || value.targetId <= 0 || !["User", "Vehicle", "Booking"].includes(value.targetType)) return "Đối tượng báo cáo không hợp lệ. Hãy mở lại từ trang chi tiết.";
  if (!reasons.some(r => r.code === value.reason && r.targetTypes.includes(value.targetType))) return "Vui lòng chọn lý do phù hợp với đối tượng.";
  const length = value.description.trim().length;
  if (length < 20 || length > 4000) return "Mô tả phải có từ 20 đến 4.000 ký tự.";
  if (value.evidenceUrls.length > 5 || value.evidenceUrls.some(url => !safeEvidence(url))) return "Tối đa 5 ảnh bằng chứng hợp lệ.";
  return "";
}
export function violationError(error: unknown, fallback = "Không tải được báo cáo. Vui lòng thử lại.") {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "Máy chủ phản hồi chậm. Hãy kiểm tra Báo cáo của tôi trước khi gửi lại; nội dung đang soạn vẫn được giữ.";
    if (error.response?.status === 401) return "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
    if (error.response?.status === 403) return "Tài khoản hiện không có quyền thực hiện thao tác này.";
    if (error.response?.status === 404) return "Không tìm thấy báo cáo hoặc đối tượng. Chỉ người gửi được xem báo cáo của mình.";
    return getApiErrorMessage(error, fallback);
  }
  return error instanceof Error ? error.message : fallback;
}
export function violationFromNotification(dataJson?: string | null) {
  try { const data = JSON.parse(dataJson || "{}"); const match = typeof data.targetPath === "string" && data.targetPath.match(/^\/my-violations\/([\da-f-]+)\/?$/i); return match && validReportId(match[1]) ? String(match[1]) : null; }
  catch { return null; }
}
