import { usePresenceStore } from "@/features/presence/usePresence";
import { chatPresenceLabel } from "./chatPresentation";

/** Realtime presence takes precedence over the room's last fetched snapshot. */
export function useChatPresence(person?: {
  id: number;
  isOnline: boolean;
  lastSeenAt?: string | null;
} | null) {
  const live = usePresenceStore((state) => person ? state.users[person.id] : undefined);
  const isOnline = live?.isOnline ?? person?.isOnline ?? false;
  const lastSeenAt = live ? live.lastSeenAt : person?.lastSeenAt;
  return { isOnline, label: chatPresenceLabel(isOnline, lastSeenAt) };
}
