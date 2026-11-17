import i18n from "@/i18n";

export function formatFuelType(value: string | null | undefined): string {
  const fuel = value?.trim();
  if (!fuel) return i18n.t("common:fuel.unknown");

  switch (fuel.toLowerCase()) {
    case "gasoline": return i18n.t("common:fuel.Gasoline");
    case "diesel": return i18n.t("common:fuel.Diesel");
    case "electric": return i18n.t("common:fuel.Electric");
    case "hybrid": return i18n.t("common:fuel.Hybrid");
    case "plug-in hybrid": return i18n.t("common:fuel.Plug-in Hybrid");
    default: return fuel;
  }
}
