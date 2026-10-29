import { getOwnerBookings } from "@/features/booking/bookingOwnerService";
import { getMyVehicles } from "@/features/vehicles/services/vehicleService";

// Dùng tổng từ API phân trang, không suy ra số lượng từ thẻ hiển thị.
export async function getOwnerOperations() {
  const [pending, returned, active, vehicles] = await Promise.all([
    getOwnerBookings({ status: "Pending", page: 1, pageSize: 2 }),
    getOwnerBookings({ status: "Returned", page: 1, pageSize: 2 }),
    getOwnerBookings({ status: "InProgress", page: 1, pageSize: 1 }),
    getMyVehicles({ page: 1, pageSize: 3 }),
  ]);
  return {
    pendingCount: pending.totalCount, returnedCount: returned.totalCount,
    activeCount: active.totalCount, vehicleCount: vehicles.totalCount,
    tasks: [...returned.items, ...pending.items], vehicles: vehicles.items,
  };
}
export type OwnerOperations = Awaited<ReturnType<typeof getOwnerOperations>>;
