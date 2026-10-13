import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { PagedResult } from "@/features/admin/types";
import type { MarkAllNotificationsReadResponse, NotificationItem, NotificationUnreadCountResponse } from "@/features/notifications/types";

export async function getNotifications(params: Record<string, string | number | boolean | undefined>) {
  const res = await apiClient.get<ApiResponse<PagedResult<NotificationItem>>>(endpoints.notifications.base, { params });
  if (!res.data.data) throw new Error("Missing notification list response.");
  return res.data.data;
}

export async function getNotificationUnreadCount() {
  const res = await apiClient.get<ApiResponse<NotificationUnreadCountResponse>>(endpoints.notifications.unreadCount);
  if (!res.data.data) throw new Error("Missing unread count response.");
  return res.data.data;
}

export async function markNotificationAsRead(id: number) {
  const res = await apiClient.put<ApiResponse<NotificationItem>>(endpoints.notifications.markRead(id));
  if (!res.data.data) throw new Error("Missing notification response.");
  return res.data.data;
}

export async function markAllNotificationsAsRead() {
  const res = await apiClient.put<ApiResponse<MarkAllNotificationsReadResponse>>(endpoints.notifications.markAllRead);
  if (!res.data.data) throw new Error("Missing mark-all response.");
  return res.data.data;
}
