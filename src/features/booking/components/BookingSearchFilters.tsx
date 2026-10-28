import { useState } from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { BookingButton, BookingField } from "./BookingControls";

export type SearchFilters = { keyword: string; fromDate: string; toDate: string };
export const EMPTY_SEARCH: SearchFilters = { keyword: "", fromDate: "", toDate: "" };
export function validateSearchFilters(filters: SearchFilters): string | null {
  for (const v of [filters.fromDate, filters.toDate]) {
    if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)) return "Nhập ngày theo dạng YYYY-MM-DD.";
  }
  return filters.fromDate && filters.toDate && filters.fromDate > filters.toDate ? "Ngày bắt đầu không được sau ngày kết thúc." : null;
}

export default function BookingSearchFilters({ onApply }: { onApply: (filters: SearchFilters) => void }) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(EMPTY_SEARCH), [error, setError] = useState("");
  return <View style={{ paddingHorizontal: 16, gap: 4 }}>
    <BookingField label="Tìm đơn thuê" value={draft.keyword} onChangeText={keyword => setDraft({ ...draft, keyword })} placeholder="Mã đơn, tên xe…" />
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}><BookingField label="Từ ngày (YYYY-MM-DD)" value={draft.fromDate} onChangeText={fromDate => setDraft({ ...draft, fromDate })} /></View>
      <View style={{ flex: 1 }}><BookingField label="Đến ngày (YYYY-MM-DD)" value={draft.toDate} onChangeText={toDate => setDraft({ ...draft, toDate })} /></View>
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}><BookingButton title="Áp dụng bộ lọc" onPress={() => { const err = validateSearchFilters(draft); setError(err ?? ""); if (!err) onApply({ ...draft, keyword: draft.keyword.trim() }); }} /></View>
      <View style={{ flex: 1 }}><BookingButton secondary title="Xóa bộ lọc" onPress={() => { setDraft(EMPTY_SEARCH); setError(""); onApply(EMPTY_SEARCH); }} /></View>
    </View>
  </View>;
}
