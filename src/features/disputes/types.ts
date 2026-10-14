import type { InspectionReportResponse } from "@/features/booking/types";

export type CompensationDirection = "CustomerPaysOwner" | "OwnerRefundsCustomer" | "NoCompensation";
export type DisputeSettlementMethod = "ExternalOnly" | "DepositThenExternal";
export type EvidenceRequestedFrom = "Customer" | "Owner" | "Both";

export type DisputeListRequest = {
  reportType?: string;
  trafficFineStatus?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type CreateDisputeRequest = {
  trafficFine?: CreateTrafficFineRequest;
  evidenceUploadTokens?: string[];
  paymentScope?: string | null;
  bookingId: number;
  reportType: string;
  description: string;
  evidenceUrls?: string | null;
};

export type ResolveDisputeRequest = {
  checkoutAdjustment?: { expectedVersion: number; finalLateReturnFee: number; actualReturnAt?: string };
  paymentAdjustmentNote?: string | null;
  resolution: string;
  compensationDirection: CompensationDirection;
  settlementMethod: DisputeSettlementMethod;
  compensationAmount?: number | null;
  updatedAt?: string | null;
};

export type RequestMoreEvidenceRequest = {
  requestedFrom: EvidenceRequestedFrom;
  message: string;
  updatedAt?: string | null;
};

export type AddDisputeEvidenceRequest = {
  evidenceUploadTokens?: string[];
  evidenceUrls?: string | null;
  message: string;
  updatedAt?: string | null;
};

export type DisputeEvidenceSubmissionItem = {
  id: number;
  submittedBy: number;
  submittedByName: string;
  submittedRole: string;
  message: string;
  evidenceUrls: string | null;
  createdAt: string;
};

export type DisputeListItem = {
  trafficFineStatus?: string | null;
  trafficFineAmount?: number | null;
  trafficFineDueAt?: string | null;
  paymentScope?: string | null;
  paymentAdjustmentNote?: string | null;
  adminManaged: boolean;
  customerAccepted: boolean;
  ownerAccepted: boolean;
  customerAcceptedAt?: string | null;
  ownerAcceptedAt?: string | null;
  id: number;
  bookingId: number;
  bookingCode: string;
  openedBy: number;
  openedByName: string;
  customerId: number;
  customerName: string;
  ownerId: number;
  ownerName: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  status: string;
  reportType: string;
  description: string;
  evidenceUrls: string | null;
  resolution: string | null;
  compensationDirection: CompensationDirection;
  settlementMethod: DisputeSettlementMethod;
  compensationAmount: number | null;
  adminApprovedAmount: number | null;
  finalCompensationAmount: number | null;
  platformSettledAmount: number;
  platformSettlementCompletedAt: string | null;
  externalSettlementAmount: number;
  customerExternalConfirmed: boolean;
  customerExternalConfirmedAt: string | null;
  ownerExternalConfirmed: boolean;
  ownerExternalConfirmedAt: string | null;
  decisionIssuedAt: string | null;
  closedAt: string | null;
  adminCloseReason: string | null;
  escalatedBy: number | null;
  escalatedAt: string | null;
  evidenceRequestedFrom: EvidenceRequestedFrom | null;
  evidenceRequestMessage: string | null;
  evidenceRequestedAt: string | null;
  evidenceRespondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DisputeAuditLogItem = {
  id: number;
  actorId: number | null;
  actorRole: string | null;
  actorName: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

export type DisputeDetailResponse = DisputeListItem & {
  trafficFine?: TrafficFineResponse | null;
  checkoutAdjustmentJson?: string | null;
  checkoutAdjustmentAppliedAt?: string | null;
  auditLogs: DisputeAuditLogItem[];
  inspectionReports: InspectionReportResponse[];
  evidenceSubmissions: DisputeEvidenceSubmissionItem[];
};

export type CreateTrafficFineRequest = {
  noticeNumber: string;
  issuingAuthority: string;
  licensePlate: string;
  violationAt: string;
  dueAt: string;
  amount: number;
  paymentMode: "CustomerPaysAuthority" | "ReimburseOwner";
  ownerPaidAt?: string;
  ownerPaymentEvidenceUrls?: string;
  ownerPaymentEvidenceTokens?: string[];
};

export type TrafficFinePaymentProof = {
  id: number;
  amount: number;
  paidAt: string;
  transactionReference: string;
  evidenceUrls: string;
  note?: string;
  status: "Pending" | "Approved" | "Rejected";
  ownerReceiptConfirmedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

export type TrafficFineResponse = Omit<CreateTrafficFineRequest, "ownerPaidAt" | "ownerPaymentEvidenceUrls"> & {
  ownerPaidAt?: string | null;
  ownerPaymentEvidenceUrls?: string | null;
  id: number;
  version: number;
  status: string;
  isOverdue: boolean;
  rentalStartAt: string;
  rentalEndAt: string;
  hasConfirmedRentalTimes: boolean;
  matchesRentalPeriod: boolean;
  verifiedAt?: string | null;
  verificationNote?: string | null;
  customerResponse?: string | null;
  customerRespondedAt?: string | null;
  rejectionReason?: string | null;
  resolvedAt?: string | null;
  paymentProofs: TrafficFinePaymentProof[];
};
