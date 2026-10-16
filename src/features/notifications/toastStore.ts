import { create } from "zustand";

/** Mirror web toastStore (MoveVN-FrontEnd/src/components/common/toastStore). */
export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  type: ToastType;
  title: string;
  message?: string;
};

type ToastItem = ToastPayload & { id: number };

type ToastState = {
  toasts: ToastItem[];
  dismissToast: (id: number) => void;
  showToast: (payload: ToastPayload) => void;
};

let toastSeq = 0;
const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4200;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  showToast: (payload) => {
    const id = ++toastSeq;
    set((state) => ({ toasts: [...state.toasts.slice(-MAX_TOASTS + 1), { ...payload, id }] }));
    setTimeout(() => get().dismissToast(id), AUTO_DISMISS_MS);
  },
}));

export function showToast(payload: ToastPayload) {
  useToastStore.getState().showToast(payload);
}
