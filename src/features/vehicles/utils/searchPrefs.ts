import * as SecureStore from "expo-secure-store";

const PREFS_KEY = "movevn.search.prefs";

export type SearchPrefs = {
  province: string;
  district: string;
  areaId?: number;
};

/** Địa điểm khách chọn gần nhất, lưu trên máy (không gửi về server). */
export async function loadSearchPrefs(): Promise<SearchPrefs | null> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SearchPrefs>;
    if (typeof parsed.province !== "string" || !parsed.province) return null;
    return {
      province: parsed.province,
      district: typeof parsed.district === "string" ? parsed.district : "",
      areaId: typeof parsed.areaId === "number" ? parsed.areaId : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveSearchPrefs(prefs: SearchPrefs): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // cache lỗi thì bỏ qua, không chặn luồng chính
  }
}
