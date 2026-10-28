import { useMemo } from "react";
import type { Theme, ThemeMode } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/** Font family đã được load sẵn ở App.tsx (Be Vietnam Pro + Quicksand). */
export const detailFont = {
  display: "Quicksand_700Bold",
  displaySemi: "Quicksand_600SemiBold",
  regular: "BeVietnamPro_400Regular",
  medium: "BeVietnamPro_500Medium",
  semibold: "BeVietnamPro_600SemiBold",
  bold: "BeVietnamPro_700Bold",
  extraBold: "BeVietnamPro_800ExtraBold",
} as const;

export type DetailPalette = {
  canvas: string;
  surface: string;
  surfaceAlt: string;
  surfaceSoft: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  brand: string;
  brandSoft: string;
  brandBorder: string;
  onBrand: string;
  mint: string;
  mintSoft: string;
  mintBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  rating: string;
  ratingSoft: string;
  ratingBorder: string;
  gradient: readonly [string, string];
  heroShade: readonly [string, string, string, string];
  glass: string;
  glassBorder: string;
  shadow: string;
};

function createPalette(theme: Theme, mode: ThemeMode): DetailPalette {
  const dark = mode === "dark";
  return {
    canvas: theme.background,
    surface: theme.surface,
    surfaceAlt: theme.surfaceAlt,
    surfaceSoft: theme.input,
    ink: theme.text,
    muted: theme.muted,
    faint: theme.faint,
    line: theme.border,
    brand: theme.brand,
    brandSoft: theme.brandSoft,
    brandBorder: theme.brandBorder,
    onBrand: theme.onBrand,
    mint: theme.success,
    mintSoft: theme.successSoft,
    mintBorder: dark ? "#1F5644" : "#BCEBD9",
    danger: theme.danger,
    dangerSoft: theme.dangerSoft,
    dangerBorder: theme.dangerBorder,
    warning: dark ? "#FBBF24" : "#D97706",
    warningSoft: dark ? "#3A2A0F" : "#FFF7E6",
    warningBorder: dark ? "#5A4318" : "#F5E0B8",
    rating: dark ? "#F5B93F" : "#E9A100",
    ratingSoft: dark ? "#34280F" : "#FFF6E2",
    ratingBorder: dark ? "#5A4318" : "#F5E0B8",
    gradient: dark ? ["#7C3AED", "#C084FC"] : ["#6B19FF", "#A855F7"],
    heroShade: [
      "rgba(8, 5, 18, 0.58)",
      "rgba(8, 5, 18, 0.06)",
      "rgba(8, 5, 18, 0.06)",
      "rgba(8, 5, 18, 0.66)",
    ],
    glass: dark ? "rgba(18, 14, 30, 0.58)" : "rgba(16, 12, 28, 0.34)",
    glassBorder: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.26)",
    shadow: dark ? "#000000" : "#2C174C",
  };
}

export function useDetailTheme(): {
  theme: Theme;
  mode: ThemeMode;
  p: DetailPalette;
} {
  const { theme, mode } = useTheme();
  return useMemo(
    () => ({ theme, mode, p: createPalette(theme, mode) }),
    [theme, mode],
  );
}
