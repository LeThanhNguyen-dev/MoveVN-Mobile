import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import { appendUploadFile, type UploadFileInput } from "@/types/upload";
import type {
  AddTicketMessageRequest,
  CreateSupportTicketRequest,
  PagedResult,
  SupportTicketDetailResponse,
  SupportTicketListItem,
  SupportTicketListRequest,
  UpdateSupportTicketStatusRequest,
  TicketQuality,
  TicketFeedback,
} from "./types";

function required<T>(response: ApiResponse<T>): T {
  if (!response.status || response.data == null) throw new Error(response.message || "Chưa tải được yêu cầu hỗ trợ.");
  return response.data;
}

export async function createSupportTicket(data: CreateSupportTicketRequest): Promise<SupportTicketDetailResponse> {
  const res = await apiClient.post<ApiResponse<SupportTicketDetailResponse>>(endpoints.supportTickets.base, data);
  return required(res.data);
}

export async function getMySupportTickets(params: SupportTicketListRequest, signal?: AbortSignal): Promise<PagedResult<SupportTicketListItem>> {
  const res = await apiClient.get<ApiResponse<PagedResult<SupportTicketListItem>>>(endpoints.supportTickets.my, { params, signal });
  return required(res.data);
}

export async function getStaffSupportTickets(params: SupportTicketListRequest): Promise<PagedResult<SupportTicketListItem>> {
  const res = await apiClient.get<ApiResponse<PagedResult<SupportTicketListItem>>>(endpoints.supportTickets.staff, { params });
  return required(res.data);
}

export async function getSupportTicketById(id: number, signal?: AbortSignal): Promise<SupportTicketDetailResponse> {
  const res = await apiClient.get<ApiResponse<SupportTicketDetailResponse>>(endpoints.supportTickets.byId(id), { signal });
  return required(res.data);
}

export async function addSupportTicketMessage(id: number, data: AddTicketMessageRequest): Promise<SupportTicketDetailResponse> {
  const res = await apiClient.post<ApiResponse<SupportTicketDetailResponse>>(endpoints.supportTickets.messages(id), data);
  return required(res.data);
}

export async function updateSupportTicketStatus(id: number, data: UpdateSupportTicketStatusRequest): Promise<SupportTicketDetailResponse> {
  const res = await apiClient.put<ApiResponse<SupportTicketDetailResponse>>(endpoints.supportTickets.status(id), data);
  return required(res.data);
}

export async function uploadSupportTicketAttachment(file: UploadFileInput): Promise<string> {
  const formData = new FormData();
  appendUploadFile(formData, "file", file);
  const res = await apiClient.post<ApiResponse<{ url: string }>>(endpoints.supportTickets.uploadAttachment, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = required(res.data).url;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) throw new Error("Máy chủ chưa trả về ảnh hợp lệ. Vui lòng thử lại.");
  return url;
}

export async function getTicketQuality(id: number, signal?: AbortSignal): Promise<TicketQuality> {
  const res = await apiClient.get<ApiResponse<TicketQuality>>(`/api/support-quality/tickets/${id}`, { signal });
  return required(res.data);
}

export async function rateSupportTicket(id: number, rating: number, comment: string): Promise<TicketFeedback> {
  const res = await apiClient.post<ApiResponse<TicketFeedback>>(`/api/support-quality/tickets/${id}/feedback`, { rating, comment: comment.trim() });
  return required(res.data);
}
