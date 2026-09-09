import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

export type MobileTabItem<T extends string> = {
  key: T;
  label: string;
  icon: TabIcon;
  prominent?: boolean;
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

  return (
    <View style={[styles.shell, { paddingBottom: bottomPadding + 8 }]}>
      <View style={styles.bar}>
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          const color = item.prominent || active ? "#6B19FF" : "#746F7E";

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => onChange(item.key)}
              style={[styles.item, item.prominent && styles.prominentItem]}
            >
              <View style={[styles.iconWrap, item.prominent && styles.prominentIconWrap]}>
                <Icon color={color} size={item.prominent ? 25 : 22} strokeWidth={item.prominent ? 2.6 : 2.3} />
              </View>
              <Text numberOfLines={1} style={[styles.label, active && styles.activeLabel, item.prominent && styles.prominentLabel]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "transparent",
    paddingHorizontal: 18,
    paddingTop: 6,
    shadowColor: "#25123D",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  bar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 5,
    paddingTop: 6,
    borderRadius: 22,
    borderWidth: 0.7,
    borderColor: "rgba(232, 225, 242, 0.82)",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  item: {
    width: "20%",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  prominentItem: {
    marginTop: -14,
  },
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  prominentIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderColor: "#6B19FF",
    borderWidth: 1,
    shadowColor: "#6B19FF",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  label: {
    color: "#746F7E",
    fontSize: 9.5,
    fontWeight: "700",
    maxWidth: 76,
    textAlign: "center",
  },
  activeLabel: {
    color: "#6B19FF",
  },
  prominentLabel: {
    color: "#6B19FF",
    fontSize: 10.5,
    marginTop: 1,
  },
});
