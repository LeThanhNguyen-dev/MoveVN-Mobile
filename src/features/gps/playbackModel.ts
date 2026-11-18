import type { GpsRoadPathResponse, GpsRoutePointResponse } from "./types";

/**
 * Bộ tính toán phát lại hành trình cho app (tương đương playbackEngine bên web).
 *
 * Ý tưởng: polyline đã map matching theo đường phố + các mốc GPS thật. Mỗi mốc GPS
 * được chiếu lên polyline để biết "đã đi được bao nhiêu mét". Khi phát, ta nội suy
 * quãng đường theo THỜI GIAN thật của chuyến (nén lại bằng TIME_SCALE) nên:
 * - khúc quẹo giữa chuyến vẫn hiện đúng,
 * - khoảng dừng 3–4 phút vẫn dừng đủ lâu,
 * - marker không nhảy tới đích sớm.
 */

export type LatLng = [number, number];

export type PlaybackAnchor = {
  /** Thời điểm thật của mốc GPS (ms). */
  t: number;
  /** Quãng đường tích luỹ dọc polyline tại mốc (m). */
  d: number;
  /** Tốc độ tại mốc (km/h). */
  speedKmh: number;
};

export type PlaybackModel = {
  /** Đỉnh polyline đã khớp đường phố (nối liền các đoạn để tra cứu theo chỉ số). */
  path: LatLng[];
  /** Các đoạn liền mạch; gap mất tín hiệu không được nối bằng đường thẳng. */
  segments: LatLng[][];
  /** Quãng đường tích luỹ tới từng đỉnh (m); bước nối gap = 0 m. */
  cum: number[];
  totalM: number;
  anchors: PlaybackAnchor[];
  startTime: number;
  endTime: number;
};

export type PlaybackFrame = {
  timeMs: number;
  d: number;
  vertex: number;
  latitude: number;
  longitude: number;
  heading: number;
  speedKmh: number;
  /** Xe có thực sự nhích đi trong ~1,5 giây (giờ chuyến) gần đây không. */
  moving: boolean;
  progress: number;
};

/** Nhìn trước chừng này mét dọc tuyến khi tính hướng mũi tên. */
const LOOKAHEAD_M = 8;
/** Cửa sổ giờ chuyến để coi là "đang chạy thật". */
const STILL_WINDOW_MS = 1500;
/** Nhích chưa tới ngưỡng này trong cửa sổ trên = đang đỗ. */
const STILL_MIN_M = 1.5;
/** Phạt (m) cho đoạn đường lệch hướng với hướng đi của mốc GPS. */
const DIRECTION_PENALTY_M = 60;

