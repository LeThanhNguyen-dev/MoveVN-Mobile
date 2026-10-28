export function notificationCategory(type: string) {
  const value = type.toLowerCase();
  if (value.includes("booking") || value.includes("contract") || value.includes("checkin") || value.includes("checkout")) return { label: "Chuyến đi", icon: "booking" as const };
  if (value.includes("wallet") || value.includes("payment") || value.includes("withdraw") || value.includes("refund")) return { label: "Thanh toán", icon: "wallet" as const };
  if (value.includes("support") || value.includes("ticket") || value.includes("dispute")) return { label: "Hỗ trợ", icon: "support" as const };
  if (value.includes("vehicle") || value.includes("owner")) return { label: "Phương tiện", icon: "vehicle" as const };
  if (value.includes("chat") || value.includes("message")) return { label: "Tin nhắn", icon: "message" as const };
  return { label: "Hệ thống", icon: "system" as const };
}

export function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có thời gian";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function notificationReference(dataJson?: string | null) {
  if (!dataJson) return null;
  try {
    const data: unknown = JSON.parse(dataJson);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    for (const [key, label] of [["bookingCode", "Mã đặt xe"], ["bookingNumber", "Mã booking"], ["ticketNumber", "Mã hỗ trợ"], ["bookingId", "Booking"], ["ticketId", "Yêu cầu hỗ trợ"]]) {
      if (!key || !label) continue;
      const value = record[key];
      if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))) return `${label}: ${value}`;
    }
  } catch { /* Older notifications may contain non-JSON metadata. */ }
  return null;
}

export function notificationDayGroup(value: string, now = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Trước đó";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const key = day.format(date);
  if (key === day.format(new Date(now))) return "Hôm nay";
  if (key === day.format(new Date(now - 86_400_000))) return "Hôm qua";
  return "Trước đó";
}

export function notificationRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes >= 0 && minutes < 1) return "Vừa xong";
  if (minutes >= 1 && minutes < 60) return `${minutes} phút trước`;
  if (minutes >= 60 && minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit",
    ...(new Date(timestamp).getUTCFullYear() !== new Date(now).getUTCFullYear() ? { year: "numeric" as const } : {}),
  }).format(new Date(timestamp));
}
