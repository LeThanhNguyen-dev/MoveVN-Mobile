import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Building2, CarFront, LogOut, Search, ShieldCheck, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "@/features/auth/services/authSession";
import type { AuthUser, UserRole } from "@/features/auth/types";

export default function RoleHomeScreen({ role, user, onPrimary, onSecondary }: { role: UserRole | null; user: AuthUser; onPrimary?: () => void; onSecondary?: () => void }) {
  const isCustomer = role === "Customer";
  const isOwner = role === "Owner";
  const Icon = isCustomer ? Search : isOwner ? CarFront : ShieldCheck;
  const title = isCustomer ? "Khám phá xe phù hợp" : isOwner ? "Không gian chủ xe" : "Chào mừng đến MoveVN";
  const description = isCustomer ? "Tìm và đặt xe cho hành trình tiếp theo của bạn." : isOwner ? "Quản lý xe và hoạt động cho thuê của bạn." : "Tài khoản của bạn đã đăng nhập thành công.";
  return <SafeAreaView style={styles.safe}>
    <View style={styles.content}>
      <View style={styles.header}><View style={styles.avatar}><UserRound color="#6B19FF" size={24} /></View><View><Text style={styles.eyebrow}>{role ?? "Tài khoản"}</Text><Text style={styles.name}>{user.fullName}</Text></View></View>
      <View style={styles.hero}><View style={styles.heroIcon}><Icon color="#FFFFFF" size={31} /></View><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>
      {isCustomer ? <View style={styles.actions}><Action label="Tìm xe" icon={<Search color="#FFFFFF" size={19} />} onPress={onPrimary} /><Action label="Chuyến đi của tôi" icon={<CarFront color="#6B19FF" size={19} />} onPress={onSecondary} secondary /></View> : null}
      {isOwner ? <View style={styles.actions}><Action label="Quản lý xe" icon={<CarFront color="#FFFFFF" size={19} />} onPress={onPrimary} /><Action label="Hồ sơ chủ xe" icon={<Building2 color="#6B19FF" size={19} />} onPress={onSecondary} secondary /></View> : null}
      <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.logout}><LogOut color="#746F7E" size={18} /><Text style={styles.logoutText}>Đăng xuất</Text></Pressable>
    </View>
  </SafeAreaView>;
}

function Action({ label, icon, onPress, secondary = false }: { label: string; icon: ReactNode; onPress?: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><>{icon}</><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF6FF" }, content: { flex: 1, padding: 24, gap: 28 }, header: { flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F1E7FF", alignItems: "center", justifyContent: "center" }, eyebrow: { color: "#746F7E", fontSize: 12, fontWeight: "700" }, name: { color: "#101936", fontSize: 18, fontWeight: "800", marginTop: 2 }, hero: { paddingTop: 42, alignItems: "center", gap: 12 }, heroIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#6B19FF", alignItems: "center", justifyContent: "center" }, title: { color: "#101936", fontSize: 27, lineHeight: 35, fontWeight: "800", textAlign: "center" }, description: { color: "#746F7E", fontSize: 15, lineHeight: 23, fontWeight: "500", textAlign: "center", maxWidth: 310 }, actions: { gap: 12 }, action: { minHeight: 54, borderRadius: 12, backgroundColor: "#6B19FF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, actionSecondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDD4EA" }, actionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" }, actionTextSecondary: { color: "#6B19FF" }, logout: { marginTop: "auto", minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, logoutText: { color: "#746F7E", fontSize: 14, fontWeight: "700" },
});
