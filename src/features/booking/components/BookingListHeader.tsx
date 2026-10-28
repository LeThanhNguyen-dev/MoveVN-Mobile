import { CalendarCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";

export default function BookingListHeader({
  title,
  count,
}: {
  title: string;
  count: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.surface, borderColor: theme.divider },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.brandSoft }]}>
        <CalendarCheck color={theme.brand} size={20} />
      </View>
      <AppText
        display
        style={{ flex: 1, color: theme.text, fontSize: 19, fontWeight: "700" }}
      >
        {title}
      </AppText>
      <View style={[styles.count, { backgroundColor: theme.brandSoft }]}>
        <AppText
          accessibilityLiveRegion="polite"
          style={{ color: theme.brand, fontSize: 11, fontWeight: "600" }}
        >
          {count}
        </AppText>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  count: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
});
