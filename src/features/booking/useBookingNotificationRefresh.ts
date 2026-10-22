import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import { parseBookingTarget } from "@/features/notifications/utils/target";

export function useBookingNotificationRefresh(bookingId: number, refresh: () => void) {
  useFocusEffect(useCallback(() => useNotificationStore.subscribe((state, previous) => {
    if (state.revision === previous.revision) return;
    const changed = Object.values(state.updates).some(update =>
      update.revision > previous.revision && !previous.updates[update.item.id]
      && parseBookingTarget(update.item.dataJson)?.bookingId === bookingId);
    if (changed) refresh();
  }), [bookingId, refresh]));
}
