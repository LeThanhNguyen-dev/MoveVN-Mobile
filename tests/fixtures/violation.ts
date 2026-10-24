import type { ViolationDetail, ViolationReason } from "@/features/violations/types";
export const report: ViolationDetail = { id: "12345678-1234-1234-1234-123456789abc", targetType: "Vehicle", targetId: 7, targetLabel: "Xe #7 · 43A-12345", reason: "UnsafeVehicle", status: "Open", reporterId: 10, description: "Xe có dấu hiệu không đúng mô tả trong tin đăng.", evidenceUrls: ["https://example.invalid/photo.jpg"], decision: null, resolution: null, closedAt: null, createdAt: "2026-10-23T02:00:00Z", updatedAt: "2026-10-23T02:00:00Z", history: [{ id: 1, action: "Submitted", internal: false, actorName: "Bạn", note: "Đã tiếp nhận báo cáo. Chưa có kết luận vi phạm.", createdAt: "2026-10-23T02:00:00Z" }] };
export const violationReasons: ViolationReason[] = [
  { code: "Fraud", label: "Có dấu hiệu lừa đảo", targetTypes: ["User", "Vehicle", "Booking"] },
  { code: "UnsafeVehicle", label: "Xe không an toàn / không đúng mô tả", targetTypes: ["Vehicle", "Booking"] },
  { code: "Harassment", label: "Quấy rối / ngôn từ không phù hợp", targetTypes: ["User", "Booking"] },
  { code: "Other", label: "Vi phạm khác", targetTypes: ["User", "Vehicle", "Booking"] },
];
