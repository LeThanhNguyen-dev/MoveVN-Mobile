import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";
import type { DisputeDetailResponse } from "@/features/disputes/types";
vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ get: vi.fn(), accept: vi.fn(), external: vi.fn(), evidence: vi.fn(), escalate: vi.fn() }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Image: "Image", Modal: "Modal", Pressable: "Pressable",
  ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
  AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("expo-image-picker", () => ({}));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light, mode: "light" }) }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { userId: 1 } }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (err: Error) => err.message }));
vi.mock("@/features/booking/components/InspectionReportCard", () => ({ default: () => null }));
vi.mock("@/features/booking/components/BookingAssistance", () => ({ default: () => null }));
vi.mock("@/features/disputes/components/TrafficFinePanel", () => ({ default: () => null }));
vi.mock("@/features/disputes/disputeService", () => ({
  getDisputeById: mocks.get, acceptDisputeResolution: mocks.accept, confirmExternalSettlement: mocks.external,
  addDisputeEvidence: mocks.evidence, escalateDispute: mocks.escalate, uploadDisputeEvidenceImages: vi.fn(),
}));
import DisputeDetailScreen from "@/features/disputes/screens/DisputeDetailScreen";
import { useNotificationStore } from "@/features/notifications/useNotifications";
const initial = {
  id: 7, bookingId: 42, customerId: 1, ownerId: 2, customerName: "Khách", ownerName: "Chủ xe",
  status: "DecisionIssued", reportType: "Other", description: "Sai phụ thu", updatedAt: "2026-10-20T01:00:00Z",
  createdAt: "2026-10-20T00:00:00Z", adminManaged: false, customerAccepted: false, ownerAccepted: false,
  customerExternalConfirmed: false, ownerExternalConfirmed: false, compensationDirection: "NoCompensation",
  settlementMethod: "ExternalOnly", platformSettledAmount: 0, externalSettlementAmount: 0,
  inspectionReports: [], auditLogs: [], evidenceSubmissions: [],
} as unknown as DisputeDetailResponse;
let tree: ReactTestRenderer;
const button = (text: string) => tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(c => (c.type as unknown) === "Text" && c.children.includes(text)).length > 0)[0]!;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  useNotificationStore.getState().reset(); useNotificationStore.getState().activate(1);
  mocks.get.mockReset(); mocks.get.mockResolvedValue(initial);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); });
async function mount() { await act(async () => { tree = create(React.createElement(DisputeDetailScreen, { disputeId: 7, onBack: vi.fn() })); }); }

it("refreshes on a dispute notification without clearing the current form", async () => {
  await mount();
  mocks.get.mockResolvedValueOnce({ ...initial, status: "NeedMoreEvidence", evidenceRequestedFrom: "Customer", evidenceRequestMessage: "Bổ sung ảnh công-tơ-mét" });
  await act(async () => useNotificationStore.getState().prependNotification({
    id: 1, title: "Update", body: "Evidence", channel: "InApp", isRead: false, type: "Dispute",
    createdAt: "2026-10-20T01:01:00Z", dataJson: JSON.stringify({ disputeId: 7 }),
  }, 1));
  expect(JSON.stringify(tree.toJSON())).toContain("Bổ sung ảnh công-tơ-mét");
  expect(mocks.get).toHaveBeenCalledTimes(2);
});

it("reloads the latest version after a rejected stale action and allows a deliberate retry", async () => {
  await mount();
  const current = { ...initial, updatedAt: "2026-10-20T01:02:00Z" };
  mocks.accept.mockRejectedValueOnce(new Error("Hồ sơ vừa được cập nhật"));
  mocks.get.mockResolvedValueOnce(current);
  await act(async () => button("Chấp nhận kết quả xử lý").props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("Hồ sơ vừa được cập nhật");
  mocks.accept.mockResolvedValueOnce({ ...current, customerAccepted: true });
  await act(async () => button("Chấp nhận kết quả xử lý").props.onPress());
  expect(mocks.accept).toHaveBeenLastCalledWith(7, current.updatedAt);
});

it("does not let a late background response overwrite an accepted decision", async () => {
  await mount();
  let resolve!: (detail: DisputeDetailResponse) => void;
  mocks.get.mockImplementationOnce(() => new Promise(res => { resolve = res; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  mocks.accept.mockResolvedValueOnce({ ...initial, customerAccepted: true, status: "Resolved" });
  await act(async () => button("Chấp nhận kết quả xử lý").props.onPress());
  await act(async () => { resolve(initial); });
  expect(JSON.stringify(tree.toJSON())).toContain("Đã xử lý hoàn tất");
});

it("blocks duplicate taps before React has rendered the busy state", async () => {
  await mount();
  let resolve!: (detail: DisputeDetailResponse) => void;
  mocks.accept.mockImplementationOnce(() => new Promise(res => { resolve = res; }));
  await act(async () => {
    const accept = button("Chấp nhận kết quả xử lý");
    accept.props.onPress(); accept.props.onPress();
  });
  expect(mocks.accept).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ ...initial, customerAccepted: true }); });
});
