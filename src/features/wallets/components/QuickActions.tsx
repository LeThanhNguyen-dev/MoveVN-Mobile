import { useMemo, type ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type QuickAction = {
  key: string;
  label: string;
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  onPress: () => void;
};

export default function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={a.onPress}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={styles.circle}>
              <Icon color={theme.brand} size={22} strokeWidth={2.2} />
            </View>
            <AppText numberOfLines={2} style={styles.label}>{a.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 6,
    },
    item: { flex: 1, alignItems: "center", gap: 8 },
    pressed: { opacity: 0.6 },
    circle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { color: theme.text, fontSize: 11.5, fontWeight: "700", textAlign: "center" },
  });
