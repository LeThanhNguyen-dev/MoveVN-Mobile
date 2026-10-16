import { bareApiClient } from "@/services/apiClient";

let cachedOffsetMs = 0;
let cachedAt = 0;
const OFFSET_TTL_MS = 5 * 60 * 1000;

function parseDateHeader(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Giờ hệ thống (server) chống lệch giờ máy khi gắn watermark ảnh bàn giao.
 * Cache độ lệch 5 phút; mất mạng thì fallback giờ máy để vẫn chụp được.
 */
export async function getServerTimeISO(): Promise<string> {
  const now = Date.now();
  try {
    if (now - cachedAt > OFFSET_TTL_MS) {
      const res = await bareApiClient.get("/api/config/public");
      const serverMs = parseDateHeader(
        (res.headers as Record<string, unknown> | undefined)?.["date"],
      );
      if (serverMs == null) throw new Error("Missing server date header.");
      cachedOffsetMs = serverMs - Date.now();
      cachedAt = Date.now();
    }
  } catch {
    // Giữ offset cũ (hoặc 0): watermark vẫn được gắn đủ, chỉ kém chuẩn xác.
  }
  return new Date(Date.now() + cachedOffsetMs).toISOString();
}
