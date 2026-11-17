import i18n from "@/i18n";

/** Transmission belongs to the catalog variant, not the vehicle's fuel/type. */
export function formatTransmission(value: string | null | undefined): string {
  const transmission = value?.trim();
  if (!transmission) return i18n.t("common:transmission.unknown");

  switch (transmission.toLowerCase()) {
    case "manual": return i18n.t("common:transmission.Manual");
    case "automatic": return i18n.t("common:transmission.Automatic");
    case "cvt": return i18n.t("common:transmission.CVT");
    case "dct": return i18n.t("common:transmission.DCT");
    default: return transmission;
  }
}
