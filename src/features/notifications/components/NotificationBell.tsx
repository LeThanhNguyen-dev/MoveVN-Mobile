import { Bell } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { useNotificationStore } from "../useNotifications";

export default function NotificationBell() {
  const { theme } = useTheme();
  const userId = useAuthStore((state) => state.user?.userId);
  const count = useNotificationStore((state) => state.userId === userId ? state.unreadCount : 0);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo"}
    onPress={() => useNotificationStore.setState({ centerOpen: true })}
    style={styles.button}
  >
    <Bell color={theme.text} size={22} strokeWidth={2.2} />
    {count > 0 ? <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.surface }]}>
      <AppText style={[styles.count, { color: theme.onBrand }]}>{count > 99 ? "99+" : count}</AppText>
    </View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 0, right: 0, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  count: { fontSize: 10, fontWeight: "800" },
});
