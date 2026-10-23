import type { SupportTicketDetailResponse, TicketQuality } from "@/features/supportTickets/types";

export const ticket: SupportTicketDetailResponse = {
  id: 41, userId: 10, customerName: "Khách kiểm thử", ticketNumber: "TK202610230041", category: "Payment", subject: "Cần kiểm tra khoản thanh toán", status: "InProgress", priority: "High", assignedStaffId: 20, assignedStaffName: "Nhân viên hỗ trợ", bookingId: null, messageCount: 2, createdAt: "2026-10-22T08:00:00Z", lastMessageAt: "2026-10-22T09:00:00Z",
  messages: [
    { id: 1, ticketId: 41, senderId: 10, senderName: "Khách kiểm thử", senderRoles: ["Customer"], message: "Khoản tiền đã trừ nhưng booking chưa cập nhật.", createdAt: "2026-10-22T08:00:00Z", attachmentUrls: '["https://example.invalid/payment.jpg"]' },
    { id: 2, ticketId: 41, senderId: 20, senderName: "Nhân viên hỗ trợ", senderRoles: ["Staff"], message: "Chúng tôi đang kiểm tra giao dịch của bạn.", createdAt: "2026-10-22T09:00:00Z" },
  ],
};
export const quality: TicketQuality = { ticketId: 41, generatedAt: "2026-10-23T00:00:00Z", tracked: true, canRate: false, feedback: [], cycles: [
  { id: "cycle-1", number: 1, priority: "High", startedAt: "2026-10-22T08:00:00Z", responseDueAt: "2026-10-22T10:00:00Z", resolutionDueAt: "2026-10-24T08:00:00Z", firstResponseAt: "2026-10-22T09:00:00Z", resolvedAt: null, responseState: "Met", resolutionState: "Pending", responseMinutes: 60, resolutionMinutes: null },
] };
