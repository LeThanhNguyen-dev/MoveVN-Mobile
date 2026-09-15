import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type DropdownOption = {
  value: string;
  label: string;
  hint?: string;
};

type FormDropdownSheetProps = {
  label: string;
  placeholder: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
};

function FormDropdownSheet({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  searchable = true,
}: FormDropdownSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (open) setKeyword("");
  }, [open ]);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return options;
    return options.filter((o) => o.label.toLowerCase().includes(k));
  }, [options, keyword]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.button, disabled && styles.buttonDisabled]}
      >
        <Text
          numberOfLines={1}
          style={[styles.buttonText, !selected && styles.placeholderText, disabled && styles.disabledText]}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown color={theme.muted} size={16} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <X color={theme.muted} size={18} />
              </Pressable>
            </View>
            {searchable && options.length > 5 ? (
              <View style={styles.searchBox}>
                <Search color={theme.placeholder} size={15} />
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor={theme.placeholder}
                  style={styles.searchInput}
                />
              </View>
            ) : null}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {filtered.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
                      {o.hint ? <Text style={styles.optionHint}>{o.hint}</Text> : null}
                    </View>
                    {active ? <Check color={theme.brand} size={16} /> : null}
                  </Pressable>
                );
              })}
              {filtered.length === 0 ? <Text style={styles.empty}>Không có lựa chọn nào.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default memo(FormDropdownSheet);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    button: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    buttonDisabled: { opacity: 0.55, backgroundColor: theme.surfaceAlt },
    buttonText: { color: theme.text, fontSize: 14, fontWeight: "600", flexShrink: 1 },
    placeholderText: { color: theme.placeholder, fontWeight: "500" },
    disabledText: { color: theme.muted },
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
    backdrop: { ...StyleSheet.absoluteFill } as object,
    sheet: {
      maxHeight: "70%",
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 18,
      paddingTop: 14,
      gap: 10,
    },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    closeBtn: { padding: 6 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.input,
      paddingHorizontal: 12,
      height: 42,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14 },
    list: { marginTop: 2 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    optionActive: {},
    optionTextWrap: { flex: 1, gap: 2 },
    optionText: { color: theme.text, fontSize: 14, fontWeight: "600" },
    optionTextActive: { color: theme.brand, fontWeight: "800" },
    optionHint: { color: theme.muted, fontSize: 11 },
    empty: { color: theme.muted, fontSize: 13, textAlign: "center", paddingVertical: 20 },
  });
