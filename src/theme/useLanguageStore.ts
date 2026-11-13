import { getLocales } from "expo-localization";
import { create } from "zustand";
import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n";
import * as SecureStore from "@/services/deviceStorage";

const languageKey = "movevn.language";
let hydration: Promise<SupportedLanguage> | null = null;

function normalize(value?: string | null): SupportedLanguage | null {
  const lower = value?.trim().toLowerCase();
  if (!lower) return null;
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("vi")) return "vi";
  return null;
}

type LanguageState = {
  language: SupportedLanguage;
  isHydrated: boolean;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
};

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: DEFAULT_LANGUAGE,
  isHydrated: false,
  setLanguage: async (language) => {
    await SecureStore.setItemAsync(languageKey, language);
    await i18n.changeLanguage(language);
    set({ language });
  },
  toggleLanguage: () => get().setLanguage(get().language === "vi" ? "en" : "vi"),
}));

function detectDeviceLanguage(): SupportedLanguage {
  try {
    return normalize(getLocales()[0]?.languageCode) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function initializeLanguage(): Promise<SupportedLanguage> {
  if (hydration) return hydration;
  hydration = (async () => {
    const saved = normalize(await SecureStore.getItemAsync(languageKey));
    const language = saved ?? detectDeviceLanguage();
    await i18n.changeLanguage(language);
    useLanguageStore.setState({ language, isHydrated: true });
    return language;
  })().catch(() => {
    hydration = null;
    useLanguageStore.setState({ isHydrated: true });
    return DEFAULT_LANGUAGE;
  });
  return hydration;
}
