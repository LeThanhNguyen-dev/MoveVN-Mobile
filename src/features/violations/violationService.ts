import type { ApiResponse } from "@/features/auth/types";
import { apiClient } from "@/services/apiClient";
import { appendUploadFile, type UploadFileInput } from "@/types/upload";
import type { CreateViolation, ViolationDetail, ViolationPage, ViolationQuery, ViolationReason } from "./types";
import { safeEvidence } from "./violationModel";

const base = "/api/violation-reports";
function required<T>(value: ApiResponse<T>): T { if (!value.status || value.data == null) throw new Error(value.message || "Máy chủ chưa trả về dữ liệu báo cáo hợp lệ."); return value.data; }
export async function getViolationReasons(signal?: AbortSignal) { return required((await apiClient.get<ApiResponse<ViolationReason[]>>(`${base}/reasons`, { signal })).data); }
export async function getMyViolations(params: ViolationQuery, signal?: AbortSignal) { return required((await apiClient.get<ApiResponse<ViolationPage>>(`${base}/my`, { params, signal })).data); }
export async function getViolation(id: string, signal?: AbortSignal) { return required((await apiClient.get<ApiResponse<ViolationDetail>>(`${base}/${id}`, { signal })).data); }
export async function createViolation(request: CreateViolation) { return required((await apiClient.post<ApiResponse<ViolationDetail>>(base, request)).data); }
export async function uploadViolationEvidence(file: UploadFileInput) {
  const body = new FormData(); appendUploadFile(body, "file", file);
  const url = required((await apiClient.post<ApiResponse<{ url: string }>>(`${base}/evidence`, body, { headers: { "Content-Type": "multipart/form-data" } })).data).url;
  if (typeof url !== "string" || !safeEvidence(url)) throw new Error("Máy chủ chưa trả về ảnh bằng chứng hợp lệ.");
  return url;
}
