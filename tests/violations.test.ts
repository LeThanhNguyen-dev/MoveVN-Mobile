import { beforeEach, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { report, violationReasons } from "./fixtures/violation";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), generation: 1, user: { userId: 10, roles: ["Customer"] }, role: "Customer", token: "test" }));
vi.mock("@/services/apiClient", () => ({ apiClient: mocks, getApiErrorMessage: (e: { response?: { data?: { message?: string } } }, fallback: string) => e.response?.data?.message ?? fallback }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ getAuthUser: () => mocks.user, getToken: () => mocks.token, getSessionGeneration: () => mocks.generation, useAuthStore: { getState: () => ({ activeRole: mocks.role }) } }));
import { getMyViolations, getViolation, createViolation, getViolationReasons, uploadViolationEvidence } from "@/features/violations/violationService";
import { validReportId, safeEvidence, validateViolation, violationFromNotification, violationError } from "@/features/violations/violationModel";
import { canReport, closeViolations, openViolations, useViolationNavigation } from "@/features/violations/violationNavigation";

beforeEach(() => { vi.clearAllMocks(); mocks.generation = 1; mocks.user = { userId: 10, roles: ["Customer"] }; mocks.role = "Customer"; mocks.token = "test"; closeViolations(); });
it("uses own-report APIs and propagates filters and cancellation", async () => {
  const page = { items: [report], totalCount: 1, page: 2, pageSize: 10, totalPages: 1 };
  mocks.get.mockResolvedValue({ data: { status: true, data: page } }); const signal = new AbortController().signal;
  const query = { page: 2, pageSize: 10, keyword: "43A", targetType: "Vehicle", status: "Open" };
  expect(await getMyViolations(query, signal)).toEqual(page);
  expect(mocks.get).toHaveBeenCalledWith("/api/violation-reports/my", { params: query, signal });
  await getViolation(report.id, signal); expect(mocks.get).toHaveBeenLastCalledWith(`/api/violation-reports/${report.id}`, { signal });
});
it("rejects unsuccessful API envelopes rather than showing an empty report or false success", async () => {
  mocks.get.mockResolvedValue({ data: { status: false, message: "Không có quyền" } });
  await expect(getMyViolations({ page: 1, pageSize: 10 })).rejects.toThrow("Không có quyền");
  await expect(getViolationReasons()).rejects.toThrow();
  mocks.post.mockResolvedValue({ data: { status: true, data: null } });
  await expect(createViolation({ targetType: "Vehicle", targetId: 7, reason: "Other", description: "Thông tin cần xác minh".repeat(2), evidenceUrls: [] })).rejects.toThrow();
});
it("enforces the actual target/reason, description and evidence bounds", () => {
  const req = { targetType: "Vehicle" as const, targetId: 7, reason: "UnsafeVehicle", description: "a".repeat(20), evidenceUrls: [] as string[] };
  expect(validateViolation(req, violationReasons)).toBe(""); expect(validateViolation({ ...req, description: " ".repeat(20) }, violationReasons)).toContain("20");
  expect(validateViolation({ ...req, description: "a".repeat(4000) }, violationReasons)).toBe(""); expect(validateViolation({ ...req, description: "a".repeat(4001) }, violationReasons)).toContain("4.000");
  expect(validateViolation({ ...req, reason: "Harassment" }, violationReasons)).toContain("lý do");
  expect(validateViolation({ ...req, targetId: -1 }, violationReasons)).toContain("Đối tượng");
  expect(validateViolation({ ...req, evidenceUrls: Array(6).fill("https://example.invalid/a.jpg") }, violationReasons)).toContain("5 ảnh");
});
it("rejects unsafe evidence and non-report notification paths", () => {
  expect(safeEvidence("https://example.invalid/a.jpg")).toBe(true);
  for (const value of ["javascript:alert(1)", "http://example.invalid/a.jpg", "https://user:pass@example.invalid/a.jpg", "https://127.0.0.1/a.jpg", "https://intranet.local/a.jpg"]) expect(safeEvidence(value)).toBe(false);
  expect(validReportId(report.id)).toBe(true); expect(validReportId("41")).toBe(false);
  expect(violationFromNotification(JSON.stringify({ targetPath: `/my-violations/${report.id}` }))).toBe(report.id);
  for (const targetPath of [`/moderation/violations/${report.id}`, `/admin/violations/${report.id}`, "https://evil.test", "/my-violations/41"]) expect(violationFromNotification(JSON.stringify({ targetPath }))).toBeNull();
});
it("does not allow self/own-vehicle reports or staff accounts in the user submission flow", () => {
  expect(canReport({ targetType: "User", targetId: 10, label: "Tôi" })).toBe(false);
  expect(canReport({ targetType: "Vehicle", targetId: 7, ownerId: 10, label: "Xe tôi" })).toBe(false);
  expect(canReport({ targetType: "Booking", targetId: 9, label: "BK9" })).toBe(true);
  mocks.role = "Owner"; mocks.user.roles = ["Owner", "Staff"]; expect(canReport()).toBe(false);
  openViolations(); expect(useViolationNavigation.getState().entry).toBeNull();
});
it("records report navigation under the current identity, rejects malformed IDs and no session", () => {
  openViolations({ reportId: report.id }); expect(useViolationNavigation.getState()).toMatchObject({ entry: { reportId: report.id }, userId: 10, generation: 1 });
  closeViolations(); openViolations({ reportId: "bad" }); expect(useViolationNavigation.getState().entry).toBeNull();
  mocks.token = ""; openViolations(); expect(useViolationNavigation.getState().entry).toBeNull();
});
it("sends structured evidence to the dedicated endpoint and rejects a bad upload result", async () => {
  const file = new Blob(["isolated-test"], { type: "image/png" }); mocks.post.mockResolvedValueOnce({ data: { status: true, data: { url: "https://example.invalid/photo.png" } } });
  expect(await uploadViolationEvidence(file)).toContain("photo.png"); expect(mocks.post.mock.calls[0]?.[0]).toBe("/api/violation-reports/evidence");
  mocks.post.mockResolvedValueOnce({ data: { status: true, data: { url: "http://example.invalid/bad.png" } } }); await expect(uploadViolationEvidence(file)).rejects.toThrow("hợp lệ");
});
it("explains timeout and forbidden access without claiming a submitted report is confirmed", () => {
  expect(violationError(new AxiosError("timeout", "ECONNABORTED"))).toContain("trước khi gửi lại");
  const forbidden = new AxiosError("Forbidden"); forbidden.response = { status: 403 } as typeof forbidden.response;
  expect(violationError(forbidden)).toContain("không có quyền");
});
