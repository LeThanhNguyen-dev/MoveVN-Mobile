import { create } from "zustand";

export type AppDialogTone = "brand" | "success" | "danger";
export type AppDialogButtonStyle = "default" | "cancel" | "destructive";

export type AppDialogButton = {
  text: string;
  style?: AppDialogButtonStyle;
  onPress?: () => void;
};

export type AppDialogOptions = {
  title: string;
  message?: string;
  tone?: AppDialogTone;
  buttons?: AppDialogButton[];
  cancelable?: boolean;
};

type AppDialogItem = AppDialogOptions & { id: number };

type AppDialogState = {
  dialogs: AppDialogItem[];
  show: (options: AppDialogOptions) => number;
  dismiss: (id: number) => void;
  clear: () => void;
};

let dialogSeq = 0;

export const useAppDialogStore = create<AppDialogState>((set) => ({
  dialogs: [],
  show: (options) => {
    const id = ++dialogSeq;
    set((state) => ({ dialogs: [...state.dialogs, { ...options, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ dialogs: state.dialogs.filter((dialog) => dialog.id !== id) })),
  clear: () => set({ dialogs: [] }),
}));

export function showAppDialog(options: AppDialogOptions) {
  return useAppDialogStore.getState().show(options);
}

/** Thay thế Alert.alert: giữ nguyên thứ tự tham số (title, message, buttons). */
export function showAppAlert(title: string, message?: string, buttons?: AppDialogButton[]) {
  const destructive = Boolean(buttons?.some((button) => button.style === "destructive"));
  return showAppDialog({ title, message, buttons, tone: destructive ? "danger" : "brand" });
}
