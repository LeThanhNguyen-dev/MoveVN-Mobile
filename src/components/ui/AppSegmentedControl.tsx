import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "@/components/AppText";
import { brandPalette } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function AppSegmentedControl<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly {
    value: T;
    label: string;
    icon?: (color: string) => ReactNode;
  }[];
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.shell,
        { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
      ]}
    >
      {items.map((item) => {
        const selected = value === item.value;
        const color = selected ? "#FFFFFF" : theme.muted;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.value)}
            style={styles.item}
          >
            {selected && (
              <LinearGradient
                colors={brandPalette.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 11 }]}
              />
            )}
            {item.icon?.(color)}
            <AppText style={[styles.label, { color }]}>{item.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderRadius: 15,
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
});
