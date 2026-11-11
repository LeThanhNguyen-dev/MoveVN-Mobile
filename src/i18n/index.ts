import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import { localeModules } from "./resources";

export const SUPPORTED_LANGUAGES = ["vi", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "vi";

type LocaleTree = Record<string, unknown>;

function isPlainObject(value: unknown): value is LocaleTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isDev = Boolean((globalThis as { __DEV__?: boolean }).__DEV__);

// Namespace = tên thư mục, file = nhóm nội dung:
// locales/vi/accountWallet/notes.json -> accountWallet:notes.*
// File lẻ ở gốc (locales/vi/policy.json) dùng tên file làm namespace.
function namespaceOf(file: string): string {
  const [head = file] = file.split("/");
  return head.endsWith(".json") ? head.slice(0, -".json".length) : head;
}

function deepMerge(target: LocaleTree, source: LocaleTree, path: string) {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      deepMerge(current, value, `${path}.${key}`);
      continue;
    }
    if (isDev && current !== undefined) {
      console.warn(`[i18n] Duplicate key "${path}.${key}" while merging locale files`);
    }
    target[key] = value;
  }
}

function buildResources(language: SupportedLanguage) {
  const resources: Record<string, LocaleTree> = {};
  const modules = localeModules[language] as Record<string, LocaleTree>;
  for (const [file, data] of Object.entries(modules)) {
    const namespace = namespaceOf(file);
    const target = (resources[namespace] ??= {});
    deepMerge(target, data, namespace);
  }
  return resources as Resource[string];
}

void i18n.use(initReactI18next).init({
  resources: {
    vi: buildResources("vi"),
    en: buildResources("en"),
  } as Resource,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  defaultNS: "common",
  interpolation: {
    // React already escapes values — disable i18next escaping to avoid double-escape.
    escapeValue: false,
  },
  returnEmptyString: false,
  initAsync: false,
  react: { useSuspense: false },
});

export default i18n;
