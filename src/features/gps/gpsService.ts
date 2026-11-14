import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type {
  GpsLivePositionResponse,
  GpsPointRequest,
  GpsPointsAcceptedResponse,
  GpsRoadPathResponse,
  GpsRoutePointResponse,
  GpsSharingConsentResponse,
  GpsTrackingSessionResponse,
  GpsTripSummaryResponse,
  OwnerTrackingOverviewResponse,
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

/** Khách thuê bật/tắt chia sẻ vị trí cho chuyến (máy chủ ghi nhận sự đồng ý). */
export async function setGpsSharingConsent(bookingId: number, granted: boolean): Promise<GpsSharingConsentResponse> {
  const res = await apiClient.post<ApiResponse<GpsSharingConsentResponse>>(endpoints.tracking.consent(bookingId), { granted });
  return res.data.data!;
}

/** Bản đồ tổng hợp của chủ xe: các xe đang cho thuê + vị trí mới nhất trong một lần gọi. */
export async function getOwnerTrackingVehicles(): Promise<OwnerTrackingOverviewResponse> {
  const res = await apiClient.get<ApiResponse<OwnerTrackingOverviewResponse>>(endpoints.tracking.ownerVehicles);
  return res.data.data ?? { items: [], serverTimestamp: new Date().toISOString() };
}

/** Địa chỉ chi tiết tại một tọa độ của chuyến (Goong reverse geocode, có cache phía server). */
export async function getGpsAddress(bookingId: number, latitude: number, longitude: number): Promise<string | null> {
  const res = await apiClient.get<ApiResponse<string | null>>(endpoints.tracking.address(bookingId), {
    params: { lat: latitude, lng: longitude },
  });
  return res.data.data ?? null;
}

/** Polyline phát lại chuyến đi theo đúng đường phố (OSRM map matching, fallback nối thẳng). */
export async function getGpsRoadPath(bookingId: number): Promise<GpsRoadPathResponse> {
  const res = await apiClient.get<ApiResponse<GpsRoadPathResponse>>(endpoints.tracking.routeRoad(bookingId));
  return res.data.data!;
}

/** Tổng hợp chuyến đi: quãng đường, tốc độ max/TB, số lần mất tín hiệu. */
export async function getGpsSummary(bookingId: number): Promise<GpsTripSummaryResponse> {
  const res = await apiClient.get<ApiResponse<GpsTripSummaryResponse>>(endpoints.tracking.summary(bookingId));
  return res.data.data!;
}
