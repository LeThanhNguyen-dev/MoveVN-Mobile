import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";
vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ customer: vi.fn(), owner: vi.fn() }));
vi.mock("react-native", () => ({ ActivityIndicator: "ActivityIndicator", FlatList: "FlatList", Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (x: unknown) => x } }));
vi.mock("lucide-react-native", () => ({ CalendarCheck: "Icon", ClipboardList: "Icon", ArrowLeft: "Icon" }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_e: unknown, fallback: string) => fallback }));
vi.mock("@/features/booking/bookingService", () => ({ getMyBookings: mocks.customer }));
vi.mock("@/features/booking/bookingOwnerService", () => ({ getOwnerBookings: mocks.owner }));
vi.mock("@/features/booking/components/BookingCard", () => ({ default: "BookingCard" }));
vi.mock("@/features/booking/components/BookingCardSkeleton", () => ({ default: "BookingCardSkeleton" }));
import TripListScreen from "@/features/booking/screens/TripListScreen";
import OwnerBookingListScreen from "@/features/booking/screens/OwnerBookingListScreen";
import BookingSearchFilters, { validateSearchFilters } from "@/features/booking/components/BookingSearchFilters";

let tree: ReactTestRenderer | undefined;
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.clearAllMocks(); });
for (const [name, Screen, api] of [["customer", TripListScreen, mocks.customer], ["owner", OwnerBookingListScreen, mocks.owner]] as const) {
  it(`${name} resets paging for combined filters and ignores an earlier response`, async () => {
    let stale!: (data: unknown) => void;
    api.mockImplementationOnce(() => new Promise(resolve => { stale = resolve; }));
    api.mockResolvedValueOnce({ items: [{ id: 2 }], totalCount: 2, page: 1 });
    await act(async () => { tree = create(React.createElement(Screen as React.ComponentType<any>, { navigation: { navigate: vi.fn() } })); });
    const filters = { keyword: "BK-2", fromDate: "2026-10-01", toDate: "2026-10-31" };
    await act(async () => tree!.root.findByType(BookingSearchFilters).props.onApply(filters));
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ ...filters, page: 1 }));
    await act(async () => stale({ items: [{ id: 1 }], totalCount: 100, page: 7 }));
    const list = () => tree!.root.find(node => (node.type as unknown) === "FlatList");
    expect(list().props.data).toEqual([{ id: 2 }]);
    let more!: (data: unknown) => void;
    api.mockImplementationOnce(() => new Promise(resolve => { more = resolve; }));
    await act(async () => { list().props.onEndReached(); list().props.onEndReached(); });
    expect(api).toHaveBeenCalledTimes(3);
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ ...filters, page: 2 }));
    await act(async () => more({ items: [{ id: 3 }], totalCount: 2, page: 2 }));
    expect(list().props.data).toEqual([{ id: 2 }, { id: 3 }]);
  });
}
it("validates date filters before any request", () => {
  expect(validateSearchFilters({ keyword: "", fromDate: "2026-02-30", toDate: "" })).toBeTruthy();
  expect(validateSearchFilters({ keyword: "", fromDate: "2026-10-20", toDate: "2026-10-01" })).toBeTruthy();
  expect(validateSearchFilters({ keyword: "", fromDate: "2026-10-01", toDate: "2026-10-20" })).toBeNull();
});
