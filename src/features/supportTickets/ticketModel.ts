import axios from "axios";
import { getApiErrorMessage } from "@/services/apiClient";
import i18n from "@/i18n";
import type { CreateSupportTicketRequest } from "./types";

export const MAX_TICKET_IMAGES = 6;
export const MAX_TICKET_IMAGE_BYTES = 5 * 1024 * 1024;
export const isTicketClosed = (status: string) => status === "Resolved" || status === "Closed";
export function validateTicket(input: CreateSupportTicketRequest) {
  if (!input.subject.trim()) return i18n.t("mobile:supportTicket.errors.subjectRequired");
  if (input.subject.trim().length > 200) return i18n.t("mobile:supportTicket.errors.subjectTooLong");
  return validateReply(input.message);
}
export function validateReply(message: string) {
  if (!message.trim()) return i18n.t("mobile:supportTicket.errors.messageRequired");
  if (message.trim().length > 4000) return i18n.t("mobile:supportTicket.errors.messageTooLong");
  return "";
}
export function ticketError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return i18n.t("mobile:supportTicket.errors.timeout");
    if (error.response?.status === 403 || error.response?.status === 404) return i18n.t("mobile:supportTicket.errors.notFound");
    if (error.response?.status === 401) return i18n.t("mobile:supportTicket.errors.unauthorized");
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.includes("already closed")) return i18n.t("mobile:supportTicket.errors.closed");
  }
  if (error instanceof Error && !axios.isAxiosError(error)) return error.message || fallback;
  return getApiErrorMessage(error, fallback);
}
export function ticketDate(value?: string | null) {
  if (!value) return i18n.t("support:ticketQuality.notRecorded");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? i18n.t("support:ticketQuality.notRecorded") : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
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
