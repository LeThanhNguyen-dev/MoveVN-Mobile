import React, { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  favoriteDeferred,
  favoritePage,
  favoriteVehicle,
} from "./favoriteFixtures";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  userId: 1,
  role: "Customer",
  roles: ["Customer"],
  ids: vi.fn(),
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  alert: vi.fn(),
  back: vi.fn(),
  open: vi.fn(),
  explore: vi.fn(),
  hardwareBack: undefined as (() => boolean) | undefined,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () => ({ userId: mocks.userId, roles: mocks.roles }),
  getToken: () => "token",
  getSessionGeneration: () => 0,
  useAuthStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({
        user: { userId: mocks.userId, roles: mocks.roles },
        activeRole: mocks.role,
        setActiveRole: vi.fn(),
      }),
    { getState: () => ({ activeRole: mocks.role }) },
  ),
}));
vi.mock("@/services/apiClient", () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/features/vehicles/services/favoriteVehicleService", () => ({
  getFavoriteVehicleIds: mocks.ids,
  getFavoriteVehicles: mocks.list,
  addFavoriteVehicle: mocks.add,
  removeFavoriteVehicle: mocks.remove,
}));
vi.mock("@/features/notifications/components/NotificationBell", () => ({
  default: () => React.createElement("NotificationBell"),
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) =>
    useEffect(effect, [effect]),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  Image: "Image",
  RefreshControl: "RefreshControl",
  Platform: { OS: "android" },
  Alert: { alert: mocks.alert },
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  BackHandler: {
    addEventListener: (_event: string, handler: () => boolean) => {
      mocks.hardwareBack = handler;
      return { remove: vi.fn() };
    },
  },
  FlatList: ({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
    refreshControl,
  }: {
    data: unknown[];
    renderItem: (props: { item: unknown }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    refreshControl?: React.ReactNode;
  }) =>
    React.createElement(
      "FlatList",
      null,
      refreshControl,
      data.length
        ? data.map((item, index) =>
            React.createElement(
              React.Fragment,
              { key: index },
              renderItem({ item }),
            ),
          )
        : ListEmptyComponent,
      ListFooterComponent,
    ),
}));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "ArrowLeft",
      "ArrowLeftRight",
      "Heart",
      "RefreshCw",
      "Bike",
      "Car",
      "MapPin",
      "ShieldCheck",
      "Sparkles",
      "Star",
      "UserRound",
    ].map((name) => [name, name]),
  ),
);

import FavoriteVehiclesScreen from "@/features/favorites/screens/FavoriteVehiclesScreen";
import FavoriteVehicleButton from "@/features/favorites/components/FavoriteVehicleButton";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import { useFavoriteStore as store } from "@/features/favorites/useFavorites";
import { useThemeStore } from "@/theme/useThemeStore";
import { refreshFavoriteIds } from "@/features/favorites/favoriteActions";

let tree: ReactTestRenderer | undefined;
const text = () =>
  tree!.root
    .findAll((node) => typeof node.type === "string")
    .map((node) =>
      (node.type as unknown) === "Text"
        ? node.children.filter((value) => typeof value === "string").join("")
        : (node.props.accessibilityLabel ?? ""),
    )
    .join("\n");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId = 1;
  mocks.role = "Customer";
  mocks.roles = ["Customer"];
  mocks.hardwareBack = undefined;
  store.getState().activate(null);
  store.getState().activate(1);
  mocks.ids.mockResolvedValue([1]);
  mocks.list.mockResolvedValue(favoritePage());
  mocks.add.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});
async function mount() {
  await act(async () => {
    tree = create(
      React.createElement(FavoriteVehiclesScreen, {
        onBack: mocks.back,
        onOpen: mocks.open,
        onExplore: mocks.explore,
      }),
    );
  });
}
async function press(label: string) {
  const button = tree!.root.findAll(
    (node) =>
      (node.type as unknown) === "Pressable" &&
      node.props.accessibilityLabel === label,
  )[0];
  expect(button, label).toBeDefined();
  expect(button!.props.disabled, `${label} disabled`).not.toBe(true);
  const stopPropagation = vi.fn();
  await act(async () => {
    await button!.props.onPress({ stopPropagation });
  });
  return stopPropagation;
}

it("opens saved vehicles from the actual home header and displays the same server-backed list", async () => {
  function Home() {
    const open = store((state) => state.open);
    return open
      ? React.createElement(FavoriteVehiclesScreen, {
          onBack: () => store.setState({ open: false }),
          onOpen: mocks.open,
          onExplore: mocks.explore,
        })
      : React.createElement(AppDashboardHeader, {
          user: {
            userId: 1,
            fullName: "Khách Test",
            email: "test@example.com",
            status: "Active",
            roles: ["Customer"],
            isEmailVerified: true,
          },
        });
  }
  await act(async () => {
    tree = create(React.createElement(Home));
  });
  await press("Xe yêu thích");
  expect(text()).toContain("Honda City 1 2025");
  expect(text()).toContain("1 xe đang hiển thị");
  await press("Quay lại từ xe yêu thích");
  expect(text()).toContain("Khách Test");
});

