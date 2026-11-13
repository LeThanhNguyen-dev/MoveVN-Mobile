import { Platform } from "react-native";
import i18n from "@/i18n";
import { apiClient } from "@/services/apiClient";

export async function downloadPdf(path: string, filename: string, method: "get" | "post" = "get") {
  const response = await apiClient.request<ArrayBuffer>({ url: path, method, responseType: "arraybuffer", timeout: 60000 });
  const bytes = new Uint8Array(response.data);
  if (bytes.length < 5 || bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70 || bytes[4] !== 45)
    throw new Error(i18n.t("mobile:pdf.invalidFile"));
  if (Platform.OS === "web") {
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  const [{ File, Paths }, sharing] = await Promise.all([import("expo-file-system"), import("expo-sharing")]);
  if (!await sharing.isAvailableAsync()) throw new Error(i18n.t("mobile:pdf.sharingUnsupported"));
  const file = new File(Paths.cache, `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  try {
    file.write(bytes);
    await sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: i18n.t("mobile:pdf.dialogTitle") });
  } finally { if (file.exists) file.delete(); }
}
