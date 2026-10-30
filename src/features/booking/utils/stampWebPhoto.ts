import { formatVietnamDateTime, type InspectionType } from "../bookingDisplay";
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
  const timeLine = `CHỤP ẢNH: ${formatVietnamDateTime(capturedAt)} (UTC+07:00)`;
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

    const blob = await drawStampedBitmap(canvas, width, height, allLines);
    if (!blob || blob.size === 0) throw new Error("Không đóng dấu được ảnh.");
    return { blob, previewUrl: URL.createObjectURL(blob), capturedAt };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Nhãn nhỏ góc phải dưới thay cho dải full ngang — đỡ che ảnh gốc. */
function drawStampedBitmap(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  lines: string[],
): Promise<Blob | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Thiết bị không hỗ trợ xử lý ảnh.");
  const fontSize = Math.max(13, Math.round(width * 0.024));
  const lineHeight = Math.round(fontSize * 1.45);
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.55);
  const margin = Math.round(width * 0.02);
  ctx.font = `700 ${fontSize}px sans-serif`;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const pillWidth = Math.ceil(textWidth) + padX * 2;
  const pillHeight = lineHeight * lines.length + padY * 2;
  const x = Math.max(0, width - pillWidth - margin);
  const y = Math.max(0, height - pillHeight - margin);
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, pillWidth, pillHeight, Math.round(fontSize * 0.45));
  } else {
    ctx.rect(x, y, pillWidth, pillHeight);
  }
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + padX, y + padY + lineHeight * index + lineHeight / 2);
  });
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}
