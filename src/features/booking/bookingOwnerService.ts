import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type {
  BookingListRequest,
  BookingResponse,
  InspectionReportResponse,
} from "@/features/booking/types";
import { appendUploadFile, type UploadFileInput } from "@/types/upload";

export async function getOwnerBookings(params: BookingListRequest): Promise<{
  items: BookingResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const res = await apiClient.get<
    ApiResponse<{ items: BookingResponse[]; totalCount: number; page: number; pageSize: number }>
  >(endpoints.bookings.owner, { params });
  return res.data.data ?? { items: [], totalCount: 0, page: 1, pageSize: 10 };
}

export async function approveBooking(id: number): Promise<BookingResponse> {
  const res = await apiClient.put<ApiResponse<BookingResponse>>(endpoints.bookings.approve(id));
  return res.data.data!;
}

export async function rejectBooking(id: number, reason: string): Promise<BookingResponse> {
  const res = await apiClient.put<ApiResponse<BookingResponse>>(endpoints.bookings.reject(id), { reason });
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

export interface InspectionFormInput {
  actualReturnAt?: string;
  odometerKm?: number;
  fuelLevel?: string;
  damageNoted: boolean;
  damageDescription?: string;
  images: UploadFileInput[];
}

function buildInspectionForm(input: InspectionFormInput): FormData {
  const formData = new FormData();
  if (input.actualReturnAt) formData.append("actualReturnAt", input.actualReturnAt);
  if (input.odometerKm != null) formData.append("odometerKm", String(input.odometerKm));
  if (input.fuelLevel) formData.append("fuelLevel", input.fuelLevel);
  formData.append("damageNoted", String(input.damageNoted));
  if (input.damageDescription) formData.append("damageDescription", input.damageDescription);
  input.images.forEach((file) => appendUploadFile(formData, "images", file));
  return formData;
}

export async function createOwnerCheckInReport(
  id: number,
  input: InspectionFormInput,
): Promise<InspectionReportResponse> {
  const res = await apiClient.post<ApiResponse<InspectionReportResponse>>(
    endpoints.bookings.checkIn(id),
    buildInspectionForm(input),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.data!;
}

export async function createOwnerCheckOutReport(
  id: number,
  input: InspectionFormInput,
): Promise<InspectionReportResponse> {
  const res = await apiClient.post<ApiResponse<InspectionReportResponse>>(
    endpoints.bookings.checkOut(id),
    buildInspectionForm(input),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.data!;
}

export interface AmendCheckoutInput {
  expectedVersion: number;
  reason: string;
  actualReturnAt: string;
  odometerKm?: number;
  fuelLevel?: string;
  damageNoted: boolean;
  damageDescription?: string;
}

export async function amendCheckoutReport(
  id: number,
  input: AmendCheckoutInput,
): Promise<InspectionReportResponse> {
  const res = await apiClient.patch<ApiResponse<InspectionReportResponse>>(
    endpoints.bookings.amendCheckOut(id),
    {
      expectedVersion: input.expectedVersion,
      reason: input.reason,
      actualReturnAt: input.actualReturnAt,
      odometerKm: input.odometerKm,
      fuelLevel: input.fuelLevel,
      damageNoted: input.damageNoted,
      damageDescription: input.damageDescription,
    },
  );
  return res.data.data!;
}
