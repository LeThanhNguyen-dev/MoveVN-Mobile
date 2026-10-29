import { describe, expect, it } from "vitest";
import { buildCustomerStats, buildOwnerStats } from "@/features/users/utils/profileStats";
import { memberYear, membershipLabel, relativeTime } from "@/features/users/utils/profileTime";
import {
  countProfileVehiclesByGroup,
  filterProfileVehicles,
  profileVehicleGroup,
  profileVehicleName,
  sortProfileVehicles,
} from "@/features/users/utils/profileVehicles";
import type {
  PublicProfileVehicle,
  PublicUserProfile,
} from "@/features/users/services/publicUserProfileService";

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
  ownerReviewCount: 0,
  ownerAverageRating: null,
  customerReviewCount: 7,
  customerAverageRating: null,
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

  it("formats how long the member has joined", () => {
    const now = new Date("2026-10-30T12:00:00Z").getTime();
    expect(membershipLabel("2023-01-15T00:00:00Z", now)).toBe("3 năm");
    expect(membershipLabel("2026-05-01T00:00:00Z", now)).toBe("Dưới 1 năm");
    expect(membershipLabel("2026-12-01T00:00:00Z", now)).toBe("Chưa rõ");
    expect(membershipLabel(undefined, now)).toBe("Chưa rõ");
  });
});

const vehicleFixtures: PublicProfileVehicle[] = [
  {
    id: 1,
    brandName: "Honda",
    modelName: "City",
    variantName: "RS",
    vehicleType: "Car",
    year: 2022,
    pricePerDay: 900000,
    primaryImage: null,
    address: "Quận 1, TP. Hồ Chí Minh",
  },
  {
    id: 2,
    brandName: "Yamaha",
    modelName: "Exciter",
    variantName: null,
    vehicleType: "Motorbike",
    year: 2021,
    pricePerDay: 150000,
    primaryImage: null,
    address: "Đà Nẵng",
  },
];

describe("profile vehicles", () => {
  it("builds a display name without empty parts", () => {
    expect(profileVehicleName(vehicleFixtures[0])).toBe("Honda City RS");
    expect(profileVehicleName(vehicleFixtures[1])).toBe("Yamaha Exciter");
  });

  it("filters by brand, model, variant, or address", () => {
    expect(filterProfileVehicles(vehicleFixtures, "")).toHaveLength(2);
    expect(filterProfileVehicles(vehicleFixtures, "honda").map((v) => v.id)).toEqual([1]);
    expect(filterProfileVehicles(vehicleFixtures, "exciter").map((v) => v.id)).toEqual([2]);
    expect(filterProfileVehicles(vehicleFixtures, "đà nẵng").map((v) => v.id)).toEqual([2]);
    expect(filterProfileVehicles(vehicleFixtures, "không có")).toEqual([]);
  });

  it("groups vehicles by type and counts each group", () => {
    expect(profileVehicleGroup(vehicleFixtures[0])).toBe("car");
    expect(profileVehicleGroup(vehicleFixtures[1])).toBe("motorbike");
    expect(countProfileVehiclesByGroup(vehicleFixtures)).toEqual({ car: 1, motorbike: 1 });
  });

  it("sorts by price in both directions without mutating input", () => {
    expect(sortProfileVehicles(vehicleFixtures, "priceDesc").map((v) => v.id)).toEqual([1, 2]);
    expect(sortProfileVehicles(vehicleFixtures, "priceAsc").map((v) => v.id)).toEqual([2, 1]);
    expect(vehicleFixtures.map((v) => v.id)).toEqual([1, 2]);
  });

  it("keeps API order for recent and ranks popular by review counts", () => {
    expect(sortProfileVehicles(vehicleFixtures, "recent").map((v) => v.id)).toEqual([1, 2]);
    const reviewCounts = new Map([
      [1, 2],
      [2, 5],
    ]);
    expect(sortProfileVehicles(vehicleFixtures, "popular", reviewCounts).map((v) => v.id)).toEqual([
      2, 1,
    ]);
    expect(sortProfileVehicles(vehicleFixtures, "popular").map((v) => v.id)).toEqual([1, 2]);
  });
});
