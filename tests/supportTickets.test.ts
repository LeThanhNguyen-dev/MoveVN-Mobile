import { beforeEach, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { ticket, quality } from "./fixtures/supportTicket";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), generation: 1, user: { userId: 10 }, role: "Customer", token: "test" }));
vi.mock("@/services/apiClient", () => ({ apiClient: mocks, getApiErrorMessage: (_e: unknown, fallback: string) => fallback }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ getAuthUser: () => mocks.user, getToken: () => mocks.token, getSessionGeneration: () => mocks.generation, useAuthStore: { getState: () => ({ activeRole: mocks.role }) } }));
import { createSupportTicket, getMySupportTickets, getSupportTicketById, addSupportTicketMessage, getTicketQuality, rateSupportTicket, uploadSupportTicketAttachment } from "@/features/supportTickets/supportTicketService";
import { validateTicket, validateReply, ticketFromNotification, isTicketClosed, ticketDate, ticketError } from "@/features/supportTickets/ticketModel";
import { closeSupportTickets, openSupportTickets, useTicketNavigation } from "@/features/supportTickets/ticketNavigation";
import { parseSupportTicketAttachmentUrls, serializeSupportTicketAttachmentUrls } from "@/features/supportTickets/supportTicketAttachments";

beforeEach(() => { vi.clearAllMocks(); mocks.generation = 1; mocks.role = "Customer"; mocks.token = "test"; closeSupportTickets(); });
it("uses the authenticated own-ticket endpoint with filters and abort signal", async () => {
  const data = { items: [ticket], totalCount: 1, page: 2, pageSize: 10 };
  mocks.get.mockResolvedValue({ data: { status: true, data } }); const signal = new AbortController().signal;
  const filters = { bookingId: 5, category: "Payment", status: "Open", keyword: "thanh toán", page: 2, pageSize: 10 };
  expect(await getMySupportTickets(filters, signal)).toEqual(data);
  expect(mocks.get).toHaveBeenCalledWith("/api/support-tickets/my", { params: filters, signal });
});
it("does not turn unsuccessful API responses into empty data or successful mutations", async () => {
  mocks.get.mockResolvedValue({ data: { status: false, message: "Không có quyền" } });
  await expect(getMySupportTickets({})).rejects.toThrow("Không có quyền");
  await expect(getSupportTicketById(41)).rejects.toThrow();
  mocks.post.mockResolvedValue({ data: { status: false, message: "Không gửi được" } });
  await expect(createSupportTicket({ category: "Other", priority: "Normal", subject: "Test", message: "Test" })).rejects.toThrow("Không gửi được");
  await expect(addSupportTicketMessage(41, { message: "Test" })).rejects.toThrow();
});
it("posts creation, replies and feedback using their actual backend contracts", async () => {
  mocks.post.mockResolvedValue({ data: { status: true, data: ticket } });
  const request = { bookingId: 5, category: "Booking", priority: "High", subject: "Bàn giao", message: "Cần kiểm tra", attachmentUrls: '["https://example.invalid/a.jpg"]' };
  await createSupportTicket(request); expect(mocks.post).toHaveBeenLastCalledWith("/api/support-tickets", request);
  await addSupportTicketMessage(41, { message: "Bổ sung" }); expect(mocks.post).toHaveBeenLastCalledWith("/api/support-tickets/41/messages", { message: "Bổ sung" });
  await rateSupportTicket(41, 5, "  Cảm ơn  "); expect(mocks.post).toHaveBeenLastCalledWith("/api/support-quality/tickets/41/feedback", { rating: 5, comment: "Cảm ơn" });
  mocks.get.mockResolvedValue({ data: { status: true, data: quality } }); expect(await getTicketQuality(41)).toEqual(quality);
});
it("validates empty and boundary-length content and terminal ticket statuses", () => {
  const input = { category: "Other", priority: "Normal", subject: "  ", message: "test" };
  expect(validateTicket(input)).toContain("tiêu đề"); expect(validateTicket({ ...input, subject: "x".repeat(201) })).toContain("200");
  expect(validateReply(" \n ")).toContain("nội dung"); expect(validateReply("x".repeat(4001))).toContain("4.000");
  expect(validateTicket({ ...input, subject: "x".repeat(200), message: "x".repeat(4000) })).toBe("");
  expect(["Open", "InProgress", "Resolved", "Closed"].map(isTicketClosed)).toEqual([false, false, true, true]);
});
it("supports legacy attachments and only recognizes own-ticket notification destinations", () => {
  expect(parseSupportTicketAttachmentUrls('["https://a.test/a,b.jpg",null]')).toEqual(["https://a.test/a,b.jpg"]);
  expect(parseSupportTicketAttachmentUrls("https://a.test/a.jpg\nhttps://a.test/b.jpg")).toHaveLength(2);
  expect(serializeSupportTicketAttachmentUrls([])).toBeUndefined();
  expect(ticketFromNotification(JSON.stringify({ ticketId: 41, bookingId: 5, targetPath: "/customer/support-tickets/41" }))).toBe(41);
  expect(ticketFromNotification('{"targetPath":"/customer/support-tickets/41"}')).toBe(41);
  for (const value of ["bad", '{"ticketId":0}', '{"ticketId":1.5}', '{"ticketId":41,"targetPath":"/support-tickets/41"}', '{"ticketId":41,"targetPath":"https://evil.test"}']) expect(ticketFromNotification(value)).toBeNull();
});
it("opens support only for authenticated customer/owner sessions and records the session identity", () => {
  openSupportTickets({ bookingId: 5 }); expect(useTicketNavigation.getState()).toMatchObject({ entry: { bookingId: 5 }, userId: 10, generation: 1 });
  closeSupportTickets(); mocks.role = "Staff"; openSupportTickets({ ticketId: 41 }); expect(useTicketNavigation.getState().entry).toBeNull();
  mocks.role = "Owner"; mocks.generation = 2; openSupportTickets({ ticketId: 41 }); expect(useTicketNavigation.getState().generation).toBe(2);
  closeSupportTickets(); mocks.token = ""; openSupportTickets(); expect(useTicketNavigation.getState().entry).toBeNull();
});
it("does not silently accept a broken upload response", async () => {
  const file = new Blob(["isolated-test"], { type: "image/png" });
  mocks.post.mockResolvedValue({ data: { status: true, data: { url: "javascript:alert(1)" } } });
  await expect(uploadSupportTicketAttachment(file)).rejects.toThrow("ảnh hợp lệ");
  mocks.post.mockResolvedValue({ data: { status: true, data: { url: "https://example.invalid/image.png" } } });
  expect(await uploadSupportTicketAttachment(file)).toContain("image.png");
});
it("explains network timeout and closed-ticket errors and formats dates in Vietnam time", () => {
  expect(ticketError(new AxiosError("timeout", "ECONNABORTED"), "fallback")).toContain("phản hồi chậm");
  expect(ticketError(new Error("Camera bị từ chối"), "fallback")).toBe("Camera bị từ chối");
  expect(ticketDate("2026-10-22T18:30:00Z")).toContain("23/10/2026"); expect(ticketDate("invalid")).toBe("Chưa ghi nhận");
});
