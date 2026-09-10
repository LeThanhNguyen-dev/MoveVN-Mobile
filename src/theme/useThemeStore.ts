import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { ThemeMode } from "./tokens";

const themeKey = "movevn.theme.mode";
let hydration: Promise<ThemeMode> | null = null;

type ThemeState = {
  mode: ThemeMode;
  isHydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",
  isHydrated: false,
  setMode: async (mode) => {
    await SecureStore.setItemAsync(themeKey, mode);
    set({ mode });
  },
  toggleMode: () => get().setMode(get().mode === "light" ? "dark" : "light"),
}));

export function initializeTheme(): Promise<ThemeMode> {
  if (hydration) return hydration;
  hydration = (async () => {
    const saved = await SecureStore.getItemAsync(themeKey);
    const mode: ThemeMode = saved === "dark" ? "dark" : "light";
    useThemeStore.setState({ mode, isHydrated: true });
    return mode;
  })().catch(() => {
    hydration = null;
    useThemeStore.setState({ isHydrated: true });
    return "light" as ThemeMode;
  });
  return hydration;
}
