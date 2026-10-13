import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { clearSession, useAuthStore } from "@/features/auth/hooks/useAuth";
import type { UserRole } from "@/features/auth/types";
import NotificationBell from "@/features/notifications/components/NotificationBell";

export default function RoleNotSupportedScreen({ role }: { role: UserRole }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((s) => s.user);

  return (
    <View style={styles.screen}>
      <ShieldAlert color={theme.brand} size={48} />
      <Text style={styles.title}>Vai trò chưa hỗ trợ trên app</Text>
      <Text style={styles.muted}>
        Tài khoản {user?.email ?? ""} có quyền {role}. Ứng dụng di động hiện chỉ phục vụ Khách thuê và
        Chủ xe — vui lòng dùng bản web để tiếp tục.
      </Text>
      <View style={styles.notifications}>
        <Text style={styles.muted}>Thông báo của bạn</Text>
        <NotificationBell />
      </View>
      <Pressable onPress={() => clearSession()} style={styles.button}>
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
    title: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    muted: { color: theme.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
    notifications: { flexDirection: "row", alignItems: "center", gap: 12 },
    button: { marginTop: 8, borderRadius: 12, backgroundColor: theme.brand, paddingHorizontal: 24, paddingVertical: 12 },
    buttonText: { color: theme.onBrand, fontSize: 15, fontWeight: "800" },
  });
