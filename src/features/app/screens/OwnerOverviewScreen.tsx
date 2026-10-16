import { LayoutDashboard } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function OwnerOverviewScreen({ onAvatarPress, onBellPress, user }: { onAvatarPress?: () => void; onBellPress?: () => void; user: AuthUser }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.content}>
      <AppDashboardHeader onAvatarPress={onAvatarPress} user={user} />

      <View style={styles.placeholder}>
        <View style={styles.iconWrap}>
          <LayoutDashboard color={theme.brand} size={30} strokeWidth={2.4} />
        </View>
        <AppText display style={styles.title}>Tổng quan</AppText>
        <AppText style={styles.description}>Thống kê doanh thu, đơn thuê và hiệu suất xe sẽ hiển thị ở đây.</AppText>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 44,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.brandSoft,
  },
  title: {
    color: theme.text,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: theme.muted,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 23,
    maxWidth: 305,
    textAlign: "center",
  },
});
