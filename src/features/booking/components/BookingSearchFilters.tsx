import Text from "@/components/AppText";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { CalendarDays, ChevronDown, Search, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/useTheme";
import { brandPalette } from "@/theme/tokens";
import AppInput from "@/components/ui/AppInput";
import AppDateField, { dateFieldLabel } from "@/components/ui/AppDateField";

export type SearchFilters = {
  keyword: string;
  fromDate: string;
  toDate: string;
};
export const EMPTY_SEARCH: SearchFilters = {
  keyword: "",
  fromDate: "",
  toDate: "",
};
export function validateSearchFilters(filters: SearchFilters): string | null {
  for (const v of [filters.fromDate, filters.toDate]) {
    if (
      v &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        !Number.isFinite(Date.parse(`${v}T00:00:00Z`)) ||
        new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)
    )
      return "Nhập ngày theo dạng YYYY-MM-DD.";
  }
  return filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
    ? "Ngày bắt đầu không được sau ngày kết thúc."
    : null;
}

export default function BookingSearchFilters({
  onApply,
  value,
  inset = true,
}: {
  onApply: (filters: SearchFilters) => void;
  value?: SearchFilters;
  inset?: boolean;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(value ?? EMPTY_SEARCH),
    [error, setError] = useState("");
  const [applied, setApplied] = useState(value ?? EMPTY_SEARCH);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (value) {
      setDraft(value);
      setApplied(value);
      setError("");
    }
  }, [value]);
  const apply = () => {
    const err = validateSearchFilters(draft);
    setError(err ?? "");
    if (err) return;
    const next = { ...draft, keyword: draft.keyword.trim() };
    setApplied(next);
    setDraft(next);
    onApply(next);
    setExpanded(false);
    Keyboard.dismiss();
  };
  const reset = () => {
    setDraft(EMPTY_SEARCH);
    setApplied(EMPTY_SEARCH);
    setError("");
    setExpanded(false);
    onApply(EMPTY_SEARCH);
    Keyboard.dismiss();
  };
  const hasDates = Boolean(applied.fromDate || applied.toDate);
  return (
    <View style={{ paddingHorizontal: inset ? 16 : 0, gap: 8 }}>
      <View style={styles.searchRow}>
        <AppInput
          accessibilityLabel="Tìm đơn thuê"
          value={draft.keyword}
          onChangeText={(keyword) => setDraft({ ...draft, keyword })}
          placeholder="Tìm mã chuyến, tên xe…"
          returnKeyType="search"
          onSubmitEditing={apply}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tìm kiếm chuyến thuê"
          onPress={apply}
          style={styles.searchButton}
        >
          <LinearGradient
            colors={brandPalette.softGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchFill}
          >
            <Search size={19} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lọc theo thời gian"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={[
            styles.dateToggle,
            {
              borderColor: hasDates ? theme.brandBorder : theme.border,
              backgroundColor: hasDates ? theme.brandSoft : theme.surface,
            },
          ]}
        >
          <CalendarDays color={theme.brand} size={16} />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              color: hasDates ? theme.brand : theme.muted,
            }}
          >
            {hasDates
              ? `${applied.fromDate ? dateFieldLabel(applied.fromDate) : "Từ đầu"} → ${applied.toDate ? dateFieldLabel(applied.toDate) : "Hiện tại"}`
              : "Lọc theo thời gian"}
          </Text>
          <ChevronDown
            color={theme.muted}
            size={16}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </Pressable>
        {(applied.keyword || hasDates) && !expanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa bộ lọc tìm kiếm và ngày"
            onPress={reset}
            style={styles.clear}
          >
            <X size={17} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>
      {expanded && (
        <View
          style={[
            styles.advanced,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <View style={styles.searchRow}>
            <AppDateField
              label="Từ ngày"
              value={draft.fromDate}
              onChange={(fromDate) => setDraft({ ...draft, fromDate })}
            />
            <AppDateField
              label="Đến ngày"
              value={draft.toDate}
              onChange={(toDate) => setDraft({ ...draft, toDate })}
            />
          </View>
          <View style={styles.searchRow}>
            <Pressable
              accessibilityRole="button"
              onPress={reset}
              style={[styles.action, { borderColor: theme.border }]}
            >
              <Text
                style={{ color: theme.muted, fontSize: 13, fontWeight: "600" }}
              >
                Đặt lại
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={apply}
              style={[
                styles.action,
                {
                  borderColor: theme.brandBorder,
                  backgroundColor: theme.brandSoft,
                },
              ]}
            >
              <Text
                style={{ color: theme.brand, fontSize: 13, fontWeight: "600" }}
              >
                Áp dụng
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.danger, fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    fontSize: 13,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchButton: { width: 44, borderRadius: 12, overflow: "hidden" },
  searchFill: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  dateToggle: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  advanced: { padding: 12, borderWidth: 1, borderRadius: 14, gap: 12 },
  action: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
});
