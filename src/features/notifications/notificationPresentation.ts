import i18n from "@/i18n";

// Category labels resolve on every read so a runtime language change is reflected.
function categoryLabel(code: "booking" | "wallet" | "support" | "vehicle" | "message" | "system") {
  switch (code) {
    case "booking": return i18n.t("mobile:notification.categories.booking");
    case "wallet": return i18n.t("common:notifications.categories.payment");
    case "support": return i18n.t("common:notifications.categories.support");
    case "vehicle": return i18n.t("mobile:notification.categories.vehicle");
    case "message": return i18n.t("mobile:notification.categories.message");
    default: return i18n.t("common:notifications.categories.system");
  }
}

export function notificationCategory(type: string) {
  const value = type.toLowerCase();
  if (value.includes("booking") || value.includes("contract") || value.includes("checkin") || value.includes("checkout")) return { label: categoryLabel("booking"), icon: "booking" as const };
  if (value.includes("wallet") || value.includes("payment") || value.includes("withdraw") || value.includes("refund")) return { label: categoryLabel("wallet"), icon: "wallet" as const };
  if (value.includes("support") || value.includes("ticket") || value.includes("dispute")) return { label: categoryLabel("support"), icon: "support" as const };
  if (value.includes("vehicle") || value.includes("owner")) return { label: categoryLabel("vehicle"), icon: "vehicle" as const };
  if (value.includes("chat") || value.includes("message")) return { label: categoryLabel("message"), icon: "message" as const };
  return { label: categoryLabel("system"), icon: "system" as const };
}

export function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t("common:noTime");
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function notificationReference(dataJson?: string | null) {
  if (!dataJson) return null;
  try {
    const data: unknown = JSON.parse(dataJson);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    for (const [key, labelKey] of [["bookingCode", "mobile:notification.reference.bookingCode"], ["bookingNumber", "mobile:notification.reference.bookingNumber"], ["ticketNumber", "mobile:notification.reference.ticketNumber"], ["bookingId", "mobile:notification.reference.booking"], ["ticketId", "mobile:notification.reference.ticket"]]) {
      if (!key || !labelKey) continue;
      const value = record[key];
      if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))) return `${i18n.t(labelKey)}: ${value}`;
    }
  } catch { /* Older notifications may contain non-JSON metadata. */ }
  return null;
}

export function notificationDayGroup(value: string, now = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t("mobile:notification.dayGroup.earlier");
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const key = day.format(date);
  if (key === day.format(new Date(now))) return i18n.t("mobile:notification.dayGroup.today");
  if (key === day.format(new Date(now - 86_400_000))) return i18n.t("mobile:notification.dayGroup.yesterday");
  return i18n.t("mobile:notification.dayGroup.earlier");
}

export function notificationRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes >= 0 && minutes < 1) return i18n.t("common:notifications.justNow");
  if (minutes >= 1 && minutes < 60) return i18n.t("common:notifications.minutesAgo", { total: minutes });
  if (minutes >= 60 && minutes < 1440) return i18n.t("common:notifications.hoursAgo", { total: Math.floor(minutes / 60) });
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit",
    ...(new Date(timestamp).getUTCFullYear() !== new Date(now).getUTCFullYear() ? { year: "numeric" as const } : {}),
  }).format(new Date(timestamp));
}
