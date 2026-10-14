import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";

export interface CreatePaymentLinkResponse {
  checkoutUrl: string;
  qrCode: string;
  orderCode: number;
  paymentLinkId: string;
}

export async function createPaymentLink(bookingId: number, returnUrl?: string): Promise<CreatePaymentLinkResponse> {
  const url = returnUrl 
    ? `/api/payments/booking/${bookingId}?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/api/payments/booking/${bookingId}`;
  const res = await apiClient.post<ApiResponse<CreatePaymentLinkResponse>>(url);
  return res.data.data!;
}

export async function createTopUpPaymentLink(amount: number): Promise<CreatePaymentLinkResponse> {
  const res = await apiClient.post<ApiResponse<CreatePaymentLinkResponse>>(`/api/payments/wallet/topup`, { amount });
  return res.data.data!;
}

export interface PaymentStatusResponse {
  orderCode: number;
  status: string;
  amount: number;
  amountPaid: number;
  isConfirmed: boolean;
  message: string;
}

export interface BookingTopUpPendingResponse {
  bookingId: number;
  amount: number;
  dueAt?: string | null;
  payerId: number;
  bookingStatus: string;
}

export async function createBookingTopUpLink(bookingId: number, returnUrl?: string): Promise<CreatePaymentLinkResponse> {
  const url = returnUrl
    ? `/api/payments/booking/${bookingId}/topup-link?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/api/payments/booking/${bookingId}/topup-link`;
  const res = await apiClient.post<ApiResponse<CreatePaymentLinkResponse>>(url);
  return res.data.data!;
}

export async function getPendingTopUp(bookingId: number): Promise<BookingTopUpPendingResponse | null> {
  const res = await apiClient.get<ApiResponse<BookingTopUpPendingResponse | null>>(`/api/payments/booking/${bookingId}/pending-topup`);
  return res.data.data ?? null;
}

export async function checkPaymentStatus(orderCode: number): Promise<PaymentStatusResponse> {
  const res = await apiClient.get<ApiResponse<PaymentStatusResponse>>(endpoints.payments.check(orderCode));
  return res.data.data!;
}

export interface WalletDepositPaymentResponse {
  bookingId: number;
  paymentId: number;
  depositAmount: number;
  status: string;
}

export async function payDepositWithWallet(bookingId: number): Promise<WalletDepositPaymentResponse> {
  const res = await apiClient.post<ApiResponse<WalletDepositPaymentResponse>>(endpoints.payments.payDepositWithWallet(bookingId));
  return res.data.data!;
}
