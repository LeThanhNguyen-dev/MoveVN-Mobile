import { formatVietnamDateTime } from "../bookingDisplay";
import { getServerTimeISO } from "./serverTime";

export type WebStampedPhoto = {
  blob: Blob;
  previewUrl: string;
  capturedAt: string;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không đọc được ảnh."));
    img.src = url;
  });
}

/**
 * Chỉ dùng trên web (trình duyệt có DOM). Vẽ lại ảnh, đóng dấu giờ hệ thống
 * rồi trả về Blob JPEG + URL xem trước. Lỗi thì ném để phía gọi báo rõ.
 */
export async function stampWebPhoto(source: Blob, lines: string[]): Promise<WebStampedPhoto> {
  const capturedAt = await getServerTimeISO();
  const timeLine = `${formatVietnamDateTime(capturedAt)} (UTC+07:00)`;
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Thiết bị không hỗ trợ xử lý ảnh.");
    ctx.drawImage(img, 0, 0, width, height);

    const allLines = [...lines, timeLine];
    const barHeight = Math.round(height * 0.13);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, height - barHeight, width, barHeight);
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.max(14, Math.round(width * 0.027));
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    allLines.forEach((line, index) => {
      ctx.fillText(line, Math.round(fontSize * 0.7), height - barHeight + Math.round((barHeight / (allLines.length + 1)) * (index + 1)));
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size === 0) throw new Error("Không đóng dấu được ảnh.");
    return { blob, previewUrl: URL.createObjectURL(blob), capturedAt };
  } finally {
    URL.revokeObjectURL(url);
  }
}
