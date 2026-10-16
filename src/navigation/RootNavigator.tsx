import { useCallback, useEffect, useMemo, useState } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthNavigator from "./AuthNavigator";
import CustomerNavigator from "./CustomerNavigator";
import OwnerNavigator from "./OwnerNavigator";
import RoleNotSupportedScreen from "@/features/app/screens/RoleNotSupportedScreen";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { restoreSession } from "@/features/auth/services/authSession";
import { usePresenceConnection } from "@/features/presence/usePresenceConnection";
import { useNotificationConnection } from "@/features/notifications/useNotificationConnection";
import { useChatConnection } from "@/features/chat/useChatConnection";
import { useFavoriteSession } from "@/features/favorites/useFavoriteSession";
import NotificationCenter from "@/features/notifications/components/NotificationCenter";
import type { UserRole } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { initializeTheme } from "@/theme/useThemeStore";
import { useTheme } from "@/theme/useTheme";

function getLandingRole(roles: UserRole[]): UserRole | null {
  return ["Admin", "Staff", "Owner", "Customer"].find((role) => roles.includes(role as UserRole)) as UserRole | null;
}

function getActiveLandingRole(roles: UserRole[], activeRole: UserRole | null): UserRole | null {
  return activeRole && roles.includes(activeRole) ? activeRole : getLandingRole(roles);
}

export default function RootNavigator() {
  usePresenceConnection();
  useNotificationConnection();
  useChatConnection();
  useFavoriteSession();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activeRole = useAuthStore((state) => state.activeRole);
  const hydrated = useAuthStore((state) => state.isHydrated);
  const [startupError, setStartupError] = useState("");
  const { mode, theme } = useTheme();

  const navTheme: NavTheme = useMemo(() => {
    const base = mode === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.brand,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
      },
    };
  }, [mode, theme]);

  const retryStartup = useCallback(() => {
    setStartupError("");
    void restoreSession().catch(() => setStartupError("Chưa thể kiểm tra phiên đăng nhập. Hãy kiểm tra kết nối và thử lại."));
  }, []);

  useEffect(() => {
    void initializeTheme();
    retryStartup();
  }, [retryStartup]);

  if (startupError) return <Startup label={startupError} onRetry={retryStartup} />;
  if (!hydrated) return <Startup label="Đang mở MoveVN..." />;

  const role = user ? getActiveLandingRole(user.roles, activeRole) : null;
  return <NavigationContainer theme={navTheme}>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    {!token || !user ? <AuthNavigator />
      : role === "Customer" ? <CustomerNavigator key={`customer-${user.userId}`} user={user} />
        : role === "Owner" ? <OwnerNavigator key={`owner-${user.userId}`} user={user} />
          : <RoleNotSupportedScreen role={role ?? "Staff"} />}
    {token && user ? <NotificationCenter key={user.userId} userId={user.userId} /> : null}
  </NavigationContainer>;
}

function Startup({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    {!onRetry && <ActivityIndicator color={theme.brand} size="large" />}
    <Text accessibilityRole={onRetry ? "alert" : undefined} style={styles.label}>{label}</Text>
    {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryLabel}>Thử lại</Text></Pressable>}
  </View></SafeAreaView>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  label: { color: theme.muted, fontSize: 15, fontWeight: "600" },
  retry: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.brand },
  retryLabel: { color: theme.surface, fontSize: 15, fontWeight: "600" },
});
