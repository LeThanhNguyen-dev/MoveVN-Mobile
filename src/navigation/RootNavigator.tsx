import { useCallback, useEffect, useMemo, useState } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
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
import ToastHost from "@/features/notifications/components/ToastHost";
import AppDialogHost from "@/components/appDialog/AppDialogHost";
import NotificationCenter from "@/features/notifications/components/NotificationCenter";
import { usePushNotifications } from "@/features/notifications/usePushNotifications";
import { usePushNavigation } from "@/features/notifications/pushNavigation";
import SupportTicketCenter from "@/features/supportTickets/SupportTicketCenter";
import AvailabilityAlertCenter from "@/features/availabilityAlerts/AvailabilityAlertCenter";
import ViolationCenter from "@/features/violations/ViolationCenter";
import type { UserRole } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { initializeLanguage, useLanguageStore } from "@/theme/useLanguageStore";
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
  usePushNotifications();
  useChatConnection();
  useFavoriteSession();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activeRole = useAuthStore((state) => state.activeRole);
  const hydrated = useAuthStore((state) => state.isHydrated);
  const pendingPush = usePushNavigation(state => state.pending);
  useEffect(() => {
    if (pendingPush && user?.userId === pendingPush.userId && user.roles.includes(pendingPush.roleTarget) && activeRole !== pendingPush.roleTarget) {
      void useAuthStore.getState().setActiveRole(pendingPush.roleTarget);
    }
  }, [pendingPush, user, activeRole]);
  const [startupFailed, setStartupFailed] = useState(false);
  const { t } = useTranslation("app");
  const languageHydrated = useLanguageStore((state) => state.isHydrated);
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
    setStartupFailed(false);
    void restoreSession().catch(() => setStartupFailed(true));
  }, []);

  useEffect(() => {
    void initializeTheme();
    void initializeLanguage();
    retryStartup();
  }, [retryStartup]);

  if (startupFailed) return <Startup label={t("startup.sessionError")} onRetry={retryStartup} />;
  if (!hydrated || !languageHydrated) return <Startup label={t("startup.opening")} />;

  const role = user ? getActiveLandingRole(user.roles, activeRole) : null;
  return <NavigationContainer theme={navTheme}>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    {!token || !user ? <AuthNavigator />
      : role === "Customer" ? <CustomerNavigator key={`customer-${user.userId}`} user={user} />
        : role === "Owner" ? <OwnerNavigator key={`owner-${user.userId}`} user={user} />
          : <RoleNotSupportedScreen role={role ?? "Staff"} />}
    {token && user ? <NotificationCenter key={user.userId} userId={user.userId} /> : null}
    {token && user ? <SupportTicketCenter key={`support-${user.userId}`} userId={user.userId} /> : null}
    {token && user ? <AvailabilityAlertCenter key={`availability-${user.userId}`} userId={user.userId} /> : null}
    {token && user ? <ViolationCenter key={`violations-${user.userId}`} userId={user.userId} /> : null}
    <ToastHost />
    <AppDialogHost />
  </NavigationContainer>;
}

function Startup({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const { theme } = useTheme();
  const { t } = useTranslation("app");
  const styles = createStyles(theme);
  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    {!onRetry && <ActivityIndicator color={theme.brand} size="large" />}
    <AppText accessibilityRole={onRetry ? "alert" : undefined} style={styles.label}>{label}</AppText>
    {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><AppText style={styles.retryLabel}>{t("startup.retry")}</AppText></Pressable>}
  </View></SafeAreaView>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  label: { color: theme.muted, fontSize: 15, fontWeight: "600" },
  retry: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.brand },
  retryLabel: { color: theme.surface, fontSize: 15, fontWeight: "600" },
});
