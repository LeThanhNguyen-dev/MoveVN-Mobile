import { ArrowDownWideNarrow, Check, Search, X } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import { fontFamilyForWeight } from "@/theme/typography";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type DealsFilterOption = {
  value: string;
  label: string;
  count?: number;
  /** Chip cảnh báo (amber) cho bộ lọc "Sắp hết hạn". */
  tone?: "default" | "amber";
};

export type DealsSortOption = {
  value: string;
  label: string;
};

type DealsFilterBarProps = {
  filters: DealsFilterOption[];
  onFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  search: string;
  searchPlaceholder: string;
  sortLabel?: string;
  sortOptions: DealsSortOption[];
  sortValue: string;
  activeFilter: string;
};

/**
 * Thanh tìm kiếm + bộ lọc + sắp xếp dùng chung cho 3 màn ưu đãi
 * (mirror web: section "Tìm và lọc ..." của /customer/promotions, /voucher-wallet, /voucher-hunt).
 */
function DealsFilterBar({
  activeFilter,
  filters,
  onFilterChange,
  onSearchChange,
  onSortChange,
  search,
  searchPlaceholder,
  sortLabel = "Sắp xếp",
  sortOptions,
  sortValue,
}: DealsFilterBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sortOpen, setSortOpen] = useState(false);

  const selectedSort = sortOptions.find((option) => option.value === sortValue);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Search color={theme.faint} size={16} />
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.placeholder}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable
              onPress={() => onSearchChange("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Xoá tìm kiếm"
            >
              <X color={theme.faint} size={15} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSortOpen(true)}
          style={styles.sortButton}
          accessibilityRole="button"
          accessibilityLabel={`${sortLabel}: ${selectedSort?.label ?? ""}`}
          accessibilityHint="Mở lựa chọn sắp xếp ưu đãi"
        >
          <ArrowDownWideNarrow color={theme.brand} size={18} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {filters.map((filter) => {
          const active = filter.value === activeFilter;
          const amber = filter.tone === "amber";
          return (
            <Pressable
              key={filter.value}
              onPress={() => onFilterChange(filter.value)}
              style={[
                styles.chip,
                active
                  ? amber
                    ? styles.chipActiveAmber
                    : styles.chipActive
                  : amber
                    ? styles.chipIdleAmber
                    : styles.chipIdle,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={filter.label}
            >
              <AppText
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {filter.label}
              </AppText>
              {typeof filter.count === "number" ? (
                <AppText
                  style={[styles.chipCount, active && styles.chipCountActive]}
                >
                  ({filter.count})
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <SortSheet
          options={sortOptions}
          value={sortValue}
          onSelect={(value) => {
            onSortChange(value);
            setSortOpen(false);
          }}
          onClose={() => setSortOpen(false)}
        />
      </Modal>
    </View>
  );
}

type SortSheetProps = {
  options: DealsSortOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

function SortSheet({ options, value, onSelect, onClose }: SortSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.sheetOverlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Đóng"
      />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <View style={styles.sheetHead}>
          <AppText display style={styles.sheetTitle}>
            Sắp xếp
          </AppText>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Đóng">
            <X color={theme.muted} size={18} />
          </Pressable>
        </View>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={styles.option}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: active }}
            >
              <AppText
                style={[styles.optionText, active && styles.optionTextActive]}
              >
                {option.label}
              </AppText>
              {active ? <Check color={theme.brand} size={16} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default memo(DealsFilterBar);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: 13,
      minHeight: 44,
      paddingVertical: 8,
      fontFamily: fontFamilyForWeight("500"),
    },
    chipRow: { gap: 6, paddingRight: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      gap: 5,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    chipIdle: { backgroundColor: theme.surface },
    chipIdleAmber: { backgroundColor: theme.surface },
    chipActive: { backgroundColor: theme.brandSoft },
    chipActiveAmber: { backgroundColor: theme.brandSoft },
    chipText: { color: theme.muted, fontSize: 12, fontWeight: "500" },
    chipTextActive: { color: theme.brand, fontWeight: "600" },
    chipCount: { color: theme.faint, fontSize: 11, fontWeight: "500" },
    chipCountActive: { color: theme.brand },
    sortButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: 44,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
    },
    sheetOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: theme.overlay,
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 18,
      paddingTop: 14,
      gap: 4,
    },
    sheetHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    sheetTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    optionText: { color: theme.text, fontSize: 14, fontWeight: "600" },
    optionTextActive: { color: theme.brand, fontWeight: "800" },
  });
