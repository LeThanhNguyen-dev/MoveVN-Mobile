import { Platform } from "react-native";
import { getOwnerWorkbook } from "./service";
import type { AnalyticsFilters } from "./types";

export async function downloadOwnerWorkbook(filters: AnalyticsFilters) {
  const bytes = await getOwnerWorkbook(filters);
  const filename = `movevn-chu-xe-${filters.fromDate}-${filters.toDate}.xlsx`;
  const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const link = document.createElement("a"); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); return;
  }
  const [{ File, Paths }, sharing] = await Promise.all([import("expo-file-system"), import("expo-sharing")]);
  if (!await sharing.isAvailableAsync()) throw new Error("Thiết bị chưa hỗ trợ chia sẻ file Excel.");
  const file = new File(Paths.cache, `${Date.now()}-${filename}`);
  try {
    file.write(new Uint8Array(bytes));
    await sharing.shareAsync(file.uri, { mimeType, UTI: "org.openxmlformats.spreadsheetml.sheet", dialogTitle: "Lưu hoặc chia sẻ thống kê chủ xe" });
  } finally { if (file.exists) file.delete(); }
}
