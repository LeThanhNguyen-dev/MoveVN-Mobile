import type { PublicProfileVehicle } from "@/features/users/services/publicUserProfileService";

/** Nhóm xe công khai: ô tô / xe máy (mirror web OwnerProfileMain). */
export type ProfileVehicleGroup = "car" | "motorbike";

export type ProfileVehicleSort = "popular" | "recent" | "priceDesc" | "priceAsc";

export const PROFILE_VEHICLE_GROUP_LABEL: Record<ProfileVehicleGroup, string> = {
  car: "Xe ô tô",
  motorbike: "Xe máy",
};

/** Lọc xe theo tên hãng, mẫu, phiên bản hoặc khu vực (mirror web OwnerProfileMain). */
export function filterProfileVehicles(
  vehicles: PublicProfileVehicle[],
  query: string,
): PublicProfileVehicle[] {
  const keyword = query.toLowerCase().trim();
  if (!keyword) return vehicles;
  return vehicles.filter((vehicle) =>
    [
      vehicle.brandName,
      vehicle.modelName,
      vehicle.variantName ?? "",
      vehicle.address,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

/** Tên hiển thị của xe: hãng + mẫu + phiên bản. */
export function profileVehicleName(vehicle: PublicProfileVehicle): string {
  return [vehicle.brandName, vehicle.modelName, vehicle.variantName]
    .filter(Boolean)
    .join(" ");
}

export function profileVehicleGroup(vehicle: PublicProfileVehicle): ProfileVehicleGroup {
  return vehicle.vehicleType === "Car" ? "car" : "motorbike";
}

export function countProfileVehiclesByGroup(
  vehicles: PublicProfileVehicle[],
): Record<ProfileVehicleGroup, number> {
  const counts: Record<ProfileVehicleGroup, number> = { car: 0, motorbike: 0 };
  for (const vehicle of vehicles) counts[profileVehicleGroup(vehicle)] += 1;
  return counts;
}

/**
 * "Phổ biến" xếp theo số lượt đánh giá gắn với từng xe (dữ liệu công khai thật
 * kèm hồ sơ); bằng điểm thì giữ nguyên thứ tự mới nhất từ API.
 */
export function sortProfileVehicles(
  vehicles: PublicProfileVehicle[],
  sort: ProfileVehicleSort,
  reviewCounts: ReadonlyMap<number, number> = new Map(),
): PublicProfileVehicle[] {
  if (sort === "recent") return vehicles;
  if (sort === "priceDesc") {
    return [...vehicles].sort((a, b) => b.pricePerDay - a.pricePerDay);
  }
  if (sort === "priceAsc") {
    return [...vehicles].sort((a, b) => a.pricePerDay - b.pricePerDay);
  }
  return [...vehicles].sort(
    (a, b) => (reviewCounts.get(b.id) ?? 0) - (reviewCounts.get(a.id) ?? 0),
  );
}
