import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: api }));
import { getOwnerOverview } from "@/features/owner/services/ownerOverviewService";

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
it("requests the Vietnam day and exact worklist filters with cancellation", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T19:00:00Z"));
  api.get.mockImplementation(async (url, options) => ({
    data: {
      status: true,
      data:
        url === "/api/owner/calendar"
          ? { summary: { vehicles: 12 } }
          : {
              items: [],
              totalCount: options.params.status === "Pending" ? 8 : 3,
            },
    },
  }));
  const signal = new AbortController().signal;
  const result = await getOwnerOverview(signal);
  expect(api.get).toHaveBeenCalledWith(
    "/api/owner/calendar",
    expect.objectContaining({
      signal,
      params: expect.objectContaining({
        fromDate: "2026-10-28",
        toDate: "2026-10-29",
        pageSize: 1,
      }),
    }),
  );
  expect(api.get.mock.calls.slice(1).map((call) => call[1].params)).toEqual([
    { status: "Pending", page: 1, pageSize: 3 },
    { status: "Returned", page: 1, pageSize: 3 },
  ]);
  expect(api.get.mock.calls.every((call) => call[1].signal === signal)).toBe(
    true,
  );
  expect(result.pending?.totalCount).toBe(8);
  expect(result.returned?.totalCount).toBe(3);
  expect(result.errors).toEqual({});
});
it("keeps successful sections and marks failures as unavailable rather than zero", async () => {
  api.get.mockImplementation(async (url, options) => {
    if (url === "/api/owner/calendar") throw new Error("offline");
    return {
      data: {
        status: true,
        data: {
          items: [],
          totalCount: options.params.status === "Pending" ? 2 : 0,
        },
      },
    };
  });
  const result = await getOwnerOverview(new AbortController().signal);
  expect(result.fleet).toBeNull();
  expect(result.errors.fleet).toBeTruthy();
  expect(result.pending?.totalCount).toBe(2);
  expect(result.returned?.totalCount).toBe(0);
});
it("does not treat a failed API envelope or missing payload as an empty worklist", async () => {
  api.get.mockResolvedValue({ data: { status: false, data: null } });
  const result = await getOwnerOverview(new AbortController().signal);
  expect(result).toMatchObject({ fleet: null, pending: null, returned: null });
  expect(Object.keys(result.errors)).toHaveLength(3);
});
