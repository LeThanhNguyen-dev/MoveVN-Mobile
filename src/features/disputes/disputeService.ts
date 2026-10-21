import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { PagedResult } from "@/features/admin/types";
import { appendUploadFile, type UploadFileInput } from "@/types/upload";
import type {
  CreateDisputeRequest,
  AddDisputeEvidenceRequest,
  DisputeDetailResponse,
  DisputeListItem,
  DisputeListRequest,
  RequestMoreEvidenceRequest,
  ResolveDisputeRequest,
} from "@/features/disputes/types";

const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 };

export type TrafficFineAction = "verify" | "respond" | "payment-proof" | "review-payment" | "reject" | "confirm-owner-receipt";

export async function updateTrafficFine(
  id: number,
  action: TrafficFineAction,
  data: {
    expectedVersion: number;
    note?: string;
    acceptResponsibility?: boolean;
    amount?: number;
    paidAt?: string;
    transactionReference?: string;
    evidenceUrls?: string;
    evidenceUploadTokens?: string[];
    proofId?: number;
    accept?: boolean;
  },
) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(
    `${endpoints.disputes.byId(id)}/traffic-fine/${action}`,
    data,
  );
  return res.data.data!;
}

export async function createDispute(data: CreateDisputeRequest) {
  const res = await apiClient.post<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.base, data);
  return res.data.data!;
}

export async function uploadDisputeEvidenceImages(files: UploadFileInput[]) {
  const formData = new FormData();
  files.forEach((file) => appendUploadFile(formData, "images", file));
  const res = await apiClient.post<ApiResponse<{ urls: string[]; tokens: string[] }>>(
    endpoints.disputes.uploadEvidenceImages,
    formData,
  );
  if (!res.data.data || res.data.data.urls.length !== files.length) throw new Error("Không thể tải đầy đủ ảnh bằng chứng.");
  return res.data.data;
}

export async function getMyDisputes(params: DisputeListRequest) {
  const res = await apiClient.get<ApiResponse<PagedResult<DisputeListItem>>>(endpoints.disputes.my, { params });
  return res.data.data ?? emptyPage;
}

export async function getStaffDisputes(params: DisputeListRequest) {
  const res = await apiClient.get<ApiResponse<PagedResult<DisputeListItem>>>(endpoints.disputes.staff, { params });
  return res.data.data ?? emptyPage;
}

export async function getDisputeById(id: number) {
  const res = await apiClient.get<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.byId(id));
  return res.data.data!;
}

export async function investigateDispute(id: number) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.investigate(id));
  return res.data.data!;
}

export async function requestMoreDisputeEvidence(id: number, data: RequestMoreEvidenceRequest) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.requestMoreEvidence(id), data);
  return res.data.data!;
}

export async function addDisputeEvidence(id: number, data: AddDisputeEvidenceRequest) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.evidence(id), data);
  return res.data.data!;
}

export async function resolveDispute(id: number, data: ResolveDisputeRequest) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.resolve(id), data);
  return res.data.data!;
}

export async function escalateDispute(id: number, data: ResolveDisputeRequest) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.escalate(id), data);
  return res.data.data!;
}

export async function adminOverrideDispute(id: number, data: ResolveDisputeRequest) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.adminOverride(id), data);
  return res.data.data!;
}

export async function confirmExternalSettlement(id: number, updatedAt?: string | null) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.confirmExternalSettlement(id), { updatedAt });
  return res.data.data!;
}

export async function acceptDisputeResolution(id: number, updatedAt?: string | null) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(`${endpoints.disputes.byId(id)}/accept-resolution`, { updatedAt });
  return res.data.data!;
}

export async function adminCloseDispute(id: number, reason: string, updatedAt?: string | null) {
  const res = await apiClient.put<ApiResponse<DisputeDetailResponse>>(endpoints.disputes.adminClose(id), { reason, updatedAt });
  return res.data.data!;
}
