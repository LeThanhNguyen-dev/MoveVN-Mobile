import { describe, expect, it } from "vitest";
import { buildCustomerStats, buildOwnerStats } from "@/features/users/utils/profileStats";
import { memberYear, relativeTime } from "@/features/users/utils/profileTime";
import type { PublicUserProfile } from "@/features/users/services/publicUserProfileService";

const baseProfile: PublicUserProfile = {
  userId: 12,
  fullName: "Nguyễn Văn A",
  avatarUrl: null,
  isOnline: true,
  createdAt: "2024-03-10T08:00:00Z",
  lastSeenAt: null,
  isOwner: false,
  isVerified: false,
  averageRating: null,
  completedTripsAsOwner: 0,
  completedTripsAsCustomer: 5,
  totalReviewsReceived: 7,
  totalVehicles: 0,
  vehicles: [],
  reviews: [],
};

describe("profile stats", () => {
  it("omits the rating tile when there is no rating", () => {
    expect(buildCustomerStats(baseProfile).map((s) => s.label)).toEqual([
      "Chuyến hoàn thành",
      "Đánh giá nhận được",
    ]);
  });

  it("includes the rating tile with one decimal and a star marker", () => {
    const stats = buildCustomerStats({ ...baseProfile, averageRating: 4.5 });
    expect(stats[1]).toEqual({ label: "Điểm đánh giá", value: "4.5", star: true });
  });

  it("adds the vehicle tile for owners", () => {
    const stats = buildOwnerStats({
      ...baseProfile,
      isOwner: true,
      completedTripsAsOwner: 12,
      totalVehicles: 3,
    });
    expect(stats.map((s) => s.label)).toEqual([
      "Chuyến hoàn thành",
      "Xe đang cho thuê",
      "Đánh giá nhận được",
    ]);
    expect(stats[0]?.value).toBe("12");
  });
});

describe("profile time helpers", () => {
  it("formats relative time", () => {
    expect(relativeTime(new Date(Date.now() - 5_000).toISOString())).toBe("vừa xong");
    expect(relativeTime(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5 phút trước");
    expect(relativeTime(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3 giờ trước");
    expect(relativeTime(null)).toBeNull();
    expect(relativeTime("not-a-date")).toBeNull();
  });

  it("extracts the member year", () => {
    expect(memberYear("2024-03-10T08:00:00Z")).toBe("2024");
    expect(memberYear(undefined)).toBeNull();
  });
});
