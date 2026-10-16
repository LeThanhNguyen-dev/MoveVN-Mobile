export interface BookingResponse {
  id: number;
  bookingCode: string;
  customerId: number;
  customerName?: string;
  vehicleId: number;
  vehicleName?: string;
  vehicleImage?: string;
  ownerId: number;
  ownerName?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  platformFee: number;
  platformFeeType?: string;
  platformFeeValue?: number;
  depositAmount: number;
  totalAmount: number;
  outstandingSurchargeAmount?: number;
  escrowAmount: number;
  escrowStatus: string;
  escrowHeldAt?: string;
  escrowSettledAt?: string;
  completedAt?: string | null;
  paymentDueAt?: string;
  pickupAddress: string;
  returnAddress?: string;
  customerNote?: string;
  status: string;
  canCheckInNow?: boolean;
  checkInOpensAt?: string;
  checkInUnavailableReason?: string;
  riskScore?: number;
  riskLevel?: string;
  riskFactors?: string[];
  cancelReason?: string;
  cancellationPolicyTier?: string;
  cancellationRefundAmount: number;
  cancellationForfeitedAmount: number;
  cancellationOwnerCompensation: number;
  cancellationPlatformFee: number;
  securityDepositAmount: number;
  promotionId?: number;
  promotionCode?: string;
  promotionDiscount: number;
  deliveryDistanceKm?: number | null;
  deliveryFee: number;
  createdAt: string;
  updatedAt: string;
  statusHistory: BookingStatusHistoryDto[];
}

export interface BookingStatusHistoryDto {
  fromStatus?: string;
  toStatus: string;
  changedBy?: number;
  note?: string;
  createdAt: string;
}

export interface BookingCancellationQuote {
  bookingId: number;
  canCancel: boolean;
  hasPaidDeposit: boolean;
  paidDepositAmount: number;
  refundPercent: number;
  refundAmount: number;
  forfeitedAmount: number;
  hoursBeforePickup: number;
  policyMessage: string;
}

export interface CreateBookingRequest {
  quoteId?: string;
  vehicleId: number;
  startDate: string;
  endDate: string;
  pickupAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  returnAddress?: string;
  returnLatitude?: number;
  returnLongitude?: number;
  customerNote?: string;
  promotionCode?: string;
}

export interface ApproveBookingRequest {
  approve: boolean;
  reason?: string;
}

export interface RejectBookingRequest {
  reason: string;
}

export interface BookingListRequest {
  status?: string;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface CheckInOutImageResponse {
  id: number;
  bookingId: number;
  inspectionId?: number;
  imageUrl: string;
  imageType: string;
  uploadedBy: number;
  createdAt: string;
}

export interface InspectionReportRevision {
  id: number;
  inspectionReportId: number;
  version: number;
  changedBy: number;
  reason: string;
  snapshotJson?: string | null;
  createdAt: string;
}

export interface InspectionReportResponse {
  id: number;
  bookingId: number;
  type: string;
  createdByUserId: number;
  version?: number;
  actualReturnAt?: string | null;
  lateReturnFee?: number | null;
  revisions?: InspectionReportRevision[];
  odometerKm?: number;
  fuelLevel?: string;
  damageNoted: boolean;
  damageDescription?: string;
  reportPdfUrl?: string;
  customerSignatureUrl?: string;
  isCustomerConfirmed: boolean;
  createdAt: string;
  images: CheckInOutImageResponse[];
}
