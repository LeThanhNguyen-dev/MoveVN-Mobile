import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type {
  GpsLivePositionResponse,
  GpsPointRequest,
  GpsPointsAcceptedResponse,
  GpsRoutePointResponse,
  GpsTrackingSessionResponse,
  RequestGpsEnableResponse,
} from "./types";

/** Khách thuê gửi một lô điểm GPS (gom batch 15–30s/lần). */
export async function postGpsPoints(bookingId: number, points: GpsPointRequest[]): Promise<GpsPointsAcceptedResponse> {
  const res = await apiClient.post<ApiResponse<GpsPointsAcceptedResponse>>(endpoints.tracking.postLocation(bookingId), { points });
  return res.data.data!;
}

export async function getGpsLivePosition(bookingId: number): Promise<GpsLivePositionResponse> {
  const res = await apiClient.get<ApiResponse<GpsLivePositionResponse>>(endpoints.tracking.live(bookingId));
  return res.data.data!;
}

export async function getGpsRoute(bookingId: number, from?: string, to?: string): Promise<GpsRoutePointResponse[]> {
  const res = await apiClient.get<ApiResponse<GpsRoutePointResponse[]>>(endpoints.tracking.route(bookingId), {
    params: { from, to },
  });
  return res.data.data ?? [];
}

export async function getGpsSession(bookingId: number): Promise<GpsTrackingSessionResponse> {
  const res = await apiClient.get<ApiResponse<GpsTrackingSessionResponse>>(endpoints.tracking.session(bookingId));
  return res.data.data!;
}

/** Chủ xe yêu cầu khách thuê bật lại GPS. */
export async function requestGpsEnable(bookingId: number): Promise<RequestGpsEnableResponse> {
  const res = await apiClient.post<ApiResponse<RequestGpsEnableResponse>>(endpoints.tracking.requestGps(bookingId), {});
  return res.data.data!;
}

/** Địa chỉ chi tiết tại một tọa độ của chuyến (Goong reverse geocode, có cache phía server). */
export async function getGpsAddress(bookingId: number, latitude: number, longitude: number): Promise<string | null> {
  const res = await apiClient.get<ApiResponse<string | null>>(endpoints.tracking.address(bookingId), {
    params: { lat: latitude, lng: longitude },
  });
  return res.data.data ?? null;
}
