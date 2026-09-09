import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthNavigator from "./AuthNavigator";
import CustomerNavigator from "./CustomerNavigator";
import OwnerNavigator from "./OwnerNavigator";
import RoleHomeScreen from "@/features/app/screens/RoleHomeScreen";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { restoreSession } from "@/features/auth/services/authSession";
import type { UserRole } from "@/features/auth/types";

function getLandingRole(roles: UserRole[]): UserRole | null {
  return ["Admin", "Staff", "Owner", "Customer"].find((role) => roles.includes(role as UserRole)) as UserRole | null;
}

export default function RootNavigator() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.isHydrated);
  const [startupError, setStartupError] = useState("");

  useEffect(() => { void restoreSession().catch(() => setStartupError("Chưa thể kiểm tra phiên đăng nhập.")); }, []);

  if (!hydrated) return <Startup label="Đang mở MoveVN..." />;
  if (startupError && token) return <Startup label={startupError} />;

  const role = user ? getLandingRole(user.roles) : null;
  return <NavigationContainer>
    {!token || !user ? <AuthNavigator />
      : role === "Customer" ? <CustomerNavigator user={user} />
        : role === "Owner" ? <OwnerNavigator user={user} />
          : <RoleHomeScreen role={role} user={user} />}
  </NavigationContainer>;
}

function Startup({ label }: { label: string }) {
  return <SafeAreaView style={styles.safe}><View style={styles.content}><ActivityIndicator color="#6B19FF" size="large" /><Text style={styles.label}>{label}</Text></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF6FF" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  label: { color: "#746F7E", fontSize: 15, fontWeight: "600" },
});
