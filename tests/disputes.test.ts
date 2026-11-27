import { describe, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
}));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: "AlertTriangle",
  ShieldCheck: "ShieldCheck",
  Camera: "Camera",
  X: "X",
}));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  launchImageLibraryAsync: vi.fn(),
}));

import { getRiskLevel } from "@/features/booking/components/RiskScoreBadge";
import {
  disputeStatusLabels,
  evidenceList,
  problemLabels,
  trafficFineStatusLabels,
} from "@/features/disputes/components/disputeLabels";
import {
  canSubmitDispute,
  parseVietnamDateTime,
  toCreateTrafficFineRequest,
  validateTrafficFineForm,
  validProofAssets,
} from "@/features/disputes/components/TrafficFineCreateFields";
import { disputeFromNotification, isDamageDisputeWindowOpen } from "@/features/disputes/disputeModel";

describe("dispute labels", () => {
  it("covers every status and problem type shown in filters", () => {
    for (const status of ["Open", "Investigating", "NeedMoreEvidence", "DecisionIssued", "AwaitingExternalSettlement", "Escalated", "Resolved"]) {
      expect(disputeStatusLabels[status]).toBeTruthy();
    }
    for (const type of ["Damage", "Payment", "LateReturn", "Accident", "TrafficFine", "Other"]) {
      expect(problemLabels[type]).toBeTruthy();
    }
    expect(trafficFineStatusLabels["AwaitingCustomerResponse"]).toContain("trách nhiệm");
  });

  it("splits evidence url lists like the backend stores them", () => {
    expect(evidenceList(null)).toEqual([]);
    expect(evidenceList("https://a/1.jpg\nhttps://a/2.jpg, https://a/3.jpg")).toEqual([
      "https://a/1.jpg",
      "https://a/2.jpg",
      "https://a/3.jpg",
    ]);
  });

  it("maps risk scores to Low/Medium/High/Unknown like web", () => {
    expect(getRiskLevel(null)).toBe("Unknown");
    expect(getRiskLevel(undefined)).toBe("Unknown");
    expect(getRiskLevel(10)).toBe("Low");
    expect(getRiskLevel(30)).toBe("Low");
    expect(getRiskLevel(31)).toBe("Medium");
    expect(getRiskLevel(60)).toBe("Medium");
    expect(getRiskLevel(61)).toBe("High");
    expect(getRiskLevel(100)).toBe("High");
  });
});

describe("traffic fine form", () => {
  it("parses Vietnamese datetimes and rejects bad input", () => {
    expect(parseVietnamDateTime("2026-10-05 14:30")).toBe("2026-10-05T07:30:00.000Z");
    expect(parseVietnamDateTime("2026-10-05")).toBeNull();
    expect(parseVietnamDateTime("not-a-date")).toBeNull();
  });

  it("validates proof assets like web (1-6 JPG/PNG/WebP under 5MB)", () => {
    expect(validProofAssets([])).toBe(false);
    expect(validProofAssets([{ uri: "a", name: "a.jpg", mime: "image/jpeg", size: 100 }])).toBe(true);
    expect(validProofAssets([{ uri: "a", name: "a.gif", mime: "image/gif", size: 100 }])).toBe(false);
    expect(validProofAssets([{ uri: "a", name: "a.jpg", mime: "image/jpeg", size: 6 * 1024 * 1024 }])).toBe(false);
  });

  it("validates the create form and builds the backend payload", () => {
    const base = {
      noticeNumber: "123",
      issuingAuthority: "CSGT",
      licensePlate: "43A-12345",
      violationAt: "2026-10-01 14:30",
      dueAt: "2026-10-31",
      amount: "500000",
      paymentMode: "CustomerPaysAuthority" as const,
      ownerPaidAt: "",
    };
    expect(validateTrafficFineForm(base, 0)).toBeNull();
    expect(validateTrafficFineForm({ ...base, noticeNumber: "" }, 0)).toContain("thông báo");
    expect(validateTrafficFineForm({ ...base, amount: "abc" }, 0)).toContain("số nguyên");
    expect(validateTrafficFineForm({ ...base, paymentMode: "ReimburseOwner", ownerPaidAt: "" }, 0)).toContain("nộp phạt");

    const payload = toCreateTrafficFineRequest(base, undefined);
    expect(payload.violationAt).toBe("2026-10-01T07:30:00.000Z");
    expect(payload.dueAt).toBe("2026-10-31T16:59:59.000Z");
    expect(payload.amount).toBe(500000);
    expect(payload.licensePlate).toBe("43A-12345");
  });

  it("blocks submit until traffic-fine evidence and owner receipt requirements are met", () => {
    const base = {
      submitting: false,
      bookingId: "42",
      description: "Xe bị phạt nguội",
      evidenceCount: 0,
      ownerReceiptCount: 0,
    };
    // Loại thường không bắt buộc ảnh.
    expect(canSubmitDispute({ ...base, reportType: "Damage" })).toBe(true);
    expect(canSubmitDispute({ ...base, reportType: "Damage", bookingId: "" })).toBe(false);
    expect(canSubmitDispute({ ...base, reportType: "Damage", description: "  " })).toBe(false);
    expect(canSubmitDispute({ ...base, reportType: "Damage", submitting: true })).toBe(false);

    // Phạt nguội: bắt buộc 1..6 ảnh chứng từ.
    expect(canSubmitDispute({ ...base, reportType: "TrafficFine", paymentMode: "CustomerPaysAuthority" })).toBe(false);
    expect(canSubmitDispute({ ...base, reportType: "TrafficFine", paymentMode: "CustomerPaysAuthority", evidenceCount: 1 })).toBe(true);
    expect(canSubmitDispute({ ...base, reportType: "TrafficFine", paymentMode: "CustomerPaysAuthority", evidenceCount: 7 })).toBe(false);

    // Hoàn trả chủ xe: thêm biên lai chủ xe đã nộp phạt.
    expect(canSubmitDispute({ ...base, reportType: "TrafficFine", paymentMode: "ReimburseOwner", evidenceCount: 1 })).toBe(false);
    expect(canSubmitDispute({ ...base, reportType: "TrafficFine", paymentMode: "ReimburseOwner", evidenceCount: 1, ownerReceiptCount: 1 })).toBe(true);
  });
});

