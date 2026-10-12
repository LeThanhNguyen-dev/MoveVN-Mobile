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
