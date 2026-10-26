import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: client }));
import { cancelAvailabilityAlert, listAvailabilityAlerts, registerAvailabilityAlert, type AvailabilityAlert } from "../src/features/availabilityAlerts/availabilityAlertService";

const path = "/api/vehicle-availability-alerts";
const from = "2026-11-01T00:30", until = "2026-11-02T00:30";
const item: AvailabilityAlert = { id: 12, vehicleId: 10, vehicleName: "Honda City", licensePlate: "43A-12345",
  startDate: "2026-10-31T17:30:00Z", endDate: "2026-11-01T17:30:00Z", status: "Active", createdAt: "2026-10-25T01:00:00Z", closedAt: null };
const page = () => ({ items: [{ ...item }], totalCount: 41, page: 1, pageSize: 20, totalPages: 999 });
const envelope = (data: unknown, status = true) => ({ data: { status, data, code: "SUCCESS", message: "Success" } });
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T00:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("availability API client contract", () => {
  it("sends Vietnam input as UTC and accepts a matching registration", async () => {
    client.post.mockResolvedValue(envelope(item));
    expect((await registerAvailabilityAlert(10, from, until)).id).toBe(12);
    expect(client.post).toHaveBeenCalledExactlyOnceWith(path, { vehicleId: 10, startDate: "2026-10-31T17:30:00.000Z", endDate: "2026-11-01T17:30:00.000Z" });
  });
  it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])("rejects invalid vehicle ID %s before sending", async id => {
    await expect(registerAvailabilityAlert(id, from, until)).rejects.toThrow(); expect(client.post).not.toHaveBeenCalled();
  });
  it.each([["", ""], ["2026-10-25T01:00", until], [from, from], [until, from], ["2026-02-30T08:00", until], ["2026-11-01T24:00", until]])("rejects invalid periods before HTTP: %s / %s", async (start, end) => {
    await expect(registerAvailabilityAlert(10, start, end)).rejects.toThrow(); expect(client.post).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...item, id: 0 }, { ...item, vehicleId: 99 }, { ...item, startDate: "2026-11-01T03:00:00Z" }, { ...item, endDate: "broken" }, { ...item, status: "Sending" }])("rejects mismatched or malformed registration confirmation %j", async data => {
    client.post.mockResolvedValue(envelope(data)); await expect(registerAvailabilityAlert(10, from, until)).rejects.toThrow();
  });
  it("does not treat a failure envelope as a successful registration", async () => {
    client.post.mockResolvedValue(envelope(item, false)); await expect(registerAvailabilityAlert(10, from, until)).rejects.toThrow();
  });
  it("does not retry mutations automatically when transport fails", async () => {
    const failure = new Error("transport"); client.post.mockRejectedValue(failure);
    await expect(registerAvailabilityAlert(10, from, until)).rejects.toBe(failure); expect(client.post).toHaveBeenCalledTimes(1);
  });
  it("loads private pages and computes pagination from the actual total", async () => {
    client.get.mockResolvedValue(envelope(page())); const result = await listAvailabilityAlerts(1, 10);
    expect(client.get).toHaveBeenCalledExactlyOnceWith(path, { params: { page: 1, pageSize: 20, vehicleId: 10 } });
    expect(result.totalPages).toBe(3); expect(result.items[0]!.id).toBe(12);
  });
  it("accepts a valid empty list", async () => {
    client.get.mockResolvedValue(envelope({ ...page(), items: [], totalCount: 0 }));
    expect((await listAvailabilityAlerts()).items).toEqual([]);
  });
  it.each([null, {}, { ...page(), items: null }, { ...page(), items: [{}] }, { ...page(), page: 0 }, { ...page(), page: 2 },
    { ...page(), pageSize: 0 }, { ...page(), pageSize: 51 }, { ...page(), totalCount: -1 }, { ...page(), totalCount: 0 },
    { ...page(), items: [item, item] }, { ...page(), items: [{ ...item, createdAt: "bad" }] }, { ...page(), items: [{ ...item, status: "unknown" }] }])("rejects invalid page %j", async data => {
    client.get.mockResolvedValue(envelope(data)); await expect(listAvailabilityAlerts()).rejects.toThrow();
  });
  it("rejects a different vehicle in a filtered response", async () => {
    client.get.mockResolvedValue(envelope(page())); await expect(listAvailabilityAlerts(1, 99)).rejects.toThrow();
  });
  it.each([0, -1, 1.1, NaN])("does not send invalid page %s", async p => {
    await expect(listAvailabilityAlerts(p)).rejects.toThrow(); expect(client.get).not.toHaveBeenCalled();
  });
  it("cancels exactly the requested registration", async () => {
    client.delete.mockResolvedValue(envelope({ id: 12 })); await cancelAvailabilityAlert(12);
    expect(client.delete).toHaveBeenCalledExactlyOnceWith(path + "/12");
  });
  it.each([0, -1, 1.2, NaN, Number.MAX_SAFE_INTEGER + 1])("does not send invalid cancellation ID %s", async id => {
    await expect(cancelAvailabilityAlert(id)).rejects.toThrow(); expect(client.delete).not.toHaveBeenCalled();
  });
  it.each([null, {}, { id: 99 }])("rejects unconfirmed cancellation %j", async data => {
    client.delete.mockResolvedValue(envelope(data)); await expect(cancelAvailabilityAlert(12)).rejects.toThrow();
  });
  it("does not treat a failed cancellation envelope as success", async () => {
    client.delete.mockResolvedValue(envelope({ id: 12 }, false)); await expect(cancelAvailabilityAlert(12)).rejects.toThrow();
  });
});
