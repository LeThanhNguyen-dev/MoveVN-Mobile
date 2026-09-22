import { useMemo, useState } from "react";
import { LogOut, ScanLine, ShieldCheck, UserRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OcrTestScreen from "@/features/admin/screens/OcrTestScreen";
import { signOut } from "@/features/auth/services/authSession";
import type { AuthUser, UserRole } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const roleLabels: Record<UserRole, string> = {
  Admin: "Quản trị viên",
  Staff: "Nhân viên",
  Owner: "Chủ xe",
  Customer: "Khách hàng",
};

export default function AdminHomeScreen({ role, user }: { role: UserRole | null; user: AuthUser }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showOcrTest, setShowOcrTest] = useState(false);
  const isAdmin = user.roles.includes("Admin");

  if (showOcrTest) {
    return <OcrTestScreen user={user} onBack={() => setShowOcrTest(false)} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <UserRound color={theme.brand} size={24} />
          </View>
          <View>
            <Text style={styles.eyebrow}>{role ? roleLabels[role] : "Tài khoản"}</Text>
            <Text style={styles.name}>{user.fullName}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ShieldCheck color={theme.onBrand} size={31} />
          </View>
          <Text style={styles.title}>Khu vực vận hành</Text>
          <Text style={styles.description}>
            Chạy thử OCR CCCD, GPLX và cavet mà không ảnh hưởng dữ liệu người dùng.
          </Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => setShowOcrTest(true)} style={styles.action}>
          <ScanLine color={theme.onBrand} size={19} />
          <Text style={styles.actionText}>Kiểm tra OCR</Text>
        </Pressable>
        {!isAdmin ? (
          <Text style={styles.hint}>Tài khoản Staff chỉ kiểm tra được CCCD và GPLX (Cavet cần quyền Admin).</Text>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.logout}>
          <LogOut color={theme.muted} size={18} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1, padding: 24, gap: 20 },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    name: { color: theme.text, fontSize: 18, fontWeight: "800", marginTop: 2 },
    hero: { paddingTop: 24, alignItems: "center", gap: 12 },
    heroIcon: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: theme.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
    description: { color: theme.muted, fontSize: 14, lineHeight: 21, fontWeight: "500", textAlign: "center", maxWidth: 320 },
    action: {
      minHeight: 54,
      borderRadius: 12,
      backgroundColor: theme.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    actionText: { color: theme.onBrand, fontSize: 16, fontWeight: "700" },
    hint: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "500" },
    logout: { marginTop: "auto", minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
    logoutText: { color: theme.muted, fontSize: 14, fontWeight: "700" },
  });
