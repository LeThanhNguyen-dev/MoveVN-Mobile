import axios from "axios";
import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";

export type PublicProfileVehicle = {
  id: number;
  brandName: string;
  modelName: string;
  variantName: string | null;
  vehicleType: string;
  year: number;
  pricePerDay: number;
  primaryImage: string | null;
  address: string;
};

export type PublicProfileReview = {
  id: number;
  reviewerId: number;
  reviewerName: string;
  reviewerAvatar: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  vehicleId: number | null;
  vehicleName: string | null;
};

/** Hồ sơ công khai (mirror web PublicUserProfile — không có email/SĐT/giấy tờ). */
export type PublicUserProfile = {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  createdAt: string;
  lastSeenAt: string | null;

  /** true chỉ khi là chủ xe đã duyệt & không bị khoá. */
  isOwner: boolean;
  isVerified: boolean;
  /** Điểm đánh giá trung bình (1 chữ số thập phân), null khi chưa có đánh giá. */
  averageRating: number | null;

  completedTripsAsOwner: number;
  completedTripsAsCustomer: number;
  totalReviewsReceived: number;
  ownerReviewCount: number;
  ownerAverageRating: number | null;
  customerReviewCount: number;
  customerAverageRating: number | null;
  totalVehicles: number;

  vehicles: PublicProfileVehicle[];
  reviews: PublicProfileReview[];
};

export async function getPublicUserProfile(userId: number): Promise<PublicUserProfile> {
  const res = await apiClient.get<ApiResponse<PublicUserProfile>>(endpoints.users.profile(userId));
  if (!res.data.data) {
    throw new Error(res.data.message || "Public user profile not found.");
  }
  return res.data.data;
}

export type PublicProfileReviewRole = "owner" | "customer";
export type PublicProfileReviewSort = "recent" | "highest" | "lowest";

export type PublicProfileReviewsResult = {
  reviews: PublicProfileReview[];
  total: number;
  page: number;
  pageSize: number;
  ratingCounts: Record<string, number>;
};

export async function getPublicProfileReviews(
  userId: number,
  role: PublicProfileReviewRole,
  page: number,
  rating: number | null,
  sort: PublicProfileReviewSort,
): Promise<PublicProfileReviewsResult> {
  const res = await apiClient.get<ApiResponse<PublicProfileReviewsResult>>(
    endpoints.users.profileReviews(userId),
    { params: { role, page, pageSize: 5, rating: rating ?? undefined, sort } },
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Reviews not found.");
  }
  return res.data.data;
}
export function isPublicProfileNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