describe("dispute notification deep link", () => {
  it("reads the dispute id the backend puts in DataJson", () => {
    expect(disputeFromNotification(JSON.stringify({ disputeId: 44, bookingId: 77 }))).toBe(44);
    expect(disputeFromNotification(JSON.stringify({ disputeId: "44" }))).toBe(44);
  });

  it("falls back to the role-specific targetPath", () => {
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/customer/disputes?disputeId=44" }))).toBe(44);
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/owner/disputes?disputeId=7" }))).toBe(7);
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/CUSTOMER/DISPUTES?disputeId=9" }))).toBe(9);
  });

  it("ignores staff/admin links because the app has no staff screens", () => {
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/staff/disputes?disputeId=44" }))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/admin/disputes?disputeId=44" }))).toBeNull();
  });

  it("rejects malformed payloads, missing ids and non-positive ids", () => {
    expect(disputeFromNotification(null)).toBeNull();
    expect(disputeFromNotification("not-json")).toBeNull();
    expect(disputeFromNotification(JSON.stringify({}))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ bookingId: 77 }))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ disputeId: 0 }))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ disputeId: -3 }))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ disputeId: 1.5 }))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/customer/disputes?disputeId=abc" }))).toBeNull();
    expect(disputeFromNotification(JSON.stringify({ targetPath: "/customer/bookings?disputeId=44" }))).toBeNull();
  });
});

describe("damage dispute window", () => {
  const anchor = "2026-10-01T07:30:00.000Z";
  const at = Date.parse(anchor);
  const hours = (value: number) => value * 60 * 60 * 1000;

  it("mirrors the backend 48h rule", () => {
    expect(isDamageDisputeWindowOpen(anchor, at)).toBe(true);
    expect(isDamageDisputeWindowOpen(anchor, at + hours(47))).toBe(true);
    expect(isDamageDisputeWindowOpen(anchor, at + hours(48))).toBe(true);
    expect(isDamageDisputeWindowOpen(anchor, at + hours(48) + 1)).toBe(false);
    expect(isDamageDisputeWindowOpen(anchor, at - 1)).toBe(false);
  });

  it("leaves the decision to the backend when the DTO has no usable completion time", () => {
    expect(isDamageDisputeWindowOpen(null, at)).toBe(true);
    expect(isDamageDisputeWindowOpen(undefined, at)).toBe(true);
    expect(isDamageDisputeWindowOpen("not-a-date", at)).toBe(true);
  });
});