const toRad = (value: number) => (value * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const earthRadius = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x =
    Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Khe giữa hai điểm log quá ngưỡng này = mất tín hiệu, không nối thẳng. */
const GAP_BREAK_M = 250;

function sanitizePoints(path: { latitude: number; longitude: number }[] | null | undefined): LatLng[] {
  const points: LatLng[] = [];
  for (const point of path ?? []) {
    const lat = Number(point.latitude);
    const lng = Number(point.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const last = points[points.length - 1];
    if (last && Math.abs(last[0] - lat) < 1e-9 && Math.abs(last[1] - lng) < 1e-9) continue;
    points.push([lat, lng]);
  }
  return points;
}

function splitAtGaps(points: LatLng[]): LatLng[][] {
  if (points.length < 2) return [];
  const out: LatLng[][] = [[points[0]!]];
  for (let index = 1; index < points.length; index++) {
    const current = points[index]!;
    if (haversineMeters(points[index - 1]!, current) > GAP_BREAK_M) out.push([current]);
    else out[out.length - 1]!.push(current);
  }
  return out.filter((segment) => segment.length >= 2);
}

/** Backend trả segments (v2) → dùng; client cũ/không có → tự cắt path tại gap. */
function resolveSegments(road: GpsRoadPathResponse | null): LatLng[][] {
  const backend = (road?.segments ?? [])
    .map((segment) => sanitizePoints(segment.points))
    .filter((segment) => segment.length >= 2);
  if (backend.length > 0) return backend;
  return splitAtGaps(sanitizePoints(road?.path));
}

/** Các đoạn liền mạch → path phẳng + quãng đường tích luỹ (gap = 0 m). */
function buildPath(road: GpsRoadPathResponse | null) {
  const segments = resolveSegments(road);
  const points = segments.flat();

  const segmentStarts = new Set<number>();
  let cursor = 0;
  for (const segment of segments) {
    segmentStarts.add(cursor);
    cursor += segment.length;
  }

  const cum: number[] = [];
  for (let index = 0; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index]!;
    if (index === 0 || !previous) cum.push(0);
    else if (segmentStarts.has(index)) cum.push(cum[index - 1]!);
    else cum.push(cum[index - 1]! + haversineMeters(previous, current));
  }

  const lastCum = cum[cum.length - 1];
  return { points, segments, cum, totalM: lastCum == null ? 0 : lastCum };
}

type RawAnchor = { t: number; latitude: number; longitude: number; speedKmh: number };

/** Chiếu vuông góc điểm lên đoạn a→b (xấp xỉ mặt phẳng, đủ chính xác ở quy mô chuyến). */
function projectOnSegment(point: LatLng, a: LatLng, b: LatLng) {
  const scale = Math.cos(toRad(point[0]));
  const toX = (value: LatLng) => (value[1] - point[1]) * scale * 111320;
  const toY = (value: LatLng) => (value[0] - point[0]) * 110540;
  const ax = toX(a);
  const ay = toY(a);
  const bx = toX(b);
  const by = toY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared <= 0 ? 0 : clamp(-(ax * dx + ay * dy) / lengthSquared, 0, 1);
  const px = ax + ratio * dx;
  const py = ay + ratio * dy;
  return { ratio, distance: Math.hypot(px, py) };
}

/**
 * Chiếu từng mốc GPS lên polyline (đoạn gần nhất trong cửa sổ tiến dần) và đổi
 * sang quãng đường tích luỹ. Chiếu lên ĐOẠN chứ không chỉ đỉnh để tuyến thưa đỉnh
 * vẫn đúng vị trí. Không lọc bỏ mốc trùng để đoạn quay đầu / đỗ vẫn còn dữ liệu.
 *
 * Tuyến đi–về trên CÙNG cung phố (rất hay gặp) khiến "đoạn gần nhất" của lượt đi
 * lại là đoạn của lượt về → marker nhảy tới đích sớm. Vì vậy điểm được chấm theo
 * khoảng cách + độ lệch HƯỚNG đi của mốc GPS so với hướng đoạn đường, và chỉ quét
 * trong giới hạn quãng đường hợp lý với khoảng thời gian giữa 2 mốc.
 */
function projectAnchors(raw: RawAnchor[], points: LatLng[], cum: number[]) {
  if (raw.length === 0 || points.length < 2) return [] as PlaybackAnchor[];

  const anchors: PlaybackAnchor[] = [];
  let cursor = 0;
  let previousD = 0;
  let previousT = -Infinity;
  let previousRaw: LatLng | null = null;

  for (const item of raw) {
    const target: LatLng = [item.latitude, item.longitude];
    const travelled = previousRaw ? haversineMeters(previousRaw, target) : 0;
    // Chỉ tin hướng đi khi 2 mốc cách nhau đủ xa (đứng yên thì hướng là nhiễu).
    const travelBearing = previousRaw && travelled >= 10 ? bearing(previousRaw, target) : null;
    // Quãng đường tối đa có thể đi giữa 2 mốc: 400 m + 30 m/s, tối đa 2,5 km
    // (đủ cho lỗ hổng GPS 1–2 phút, không cho nhảy vòng qua cả chuyến).
    const gapSeconds = Number.isFinite(previousT) ? Math.max(0, (item.t - previousT) / 1000) : 0;
    const aheadLimit = Math.min(2500, 400 + gapSeconds * 30);

    let bestSegment = cursor;
    let bestRatio = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    const from = Math.max(0, cursor - 1);
    for (let k = from; k <= points.length - 2; k++) {
      const segmentStartD = cum[k] ?? 0;
      if (segmentStartD > previousD + aheadLimit) break;
      const a = points[k];
      const b = points[k + 1];
      if (!a || !b) continue;
      const projection = projectOnSegment(target, a, b);
      const segmentLength = (cum[k + 1] ?? segmentStartD) - segmentStartD;
      const candidateD = segmentStartD + segmentLength * projection.ratio;
      let score = projection.distance;
      // Đỗ/nhiễu: không cho "nhảy cóc" xa hơn quãng đường xe thực sự đi được
      // (cộng biên 20 m + 1,6× để bù đường cong). Nếu không, một mốc GPS đứng yên
      // gần nhánh về sẽ bị chiếu sang cuối tuyến và marker tới đích sớm.
      score += Math.max(0, candidateD - previousD - (travelled * 1.6 + 20)) * 0.35;
      if (travelBearing != null) {
        const segmentBearing = bearing(a, b);
        const delta = Math.abs(((segmentBearing - travelBearing + 540) % 360) - 180);
        score += (delta / 180) * DIRECTION_PENALTY_M;
      }
      // So sánh chặt (<): cùng điểm số thì giữ đoạn SỚM HƠN để không nhảy sang
      // nhánh về khi đang đứng ở giao điểm của 2 lượt.
      if (score < bestScore) {
        bestScore = score;
        bestSegment = k;
        bestRatio = projection.ratio;
      }
    }
    cursor = Math.max(cursor, bestSegment);

    // Quãng đường phải đơn điệu tăng: GPS nhiễu không được kéo marker lùi lại.
    const segmentStart = cum[bestSegment] ?? previousD;
    const segmentEnd = cum[bestSegment + 1] ?? segmentStart;
    const d = Math.max(previousD, segmentStart + (segmentEnd - segmentStart) * bestRatio);
    previousD = d;

    const t = Math.max(previousT, item.t);
    previousT = t;
    previousRaw = target;

    anchors.push({ t, d, speedKmh: Math.max(0, item.speedKmh) });
  }

  // Nếu mốc đầu trùng giờ với mốc sau (log dồn batch), giãn ra 1 giây/điểm để
  // phát lại vẫn chạy thay vì đứng im.
  for (let index = 1; index < anchors.length; index++) {
    const previous = anchors[index - 1]!;
    const current = anchors[index]!;
    if (current.t <= previous.t) {
      anchors[index] = { ...current, t: previous.t + 1000 };
    }
  }

  return anchors;
}

function toRawAnchors(gps: GpsRoutePointResponse[]): RawAnchor[] {
  const raw: RawAnchor[] = [];
  for (const point of gps) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
    const t = Date.parse(point.timestamp);
    if (!Number.isFinite(t)) continue;
    raw.push({
      t,
      latitude: point.latitude,
      longitude: point.longitude,
      speedKmh: Number(point.speedKmh ?? 0) || 0,
    });
  }
  raw.sort((a, b) => a.t - b.t);
  return raw;
}

