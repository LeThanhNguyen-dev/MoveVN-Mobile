export type BookingNotificationTarget = {
  bookingId: number;
  roleTarget: string;
  action: string;
};

/** Bóc bookingId + roleTarget + action từ dataJson backend gửi kèm (vd booking). */
export function parseBookingTarget(dataJson?: string | null): BookingNotificationTarget | null {
  if (!dataJson) return null;
  try {
    const data = JSON.parse(dataJson) as {
      bookingId?: unknown;
      booking_id?: unknown;
      roleTarget?: unknown;
      action?: unknown;
    };
    const raw = data.bookingId ?? data.booking_id;
    const id = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return {
      bookingId: Math.trunc(id),
      roleTarget: typeof data.roleTarget === "string" ? data.roleTarget : "",
      action: typeof data.action === "string" ? data.action : "",
    };
  } catch {
    return null;
  }
}
