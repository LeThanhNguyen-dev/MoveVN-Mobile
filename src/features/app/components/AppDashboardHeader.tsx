import { ArrowLeftRight, Bell, Heart, UserRound } from "lucide-react-native";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import type { AuthUser, UserRole } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const roleLabels: Record<UserRole, string> = {
  Admin: "quản trị",
  Staff: "nhân viên",
  Owner: "chủ xe",
  Customer: "khách thuê",
};

export default function AppDashboardHeader({ onAvatarPress, user }: { onAvatarPress?: () => void; user: AuthUser }) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const setActiveRole = useAuthStore((state) => state.setActiveRole);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const switchableRole = activeRole === "Customer" && user.roles.includes("Owner")
    ? "Owner"
    : activeRole === "Owner" && user.roles.includes("Customer")
      ? "Customer"
      : null;

  function handleSwitchRole() {
    if (!switchableRole) return;
    void setActiveRole(switchableRole);
  }

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Pressable
          accessibilityLabel="Xem thông tin tài khoản"
          accessibilityRole="button"
          onPress={onAvatarPress}
          style={styles.avatar}
        >
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <UserRound color={theme.brand} size={24} />
          )}
        </Pressable>
        <View style={styles.nameBlock}>
          <Text style={styles.greeting}>Xin chào</Text>
          <Text numberOfLines={1} style={styles.name}>
            {user.fullName}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {switchableRole ? (
          <>
            <Pressable
              accessibilityLabel={`Chuyển sang ${roleLabels[switchableRole]}`}
              accessibilityRole="button"
              onPress={handleSwitchRole}
              style={styles.iconButton}
            >
              <ArrowLeftRight color={theme.text} size={21} strokeWidth={2.3} />
            </Pressable>
            <View style={styles.divider} />
          </>
        ) : null}
        <Pressable accessibilityLabel="Xe yêu thích" accessibilityRole="button" style={styles.iconButton}>
          <Heart color={theme.text} size={21} strokeWidth={2.3} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable accessibilityLabel="Thông báo" accessibilityRole="button" style={styles.iconButton}>
          <Bell color={theme.text} size={21} strokeWidth={2.3} />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  identity: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  nameBlock: {
    minWidth: 0,
    flex: 1,
  },
  greeting: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  name: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  actions: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconButton: {
    width: 34,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: theme.border,
  },
  notificationDot: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.danger,
    borderColor: theme.onBrand,
    borderWidth: 1,
  },
});
