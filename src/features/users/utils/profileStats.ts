import type { PublicUserProfile } from "@/features/users/services/publicUserProfileService";

export type ProfileStat = {
  label: string;
  value: string;
  star?: boolean;
};

/** Thống kê cho chủ xe: chuyến hoàn thành (với vai trò chủ xe), điểm, số xe, số đánh giá. */
export function buildOwnerStats(profile: PublicUserProfile): ProfileStat[] {
  const stats: ProfileStat[] = [
    { label: "Chuyến hoàn thành", value: String(profile.completedTripsAsOwner) },
  ];
  if (profile.averageRating != null) {
    stats.push({ label: "Điểm đánh giá", value: profile.averageRating.toFixed(1), star: true });
  }
  stats.push({ label: "Xe đang cho thuê", value: String(profile.totalVehicles) });
  stats.push({ label: "Đánh giá nhận được", value: String(profile.totalReviewsReceived) });
  return stats;
}

/** Thống kê cho khách thuê: chuyến hoàn thành (vai trò khách), điểm, số đánh giá. */
export function buildCustomerStats(profile: PublicUserProfile): ProfileStat[] {
  const stats: ProfileStat[] = [
    { label: "Chuyến hoàn thành", value: String(profile.completedTripsAsCustomer) },
  ];
  if (profile.averageRating != null) {
    stats.push({ label: "Điểm đánh giá", value: profile.averageRating.toFixed(1), star: true });
  }
  stats.push({ label: "Đánh giá nhận được", value: String(profile.totalReviewsReceived) });
  return stats;
}
