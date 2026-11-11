import i18n from "@/i18n";

/** Thời gian tương đối (mirror web relativeTime): "vừa xong", "N phút trước", ... */
export function relativeTime(value?: string | null): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const diff = Date.now() - time;
  if (diff < 60_000) return i18n.t("users:time.justNow");
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return i18n.t("users:time.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("users:time.hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return i18n.t("users:time.days", { count: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return i18n.t("users:time.weeks", { count: weeks });
  return new Date(value).toLocaleDateString("vi-VN");
}

/** Năm gia nhập (mirror web memberYear): "2024". */
export function memberYear(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
}

/** Số năm đã tham gia, làm tròn xuống: "3 năm" hoặc "Dưới 1 năm". */
export function membershipLabel(value?: string | null, nowMs = Date.now()): string {
  if (!value) return i18n.t("mobile:user.time.unknown");
  const time = new Date(value).getTime();
  if (Number.isNaN(time) || time > nowMs) return i18n.t("mobile:user.time.unknown");
  const start = new Date(time);
  const today = new Date(nowMs);
  let years = today.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    today.getMonth() < start.getMonth() ||
    (today.getMonth() === start.getMonth() && today.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return years >= 1
    ? i18n.t("mobile:user.time.years", { count: years })
    : i18n.t("mobile:user.time.underOneYear");
}
