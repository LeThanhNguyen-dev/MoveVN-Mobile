import { describe, expect, it } from "vitest";
import { formatLogTime, GPS_LOG_LIMIT, mergeLogPoints, rewindPath, type GpsLogPoint } from "@/features/gps/gpsLogPoints";

function point(timestamp: string, latitude = 10.76262, longitude = 106.66017): GpsLogPoint {
  return { timestamp, latitude, longitude, speedKmh: 20 };
}

describe("gps log points", () => {
  it("sorts newest first and dedupes by timestamp, preferring the newer object", () => {
    const older = point("2026-11-14T03:00:00.000Z");
    const newer = point("2026-11-14T03:00:30.000Z", 10.763, 106.661);
    const merged = mergeLogPoints(
      [older],
      [{ ...newer, isMock: true }, point("2026-11-14T03:00:30.000Z", 10.764, 106.662)],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]!.timestamp).toBe(newer.timestamp);
    expect(merged[0]!.latitude).toBe(10.764);
    expect(merged[1]!.timestamp).toBe(older.timestamp);
  });

  it("caps the log at the configured limit keeping the newest points", () => {
    const incoming = Array.from({ length: GPS_LOG_LIMIT + 25 }, (_, index) => point(
      new Date(Date.UTC(2026, 10, 14, 3, 0, index)).toISOString(),
      index,
    ));
    const merged = mergeLogPoints(incoming, []);

    expect(merged).toHaveLength(GPS_LOG_LIMIT);
    expect(merged[0]!.latitude).toBe(GPS_LOG_LIMIT + 24);
    expect(merged[GPS_LOG_LIMIT - 1]!.latitude).toBe(25);
  });

  it("formats valid timestamps and falls back for invalid input", () => {
    expect(formatLogTime("not-a-date")).toBe("--:--:--");
    expect(formatLogTime("2026-11-14T03:05:09.000Z")).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("cuts the route at the selected moment in chronological order", () => {
    const points = [
      point("2026-11-14T03:00:30.000Z", 3, 3),
      point("2026-11-14T03:00:00.000Z", 1, 1),
      point("2026-11-14T03:00:15.000Z", 2, 2),
      point("2026-11-14T03:00:45.000Z", 4, 4),
    ];

    expect(rewindPath(points, "2026-11-14T03:00:30.000Z")).toEqual([[1, 1], [2, 2], [3, 3]]);
    expect(rewindPath(points, "not-a-date")).toEqual([]);
  });
});
