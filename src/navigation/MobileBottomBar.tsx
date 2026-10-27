import type { ComponentType } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type TabIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

export type MobileTabItem<T extends string> = {
  key: T;
  label: string;
  icon: TabIcon;
  prominent?: boolean;
  badge?: number;
};

export default function MobileBottomBar<T extends string>({
  activeKey,
  items,
  onChange,
}: {
  activeKey: T;
  items: MobileTabItem<T>[];
  onChange: (key: T) => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.shell, { paddingBottom: bottomPadding }]}>
      <View style={styles.bar}>
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          const color = active ? theme.brand : theme.muted;

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label}${item.badge ? `, ${item.badge} chưa đọc` : ""}`}
              key={item.key}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.65 }]}
            >
              <View style={[styles.iconWrap, active && { backgroundColor: theme.brandSoft }]}>
                <Icon color={color} size={22} strokeWidth={active ? 2.4 : 1.9} />
                {item.badge && item.badge > 0 ? <View style={{ position: "absolute", top: -4, right: -8, minWidth: 18, paddingHorizontal: 4, borderRadius: 10, backgroundColor: theme.brand }}><AppText style={{ color: theme.onBrand, fontSize: 10, fontWeight: "700", textAlign: "center" }}>{item.badge > 99 ? "99+" : item.badge}</AppText></View> : null}
              </View>
              <AppText numberOfLines={2} style={[styles.label, active && styles.activeLabel]}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  shell: {
    backgroundColor: theme.barBg,
    borderTopWidth: 1,
    borderTopColor: theme.barBorder,
    paddingHorizontal: 8,
    paddingTop: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 4,
  },
  bar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 5,
    paddingTop: 0,
    borderRadius: 0,
    backgroundColor: theme.barBg,
  },
  item: {
    width: "20%",
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconWrap: {
    width: 48,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: theme.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    maxWidth: 76,
    textAlign: "center",
  },
  activeLabel: {
    color: theme.brand,
  },
});
