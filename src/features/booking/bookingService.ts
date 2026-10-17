import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { BookingResponse, BookingCancellationQuote, BookingListRequest, CreateBookingRequest, InspectionReportResponse, RejectBookingRequest } from "./types";

export async function createBooking(data: CreateBookingRequest): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.base, data);
  return res.data.data!;
}

export async function getBookingById(id: number): Promise<BookingResponse> {
  const res = await apiClient.get<ApiResponse<BookingResponse>>(endpoints.bookings.byId(id));
  return res.data.data!;
}

export async function getMyBookings(params: BookingListRequest): Promise<{ items: BookingResponse[]; totalCount: number; page: number; pageSize: number }> {
  const res = await apiClient.get<ApiResponse<{ items: BookingResponse[]; totalCount: number; page: number; pageSize: number }>>(endpoints.bookings.my, { params });
  return res.data.data ?? { items: [], totalCount: 0, page: 1, pageSize: 10 };
}

export async function getOwnerBookings(params: BookingListRequest): Promise<{ items: BookingResponse[]; totalCount: number; page: number; pageSize: number }> {
  const res = await apiClient.get<ApiResponse<{ items: BookingResponse[]; totalCount: number; page: number; pageSize: number }>>(endpoints.bookings.owner, { params });
  return res.data.data ?? { items: [], totalCount: 0, page: 1, pageSize: 10 };
}

export async function approveBooking(id: number): Promise<BookingResponse> {
  const res = await apiClient.put<ApiResponse<BookingResponse>>(endpoints.bookings.approve(id));
  return res.data.data!;
}

export async function rejectBooking(id: number, data: RejectBookingRequest): Promise<BookingResponse> {
  const res = await apiClient.put<ApiResponse<BookingResponse>>(endpoints.bookings.reject(id), data);
  return res.data.data!;
}

export async function completeBooking(id: number): Promise<BookingResponse> {
  const res = await apiClient.put<ApiResponse<BookingResponse>>(endpoints.bookings.complete(id));
  return res.data.data!;
}

export async function ownerCompleteBooking(id: number): Promise<BookingResponse> {
  const res = await apiClient.put<ApiResponse<BookingResponse>>(endpoints.bookings.ownerComplete(id));
  return res.data.data!;
}

export async function createCheckInReport(id: number, data: FormData): Promise<InspectionReportResponse> {
  const res = await apiClient.post<ApiResponse<InspectionReportResponse>>(endpoints.bookings.checkIn(id), data, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return res.data.data!;
}

export async function createCheckOutReport(id: number, data: FormData): Promise<InspectionReportResponse> {
  const res = await apiClient.post<ApiResponse<InspectionReportResponse>>(endpoints.bookings.checkOut(id), data, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return res.data.data!;
}

export async function confirmCheckIn(id: number): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.confirmCheckIn(id));
  return res.data.data!;
}

export async function confirmCheckOut(id: number, expectedVersion = 1, paymentMethod?: import("./types").CheckoutPaymentMethod): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.confirmCheckOut(id), { expectedVersion, ...(paymentMethod ? { paymentMethod } : {}) });
  return res.data.data!;
}

export async function amendCheckout(id: number, request: {
  additionalSurcharges?: import("./types").CheckoutSurchargeSelection[];
  applyCurrentLateReturnPolicy?: boolean;
  expectedVersion: number; reason: string; actualReturnAt: string;
  odometerKm?: number; fuelLevel?: string; damageNoted: boolean; damageDescription?: string;
}): Promise<InspectionReportResponse> {
  const res = await apiClient.patch<ApiResponse<InspectionReportResponse>>(`/api/bookings/${id}/check-out`, request);
  return res.data.data!;
}

export async function getInspectionReports(id: number): Promise<InspectionReportResponse[]> {
  const res = await apiClient.get<ApiResponse<InspectionReportResponse[]>>(endpoints.bookings.inspectionReports(id));
  return res.data.data ?? [];
}

export async function getBookingCancellationQuote(id: number): Promise<BookingCancellationQuote> {
  const res = await apiClient.get<ApiResponse<BookingCancellationQuote>>(endpoints.bookings.cancellationQuote(id));
  return res.data.data!;
}

export async function cancelBooking(id: number, reason?: string): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.cancel(id), { reason });
  return res.data.data!;
}

export async function cancelBookingByOwner(id: number, reason?: string): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.ownerCancel(id), { reason });
  return res.data.data!;
}

export async function confirmReceipt(
  id: number,
  body?: { hasDamages?: boolean; damageNote?: string },
): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.confirmReceipt(id), body ?? {});
  return res.data.data!;
}

export async function requestSettlement(id: number): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.settlement(id));
  return res.data.data!;
}

export async function reportReturn(id: number): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.reportReturn(id));
  return res.data.data!;
}

export async function reportNoShow(id: number): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(endpoints.bookings.reportNoShow(id));
  return res.data.data!;
}

export async function settleCheckoutSurcharges(id: number, request: { action: "Wallet" | "External" | "ConfirmExternal"; expectedVersion: number; note?: string }): Promise<BookingResponse> {
  const res = await apiClient.post<ApiResponse<BookingResponse>>(`/api/bookings/${id}/surcharges/payment`, request);
  return res.data.data!;
}
