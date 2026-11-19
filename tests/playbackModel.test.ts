import { describe, expect, it } from "vitest";
import {
  anchorIndexAt,
  buildPlaybackModel,
  frameAtTime,
  stepAnchorTime,
} from "@/features/gps/playbackModel";
import type { GpsRoadPathResponse, GpsRoutePointResponse } from "@/features/gps/types";

const start = Date.parse("2026-11-17T05:00:00.000Z");
const at = (seconds: number) => new Date(start + seconds * 1000).toISOString();

const road: GpsRoadPathResponse = {
  bookingId: 1,
  matched: true,
  path: [
    { latitude: 16.0, longitude: 108.0 },
    { latitude: 16.0, longitude: 108.002 },
  ],
};

/** Chuyến thẳng 214 m: chạy 30 s, đỗ 90 s giữa chuyến, rồi chạy tiếp. */
const gps: GpsRoutePointResponse[] = [
  { timestamp: at(0), latitude: 16.0, longitude: 108.0, speedKmh: 20 },
  { timestamp: at(30), latitude: 16.0, longitude: 108.0006, speedKmh: 12 },
  { timestamp: at(60), latitude: 16.0, longitude: 108.0006, speedKmh: 0 },
  { timestamp: at(120), latitude: 16.0, longitude: 108.0006, speedKmh: 0 },
  { timestamp: at(150), latitude: 16.0, longitude: 108.0012, speedKmh: 20 },
  { timestamp: at(180), latitude: 16.0, longitude: 108.002, speedKmh: 25 },
];

describe("playback model", () => {
  const model = buildPlaybackModel(gps, road);

  it("builds one anchor per GPS point with monotonic distance", () => {
    expect(model).not.toBeNull();
    expect(model!.anchors).toHaveLength(gps.length);
    const distances = model!.anchors.map((anchor) => anchor.d);
    for (let index = 1; index < distances.length; index++) {
      expect(distances[index]).toBeGreaterThanOrEqual(distances[index - 1]!);
    }
    expect(model!.totalM).toBeGreaterThan(200);
    expect(model!.totalM).toBeLessThan(230);
  });

  it("keeps the mid-trip stop: marker stands still and speed is 0", () => {
    const frame = frameAtTime(model!, start + 90_000, 0);
    expect(frame.moving).toBe(false);
    expect(frame.speedKmh).toBe(0);
    expect(frame.longitude).toBeCloseTo(108.0006, 4);
    // Đúng 90 giây giữa 2 mốc đỗ, không được nhích tới đích.
    expect(frame.d).toBeLessThan(model!.totalM * 0.6);
  });

  it("keeps the arrow heading while the vehicle is standing", () => {
    const frame = frameAtTime(model!, start + 90_000, 123);
    expect(frame.heading).toBe(123);
  });

  it("arrives at the destination exactly at the end of the trip", () => {
    const frame = frameAtTime(model!, start + 180_000, 0);
    expect(frame.longitude).toBeCloseTo(108.002, 5);
    expect(frame.progress).toBeCloseTo(1, 5);
  });

  it("steps to the previous/next GPS point", () => {
    const mid = start + 135_000;
    expect(anchorIndexAt(model!, mid)).toBe(3);
    expect(stepAnchorTime(model!, mid, -1)).toBe(start + 120_000);
    expect(stepAnchorTime(model!, mid, 1)).toBe(start + 150_000);
  });

  it("returns null when there is no road path", () => {
    expect(buildPlaybackModel(gps, null)).toBeNull();
    expect(buildPlaybackModel(gps, { bookingId: 1, matched: false, path: [] })).toBeNull();
  });
});

