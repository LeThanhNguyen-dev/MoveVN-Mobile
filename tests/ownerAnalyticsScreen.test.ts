import React from "react";
import fixture from "./fixtures/owner-analytics.json";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { OwnerAnalytics } from "@/features/ownerAnalytics/types";
import type { AuthUser } from "@/features/auth/types";

vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn() }));
vi.mock("@/features/ownerAnalytics/service", () => ({ getOwnerAnalytics: mocks.get }));
vi.mock("@/features/ownerAnalytics/downloadWorkbook", () => ({ downloadOwnerWorkbook: mocks.download }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_e: unknown, fallback: string) => fallback }));
vi.mock("@/features/app/components/AppDashboardHeader", () => ({ default: () => null }));
vi.mock("react-native", () => ({ View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", RefreshControl: "RefreshControl", StyleSheet: { create: (x: unknown) => x, hairlineWidth: 1, absoluteFill: {} },
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement("Modal", null, children) : null,
}));
vi.mock("lucide-react-native", () => Object.fromEntries(["BarChart3", "CalendarCheck", "CarFront", "ChevronDown", "CircleHelp", "Download", "RefreshCw", "ShieldCheck", "Star", "Trophy", "X"].map(n => [n, n])));
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(async () => null), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
import OwnerAnalyticsScreen from "@/features/ownerAnalytics/OwnerAnalyticsScreen";

const seed = fixture as OwnerAnalytics;
const user = { userId: 10, fullName: "Chủ xe kiểm thử", roles: ["Owner"] } as AuthUser;
let tree: ReactTestRenderer | undefined;
const text = () => tree!.root.findAll(n => n.type as unknown === "Text").map(n => n.children.filter(c => typeof c === "string" || typeof c === "number").join("")).join("\n");
beforeEach(() => { vi.resetAllMocks(); mocks.get.mockResolvedValue(structuredClone(seed)); mocks.download.mockResolvedValue(undefined); });
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
async function mount() { await act(async () => { tree = create(React.createElement(OwnerAnalyticsScreen, { user })); }); }
async function press(label: string) {
  const button = tree!.root.findAll(n => n.type as unknown === "Pressable" && n.props.accessibilityLabel === label)[0];
  expect(button, label).toBeDefined(); await act(async () => { await button!.props.onPress(); });
}

it("renders both rankings, separate wallet income and an idle vehicle from the real response shape", async () => {
  await mount(); expect(text()).toContain("Hiệu quả đội xe");
  expect(text()).toContain("675.000"); expect(text()).toContain("6.000.000");
  expect(text()).toContain("Xe được đặt nhiều nhất"); expect(text()).toContain("Xe có thu nhập cao nhất");
  expect(text()).toContain("Yamaha Grande"); expect(text()).toContain("1/3 xe chưa có đơn hợp lệ");
});
it("selects a ranked vehicle, resets paging and allows returning to the full fleet", async () => {
  await mount(); await press("Xe được đặt nhiều nhất: 43A-12345");
  expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ vehicleId: 1, page: 1 }), expect.any(AbortSignal));
  await press("Xem toàn bộ đội xe");
  expect(mocks.get.mock.calls.at(-1)![0].vehicleId).toBeUndefined();
});
it("validates custom dates before fetching and applies a selected valid period", async () => {
  await mount(); const count = mocks.get.mock.calls.length;
  const field = (label: string) => tree!.root.find(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === label);
  await act(async () => { field("Từ ngày").props.onChangeText("2026-10-07"); field("Đến ngày").props.onChangeText("2026-10-01"); });
  await press("Áp dụng"); expect(text()).toContain("Ngày bắt đầu không được sau"); expect(mocks.get).toHaveBeenCalledTimes(count);
  await act(async () => { field("Từ ngày").props.onChangeText("2026-10-01"); field("Đến ngày").props.onChangeText("2026-10-07"); });
  await press("Áp dụng"); expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ fromDate: "2026-10-01", toDate: "2026-10-07" }), expect.any(AbortSignal));
});
it("shows an API failure with retry rather than inventing an empty result", async () => {
  mocks.get.mockRejectedValueOnce(new Error("offline")); await mount(); expect(text()).toContain("Không tải được thống kê");
  expect(text()).not.toContain("Xe có thu nhập cao nhất"); await press("Thử lại"); expect(text()).toContain("Xe có thu nhập cao nhất");
});
it("ignores a stale response after switching the filter", async () => {
  let resolveOld!: (value: OwnerAnalytics) => void; mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await mount(); await press("7 ngày");
  expect(mocks.get.mock.calls[0]![1].aborted).toBe(true);
  await act(async () => { resolveOld({ ...seed, summary: { ...seed.summary, walletIncome: 999999999 } }); });
  expect(text()).toContain("675.000"); expect(text()).not.toContain("999.999.999");
});
it("opens metric definitions and reports export failure without closing the overview", async () => {
  await mount(); await press("Cách tính số liệu và lưu ý"); expect(text()).toContain("không phải lợi nhuận");
  mocks.download.mockRejectedValueOnce(new Error("Không tải được Excel")); await press("Xuất Excel");
  expect(text()).toContain("Không tải được Excel"); expect(text()).toContain("Hiệu quả đội xe");
  await press("Xuất Excel"); expect(mocks.download).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
});
