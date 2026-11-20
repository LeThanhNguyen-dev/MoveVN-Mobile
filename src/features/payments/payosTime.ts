/** Thời gian còn lại của link thanh toán PayOS tính bằng giây.
 *  expiredAt là giây unix; nếu PayOS không trả về thì mặc định 30 phút (1800s). */
export function payosExpirySeconds(expiredAt?: number | null, nowMs: number = Date.now()): number {
  if (!expiredAt) return 30 * 60;
  return Math.max(0, Math.ceil((expiredAt * 1000 - nowMs) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
