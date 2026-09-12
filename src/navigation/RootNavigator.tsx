import { useEffect, useMemo, useState } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthNavigator from "./AuthNavigator";
import CustomerNavigator from "./CustomerNavigator";
import OwnerNavigator from "./OwnerNavigator";
import RoleHomeScreen from "@/features/app/screens/RoleHomeScreen";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { restoreSession } from "@/features/auth/services/authSession";
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

  useEffect(() => {
    void initializeTheme();
    void restoreSession().catch(() => setStartupError("Chưa thể kiểm tra phiên đăng nhập."));
  }, []);

  if (!hydrated) return <Startup label="Đang mở MoveVN..." />;
  if (startupError && token) return <Startup label={startupError} />;

  const role = user ? getActiveLandingRole(user.roles, activeRole) : null;
  return <NavigationContainer theme={navTheme}>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    {!token || !user ? <AuthNavigator />
      : role === "Customer" ? <CustomerNavigator user={user} />
        : role === "Owner" ? <OwnerNavigator user={user} />
          : <RoleHomeScreen role={role} user={user} />}
  </NavigationContainer>;
}

function Startup({ label }: { label: string }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return <SafeAreaView style={styles.safe}><View style={styles.content}><ActivityIndicator color={theme.brand} size="large" /><Text style={styles.label}>{label}</Text></View></SafeAreaView>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  label: { color: theme.muted, fontSize: 15, fontWeight: "600" },
});
