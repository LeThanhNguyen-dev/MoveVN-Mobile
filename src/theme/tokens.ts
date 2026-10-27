export type ThemeMode = "light" | "dark";

export const brandPalette = {
  solid: "#861AFF",
  gradient: ["#861AFF", "#A324FF", "#BD35F6"] as const,
  softGradient: ["#9838ED", "#AE35EA"] as const,
};

export type Theme = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceAlt: string;
  input: string;
  border: string;
  divider: string;
  text: string;
  muted: string;
  faint: string;
  placeholder: string;
  brand: string;
  brandSolid: string;
  onBrand: string;
  brandSoft: string;
  brandBorder: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  error: string;
  errorSoft: string;
  errorBorder: string;
  info: string;
  infoSoft: string;
  infoBorder: string;
  overlay: string;
  shadow: string;
  barBg: string;
  barBorder: string;
  prominentBg: string;
  decorA: string;
  decorB: string;
};

const lightTheme: Theme = {
  mode: "light",
  background: "#F7F8FC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  input: "#FFFFFF",
  border: "#E3E7F0",
  divider: "#EDF0F6",
  text: "#141B2D",
  muted: "#526077",
  faint: "#69768B",
  placeholder: "#748095",
  brand: brandPalette.solid,
  brandSolid: brandPalette.solid,
  onBrand: "#FFFFFF",
  brandSoft: "#F5EDFF",
  brandBorder: "#E4D1FF",
  success: "#059669",
  successSoft: "#D1FAE5",
  warning: "#A35108",
  warningSoft: "#FFF4DA",
  danger: "#DC2626",
  dangerSoft: "#FFE4E6",
  dangerBorder: "#FECACA",
  error: "#B4235A",
  errorSoft: "#FFF2F6",
  errorBorder: "#F5C4D7",
  info: "#2563C9",
  infoSoft: "#EEF5FF",
  infoBorder: "#CDDEFF",
  overlay: "rgba(16, 25, 54, 0.45)",
  shadow: "#2C174C",
  barBg: "#FFFFFF",
  barBorder: "#E3E7F0",
  prominentBg: "rgba(255, 255, 255, 0.94)",
  decorA: "#E2CCFF",
  decorB: "#F3CBE5",
};

const darkTheme: Theme = {
  mode: "dark",
  background: "#131022",
  surface: "#1E1930",
  surfaceAlt: "#2A2442",
  input: "#262040",
  border: "#342C52",
  divider: "#2A2442",
  text: "#F3F0FB",
  muted: "#ABA2C9",
  faint: "#6E6591",
  placeholder: "#7E7694",
  brand: "#B597FF",
  brandSolid: brandPalette.solid,
  onBrand: "#FFFFFF",
  brandSoft: "#2E2757",
  brandBorder: "#4C4180",
  success: "#34D399",
  successSoft: "#123B2E",
  warning: "#FCD278",
  warningSoft: "#3B301C",
  danger: "#F87171",
  dangerSoft: "#3B2230",
  dangerBorder: "#5B2B3A",
  error: "#F87171",
  errorSoft: "#3B2230",
  errorBorder: "#5B2B3A",
  info: "#B79CFF",
  infoSoft: "#241D45",
  infoBorder: "#453A7A",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "#000000",
  barBg: "#1E1930",
  barBorder: "#342C52",
  prominentBg: "rgba(38, 32, 64, 0.95)",
  decorA: "#3A2F63",
  decorB: "#4A2C4E",
};

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
