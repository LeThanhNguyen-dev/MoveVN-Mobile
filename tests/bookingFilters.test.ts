import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";
vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ customer: vi.fn(), owner: vi.fn() }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  FlatList: (props: Record<string, unknown>) =>
    React.createElement(
      "FlatList",
      props,
      props.ListHeaderComponent as React.ReactNode,
    ),
  Pressable: "Pressable",
  RefreshControl: "RefreshControl",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  Keyboard: { dismiss: vi.fn() },
  Modal: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? React.createElement("Modal", null, children) : null),
  StyleSheet: {
    absoluteFill: {},
    flatten: function flatten(style: unknown): Record<string, unknown> {
      return Array.isArray(style)
        ? Object.assign({}, ...style.map(flatten))
        : style && typeof style === "object"
          ? (style as Record<string, unknown>)
          : {};
    },
    create: (x: unknown) => x,
  },
}));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "CalendarCheck",
      "ClipboardList",
      "ArrowLeft",
      "CalendarDays",
      "ChevronDown",
      "ChevronLeft",
      "ChevronRight",
      "Search",
      "X",
    ].map((name) => [name, "Icon"]),
  ),
);
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) =>
    React.useEffect(callback, [callback]),
}));
vi.mock("@/theme/useTheme", () => ({
  useTheme: () => ({ theme: themes.light }),
}));
vi.mock("@/services/apiClient", () => ({
  getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/features/booking/bookingService", () => ({
  getMyBookings: mocks.customer,
}));
vi.mock("@/features/booking/bookingOwnerService", () => ({
  getOwnerBookings: mocks.owner,
}));
vi.mock("@/features/booking/components/BookingCard", () => ({
  default: "BookingCard",
}));
vi.mock("@/features/booking/components/BookingCardSkeleton", () => ({
  default: "BookingCardSkeleton",
}));
import TripListScreen from "@/features/booking/screens/TripListScreen";
import OwnerBookingListScreen from "@/features/booking/screens/OwnerBookingListScreen";
import BookingSearchFilters, {
  validateSearchFilters,
} from "@/features/booking/components/BookingSearchFilters";
import AppDateField from "@/components/ui/AppDateField";

let tree: ReactTestRenderer | undefined;
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  vi.useRealTimers();
  vi.clearAllMocks();
});
for (const [name, Screen, api] of [
  ["customer", TripListScreen, mocks.customer],
  ["owner", OwnerBookingListScreen, mocks.owner],
] as const) {
  it(`${name} resets paging for combined filters and ignores an earlier response`, async () => {
    let stale!: (data: unknown) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          stale = resolve;
        }),
    );
    api.mockResolvedValueOnce({ items: [{ id: 2 }], totalCount: 2, page: 1 });
    await act(async () => {
      tree = create(
        React.createElement(Screen as React.ComponentType<any>, {
          navigation: { navigate: vi.fn() },
        }),
      );
    });
    const filters = {
      keyword: "BK-2",
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    };
    await act(async () =>
      tree!.root.findByType(BookingSearchFilters).props.onApply(filters),
    );
    expect(api).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...filters, page: 1 }),
    );
    await act(async () =>
      stale({ items: [{ id: 1 }], totalCount: 100, page: 7 }),
    );
    const list = () =>
      tree!.root.find((node) => (node.type as unknown) === "FlatList");
    expect(list().props.data).toEqual([{ id: 2 }]);
    let more!: (data: unknown) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          more = resolve;
        }),
    );
    await act(async () => {
      list().props.onEndReached();
      list().props.onEndReached();
    });
    expect(api).toHaveBeenCalledTimes(3);
    expect(api).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...filters, page: 2 }),
    );
    await act(async () => more({ items: [{ id: 3 }], totalCount: 2, page: 2 }));
    expect(list().props.data).toEqual([{ id: 2 }, { id: 3 }]);
  });
}
it("validates date filters before any request", () => {
  expect(
    validateSearchFilters({ keyword: "", fromDate: "2026-02-30", toDate: "" }),
  ).toBeTruthy();
  expect(
    validateSearchFilters({
      keyword: "",
      fromDate: "2026-10-20",
      toDate: "2026-10-01",
    }),
  ).toBeTruthy();
  expect(
    validateSearchFilters({
      keyword: "",
      fromDate: "2026-10-01",
      toDate: "2026-10-20",
    }),
  ).toBeNull();
});

async function press(label: string) {
  const button = tree!.root.findAll(
    (node) =>
      (node.type as unknown) === "Pressable" &&
      (node.props.accessibilityLabel === label ||
        node
          .findAll((child) => (child.type as unknown) === "Text")
          .some((child) => child.children.join("") === label)),
  )[0];
  expect(button, label).toBeDefined();
  await act(async () => button!.props.onPress());
}
it("keeps date filters collapsed, searches on the keyboard and validates a selected range", async () => {
  const apply = vi.fn();
  await act(async () => {
    tree = create(
      React.createElement(BookingSearchFilters, { onApply: apply }),
    );
  });
  expect(tree!.root.findAllByType(AppDateField)).toHaveLength(0);
  const input = () =>
    tree!.root.find((node) => (node.type as unknown) === "TextInput");
  await act(async () => input().props.onChangeText("  BK-12  "));
  await act(async () => input().props.onSubmitEditing());
  expect(apply).toHaveBeenLastCalledWith({
    keyword: "BK-12",
    fromDate: "",
    toDate: "",
  });
  await press("Lọc theo thời gian");
  const fields = () => tree!.root.findAllByType(AppDateField);
  await act(async () => {
    fields()[0]!.props.onChange("2026-10-20");
  });
  await act(async () => {
    fields()[1]!.props.onChange("2026-10-01");
  });
  await press("Áp dụng");
  expect(apply).toHaveBeenCalledTimes(1);
  expect(
    tree!.root.findAll((node) => node.props.accessibilityRole === "alert"),
  ).toHaveLength(2);
  await act(async () => {
    fields()[1]!.props.onChange("2026-10-31");
  });
  await press("Áp dụng");
  expect(apply).toHaveBeenLastCalledWith({
    keyword: "BK-12",
    fromDate: "2026-10-20",
    toDate: "2026-10-31",
  });
  expect(tree!.root.findAllByType(AppDateField)).toHaveLength(0);
  await press("Xóa bộ lọc tìm kiếm và ngày");
  expect(apply).toHaveBeenLastCalledWith({
    keyword: "",
    fromDate: "",
    toDate: "",
  });
});
it("lets users pick historical dates on the calendar and clear one boundary", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T12:00:00+07:00"));
  const change = vi.fn();
  await act(async () => {
    tree = create(
      React.createElement(AppDateField, {
        label: "Từ ngày",
        value: "",
        onChange: change,
      }),
    );
  });
  await press("Từ ngày: Chọn ngày");
  await press("Tháng trước");
  await press("30/09/2026");
  expect(change).toHaveBeenLastCalledWith("2026-09-30");
  await act(async () =>
    tree!.update(
      React.createElement(AppDateField, {
        label: "Từ ngày",
        value: "2026-09-30",
        onChange: change,
      }),
    ),
  );
  await press("Từ ngày: 30/09/2026");
  await press("Bỏ chọn ngày");
  expect(change).toHaveBeenLastCalledWith("");
});