export function buildPlaybackModel(
  gps: GpsRoutePointResponse[],
  road: GpsRoadPathResponse | null,
): PlaybackModel | null {
  const { points, segments, cum, totalM } = buildPath(road);
  if (points.length < 2 || totalM < 1) return null;

  const anchors = projectAnchors(toRawAnchors(gps), points, cum);
  if (anchors.length === 0) return null;

  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;

  return {
    path: points,
    segments,
    cum,
    totalM,
    anchors,
    startTime: first.t,
    endTime: Math.max(last.t, first.t + 1000),
  };
}

type Sample = { d: number; speedKmh: number };

/** Nội suy quãng đường + tốc độ tại thời điểm phát lại. */
function sampleAtTime(model: PlaybackModel, timeMs: number): Sample {
  const anchors = model.anchors;
  const first = anchors[0];
  if (!first) return { d: 0, speedKmh: 0 };
  if (anchors.length === 1 || timeMs <= first.t) {
    return { d: first.d, speedKmh: first.speedKmh };
  }
  const last = anchors[anchors.length - 1]!;
  if (timeMs >= last.t) return { d: last.d, speedKmh: last.speedKmh };

  let lo = 0;
  let hi = anchors.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((anchors[mid]?.t ?? Number.POSITIVE_INFINITY) <= timeMs) lo = mid;
    else hi = mid - 1;
  }
  const a = anchors[lo]!;
  const b = anchors[Math.min(lo + 1, anchors.length - 1)]!;
  const span = b.t - a.t;
  const ratio = span <= 0 ? 0 : clamp((timeMs - a.t) / span, 0, 1);
  return {
    d: a.d + (b.d - a.d) * ratio,
    speedKmh: a.speedKmh + (b.speedKmh - a.speedKmh) * ratio,
  };
}

