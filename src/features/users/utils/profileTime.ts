/** Thời gian tương đối (mirror web relativeTime): "vừa xong", "N phút trước", ... */
export function relativeTime(value?: string | null): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const diff = Date.now() - time;
  if (diff < 60_000) return "vừa xong";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} tuần trước`;
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
  if (!value) return "Chưa rõ";
  const time = new Date(value).getTime();
  if (Number.isNaN(time) || time > nowMs) return "Chưa rõ";
  const start = new Date(time);
  const today = new Date(nowMs);
  let years = today.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    today.getMonth() < start.getMonth() ||
    (today.getMonth() === start.getMonth() && today.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return years >= 1 ? `${years} năm` : "Dưới 1 năm";
}
