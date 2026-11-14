/** Mã lý do campaign-level (mirror web `VoucherAvailabilityReasonCode`). */
export type VoucherAvailabilityReasonCode =
  | "CampaignPaused"
  | "CampaignNotApproved"
  | "NoParticipatingOwner";

export interface VoucherHuntItem {
  promotionId: number;
  code: string;
  name: string;
  description?: string;
  discountType: "Fixed" | "Percentage";
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  vehicleType: "All" | "Motorbike" | "Car";
  startAt?: string;
  endAt?: string;
  maxUsageCount: number;
  usageCount: number;
  isClaimed: boolean;
}

export interface VoucherClaimResponse {
  id: number;
  promotionId: number;
  code: string;
  name: string;
  description?: string;
  discountType: "Fixed" | "Percentage";
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  vehicleType: "All" | "Motorbike" | "Car";
  startAt?: string;
  endAt?: string;
  maxUsageCount: number;
  usageCount: number;
  claimedAt: string;
  usedAt?: string;
  bookingId?: number;

  /**
   * Campaign-level facts cho UI ví. Voucher nằm trong ví nghĩa là đã nhận và
   * còn hạn — KHÔNG có nghĩa là dùng được cho mọi xe. Điều kiện theo từng chủ xe
   * vẫn do `PromotionEligibility` kiểm tra lúc đặt xe.
   */
  whoBears?: string;
  ownerId?: number | null;
  ownerName?: string | null;
  isActive?: boolean;
  approvalStatus?: string;
  requiresOwnerOptIn?: boolean;
  acceptedOwnerCount?: number;
  totalOwnerCount?: number;
  availabilityReasonCode?: VoucherAvailabilityReasonCode | string | null;
  availabilityReason?: string | null;
}
