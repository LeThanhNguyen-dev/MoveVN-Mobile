/**
 * Typography đồng bộ web (Be Vietnam Pro body + Quicksand heading).
 * Android bỏ qua fontWeight khi đã set fontFamily nên mọi weight
 * phải map tường minh sang đúng file font (mirror CSS font-face của web).
 */

export const BODY_FAMILY: Record<string, string> = {
  "100": "BeVietnamPro_300Light",
  "200": "BeVietnamPro_300Light",
  "300": "BeVietnamPro_300Light",
  "400": "BeVietnamPro_400Regular",
  "500": "BeVietnamPro_500Medium",
  "600": "BeVietnamPro_600SemiBold",
  "700": "BeVietnamPro_700Bold",
  "800": "BeVietnamPro_800ExtraBold",
  "900": "BeVietnamPro_900Black",
  normal: "BeVietnamPro_400Regular",
  bold: "BeVietnamPro_700Bold",
};

export const DISPLAY_FAMILY: Record<string, string> = {
  "100": "Quicksand_400Regular",
  "200": "Quicksand_400Regular",
  "300": "Quicksand_400Regular",
  "400": "Quicksand_400Regular",
  "500": "Quicksand_500Medium",
  "600": "Quicksand_600SemiBold",
  "700": "Quicksand_700Bold",
  "800": "Quicksand_700Bold",
  "900": "Quicksand_700Bold",
  normal: "Quicksand_400Regular",
  bold: "Quicksand_700Bold",
};

/** Chuẩn hoá fontWeight RN (số | "normal" | "bold") thành key tra bảng. */
export function normalizeWeightKey(weight: string | number | undefined): string {
  if (weight == null) return "400";
  if (weight === "normal" || weight === "bold") return weight;
  const n = typeof weight === "number" ? weight : Number.parseInt(weight, 10);
  if (!Number.isFinite(n)) return "400";
  const snapped = Math.min(900, Math.max(100, Math.round(n / 100) * 100));
  return String(snapped);
}

/** Lấy đúng family theo weight; display=true dùng Quicksand (heading/điểm nhấn). */
export function fontFamilyForWeight(
  weight: string | number | undefined,
  display = false,
): string {
  const key = normalizeWeightKey(weight);
  const table = display ? DISPLAY_FAMILY : BODY_FAMILY;
  return table[key] ?? (display ? "Quicksand_400Regular" : "BeVietnamPro_400Regular");
}
