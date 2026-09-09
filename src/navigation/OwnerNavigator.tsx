import { useState } from "react";
import { CalendarCheck, CarFront, LayoutDashboard, LogOut, MessageSquare, UserRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OwnerOverviewScreen from "@/features/app/screens/OwnerOverviewScreen";
import OwnerVehiclesScreen from "@/features/app/screens/OwnerVehiclesScreen";
import TabPlaceholderScreen from "@/features/app/screens/TabPlaceholderScreen";
import { signOut } from "@/features/auth/services/authSession";
import type { AuthUser } from "@/features/auth/types";
import MobileBottomBar, { type MobileTabItem } from "./MobileBottomBar";

type OwnerTabKey = "vehicles" | "bookings" | "overview" | "messages" | "account";

const ownerTabs: MobileTabItem<OwnerTabKey>[] = [
  { key: "vehicles", label: "Xe của tôi", icon: CarFront },
  { key: "bookings", label: "Đơn thuê", icon: CalendarCheck },
  { key: "overview", label: "Tổng quan", icon: LayoutDashboard, prominent: true },
  { key: "messages", label: "Tin nhắn", icon: MessageSquare },
  { key: "account", label: "Tài khoản", icon: UserRound },
];

export default function OwnerNavigator({ user }: { user: AuthUser }) {
  const [activeTab, setActiveTab] = useState<OwnerTabKey>("overview");

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.screen}>
        {activeTab === "overview" ? (
          <OwnerOverviewScreen user={user} />
        ) : activeTab === "bookings" ? (
          <TabPlaceholderScreen description="Yêu cầu thuê, lịch bàn giao và trạng thái hoàn tất chuyến sẽ hiển thị ở đây." icon={CalendarCheck} title="Đơn thuê" />
        ) : activeTab === "vehicles" ? (
          <OwnerVehiclesScreen />
        ) : activeTab === "messages" ? (
          <TabPlaceholderScreen description="Tin nhắn với khách thuê và đội hỗ trợ sẽ hiển thị ở đây." icon={MessageSquare} title="Tin nhắn" />
        ) : (
          <TabPlaceholderScreen
            description="Hồ sơ chủ xe, ví tiền, tài khoản ngân hàng, khuyến mãi, tranh chấp và bảo mật sẽ nằm ở đây."
            footer={<LogoutButton />}
            icon={UserRound}
            title="Tài khoản"
          />
        )}
      </View>
      <MobileBottomBar activeKey={activeTab} items={ownerTabs} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

function LogoutButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.logoutButton}>
      <LogOut color="#FFFFFF" size={18} strokeWidth={2.3} />
      <Text style={styles.logoutText}>Đăng xuất</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF6FF" },
  screen: { flex: 1 },
  logoutButton: {
    minHeight: 46,
    minWidth: 156,
    borderRadius: 23,
    backgroundColor: "#6B19FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
