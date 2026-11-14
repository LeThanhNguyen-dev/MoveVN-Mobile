/** Một điểm GPS đã nhận về (lịch sử từ API route hoặc realtime từ SignalR). */
export type GpsLogPoint = {
  timestamp: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  isMock?: boolean;
};

/** Số điểm tối đa giữ trong nhật ký để không phình bộ nhớ khi chuyến dài. */
export const GPS_LOG_LIMIT = 300;

/** Gộp điểm mới vào nhật ký: dedupe theo mốc thời gian, mới nhất trước, giới hạn 300 điểm. */
export function mergeLogPoints(incoming: GpsLogPoint[], current: GpsLogPoint[]): GpsLogPoint[] {
  const byKey = new Map<string, GpsLogPoint>();
  // Điểm mới ghi đè điểm cũ cùng mốc thời gian (realtime có thêm isMock).
  for (const point of [...incoming, ...current]) {
    byKey.set(point.timestamp, point);
  }
  return [...byKey.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, GPS_LOG_LIMIT);
}

/**
 * Vệt đường "tua ngược" về một mốc: giữ các điểm có thời gian ≤ mốc đã chọn,
 * xếp cũ → mới để vẽ đúng đoạn xe đã đi tính đến lúc đó.
 */
export function rewindPath(points: GpsLogPoint[], timestamp: string): [number, number][] {
  const limit = Date.parse(timestamp);
  if (Number.isNaN(limit)) return [];
  return points
    .filter((point) => Date.parse(point.timestamp) <= limit)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((point) => [point.latitude, point.longitude] as [number, number]);
}

export function formatLogTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString("vi-VN");
}