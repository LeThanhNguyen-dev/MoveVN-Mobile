import i18n from "@/i18n";

export function getFormatLocale(): "vi-VN" | "en-US" {
  return i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
}
