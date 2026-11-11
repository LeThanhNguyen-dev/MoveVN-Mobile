import i18n from "@/i18n";
import { parseServerDate } from "./bookingDisplay";

export function vietnamInput(value = new Date().toISOString()): string {
  return new Date(parseServerDate(value).getTime() + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ");
}

export function returnTimeISO(value: string, startDate: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(value.trim())) throw new Error(i18n.t("mobile:checkout.rules.timeFormat"));
  const local = value.trim().replace(" ", "T");
  const date = new Date(`${local}:00+07:00`);
  if (!Number.isFinite(date.getTime()) || vietnamInput(date.toISOString()).replace(" ", "T") !== local) throw new Error(i18n.t("mobile:checkout.rules.timeInvalid"));
  if (date.getTime() < parseServerDate(startDate).getTime() || date.getTime() > now) throw new Error(i18n.t("booking:checkout.editValidationTime"));
  return date.toISOString();
}

export function validateCheckoutKm(value: string, initial?: number): number | undefined {
  const km = value.trim() ? Number(value) : undefined;
  if (value.trim() && (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(km) || km! > 2147483647)) throw new Error(i18n.t("booking:checkout.editValidationKm"));
  if (initial != null && (km == null || km < initial)) throw new Error(i18n.t("booking:checkout.editValidationKmLower"));
  return km;
}
