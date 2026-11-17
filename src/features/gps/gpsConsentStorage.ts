import { deleteItemAsync, getItemAsync, setItemAsync } from "@/services/deviceStorage";

/**
 * Lựa chọn chia sẻ vị trí của khách thuê lưu trên thiết bị (SecureStore native,
 * localStorage trên web). Máy chủ vẫn là nguồn sự thật (TrackingSession.ConsentGiven);
 * bản lưu này giúp app tự gửi tiếp sau khi mở lại mà không phải hỏi lại.
 */
export type GpsStoredConsent = "granted" | "declined";

const STORAGE_KEY = "movevn.gps.consents";
const ACTIVE_KEY = "movevn.gps.activeBooking";

type ConsentMap = Record<string, { state: GpsStoredConsent; at: number }>;

async function readMap(): Promise<ConsentMap> {
  try {
    const raw = await getItemAsync(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ConsentMap;
  } catch {
    return {};
  }
}

async function writeMap(map: ConsentMap): Promise<void> {
  try {
    await setItemAsync(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Thiết bị chặn storage: bỏ qua, phiên hiện tại vẫn chạy bình thường.
  }
}

export async function getStoredConsent(bookingId: number): Promise<GpsStoredConsent | null> {
  const entry = (await readMap())[String(bookingId)];
  return entry?.state === "granted" || entry?.state === "declined" ? entry.state : null;
}

export async function setStoredConsent(bookingId: number, state: GpsStoredConsent): Promise<void> {
  const map = await readMap();
  map[String(bookingId)] = { state, at: Date.now() };
  await writeMap(map);
}

export async function clearStoredConsent(bookingId: number): Promise<void> {
  const map = await readMap();
  if (!(String(bookingId) in map)) return;
  delete map[String(bookingId)];
  await writeMap(map);
}

/** Dọn lựa chọn của các chuyến đã kết thúc (chỉ giữ booking còn đang thuê). */
export async function pruneStoredConsents(activeBookingIds: number[]): Promise<void> {
  const keep = new Set(activeBookingIds.map(String));
  const map = await readMap();
  const next: ConsentMap = {};
  let changed = false;
  for (const [key, value] of Object.entries(map)) {
    if (keep.has(key)) {
      next[key] = value;
    } else {
      changed = true;
    }
  }
  if (changed) await writeMap(next);
}

/**
 * Chuyến đang được chia sẻ vị trí, lưu trên thiết bị để tiến trình chạy nền
 * (foreground service) biết phải gửi GPS cho booking nào khi app đã bị đóng.
 */
export async function setActivePublishTarget(bookingId: number | null): Promise<void> {
  try {
    if (bookingId == null) await deleteItemAsync(ACTIVE_KEY);
    else await setItemAsync(ACTIVE_KEY, String(bookingId));
  } catch {
    // Thiết bị chặn storage: nền không gửi được, app vẫn chạy foreground bình thường.
  }
}

export async function getActivePublishTarget(): Promise<number | null> {
  try {
    const raw = await getItemAsync(ACTIVE_KEY);
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function clearActivePublishTarget(): Promise<void> {
  await setActivePublishTarget(null);
}
