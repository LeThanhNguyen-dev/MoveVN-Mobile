import { create } from "zustand";
import { getAuthUser, getSessionGeneration, getToken, useAuthStore } from "@/features/auth/hooks/useAuth";
import { validDisputeId } from "./disputeModel";

type State = { disputeId: number | null; userId: number | null; generation: number; serial: number };

export const useDisputeNavigation = create<State>(() => ({
  disputeId: null,
  userId: null,
  generation: -1,
  serial: 0,
}));

// Staff/Admin thao tác tranh chấp trên web; app mobile chỉ phục vụ Customer/Owner.
export function canOpenDisputes() {
  const user = getAuthUser();
  const role = useAuthStore.getState().activeRole;
  if (!getToken() || !user || !["Customer", "Owner"].includes(role ?? "")) return false;
  return !user.roles.some((r) => r === "Staff" || r === "Admin");
}

export function openDisputes(entry: { disputeId?: number | null } = {}) {
  if (!canOpenDisputes()) return;
  const disputeId = entry.disputeId ?? null;
  if (disputeId !== null && !validDisputeId(disputeId)) return;
  useDisputeNavigation.setState((s) => ({
    disputeId,
    userId: getAuthUser()!.userId,
    generation: getSessionGeneration(),
    serial: s.serial + 1,
  }));
}

export function closeDisputes() {
  useDisputeNavigation.setState({ disputeId: null, userId: null, generation: -1 });
}
