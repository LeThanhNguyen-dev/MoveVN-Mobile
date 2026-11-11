import { translatedLabels } from "@/i18n/liveLabels";

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
  nationalId?: string | null;
  nationalIdMasked?: string | null;
  address?: string | null;
  driverLicenseNumber?: string | null;
  driverLicenseClass?: string | null;
}

export interface ContractVehicleInfo {
  vehicleType?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  licensePlate?: string | null;
  year?: number | null;
  address?: string | null;
  pricePerDay?: number | null;
}

export interface ContractScheduleInfo {
  startDate?: string | null;
  endDate?: string | null;
  totalDays?: number | null;
  pickupAddress?: string | null;
  returnAddress?: string | null;
  customerNote?: string | null;
}

export interface ContractMoneyInfo {
  basePrice?: number | null;
  platformFee?: number | null;
  promotionDiscount?: number | null;
  deliveryFee?: number | null;
  totalAmount?: number | null;
  depositAmount?: number | null;
  securityDepositAmount?: number | null;
}

export interface ContractSurchargeTerm {
  feeType?: string | null;
  name?: string | null;
  description?: string | null;
  calculationMethod?: string | null;
  unitPrice?: number | null;
  lateDayThresholdHours?: number | null;
  includedKm?: number | null;
  allowanceScope?: string | null;
  maxAmount?: number | null;
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
    vehicle?: ContractVehicleInfo | null;
    schedule?: ContractScheduleInfo | null;
    money?: ContractMoneyInfo | null;
    surchargeTerms?: ContractSurchargeTerm[] | null;
  } | null;
}

// Lazy getters: nhãn trạng thái đổi theo ngôn ngữ đang chọn, không đóng băng lúc import.
export const CONTRACT_STATUS_LABELS: Record<string, string> = translatedLabels("contract", {
  Draft: "status.Draft",
  PendingSigning: "status.PendingSigning",
  Overdue: "status.Overdue",
  Active: "status.Active",
  Completed: "status.Completed",
  Cancelled: "status.Cancelled",
  Terminated: "status.Terminated",
  Superseded: "status.Superseded",
});

export const CONTRACT_LIVE_STATUSES = ["Draft", "PendingSigning", "Overdue", "Active"];
