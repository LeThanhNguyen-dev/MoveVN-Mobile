import fixture from "./fixtures/owner-analytics.json";
import { beforeEach, expect, it, vi } from "vitest";
import { comparison, datePreset, validateDates, type AnalyticsFilters } from "@/features/ownerAnalytics/types";

const mocks = vi.hoisted(() => ({ get: vi.fn(), share: vi.fn(), available: vi.fn(), write: vi.fn(), remove: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: { get: mocks.get } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", () => ({ Paths: { cache: "file:///cache" }, File: class {
  uri = "file:///cache/analytics.xlsx"; exists = true; write = mocks.write; delete = mocks.remove;
} }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
import { getOwnerAnalytics } from "@/features/ownerAnalytics/service";
import { downloadOwnerWorkbook } from "@/features/ownerAnalytics/downloadWorkbook";

const filters: AnalyticsFilters = { fromDate: "2026-10-01", toDate: "2026-10-07", granularity: "day", vehicleId: 2, sort: "income", page: 1, pageSize: 10 };
beforeEach(() => { vi.clearAllMocks(); mocks.available.mockResolvedValue(true); mocks.share.mockResolvedValue(undefined); });

it("builds calendar presets correctly across year and leap-month boundaries", () => {
  expect(datePreset("previousMonth", "2026-01-15")).toEqual({ fromDate: "2025-12-01", toDate: "2025-12-31" });
  expect(datePreset("previousMonth", "2024-03-31")).toEqual({ fromDate: "2024-02-01", toDate: "2024-02-29" });
  expect(datePreset("7", "2026-01-03")).toEqual({ fromDate: "2025-12-28", toDate: "2026-01-03" });
  expect(validateDates("2026-02-31", "2026-03-01", "2026-10-22")).toContain("hợp lệ");
  expect(validateDates("2026-10-08", "2026-10-01", "2026-10-22")).toContain("không được sau");
  expect(validateDates("2025-01-01", "2026-10-01", "2026-10-22")).toContain("366 ngày");
  expect(validateDates("2026-10-01", "2026-10-23", "2026-10-22")).toContain("tương lai");
});
it("does not invent percentage growth when the comparison period is zero", () => {
  expect(comparison(500, 0)).toBe("Mới phát sinh trong kỳ");
  expect(comparison(-50, 0)).toBe("Phát sinh điều chỉnh giảm");
  expect(comparison(0, 0)).toBe("Không đổi so với kỳ trước");
  expect(comparison(50, 100)).toBe("-50% so với kỳ trước");
  expect(comparison(-50, -100)).toBe("+50% so với kỳ trước");
});
it("sends vehicle and date filters through the authenticated API and supports cancellation", async () => {
  const data = structuredClone(fixture);
  const signal = new AbortController().signal;
  mocks.get.mockResolvedValue({ data: { status: true, data } });
  expect(await getOwnerAnalytics(filters, signal)).toEqual(data);
  expect(mocks.get).toHaveBeenCalledWith("/api/owner/analytics", { params: filters, signal });
});
it("does not pretend an unsuccessful API response is an empty fleet", async () => {
  mocks.get.mockResolvedValue({ data: { status: false, message: "Không có quyền", data: null } });
  await expect(getOwnerAnalytics(filters)).rejects.toThrow("Không có quyền");
});
it("downloads a filtered workbook and shares Excel with its proper native content type", async () => {
  const data = new Uint8Array([0x50, 0x4b, 3, 4]).buffer; mocks.get.mockResolvedValue({ data });
  await downloadOwnerWorkbook(filters);
  expect(mocks.get).toHaveBeenCalledWith("/api/owner/analytics/export", expect.objectContaining({ params: filters, responseType: "arraybuffer" }));
  expect(mocks.write).toHaveBeenCalledWith(new Uint8Array(data));
  expect(mocks.share).toHaveBeenCalledWith("file:///cache/analytics.xlsx", expect.objectContaining({ mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});
it("rejects disguised error files and cleans up when native sharing fails", async () => {
  mocks.get.mockResolvedValue({ data: new TextEncoder().encode('{"error":"unauthorized"}').buffer });
  await expect(downloadOwnerWorkbook(filters)).rejects.toThrow("Excel hợp lệ");
  expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue({ data: new Uint8Array([0x50, 0x4b, 3, 4]).buffer }); mocks.share.mockRejectedValue(new Error("share failed"));
  await expect(downloadOwnerWorkbook(filters)).rejects.toThrow("share failed"); expect(mocks.remove).toHaveBeenCalledTimes(1);
});