it("confirms removal on the server, refills the first page and shows the empty-state explore action", async () => {
  await mount();
  mocks.list.mockResolvedValueOnce(favoritePage([]));
  const stop = await press("Bỏ yêu thích 1");
  expect(stop).toHaveBeenCalledTimes(1);
  expect(mocks.remove).toHaveBeenCalledWith(1);
  expect(text()).toContain("Chưa có xe yêu thích");
  await press("Khám phá xe để yêu thích");
  expect(mocks.explore).toHaveBeenCalledTimes(1);
});

it("retains the vehicle and selected heart when removing fails and shows a useful error", async () => {
  await mount();
  mocks.remove.mockRejectedValueOnce(new Error("offline"));
  await press("Bỏ yêu thích 1");
  expect(text()).toContain("Honda City 1 2025");
  expect(text()).toContain("Bỏ yêu thích 1");
  expect(mocks.alert).toHaveBeenCalledWith(
    "Yêu thích",
    expect.stringContaining("Chưa bỏ được xe"),
  );
});

it("synchronizes two mounted hearts without a reload and blocks double taps while saving", async () => {
  await refreshFavoriteIds();
  await act(async () => {
    tree = create(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(FavoriteVehicleButton, { vehicleId: 2 }),
        React.createElement(FavoriteVehicleButton, { vehicleId: 2 }),
      ),
    );
  });
  const pending = favoriteDeferred<void>();
  mocks.add.mockReturnValueOnce(pending.promise);
  let sending!: Promise<void>;
  const first = tree!.root.findAll(
    (node) => (node.type as unknown) === "Pressable",
  )[0]!;
  await act(async () => {
    sending = first.props.onPress({ stopPropagation: vi.fn() });
  });
  const buttons = tree!.root.findAll(
    (node) => (node.type as unknown) === "Pressable",
  );
  expect(buttons.every((button) => button.props.disabled)).toBe(true);
  await act(async () => {
    pending.resolve();
    await sending;
  });
  expect(
    tree!.root.findAll(
      (node) =>
        (node.type as unknown) === "Pressable" &&
        node.props.accessibilityLabel === "Bỏ yêu thích 2",
    ),
  ).toHaveLength(2);
});

it("does not display a failed list request as an empty collection and supports retry", async () => {
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(text()).toContain("Không tải được xe yêu thích");
  expect(text()).not.toContain("Chưa có xe yêu thích");
  await press("Thử tải lại xe yêu thích");
  expect(text()).toContain("Honda City 1 2025");
});

it("shows retry for unknown favorite state instead of guessing whether to add or remove", async () => {
  mocks.ids.mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(text()).toContain("Tải trạng thái yêu thích xe 1");
  await press("Tải trạng thái yêu thích xe 1");
  expect(text()).toContain("Bỏ yêu thích 1");
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("loads the next page, retains existing cards and does not open a vehicle when its heart is pressed", async () => {
  mocks.list
    .mockResolvedValueOnce(favoritePage([favoriteVehicle(1)], 1, 13))
    .mockResolvedValueOnce(favoritePage([favoriteVehicle(2)], 2, 13));
  await mount();
  await press("Xem thêm xe yêu thích");
  expect(mocks.list).toHaveBeenLastCalledWith(2, 12);
  expect(text()).toContain("Honda City 1 2025");
  expect(text()).toContain("Honda City 2 2025");
  mocks.remove.mockRejectedValueOnce(new Error("offline"));
  await press("Bỏ yêu thích 1");
  expect(mocks.open).not.toHaveBeenCalled();
  await press("Xem xe Honda City 1 2025");
  expect(mocks.open).toHaveBeenCalledWith(1);
});

it("intercepts Android back on the root favorites screen instead of closing the app", async () => {
  await mount();
  await act(async () => {
    expect(mocks.hardwareBack?.()).toBe(true);
  });
  expect(mocks.back).toHaveBeenCalledTimes(1);
});

it.each(["Owner", "Staff", "Admin"])(
  "hides customer favorite controls in %s mode",
  async (role) => {
    mocks.role = role;
    mocks.roles = [role];
    await act(async () => {
      tree = create(
        React.createElement(FavoriteVehicleButton, { vehicleId: 1 }),
      );
    });
    expect(tree!.toJSON()).toBeNull();
  },
);

it("does not briefly display another user's saved heart before the session effect has reset the store", async () => {
  await refreshFavoriteIds();
  mocks.userId = 2;
  await act(async () => {
    tree = create(React.createElement(FavoriteVehicleButton, { vehicleId: 1 }));
  });
  expect(text()).not.toContain("Bỏ yêu thích 1");
  expect(text()).toContain("Tải trạng thái yêu thích xe 1");
});

it("renders the saved list in dark mode and can refresh it without losing the view", async () => {
  const previous = useThemeStore.getState();
  useThemeStore.setState({ mode: "dark" });
  try {
    await mount();
    expect(text()).toContain("Xe yêu thích");
    await press("Làm mới xe yêu thích");
    expect(text()).toContain("Honda City 1 2025");
  } finally {
    await act(async () => useThemeStore.setState(previous));
  }
});
