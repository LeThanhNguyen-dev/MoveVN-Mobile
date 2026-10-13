export interface ContractSummary {
  id: number;
  bookingId: number;
  contractNumber: string;
  version: string;
  status: string;
  sentAt?: string | null;
  ownerId: number;
  ownerSignStatus: string;
  ownerSignedAt?: string | null;
  customerId: number;
  customerSignStatus: string;
  customerSignedAt?: string | null;
  createdAt: string;
}

export interface ContractPartyInfo {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  driverLicenseNumber?: string | null;
  driverLicenseClass?: string | null;
}

export interface ContractContent {
  id: number;
  contractNumber: string;
  version: string;
  status: string;
  ownerSignStatus: string;
  ownerSignedAt?: string | null;
  customerSignStatus: string;
  customerSignedAt?: string | null;
  verificationCode?: string | null;
  createdAt: string;
  data?: {
    bookingCode?: string | null;
    owner?: ContractPartyInfo | null;
    customer?: ContractPartyInfo | null;
    vehicle?: {
      vehicleType?: string | null;
      brand?: string | null;
      model?: string | null;
      variant?: string | null;
      licensePlate?: string | null;
    } | null;
    schedule?: {
      startDate?: string | null;
      endDate?: string | null;
      totalDays?: number | null;
      pickupAddress?: string | null;
      returnAddress?: string | null;
    } | null;
    money?: {
      basePrice?: number | null;
      platformFee?: number | null;
      promotionDiscount?: number | null;
      totalAmount?: number | null;
      depositAmount?: number | null;
    } | null;
  } | null;
}

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  Draft: "Soạn thảo",
  PendingSigning: "Chờ ký",
  Overdue: "Quá hạn",
  Active: "Đang hiệu lực",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
  Terminated: "Chấm dứt",
  Superseded: "Đã thay thế",
};

export const CONTRACT_LIVE_STATUSES = ["Draft", "PendingSigning", "Overdue", "Active"];
