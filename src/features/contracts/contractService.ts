import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { ContractContent, ContractSummary } from "./types";

export async function getContractsByBooking(bookingId: number): Promise<ContractSummary[]> {
  const res = await apiClient.get<ApiResponse<ContractSummary[]>>(endpoints.contracts.byBooking(bookingId));
  return res.data.data ?? [];
}

export async function sendForSigning(contractId: number): Promise<void> {
  await apiClient.post<ApiResponse<object>>(endpoints.contracts.sendForSigning(contractId));
}

export async function requestViewOtp(contractId: number): Promise<void> {
  await apiClient.post<ApiResponse<object>>(endpoints.contracts.requestViewOtp(contractId));
}

export async function verifyViewOtp(contractId: number, otp: string): Promise<ContractContent> {
  const res = await apiClient.post<ApiResponse<ContractContent>>(endpoints.contracts.verifyViewOtp(contractId), { otp });
  return res.data.data!;
}

export async function verifyViewPin(contractId: number, pinCode: string): Promise<ContractContent> {
  const res = await apiClient.post<ApiResponse<ContractContent>>(endpoints.contracts.verifyViewPin(contractId), { pinCode });
  return res.data.data!;
}

export async function tryViewWithGrant(contractId: number): Promise<ContractContent> {
  const res = await apiClient.post<ApiResponse<ContractContent>>(endpoints.contracts.viewByGrant(contractId));
  return res.data.data!;
}

export async function requestSignOtp(contractId: number): Promise<void> {
  await apiClient.post<ApiResponse<object>>(endpoints.contracts.requestSignOtp(contractId));
}

export async function verifySignOtp(contractId: number, otp: string): Promise<void> {
  await apiClient.post<ApiResponse<object>>(endpoints.contracts.verifySignOtp(contractId), { otp });
}

export async function createContract(bookingId: number): Promise<ContractSummary> {
  const res = await apiClient.post<ApiResponse<ContractSummary>>(endpoints.contracts.base, { bookingId });
  return res.data.data!;
}

export async function extendContract(contractId: number, additionalDays: number): Promise<ContractSummary> {
  if (!Number.isInteger(additionalDays) || additionalDays < 1 || additionalDays > 90) throw new Error("Số ngày gia hạn phải từ 1 đến 90.");
  const res = await apiClient.post<ApiResponse<ContractSummary>>(endpoints.contracts.extend(contractId), { additionalDays });
  return res.data.data!;
}

export interface ContractAuditLogItem {
  contractId: number; actorName?: string | null; actorRole?: string | null; action: string; note?: string | null; timestamp: string;
}
export async function getContractAudit(contractId: number): Promise<ContractAuditLogItem[]> {
  const res = await apiClient.get<ApiResponse<ContractAuditLogItem[]>>(endpoints.contracts.audit(contractId));
  return res.data.data ?? [];
}

export async function downloadContractPdf(contract: ContractSummary): Promise<void> {
  const { downloadPdf } = await import("@/utils/pdfDownload");
  await downloadPdf(endpoints.contracts.pdfByGrant(contract.id), `hop-dong-${contract.id}-v${contract.version}.pdf`, "post");
}

export interface ExtensionRequestItem {
  id: number;
  bookingId: number;
  contractId: number;
  customerId: number;
  additionalDays: number;
  note?: string | null;
  status: "Pending" | "Approved" | "Rejected";
  rejectReason?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  newContractId?: number | null;
}

export async function createExtensionRequest(bookingId: number, additionalDays: number, note?: string): Promise<ExtensionRequestItem> {
  const res = await apiClient.post<ApiResponse<ExtensionRequestItem>>(endpoints.extensionRequests.base, { bookingId, additionalDays, note });
  return res.data.data!;
}

export async function getExtensionRequests(bookingId: number): Promise<ExtensionRequestItem[]> {
  const res = await apiClient.get<ApiResponse<ExtensionRequestItem[]>>(endpoints.extensionRequests.byBooking(bookingId));
  return res.data.data ?? [];
}

export async function approveExtensionRequest(id: number): Promise<ExtensionRequestItem> {
  const res = await apiClient.post<ApiResponse<ExtensionRequestItem>>(endpoints.extensionRequests.approve(id));
  return res.data.data!;
}

export async function rejectExtensionRequest(id: number, reason: string): Promise<ExtensionRequestItem> {
  const res = await apiClient.post<ApiResponse<ExtensionRequestItem>>(endpoints.extensionRequests.reject(id), { reason });
  return res.data.data!;
}
