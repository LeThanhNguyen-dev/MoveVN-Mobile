import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { UploadFileInput } from "@/types/upload";

// Ảnh gốc từ camera/thư viện thường 3-10MB, vượt giới hạn ~1MB của OCR
// (413 Payload Too Large), nhưng nén mạnh tay lại làm OCR đọc sai.
// Nén thích ứng: đo size thật sau mỗi bước, dừng khi <= 900KB.
const TARGET_BYTES = 900 * 1024;

const STEPS = [
  { edge: 1920, compress: 0.85 },
  { edge: 1600, compress: 0.8 },
  { edge: 1280, compress: 0.75 },
  { edge: 1024, compress: 0.7 },
];

export type DocumentPickerAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
};

async function getFileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === "number" ? info.size : null;
  } catch {
    return null;
  }
}

async function deleteQuietly(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // File tạm trong cache, OS tự dọn. Không chặn luồng chính.
  }
}

export async function prepareDocumentImage(
  asset: DocumentPickerAsset,
  baseName: string,
): Promise<{ file: UploadFileInput; uri: string }> {
  // eslint-disable-next-line no-console
  console.log(`[doc-image] original: ${asset.width ?? "?"}x${asset.height ?? "?"} ${asset.uri}`);

  let currentUri = asset.uri;
  let currentWidth = asset.width ?? 0;
  let currentHeight = asset.height ?? 0;
  let temporary = false;

  for (const step of STEPS) {
    const longest = Math.max(currentWidth, currentHeight);
    const actions = longest > step.edge
      ? [{
        resize: {
          width: Math.round((currentWidth * step.edge) / longest),
          height: Math.round((currentHeight * step.edge) / longest),
        },
      }]
      : [];

    const result = await manipulateAsync(currentUri, actions, {
      compress: step.compress,
      format: SaveFormat.JPEG,
    });
    const size = await getFileSize(result.uri);
    // eslint-disable-next-line no-console
    console.log(`[doc-image] edge=${step.edge} q=${step.compress} -> ${result.width}x${result.height} ${size ?? "?"} bytes`);

    if (temporary) {
      await deleteQuietly(currentUri);
    }
    currentUri = result.uri;
    currentWidth = result.width;
    currentHeight = result.height;
    temporary = true;

    if (size == null || size <= TARGET_BYTES) {
      break;
    }
  }

  return {
    uri: currentUri,
    file: { uri: currentUri, name: `${baseName}.jpg`, type: "image/jpeg" },
  };
}
