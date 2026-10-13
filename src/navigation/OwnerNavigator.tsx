import { useState } from "react";
import { CalendarCheck, CarFront, LayoutDashboard, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import BookingsTabScreen from "@/features/booking/screens/BookingsTabScreen";
import OwnerOverviewScreen from "@/features/app/screens/OwnerOverviewScreen";
import OwnerVehiclesScreen from "@/features/app/screens/OwnerVehiclesScreen";
import AssistantFab from "@/features/assistant/components/AssistantFab";
import TabPlaceholderScreen from "@/features/app/screens/TabPlaceholderScreen";
import UserProfileScreen from "@/features/app/screens/UserProfileScreen";
import type { AuthUser } from "@/features/auth/types";
import MobileBottomBar, { type MobileTabItem } from "./MobileBottomBar";
import { useTheme } from "@/theme/useTheme";

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
  const [showProfile, setShowProfile] = useState(false);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {showProfile ? (
        <UserProfileScreen onBack={() => setShowProfile(false)} user={user} />
      ) : (
        <>
          <View style={styles.screen}>
            {activeTab === "overview" ? (
              <OwnerOverviewScreen onAvatarPress={() => setShowProfile(true)} user={user} />
            ) : activeTab === "bookings" ? (
              <BookingsTabScreen role="Owner" onDetailChange={setBookingDetailOpen} />
            ) : activeTab === "vehicles" ? (
              <OwnerVehiclesScreen />
            ) : activeTab === "messages" ? (
              <TabPlaceholderScreen
                description="Tin nhắn với khách thuê và đội hỗ trợ sẽ hiển thị ở đây."
                icon={MessageSquare}
                title="Tin nhắn"
              />
            ) : (
              <AccountTabScreen onProfilePress={() => setShowProfile(true)} user={user} />
            )}
          </View>
          {!bookingDetailOpen ? <MobileBottomBar activeKey={activeTab} items={ownerTabs} onChange={setActiveTab} /> : null}
          {/* ChatbotAI (không booking) cho chủ xe */}
          <AssistantFab />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screen: { flex: 1 },
});
