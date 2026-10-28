import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { BookingResponse } from "@/features/booking/types";

export type FleetOverview = {
  generatedAt: string;
  summary: {
    vehicles: number;
    available: number;
    rented: number;
    blocked: number;
    overdue: number;
    pickupsNext24Hours: number;
    returnsNext24Hours: number;
  };
};
export type OwnerWorklist = { items: BookingResponse[]; totalCount: number };
export type OwnerOverview = {
  fleet: FleetOverview | null;
  pending: OwnerWorklist | null;
  returned: OwnerWorklist | null;
  errors: Partial<Record<"fleet" | "pending" | "returned", string>>;
};
export async function getOwnerOverview(
  signal: AbortSignal,
): Promise<OwnerOverview> {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  const fleet = async () => {
    const response = await apiClient.get<ApiResponse<FleetOverview>>(
      "/api/owner/calendar",
      {
        signal,
        params: {
          fromDate: today,
          toDate: tomorrow,
          keyword: "",
          vehicleType: "",
          state: "",
          page: 1,
          pageSize: 1,
        },
      },
    );
    if (!response.data.status || !response.data.data)
      throw new Error("fleet unavailable");
    return response.data.data;
  };
  const bookings = async (status: string) => {
    const response = await apiClient.get<ApiResponse<OwnerWorklist>>(
      endpoints.bookings.owner,
      { signal, params: { status, page: 1, pageSize: 3 } },
    );
    if (!response.data.status || !response.data.data)
      throw new Error("bookings unavailable");
    return response.data.data;
  };
  const [fleetResult, pending, returned] = await Promise.allSettled([
    fleet(),
    bookings("Pending"),
    bookings("Returned"),
  ]);
  return {
    fleet: fleetResult.status === "fulfilled" ? fleetResult.value : null,
    pending: pending.status === "fulfilled" ? pending.value : null,
    returned: returned.status === "fulfilled" ? returned.value : null,
    errors: {
      ...(fleetResult.status === "rejected"
        ? { fleet: "Không tải được hiện trạng đội xe." }
        : {}),
      ...(pending.status === "rejected"
        ? { pending: "Không tải được yêu cầu chờ duyệt." }
        : {}),
      ...(returned.status === "rejected"
        ? { returned: "Không tải được chuyến chờ nhận lại xe." }
        : {}),
    },
  };
}