describe("playback model across a GPS gap", () => {
  const roadWithGap: GpsRoadPathResponse = {
    bookingId: 3,
    matched: true,
    path: [
      { latitude: 16.0, longitude: 108.0 },
      { latitude: 16.0, longitude: 108.001 },
      { latitude: 16.0, longitude: 108.011 },
      { latitude: 16.0, longitude: 108.012 },
    ],
    segments: [
      {
        matched: true,
        points: [
          { latitude: 16.0, longitude: 108.0 },
          { latitude: 16.0, longitude: 108.001 },
        ],
      },
      {
        matched: true,
        points: [
          { latitude: 16.0, longitude: 108.011 },
          { latitude: 16.0, longitude: 108.012 },
        ],
      },
    ],
  };
  const gpsWithGap: GpsRoutePointResponse[] = [
    { timestamp: at(0), latitude: 16.0, longitude: 108.0, speedKmh: 20 },
    { timestamp: at(30), latitude: 16.0, longitude: 108.001, speedKmh: 20 },
    { timestamp: at(120), latitude: 16.0, longitude: 108.011, speedKmh: 20 },
    { timestamp: at(150), latitude: 16.0, longitude: 108.012, speedKmh: 20 },
  ];
  const model = buildPlaybackModel(gpsWithGap, roadWithGap)!;

  it("excludes the gap from total distance", () => {
    expect(model.segments).toHaveLength(2);
    // Mỗi đoạn ~107 m; gap 1 km không được cộng vào.
    expect(model.totalM).toBeGreaterThan(200);
    expect(model.totalM).toBeLessThan(230);
  });

  it("keeps the marker at the end of the old segment during the gap", () => {
    const frame = frameAtTime(model, start + 90_000, 0);
    expect(frame.longitude).toBeCloseTo(108.001, 4);
  });

  it("jumps into the new segment after the gap", () => {
    const frame = frameAtTime(model, start + 135_000, 0);
    expect(frame.longitude).toBeGreaterThan(108.011);
    expect(frame.longitude).toBeLessThan(108.012);
  });
});

describe("playback model on an out-and-back street", () => {
  // Đi–về trên CÙNG cung phố: nếu chiếu "đoạn gần nhất" thì điểm của lượt đi
  // sẽ rơi vào nhánh về → marker nhảy tới đích sớm.
  const path = [
    { latitude: 16.0, longitude: 108.0 },
    { latitude: 16.0, longitude: 108.001 },
    { latitude: 16.0, longitude: 108.002 },
    { latitude: 16.0, longitude: 108.001 },
    { latitude: 16.0, longitude: 108.0 },
  ];
  const outAndBack: GpsRoutePointResponse[] = [
    { timestamp: at(0), latitude: 16.0, longitude: 108.0, speedKmh: 30 },
    { timestamp: at(30), latitude: 16.0, longitude: 108.001, speedKmh: 30 },
    { timestamp: at(60), latitude: 16.0, longitude: 108.002, speedKmh: 10 },
    { timestamp: at(90), latitude: 16.0, longitude: 108.001, speedKmh: 30 },
    { timestamp: at(120), latitude: 16.0, longitude: 108.0, speedKmh: 30 },
  ];
  const model = buildPlaybackModel(outAndBack, { bookingId: 2, matched: true, path })!;

  it("advances along the outbound leg first, not the return leg", () => {
    const outbound = frameAtTime(model, start + 30_000, 90);
    expect(outbound.d).toBeLessThan(model.totalM * 0.4);
    expect(outbound.longitude).toBeCloseTo(108.001, 4);
  });

  it("keeps increasing through the turnaround to the end", () => {
    const distances = [0, 30_000, 60_000, 90_000, 120_000].map(
      (seconds) => frameAtTime(model, start + seconds, 90).d,
    );
    for (let index = 1; index < distances.length; index++) {
      expect(distances[index]!).toBeGreaterThanOrEqual(distances[index - 1]!);
    }
    expect(distances[2]!).toBeCloseTo(model.totalM / 2, 0);
    expect(distances[4]!).toBeCloseTo(model.totalM, 0);
  });
});
