import { beforeEach, expect, it, vi } from "vitest";
import { favoritePage } from "./favoriteFixtures";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: mocks.get, put: mocks.put, delete: mocks.remove },
}));
import {
  addFavoriteVehicle,
  getFavoriteVehicleIds,
  getFavoriteVehicles,
  removeFavoriteVehicle,
} from "@/features/vehicles/services/favoriteVehicleService";
beforeEach(() => vi.resetAllMocks());

it("uses authenticated customer routes and normalizes unique favorite IDs", async () => {
  mocks.get.mockResolvedValue({ data: { data: [1, 2, 1] } });
  expect(await getFavoriteVehicleIds()).toEqual([1, 2]);
  expect(mocks.get).toHaveBeenCalledWith("/api/customer/favorite-vehicles/ids");
  await addFavoriteVehicle(1);
  expect(mocks.put).toHaveBeenCalledWith("/api/customer/favorite-vehicles/1");
  await removeFavoriteVehicle(2);
  expect(mocks.remove).toHaveBeenCalledWith(
    "/api/customer/favorite-vehicles/2",
  );
});
it("requests a specific page and derives total pages from the server's visible count", async () => {
  mocks.get.mockResolvedValue({
    data: {
      data: { ...favoritePage(), totalCount: 25, totalPages: undefined },
    },
  });
  expect((await getFavoriteVehicles(2, 12)).totalPages).toBe(3);
  expect(mocks.get).toHaveBeenCalledWith("/api/customer/favorite-vehicles", {
    params: { page: 2, pageSize: 12 },
  });
});
it("surfaces malformed responses as errors instead of claiming the user has no favorites", async () => {
  mocks.get.mockResolvedValue({ data: { data: null } });
  await expect(getFavoriteVehicleIds()).rejects.toThrow("Invalid");
  await expect(getFavoriteVehicles()).rejects.toThrow("Invalid");
  mocks.get.mockResolvedValue({ data: { data: [0, 1] } });
  await expect(getFavoriteVehicleIds()).rejects.toThrow("Invalid");
  mocks.get.mockResolvedValue({
    data: { data: { ...favoritePage(), pageSize: 0 } },
  });
  await expect(getFavoriteVehicles()).rejects.toThrow("Invalid");
});
