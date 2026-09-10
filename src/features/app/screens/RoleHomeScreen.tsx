import type { ReactNode } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Building2, CarFront, LogOut, Search, ShieldCheck, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "@/features/auth/services/authSession";
import type { AuthUser, UserRole } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function RoleHomeScreen({ role, user, onPrimary, onSecondary }: { role: UserRole | null; user: AuthUser; onPrimary?: () => void; onSecondary?: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isCustomer = role === "Customer";
  const isOwner = role === "Owner";
  const Icon = isCustomer ? Search : isOwner ? CarFront : ShieldCheck;
  const title = isCustomer ? "Khám phá xe phù hợp" : isOwner ? "Không gian chủ xe" : "Chào mừng đến MoveVN";
  const description = isCustomer ? "Tìm và đặt xe cho hành trình tiếp theo của bạn." : isOwner ? "Quản lý xe và hoạt động cho thuê của bạn." : "Tài khoản của bạn đã đăng nhập thành công.";
  return <SafeAreaView style={styles.safe}>
    <View style={styles.content}>
      <View style={styles.header}><View style={styles.avatar}><UserRound color={theme.brand} size={24} /></View><View><Text style={styles.eyebrow}>{role ?? "Tài khoản"}</Text><Text style={styles.name}>{user.fullName}</Text></View></View>
      <View style={styles.hero}><View style={styles.heroIcon}><Icon color={theme.onBrand} size={31} /></View><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>
      {isCustomer ? <View style={styles.actions}><Action label="Tìm xe" icon={<Search color={theme.onBrand} size={19} />} onPress={onPrimary} /><Action label="Chuyến đi của tôi" icon={<CarFront color={theme.brand} size={19} />} onPress={onSecondary} secondary /></View> : null}
      {isOwner ? <View style={styles.actions}><Action label="Quản lý xe" icon={<CarFront color={theme.onBrand} size={19} />} onPress={onPrimary} /><Action label="Hồ sơ chủ xe" icon={<Building2 color={theme.brand} size={19} />} onPress={onSecondary} secondary /></View> : null}
      <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.logout}><LogOut color={theme.muted} size={18} /><Text style={styles.logoutText}>Đăng xuất</Text></Pressable>
    </View>
  </SafeAreaView>;
}

function Action({ label, icon, onPress, secondary = false }: { label: string; icon: ReactNode; onPress?: () => void; secondary?: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><>{icon}</><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background }, content: { flex: 1, padding: 24, gap: 28 }, header: { flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" }, eyebrow: { color: theme.muted, fontSize: 12, fontWeight: "700" }, name: { color: theme.text, fontSize: 18, fontWeight: "800", marginTop: 2 }, hero: { paddingTop: 42, alignItems: "center", gap: 12 }, heroIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center" }, title: { color: theme.text, fontSize: 27, lineHeight: 35, fontWeight: "800", textAlign: "center" }, description: { color: theme.muted, fontSize: 15, lineHeight: 23, fontWeight: "500", textAlign: "center", maxWidth: 310 }, actions: { gap: 12 }, action: { minHeight: 54, borderRadius: 12, backgroundColor: theme.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, actionSecondary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, actionText: { color: theme.onBrand, fontSize: 16, fontWeight: "700" }, actionTextSecondary: { color: theme.brand }, logout: { marginTop: "auto", minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, logoutText: { color: theme.muted, fontSize: 14, fontWeight: "700" },
});
