import { Pressable, ScrollView, StyleSheet } from "react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import { BOOKING_STATUS_FILTERS } from "../constants";

export default function BookingStatusFilters({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.items}
    >
      {BOOKING_STATUS_FILTERS.map((item) => {
        const selected = value === item.key;
        return (
          <Pressable
            key={item.key || "all"}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.key)}
            style={[
              styles.item,
              {
                backgroundColor: selected ? theme.brandSoft : theme.surface,
                borderColor: selected ? theme.brandBorder : theme.border,
              },
            ]}
          >
            <AppText
              style={{
                color: selected ? theme.brand : theme.muted,
                fontSize: 12,
                fontWeight: selected ? "700" : "500",
              }}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  items: { gap: 6, paddingVertical: 2 },
  item: {
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
});
