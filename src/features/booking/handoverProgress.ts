import type { BookingResponse, InspectionReportResponse } from "./types";

export function handoverProgress(booking: BookingResponse, type: "CheckIn" | "CheckOut", report?: InspectionReportResponse) {
  const state = (label: string, guidance: string, tone: "waiting" | "action" | "done" = "waiting") => ({ label, guidance, tone });
  if (["Cancelled", "Rejected"].includes(booking.status)) return state("Đã dừng", "Đơn thuê đã kết thúc, không tiếp tục bàn giao.");
  if (type === "CheckIn") {
    if (report?.isCustomerConfirmed || ["InProgress", "Returning", "Returned", "Completed"].includes(booking.status)) return state("Đã nhận xe", "Hai bên đã hoàn tất nhận xe.", "done");
    if (report?.requiresRevision) return state("Chờ chủ xe lập lại", report.revisionReason || "Khách yêu cầu chỉnh sửa. Chủ xe cần gửi lại biên bản nhận xe.", "action");
    if (report) return state("Chờ khách xác nhận", "Chủ xe đã gửi biên bản. Khách mở kiểm tra và xác nhận nhận xe.", "action");
    if (booking.status !== "DepositPaid") return state("Chưa đến bước nhận xe", "Hoàn tất duyệt đơn và đặt cọc trước khi nhận xe.");
    if (!booking.canCheckInNow) return state("Chờ giờ nhận xe", booking.checkInUnavailableReason || "Chưa mở nhận xe. Có thể nhận sớm tối đa 2 giờ nếu xe trống.");
    return state("Chờ chủ xe lập biên bản", "Đã có thể nhận xe. Chủ xe kiểm tra xe, chụp ảnh và gửi biên bản cho khách.", "action");
  }
  const outstanding = Math.max(report?.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0, report?.externalPendingSurchargeAmount ?? booking.externalPendingSurchargeAmount ?? 0);
  if (["Returned", "Completed"].includes(booking.status) && outstanding > 0) return state("Còn phụ thu cần xử lý", "Khách đã xác nhận trả xe. Kiểm tra khoản phụ thu và xác nhận thanh toán.", "action");
  if (booking.status === "Completed") return state("Đã hoàn tất trả xe", "Chủ xe đã xác nhận nhận lại xe.", "done");
  if (booking.status === "Returned") return state("Chờ chủ xe nhận lại", "Khách đã xác nhận trả xe. Chủ xe cần xác nhận đã nhận xe để hoàn tất chuyến.", "action");
  if (report?.requiresRevision) return state("Chờ cập nhật biên bản", "Chủ xe cần cập nhật biên bản trả xe.", "action");
  if (report && !report.isCustomerConfirmed) return state("Chờ khách xác nhận", "Chủ xe đã gửi biên bản trả xe. Khách kiểm tra tình trạng xe và phụ thu trước khi xác nhận.", "action");
  if (booking.status === "Returning") return state("Chờ chủ xe kiểm tra xe", "Khách đã báo trả xe. Chủ xe kiểm tra và lập biên bản trả xe.", "action");
  if (booking.status === "InProgress") return state("Đang thuê xe", "Khách có thể báo trả xe; chủ xe có thể lập biên bản khi hai bên bàn giao.");
  return state("Chưa đến bước trả xe", "Tiến trình trả xe bắt đầu sau khi nhận xe.");
}
