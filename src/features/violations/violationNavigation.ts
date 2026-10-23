import { create } from "zustand";
import { getAuthUser, getSessionGeneration, getToken, useAuthStore } from "@/features/auth/hooks/useAuth";
import type { ViolationEntry, ViolationTarget } from "./types";
import { validReportId } from "./violationModel";

type State = { entry: ViolationEntry | null; userId: number | null; generation: number; serial: number };
export const useViolationNavigation = create<State>(() => ({ entry: null, userId: null, generation: -1, serial: 0 }));
export function canReport(target?: ViolationTarget) {
  const user = getAuthUser(); const role = useAuthStore.getState().activeRole;
  if (!getToken() || !user || !["Customer", "Owner"].includes(role ?? "") || user.roles.some(r => r === "Staff" || r === "Admin")) return false;
  if (!target) return true;
  return Number.isSafeInteger(target.targetId) && target.targetId > 0 && ["User", "Vehicle", "Booking"].includes(target.targetType)
    && !(target.targetType === "User" && target.targetId === user.userId) && !(target.targetType === "Vehicle" && target.ownerId === user.userId);
}
export function openViolations(entry: ViolationEntry = {}) {
  if (!canReport(entry.target) || (entry.reportId && !validReportId(entry.reportId))) return;
  useViolationNavigation.setState(s => ({ entry, userId: getAuthUser()!.userId, generation: getSessionGeneration(), serial: s.serial + 1 }));
}
export function closeViolations() { useViolationNavigation.setState({ entry: null, userId: null, generation: -1 }); }
