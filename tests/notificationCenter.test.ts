import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NotificationItem } from "@/features/notifications/types";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), read: vi.fn(), readAll: vi.fn() }));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () => ({ userId: 1 }), getSessionGeneration: () => 0, getToken: () => "test-token",
  clearSession: vi.fn(),
  useAuthStore: (selector: (state: { user: { userId: number } }) => unknown) => selector({ user: { userId: 1 } }),
}));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("@/features/notifications/services/notificationService", () => ({
  getNotifications: mocks.list, getNotificationUnreadCount: mocks.count,
  markNotificationAsRead: mocks.read, markAllNotificationsAsRead: mocks.readAll,
}));
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(async () => null), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", Text: "Text", View: "View", ScrollView: "ScrollView", RefreshControl: "RefreshControl",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Modal: ({ visible, children, onRequestClose }: { visible: boolean; children: React.ReactNode; onRequestClose: () => void }) => visible ? React.createElement("Modal", { onRequestClose }, children) : null,
  FlatList: ({ data, renderItem, ListEmptyComponent, ListFooterComponent, refreshControl }: {
    data: NotificationItem[]; renderItem: (props: { item: NotificationItem }) => React.ReactNode;
    ListEmptyComponent: React.ReactNode; ListFooterComponent: React.ReactNode; refreshControl: React.ReactNode;
  }) => React.createElement("FlatList", null, refreshControl, data.length ? data.map((item) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent),
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView", SafeAreaProvider: "SafeAreaProvider" }));
vi.mock("lucide-react-native", () => Object.fromEntries(["ArrowLeft", "Bell", "BellOff", "CalendarCheck", "CarFront", "CheckCheck", "ChevronRight", "CircleAlert", "Headphones", "MessageSquare", "RefreshCw", "ShieldAlert", "Wallet"].map((name) => [name, name])));

import NotificationBell from "@/features/notifications/components/NotificationBell";
import RoleNotSupportedScreen from "@/features/app/screens/RoleNotSupportedScreen";
import NotificationCenter from "@/features/notifications/components/NotificationCenter";
import { useNotificationStore as store } from "@/features/notifications/useNotifications";

const unread: NotificationItem = { id: 1, type: "BookingApproved", title: "Đơn thuê đã được duyệt", body: "Nội dung đầy đủ không bị cắt trong chi tiết.", channel: "InApp", isRead: false, createdAt: "2026-10-13T08:00:00Z" };
const read: NotificationItem = { ...unread, id: 2, title: "Thông báo đã xem", isRead: true };
const result = (items: NotificationItem[]) => ({ items, page: 1, totalPages: 1, totalCount: items.length, pageSize: 20 });
let tree: ReactTestRenderer | undefined;
const text = () => JSON.stringify(tree!.toJSON());

beforeEach(() => {
  vi.resetAllMocks();
  store.getState().reset(); store.getState().activate(1);
  store.getState().setUnreadCount(1);
  mocks.list.mockResolvedValue(result([unread, read]));
  mocks.count.mockResolvedValue({ unreadCount: 1 });
  mocks.read.mockResolvedValue({ ...unread, isRead: true });
  mocks.readAll.mockResolvedValue({ updatedCount: 1 });
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
async function mount() {
  await act(async () => { tree = create(React.createElement(React.Fragment, null, React.createElement(NotificationBell), React.createElement(NotificationCenter, { userId: 1 }))); });
}
async function press(label: string) {
  const button = tree!.root.findAll((node) => (node.type as unknown) === "Pressable" && node.props.accessibilityLabel === label)[0];
  expect(button).toBeDefined();
  await act(async () => { await button!.props.onPress(); });
}

it("opens the notification center from a bell and shows the actual unread count", async () => {
  await mount();
  expect(text()).not.toContain("Đơn thuê đã được duyệt");
  await press("Thông báo, 1 chưa đọc");
  expect(text()).toContain("Đơn thuê đã được duyệt");
  expect(text()).toContain("1 thông báo chưa đọc");
  expect(mocks.list).toHaveBeenCalledTimes(1);
});

it.each(["Admin", "Staff"] as const)("keeps the existing %s role restriction while allowing its own notifications", async (role) => {
  await act(async () => {
    tree = create(React.createElement(React.Fragment, null,
      React.createElement(RoleNotSupportedScreen, { role }),
      React.createElement(NotificationCenter, { userId: 1 })));
  });
  expect(text()).toContain("Vai trò chưa hỗ trợ trên app");
  await press("Thông báo, 1 chưa đọc");
  expect(text()).toContain("Đơn thuê đã được duyệt");
});

it("opens full details, marks read on the server and lets Android back return to the list", async () => {
  await mount(); await press("Thông báo, 1 chưa đọc");
  mocks.count.mockResolvedValue({ unreadCount: 0 });
  await press("Chưa đọc: Đơn thuê đã được duyệt");
  expect(text()).toContain("Chi tiết thông báo");
  expect(text()).toContain(unread.body);
  expect(mocks.read).toHaveBeenCalledWith(1);
  expect(store.getState().unreadCount).toBe(0);
  const modal = tree!.root.find((node) => (node.type as unknown) === "Modal");
  await act(async () => modal.props.onRequestClose());
  expect(text()).toContain("Bạn đã đọc hết thông báo");
  expect(text()).not.toContain("Chi tiết thông báo");
  await act(async () => modal.props.onRequestClose());
  expect(store.getState().centerOpen).toBe(false);
});

it("displays details and a retry action while keeping the item unread on a failed mark-read", async () => {
  mocks.read.mockRejectedValueOnce(new Error("offline"));
  await mount(); await press("Thông báo, 1 chưa đọc");
  await press("Chưa đọc: Đơn thuê đã được duyệt");
  expect(text()).toContain("Chưa thể đánh dấu đã đọc");
  expect(store.getState().items.find((entry) => entry.id === 1)?.isRead).toBe(false);
  await press("Đánh dấu thông báo đã đọc");
  expect(store.getState().items.find((entry) => entry.id === 1)?.isRead).toBe(true);
});

it("does not send another mark-read request when opening an already-read item", async () => {
  await mount(); await press("Thông báo, 1 chưa đọc");
  await press("Đã đọc: Thông báo đã xem");
  expect(text()).toContain("Chi tiết thông báo");
  expect(mocks.read).not.toHaveBeenCalled();
});

it("shows the server-read status after another device read an item originally received live", async () => {
  store.getState().prependNotification(unread, 1);
  mocks.list.mockResolvedValue(result([{ ...unread, isRead: true }]));
  mocks.count.mockResolvedValue({ unreadCount: 0 });
  await mount(); await press("Thông báo, 1 chưa đọc");
  await press("Đã đọc: Đơn thuê đã được duyệt");
  expect(text()).not.toContain("Đánh dấu đã đọc");
  expect(mocks.read).not.toHaveBeenCalled();
});

it("shows an error instead of claiming the list is empty when the API fails", async () => {
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  await mount(); await press("Thông báo, 1 chưa đọc");
  expect(text()).toContain("Chưa tải được thông báo");
  expect(text()).not.toContain("Chưa có thông báo");
});

it("filters unread notifications and renders the correct empty state", async () => {
  await mount(); await press("Thông báo, 1 chưa đọc");
  mocks.list.mockResolvedValue(result([])); mocks.count.mockResolvedValue({ unreadCount: 0 });
  const tab = tree!.root.findAll((node) => (node.type as unknown) === "Pressable" && node.props.accessibilityRole === "tab" && node.findAll((child) => (child.type as unknown) === "Text" && child.children.includes("Chưa đọc")).length > 0)[0]!;
  await act(async () => { await tab.props.onPress(); });
  expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, unreadOnly: true });
  expect(text()).toContain("Không có thông báo chưa đọc");
});

it("hides the badge at zero and caps its displayed count at 99+", async () => {
  store.getState().setUnreadCount(120);
  await mount();
  expect(text()).toContain("99+");
  await act(async () => store.getState().setUnreadCount(0));
  expect(text()).not.toContain("99+");
  expect(tree!.root.findAll((node) => (node.type as unknown) === "Pressable" && node.props.accessibilityLabel === "Thông báo")).toHaveLength(1);
});
