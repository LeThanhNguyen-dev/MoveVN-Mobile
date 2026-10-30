import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { UploadFile } from "@/types/upload";
import { MAX_INSPECTION_PHOTO_BYTES } from "./bookingDisplay";

export type CapturedInspectionPhoto = {
  source?: "camera" | "library";
  id: string;
  uri: string;
  capturedAt: string;
  file: UploadFile;
  /** Blob đã đóng dấu trên web (RN FormData web cần Blob thật để upload). */
  uploadBlob?: Blob;
};

export function deleteInspectionPhoto(uri: string) {
  if (uri.startsWith("blob:")) { URL.revokeObjectURL(uri); return; }
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Temporary cache files may already have been reclaimed by the OS.
  }
}

export async function resizeCameraPhoto(uri: string, width: number, height: number) {
  if (!width || !height) throw new Error("Không đọc được kích thước ảnh chụp.");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return manipulateAsync(uri, [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }], {
    format: SaveFormat.JPEG, compress: 0.9,
  });
}

export function stampedInspectionPhoto(uri: string, capturedAt: string): CapturedInspectionPhoto {
  const file = new File(uri);
  if (!file.exists || file.size <= 0 || file.size > MAX_INSPECTION_PHOTO_BYTES) {
    throw new Error("Ảnh có watermark phải có dung lượng dưới 5MB. Vui lòng chụp lại.");
  }
  const id = capturedAt.replace(/[^\d]/g, "");
  return { id, uri, capturedAt, file: { uri, name: `inspection-${id}.jpg`, type: "image/jpeg" } };
}
