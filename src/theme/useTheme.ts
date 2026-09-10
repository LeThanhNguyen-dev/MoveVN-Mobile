import { themes, type Theme, type ThemeMode } from "./tokens";
import { useThemeStore } from "./useThemeStore";

export function useTheme(): {
  mode: ThemeMode;
  theme: Theme;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
} {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const toggleMode = useThemeStore((state) => state.toggleMode);
  return { mode, theme: themes[mode], setMode, toggleMode };
}
