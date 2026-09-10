import { LayoutDashboard } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";

export default function OwnerOverviewScreen({ onAvatarPress, user }: { onAvatarPress?: () => void; user: AuthUser }) {
  return (
    <View style={styles.content}>
      <AppDashboardHeader onAvatarPress={onAvatarPress} user={user} />

      <View style={styles.placeholder}>
        <View style={styles.iconWrap}>
          <LayoutDashboard color="#6B19FF" size={30} strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>Tổng quan</Text>
        <Text style={styles.description}>Thống kê doanh thu, đơn thuê và hiệu suất xe sẽ hiển thị ở đây.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#F1E7FF",
  },
  title: {
    color: "#101936",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: "#746F7E",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 23,
    maxWidth: 305,
    textAlign: "center",
  },
});
