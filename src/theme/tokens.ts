export type ThemeMode = "light" | "dark";

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
  onBrand: string;
  brandSoft: string;
  brandBorder: string;
  success: string;
  successSoft: string;
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
  background: "#FAF6FF",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  input: "#FAF6FF",
  border: "#E8E1F2",
  divider: "#F0EBF6",
  text: "#101936",
  muted: "#746F7E",
  faint: "#94A3B8",
  placeholder: "#A7A1B3",
  brand: "#6B19FF",
  onBrand: "#FFFFFF",
  brandSoft: "#F1E7FF",
  brandBorder: "#DACBFF",
  success: "#059669",
  successSoft: "#D1FAE5",
  danger: "#DC2626",
  dangerSoft: "#FFE4E6",
  dangerBorder: "#FECACA",
  error: "#B4235A",
  errorSoft: "#FFF2F6",
  errorBorder: "#F5C4D7",
  info: "#5215A2",
  infoSoft: "#F7F1FF",
  infoBorder: "#DDCCFA",
  overlay: "rgba(16, 25, 54, 0.45)",
  shadow: "#2C174C",
  barBg: "rgba(255, 255, 255, 0.5)",
  barBorder: "rgba(232, 225, 242, 0.82)",
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
  brand: "#8B5CFF",
  onBrand: "#FFFFFF",
  brandSoft: "#2E2757",
  brandBorder: "#4C4180",
  success: "#34D399",
  successSoft: "#123B2E",
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
  barBg: "rgba(30, 25, 48, 0.6)",
  barBorder: "rgba(52, 44, 82, 0.9)",
  prominentBg: "rgba(38, 32, 64, 0.95)",
  decorA: "#3A2F63",
  decorB: "#4A2C4E",
};

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
