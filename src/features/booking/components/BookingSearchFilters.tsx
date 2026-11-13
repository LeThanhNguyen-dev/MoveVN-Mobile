import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";
import i18n from "@/i18n";
import { useTheme } from "@/theme/useTheme";
import { BookingButton, BookingField } from "./BookingControls";

export type SearchFilters = { keyword: string; fromDate: string; toDate: string };
export const EMPTY_SEARCH: SearchFilters = { keyword: "", fromDate: "", toDate: "" };
export function validateSearchFilters(filters: SearchFilters): string | null {
  for (const v of [filters.fromDate, filters.toDate]) {
    if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)) return i18n.t("mobile:bookingList.search.validationDate");
  }
  return filters.fromDate && filters.toDate && filters.fromDate > filters.toDate ? i18n.t("mobile:bookingList.search.validationRange") : null;
}

export default function BookingSearchFilters({ onApply, initial = EMPTY_SEARCH }: { onApply: (filters: SearchFilters) => void; initial?: SearchFilters }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial), [error, setError] = useState("");
  return <View style={{ paddingHorizontal: 16, gap: 4 }}>
    <BookingField label={t("mobile:bookingList.search.field")} value={draft.keyword} onChangeText={keyword => setDraft({ ...draft, keyword })} placeholder={t("mobile:bookingList.search.keywordPlaceholder")} />
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}><BookingField label={t("mobile:bookingList.search.fromLabel")} value={draft.fromDate} onChangeText={fromDate => setDraft({ ...draft, fromDate })} /></View>
      <View style={{ flex: 1 }}><BookingField label={t("mobile:bookingList.search.toLabel")} value={draft.toDate} onChangeText={toDate => setDraft({ ...draft, toDate })} /></View>
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}><BookingButton title={t("mobile:bookingList.search.apply")} onPress={() => { const err = validateSearchFilters(draft); setError(err ?? ""); if (!err) onApply({ ...draft, keyword: draft.keyword.trim() }); }} /></View>
      <View style={{ flex: 1 }}><BookingButton secondary title={t("booking:list.clearFilters")} onPress={() => { setDraft(EMPTY_SEARCH); setError(""); onApply(EMPTY_SEARCH); }} /></View>
    </View>
  </View>;
}
