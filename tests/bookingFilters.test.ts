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
import { validateSearchFilters } from "@/features/booking/components/BookingSearchFilters";


it("validates date filters before any request", () => {
  expect(validateSearchFilters({ keyword: "", fromDate: "2026-02-30", toDate: "" })).toBeTruthy();
  expect(validateSearchFilters({ keyword: "", fromDate: "2026-10-20", toDate: "2026-10-01" })).toBeTruthy();
  expect(validateSearchFilters({ keyword: "", fromDate: "2026-10-01", toDate: "2026-10-20" })).toBeNull();
});
