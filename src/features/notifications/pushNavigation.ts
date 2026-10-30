import { create } from "zustand";
import { parseBookingTarget } from "./utils/target";

export type PushBooking = { bookingId: number; roleTarget: "Customer" | "Owner"; userId: number; requestId: string };
export const usePushNavigation = create<{ pending: PushBooking | null; clear: () => void }>(set => ({
  pending: null, clear: () => set({ pending: null }),
}));

export function pushBookingTarget(data: Record<string, unknown>, requestId: string): PushBooking | null {
  const target = parseBookingTarget(typeof data.dataJson === "string" ? data.dataJson : null);
  const userId = Number(data.userId);
  if (!target || !Number.isSafeInteger(userId) || userId <= 0) return null;
  const role = target.roleTarget.toLowerCase();
  if (role !== "owner" && role !== "customer") return null;
  return { bookingId: target.bookingId, roleTarget: role === "owner" ? "Owner" : "Customer", userId, requestId };
}
