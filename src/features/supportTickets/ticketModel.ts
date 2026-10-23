import axios from "axios";
import { getApiErrorMessage } from "@/services/apiClient";
import type { CreateSupportTicketRequest } from "./types";

export const MAX_TICKET_IMAGES = 6;
export const MAX_TICKET_IMAGE_BYTES = 5 * 1024 * 1024;
export const isTicketClosed = (status: string) => status === "Resolved" || status === "Closed";
export function validateTicket(input: CreateSupportTicketRequest) {
  if (!input.subject.trim()) return "Vui lòng nhập tiêu đề yêu cầu.";
  if (input.subject.trim().length > 200) return "Tiêu đề tối đa 200 ký tự.";
  return validateReply(input.message);
}
export function validateReply(message: string) {
  if (!message.trim()) return "Vui lòng nhập nội dung hỗ trợ.";
  if (message.trim().length > 4000) return "Nội dung tối đa 4.000 ký tự.";
  return "";
}
export function ticketError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "Máy chủ phản hồi chậm. Nội dung vẫn được giữ; hãy tải lại danh sách để kiểm tra trước khi gửi lại.";
    if (error.response?.status === 403 || error.response?.status === 404) return "Không tìm thấy yêu cầu hoặc bạn không có quyền truy cập.";
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.includes("already closed")) return "Yêu cầu đã kết thúc nên không thể gửi thêm phản hồi. Hãy làm mới để xem trạng thái.";
  }
  if (error instanceof Error && !axios.isAxiosError(error)) return error.message || fallback;
  return getApiErrorMessage(error, fallback);
}
export function ticketDate(value?: string | null) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Only own-ticket destinations are supported. Staff links must never turn into an owner/customer destination. */
export function ticketFromNotification(dataJson?: string | null): number | null {
  try {
    const data = JSON.parse(dataJson || "{}") as { ticketId?: unknown; targetPath?: unknown };
    const path = typeof data.targetPath === "string" ? data.targetPath : "";
    if (path && !/^\/customer\/support-tickets\/\d+\/?$/.test(path)) return null;
    const id = Number(data.ticketId ?? path.match(/\/(\d+)\/?$/)?.[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}
