import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  userId: 1 as number | null,
  role: "Customer",
  generation: 0,
  ids: vi.fn(),
  listener: undefined as ((state: string) => void) | undefined,
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_type: string, listener: (state: string) => void) => {
      mocks.listener = listener;
      return {
        remove: () => {
          mocks.listener = undefined;
        },
      };
    },
  },
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () =>
    mocks.userId
      ? { userId: mocks.userId, roles: ["Customer", "Owner"] }
      : null,
  getToken: () => (mocks.userId ? "token" : null),
  getSessionGeneration: () => mocks.generation,
  useAuthStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({
        token: mocks.userId ? { accessToken: "token" } : null,
        user: mocks.userId
          ? { userId: mocks.userId, roles: ["Customer", "Owner"] }
          : null,
        activeRole: mocks.role,
      }),
    { getState: () => ({ activeRole: mocks.role }) },
  ),
}));
vi.mock("@/services/apiClient", () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/features/vehicles/services/favoriteVehicleService", () => ({
  getFavoriteVehicleIds: mocks.ids,
}));
import { useFavoriteSession } from "@/features/favorites/useFavoriteSession";
import { useFavoriteStore as store } from "@/features/favorites/useFavorites";
import { favoriteDeferred } from "./favoriteFixtures";

let tree: ReactTestRenderer | undefined;
function Probe({ revision: _revision }: { revision: number }) {
  useFavoriteSession();
  return null;
}
async function render(revision = 0) {
  await act(async () => {
    if (tree) tree.update(React.createElement(Probe, { revision }));
    else tree = create(React.createElement(Probe, { revision }));
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId = 1;
  mocks.role = "Customer";
  mocks.generation = 0;
  mocks.listener = undefined;
  mocks.ids.mockResolvedValue([1]);
  store.getState().activate(null);
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});

it("initializes the customer session and refreshes saved IDs when the app returns to foreground", async () => {
  await render();
  expect(store.getState().ids).toEqual([1]);
  mocks.ids.mockResolvedValueOnce([1, 2]);
  await act(async () => mocks.listener?.("active"));
  expect(store.getState().ids).toEqual([1, 2]);
});

it("clears saved state when leaving Customer mode and reloads it when returning", async () => {
  await render();
  store.setState({ open: true });
  mocks.role = "Owner";
  await render(1);
  expect(store.getState().userId).toBeNull();
  expect(store.getState().open).toBe(false);
  expect(store.getState().ids).toEqual([]);
  expect(mocks.listener).toBeUndefined();
  mocks.role = "Customer";
  await render(2);
  expect(store.getState().ids).toEqual([1]);
  expect(mocks.ids).toHaveBeenCalledTimes(2);
});

it("ignores a previous account's pending ID response after switching accounts", async () => {
  const pending = favoriteDeferred<number[]>();
  mocks.ids.mockReturnValueOnce(pending.promise);
  await render();
  mocks.userId = 2;
  mocks.generation++;
  mocks.ids.mockResolvedValueOnce([2]);
  await render(1);
  await act(async () => pending.resolve([99]));
  expect(store.getState().userId).toBe(2);
  expect(store.getState().ids).toEqual([2]);
});
