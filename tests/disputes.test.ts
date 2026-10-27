import { describe, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

vi.mock("react-native", () => ({
  StyleSheet: { flatten: function flatten(style: unknown): Record<string, unknown> { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {}; }, create: (styles: object) => styles, hairlineWidth: 1 },
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
  parseVietnamDateTime,
  toCreateTrafficFineRequest,
  validateTrafficFineForm,
  validProofAssets,
} from "@/features/disputes/components/TrafficFineCreateFields";

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
});