/** Toạ độ tại quãng đường d (nội suy trên đoạn polyline chứa d). */
function positionAtDistance(model: PlaybackModel, d: number) {
  const target = clamp(d, 0, model.totalM);
  const cum = model.cum;
  // Tìm đỉnh cuối có cum < target: tại ranh giới đoạn (cum trùng nhau) marker
  // đứng ở cuối đoạn trước trong suốt gap, chỉ nhảy khi quãng đường vượt qua.
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((cum[mid] ?? Number.POSITIVE_INFINITY) < target) lo = mid;
    else hi = mid - 1;
  }
  const index = Math.min(lo, model.path.length - 2);
  const from = model.path[index] ?? [0, 0];
  const to = model.path[index + 1] ?? from;
  const span = (cum[index + 1] ?? 0) - (cum[index] ?? 0);
  const ratio = span <= 0 ? 0 : clamp((target - (cum[index] ?? 0)) / span, 0, 1);
  const lat = from[0] + (to[0] - from[0]) * ratio;
  const lng = from[1] + (to[1] - from[1]) * ratio;
  return { index, lat, lng };
}

/**
 * Trạng thái hiển thị tại thời điểm phát lại. `previousHeading` được giữ nguyên
 * khi xe đứng yên để mũi tên không tự xoay 180° lúc cursor bò qua khúc quay đầu.
 */
export function frameAtTime(
  model: PlaybackModel,
  timeMs: number,
  previousHeading: number,
): PlaybackFrame {
  const t = clamp(timeMs, model.startTime, model.endTime);
  const sample = sampleAtTime(model, t);
  const behind = sampleAtTime(model, t - STILL_WINDOW_MS).d;
  const moving = sample.d - behind >= STILL_MIN_M;

  const here = positionAtDistance(model, sample.d);
  let heading = previousHeading;
  if (moving) {
    const ahead = positionAtDistance(model, Math.min(model.totalM, sample.d + LOOKAHEAD_M));
    const distance = haversineMeters([here.lat, here.lng], [ahead.lat, ahead.lng]);
    if (distance > 0.5) heading = bearing([here.lat, here.lng], [ahead.lat, ahead.lng]);
  }

  const duration = model.endTime - model.startTime;

  return {
    timeMs: t,
    d: sample.d,
    vertex: here.index,
    latitude: here.lat,
    longitude: here.lng,
    heading,
    speedKmh: moving ? sample.speedKmh : 0,
    moving,
    progress: duration <= 0 ? 0 : clamp((t - model.startTime) / duration, 0, 1),
  };
}

/** Chỉ số mốc GPS đang phát (mốc cuối cùng có thời điểm ≤ timeMs). */
export function anchorIndexAt(model: PlaybackModel, timeMs: number): number {
  const anchors = model.anchors;
  if (anchors.length === 0) return 0;
  let index = 0;
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    if (anchor && anchor.t <= timeMs + 50) index = i;
    else break;
  }
  return index;
}

/** Thời điểm của mốc GPS trước/sau mốc đang phát (nút lùi/tiến 1 điểm). */
export function stepAnchorTime(model: PlaybackModel, timeMs: number, direction: -1 | 1): number {
  const anchors = model.anchors;
  if (anchors.length === 0) return timeMs;
  const index = anchorIndexAt(model, timeMs);
  const current = anchors[index]!;
  if (direction < 0) {
    const alreadyAt = Math.abs(timeMs - current.t) < 250;
    return (anchors[Math.max(0, index - (alreadyAt ? 1 : 0))] ?? current).t;
  }
  return (anchors[Math.min(anchors.length - 1, index + 1)] ?? current).t;
}
