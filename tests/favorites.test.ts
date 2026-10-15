import { beforeEach, expect, it, vi } from "vitest";
import type { PagedResult } from "@/features/admin/types";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import {
  favoriteDeferred,
  favoritePage,
  favoriteVehicle,
} from "./favoriteFixtures";

const mocks = vi.hoisted(() => ({
  userId: 1 as number | null,
  generation: 0,
  role: "Customer",
  roles: ["Customer"],
  ids: vi.fn(),
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () =>
    mocks.userId ? { userId: mocks.userId, roles: mocks.roles } : null,
  getToken: () => (mocks.userId ? "token" : null),
  getSessionGeneration: () => mocks.generation,
  useAuthStore: { getState: () => ({ activeRole: mocks.role }) },
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
import { useFavoriteStore as store } from "@/features/favorites/useFavorites";
import {
  loadFavoriteVehicles,
  openFavoriteVehicles,
  refreshFavoriteIds,
  toggleFavoriteVehicle,
} from "@/features/favorites/favoriteActions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId = 1;
  mocks.generation = 0;
  mocks.role = "Customer";
  mocks.roles = ["Customer"];
  store.getState().activate(null);
  store.getState().activate(1);
  mocks.ids.mockResolvedValue([1]);
  mocks.list.mockResolvedValue(favoritePage());
  mocks.add.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});

it("deduplicates concurrent ID loads and merges a mutation that finishes while a refresh is pending", async () => {
  await refreshFavoriteIds();
  const pending = favoriteDeferred<number[]>();
  mocks.ids.mockReturnValueOnce(pending.promise);
  const a = refreshFavoriteIds();
  const b = refreshFavoriteIds();
  await toggleFavoriteVehicle(1);
  pending.resolve([1]);
  await Promise.all([a, b]);
  expect(mocks.ids).toHaveBeenCalledTimes(2);
  expect(store.getState().ids).toEqual([]);
});

it("updates all views only after a successful save and preserves their state on failure", async () => {
  await refreshFavoriteIds();
  mocks.add.mockRejectedValueOnce(new Error("offline"));
  expect((await toggleFavoriteVehicle(2)).ok).toBe(false);
  expect(store.getState().ids).toEqual([1]);
  await toggleFavoriteVehicle(2);
  expect(store.getState().ids).toEqual([1, 2]);
  mocks.remove.mockRejectedValueOnce(new Error("offline"));
  await toggleFavoriteVehicle(1);
  expect(store.getState().ids).toEqual([1, 2]);
  await toggleFavoriteVehicle(1);
  expect(store.getState().ids).toEqual([2]);
});

it("suppresses double taps per vehicle while allowing another vehicle to be saved", async () => {
  await refreshFavoriteIds();
  const pending = favoriteDeferred<void>();
  mocks.add.mockReturnValueOnce(pending.promise);
  const first = toggleFavoriteVehicle(2);
  await toggleFavoriteVehicle(2);
  await toggleFavoriteVehicle(3);
  expect(mocks.add).toHaveBeenCalledTimes(2);
  expect(store.getState().pendingIds).toEqual([2]);
  pending.resolve();
  await first;
  expect(store.getState().ids).toEqual([1, 3, 2]);
});

it("does not guess an unknown heart state or silently erase IDs after a failed refresh", async () => {
  mocks.ids.mockRejectedValueOnce(new Error("offline"));
  await toggleFavoriteVehicle(1);
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(store.getState().idsLoaded).toBe(false);
  await refreshFavoriteIds();
  mocks.ids.mockRejectedValueOnce(new Error("offline"));
  await refreshFavoriteIds();
  expect(store.getState().ids).toEqual([1]);
  expect(store.getState().idsError).toBeTruthy();
});

it("appends pages without duplicates and restarts pagination after a successful removal", async () => {
  await refreshFavoriteIds();
  mocks.list
    .mockResolvedValueOnce(
      favoritePage([favoriteVehicle(1), favoriteVehicle(2)], 1, 14),
    )
    .mockResolvedValueOnce(
      favoritePage([favoriteVehicle(2), favoriteVehicle(3)], 2, 14),
    );
  await loadFavoriteVehicles();
  await loadFavoriteVehicles(true);
  expect(store.getState().items.map((item) => item.id)).toEqual([1, 2, 3]);
  await toggleFavoriteVehicle(1);
  expect(store.getState().items.map((item) => item.id)).toEqual([2, 3]);
  await loadFavoriteVehicles(true);
  expect(mocks.list).toHaveBeenLastCalledWith(1, 12);
});

it("discards a stale list response after a mutation instead of restoring a removed row or stale count", async () => {
  await refreshFavoriteIds();
  const pending = favoriteDeferred<PagedResult<VehicleListItemResponse>>();
  mocks.list.mockReturnValueOnce(pending.promise);
  const loading = loadFavoriteVehicles();
  await toggleFavoriteVehicle(1);
  pending.resolve(favoritePage());
  await loading;
  expect(store.getState().items).toEqual([]);
  expect(store.getState().listDirty).toBe(true);
  mocks.list.mockResolvedValueOnce(favoritePage([]));
  await loadFavoriteVehicles();
  expect(store.getState().totalCount).toBe(0);
});

it("retains loaded rows and the current page after a pagination error so retry fetches that page again", async () => {
  mocks.list.mockResolvedValueOnce(favoritePage([favoriteVehicle()], 1, 13));
  await loadFavoriteVehicles();
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  await loadFavoriteVehicles(true);
  expect(store.getState().items).toHaveLength(1);
  expect(store.getState().page).toBe(1);
  expect(store.getState().listError).toBeTruthy();
  mocks.list.mockResolvedValueOnce(favoritePage([favoriteVehicle(2)], 2, 13));
  await loadFavoriteVehicles(true);
  expect(mocks.list).toHaveBeenLastCalledWith(2, 12);
  expect(store.getState().items).toHaveLength(2);
});

it("keeps pagination invalidated when refreshing after a removal fails, preventing an offset skip on retry", async () => {
  await refreshFavoriteIds();
  mocks.list.mockResolvedValueOnce(favoritePage([favoriteVehicle()], 1, 25));
  await loadFavoriteVehicles();
  await toggleFavoriteVehicle(1);
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  await loadFavoriteVehicles();
  expect(store.getState().listDirty).toBe(true);
  await loadFavoriteVehicles(true);
  expect(mocks.list).toHaveBeenLastCalledWith(1, 12);
});

it("does not leak loaded favorites, drafts of requests, or late save results across logout and same-account relogin", async () => {
  await refreshFavoriteIds();
  openFavoriteVehicles();
  const ids = favoriteDeferred<number[]>();
  const list = favoriteDeferred<PagedResult<VehicleListItemResponse>>();
  const add = favoriteDeferred<void>();
  mocks.ids.mockReturnValueOnce(ids.promise);
  mocks.list.mockReturnValueOnce(list.promise);
  mocks.add.mockReturnValueOnce(add.promise);
  const requests = [
    refreshFavoriteIds(),
    loadFavoriteVehicles(),
    toggleFavoriteVehicle(2),
  ];
  mocks.generation++;
  store.getState().activate(null);
  store.getState().activate(1);
  ids.resolve([1, 2]);
  list.resolve(favoritePage());
  add.resolve();
  await Promise.all(requests);
  expect(store.getState().open).toBe(false);
  expect(store.getState().items).toEqual([]);
  expect(store.getState().ids).toEqual([]);
  expect(store.getState().pendingIds).toEqual([]);
});

it.each(["Owner", "Admin", "Staff"])(
  "does not call customer-only endpoints while the active role is %s",
  async (role) => {
    mocks.role = role;
    await refreshFavoriteIds();
    await loadFavoriteVehicles();
    await toggleFavoriteVehicle(1);
    openFavoriteVehicles();
    expect(mocks.ids).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
    expect(store.getState().open).toBe(false);
  },
);

it("clears state on account change and prevents an older request from affecting a different user", async () => {
  const pending = favoriteDeferred<number[]>();
  mocks.ids.mockReturnValueOnce(pending.promise);
  const loading = refreshFavoriteIds();
  mocks.userId = 2;
  store.getState().activate(2);
  pending.resolve([99]);
  await loading;
  expect(store.getState().ids).toEqual([]);
  await refreshFavoriteIds();
  expect(store.getState().ids).toEqual([1]);
});
