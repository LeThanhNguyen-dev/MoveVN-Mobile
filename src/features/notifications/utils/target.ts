export type BookingNotificationTarget = {
  bookingId: number;
  roleTarget: string;
};

/** Bóc bookingId + roleTarget từ dataJson backend gửi kèm (vd booking). */
export function parseBookingTarget(dataJson?: string | null): BookingNotificationTarget | null {
  if (!dataJson) return null;
  try {
    const data = JSON.parse(dataJson) as { bookingId?: unknown; booking_id?: unknown; roleTarget?: unknown };
    const raw = data.bookingId ?? data.booking_id;
    const id = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      bookingId: Math.trunc(id),
      roleTarget: typeof data.roleTarget === "string" ? data.roleTarget : "",
    };
  } catch {
    return null;
  }
}
