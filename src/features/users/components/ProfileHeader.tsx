import { ArrowLeft, EllipsisVertical, Search, X } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type ProfileHeaderSearch = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

type ProfileHeaderProps = {
  onBack: () => void;
  /** Tiêu đề hiển thị khi không có ô tìm kiếm. */
  title?: string;
  search?: ProfileHeaderSearch;
  onMenuPress?: () => void;
};

/** Thanh điều hướng gọn 48px dùng chung cho các màn hồ sơ công khai. */
export default function ProfileHeader({ onBack, title, search, onMenuPress }: ProfileHeaderProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        hitSlop={8}
      >
        <ArrowLeft color={theme.text} size={20} />
      </Pressable>

      {search ? (
        <View style={styles.searchBox}>
          <Search color={theme.faint} size={15} />
          <TextInput
            value={search.value}
            onChangeText={search.onChangeText}
            placeholder={search.placeholder}
            placeholderTextColor={theme.placeholder}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={search.placeholder}
            style={styles.searchInput}
          />
          {search.value ? (
            <Pressable
              onPress={() => search.onChangeText("")}
              accessibilityRole="button"
              accessibilityLabel="Xoá tìm kiếm"
              hitSlop={8}
            >
              <X color={theme.faint} size={14} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <AppText style={styles.title} numberOfLines={1}>
          {title ?? ""}
        </AppText>
      )}

      {onMenuPress ? (
        <Pressable
          onPress={onMenuPress}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Tuỳ chọn khác"
          hitSlop={8}
        >
          <EllipsisVertical color={theme.text} size={18} />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 48,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    iconPlaceholder: { width: 32, height: 32 },
    title: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontFamily: "Quicksand_700Bold",
      fontSize: 14,
    },
    searchBox: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 32,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      color: theme.text,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 12,
    },
  });
