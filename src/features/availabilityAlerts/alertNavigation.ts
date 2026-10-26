import { create } from "zustand";
import { getAuthUser, getSessionGeneration, getToken, useAuthStore } from "@/features/auth/hooks/useAuth";

import { isAlertVehicleTarget, type AlertVehicleTarget } from "./alertModel";
export { availabilityTarget, localRentalDate, type AlertVehicleTarget } from "./alertModel";
type Entry = { vehicle?: AlertVehicleTarget; userId: number; generation: number; serial: number };
export const useAlertNavigation = create<{ entry: Entry | null }>(() => ({ entry: null }));
let serial = 0;
export function openAvailabilityAlerts(vehicle?: AlertVehicleTarget) {
  const user = getAuthUser();
  if (!getToken() || !user || !["Customer", "Owner"].includes(useAuthStore.getState().activeRole ?? "")) return;
  if (vehicle && !isAlertVehicleTarget(vehicle)) return;
  useAlertNavigation.setState({ entry: { vehicle, userId: user.userId, generation: getSessionGeneration(), serial: ++serial } });
}
export function closeAvailabilityAlerts() { useAlertNavigation.setState({ entry: null }); }
