import { create } from "zustand";
import { getAuthUser, getSessionGeneration, getToken, useAuthStore } from "@/features/auth/hooks/useAuth";
import type { TicketEntry } from "./types";

type TicketNavigation = { entry: TicketEntry | null; userId: number | null; generation: number; serial: number };
export const useTicketNavigation = create<TicketNavigation>(() => ({ entry: null, userId: null, generation: -1, serial: 0 }));
export function openSupportTickets(entry: TicketEntry = {}) {
  const user = getAuthUser();
  const role = useAuthStore.getState().activeRole;
  if (!getToken() || !user || (role !== "Customer" && role !== "Owner")) return;
  if (entry.ticketId != null && (!Number.isSafeInteger(entry.ticketId) || entry.ticketId <= 0)) return;
  if (entry.bookingId != null && (!Number.isSafeInteger(entry.bookingId) || entry.bookingId <= 0)) return;
  useTicketNavigation.setState(s => ({ entry, userId: user.userId, generation: getSessionGeneration(), serial: s.serial + 1 }));
}
export function closeSupportTickets() { useTicketNavigation.setState({ entry: null, userId: null, generation: -1 }); }
